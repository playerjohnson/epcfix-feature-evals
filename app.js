// EPCFix Feature Evals — runs entirely in your browser.
// Sibling of epcfix-evals-static, swapped to score feature ideas against
// landlord personas using a product-fit rubric.

import { personas } from "./personas.js";
import { variants } from "./variants.js";

/* -------------------------------------------------------------------------- */
/*                                   State                                    */
/* -------------------------------------------------------------------------- */

const state = {
  provider: localStorage.getItem("epcfix-feat-provider") || "dry",
  apiKey: localStorage.getItem("epcfix-feat-key") || "",
  concurrency: Number(localStorage.getItem("epcfix-feat-conc") || 3),
  results: JSON.parse(localStorage.getItem("epcfix-feat-results") || "null"),
  running: false,
  progress: { done: 0, total: 0 },
  lastRunAt: localStorage.getItem("epcfix-feat-lastrun") || null,
};

/* -------------------------------------------------------------------------- */
/*                                Judge prompt                                */
/* -------------------------------------------------------------------------- */

function buildJudgePrompt(persona, variant) {
  return `You are a product reviewer scoring a SaaS feature idea against a specific buyer persona.
Be honest and discriminating — use the full 1–10 range. Anchor: 5 = neutral, mediocre fit; 8 = strong, clearly worth shipping for this persona; 10 = exceptional, would meaningfully change their relationship with the product.

PERSONA: ${persona.name}
${persona.oneLiner}
Portfolio: ${persona.portfolio}
Top fears: ${persona.topFears.join(" / ")}
Top goals: ${persona.topGoals.join(" / ")}
Tone preference: ${persona.tonePreference}
Jargon tolerance: ${persona.jargonTolerance}
Receptiveness to ROI/payback framing: ${persona.paybackAppeal}

FEATURE IDEA:
Name: ${variant.name}
Pitch: ${variant.pitch}
What it does: ${variant.description}
Stated primary audience: ${variant.primaryFor}
Estimated build effort: ${variant.effort}

Score this feature against THIS persona specifically (not landlords in general):

- pain_match (1-10): how directly does it hit THIS persona's stated fears or goals?
- frequency (1-10): how often would THIS persona actually use it? 10=weekly+, 7=monthly, 4=quarterly, 1=once or never.
- willingness_to_pay (1-10): would THIS persona pay extra specifically for this feature? 10=yes demonstrably, 5=neutral, 1=expects it free.
- switch_trigger (1-10): would this alone trigger THIS persona to switch from a competitor / DIY / spreadsheet to EPCFix? 10=decisive, 1=no impact.
- effort_value (1-10): given the stated build effort (${variant.effort}), is the per-persona value worth shipping for THIS persona alone? 10=clear yes, 1=no.

Respond with ONLY a single JSON object, no prose before or after:
{
  "pain_match": <integer 1-10>,
  "frequency": <integer 1-10>,
  "willingness_to_pay": <integer 1-10>,
  "switch_trigger": <integer 1-10>,
  "effort_value": <integer 1-10>,
  "reasoning": "<2-4 sentences calling out the single biggest fit AND single biggest friction for THIS persona>"
}`;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return JSON.parse(fenced[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(first, last + 1));
}

function normaliseScores(parsed) {
  return {
    painMatch: parsed.pain_match,
    frequency: parsed.frequency,
    willingnessToPay: parsed.willingness_to_pay,
    switchTrigger: parsed.switch_trigger,
    effortValue: parsed.effort_value,
    reasoning: parsed.reasoning,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Judge backends                                */
/* -------------------------------------------------------------------------- */

async function judgeWithGemini(persona, variant, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildJudgePrompt(persona, variant) }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return normaliseScores(extractJson(text));
}

function judgeStub(persona, variant) {
  // Dry preview: bias scores by whether the persona id appears in primaryFor
  // so the UI shows a plausible heatmap shape before you commit a real key.
  const isTarget = (variant.primaryFor || "").includes(persona.id);
  const base = isTarget ? 7 : 4;
  const jitter = () => base + ((persona.id.length + variant.id.length) % 3) - 1;
  return Promise.resolve({
    painMatch: jitter(), frequency: jitter(), willingnessToPay: jitter(),
    switchTrigger: jitter(), effortValue: jitter(),
    reasoning: `(dry preview — based purely on whether ${persona.id} is in primaryFor)`,
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Runner                                    */
/* -------------------------------------------------------------------------- */

function weighted(judgeSum) {
  // Judge max is 50 (5 dims × 10). Rescale to 0–100.
  return Math.round((judgeSum / 50) * 100);
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runEval() {
  if (state.running) return;
  state.running = true;
  setButtonsDisabled(true);

  let judge;
  try { judge = pickJudge(); }
  catch (err) { alert(err.message); state.running = false; setButtonsDisabled(false); return; }

  const pairs = variants.flatMap(v => personas.map(p => ({ variantId: v.id, personaId: p.id })));
  state.progress = { done: 0, total: pairs.length };
  renderProgress();

  try {
    const results = await mapLimit(pairs, state.concurrency, async ({ variantId, personaId }) => {
      const v = variants.find(x => x.id === variantId);
      const p = personas.find(x => x.id === personaId);

      let judgeScore;
      try { judgeScore = await judge(p, v); }
      catch (err) {
        judgeScore = {
          painMatch: 0, frequency: 0, willingnessToPay: 0,
          switchTrigger: 0, effortValue: 0,
          reasoning: `ERROR: ${err.message}`,
        };
      }

      state.progress.done++;
      renderProgress();

      const judgeSum = judgeScore.painMatch + judgeScore.frequency + judgeScore.willingnessToPay + judgeScore.switchTrigger + judgeScore.effortValue;
      return { variantId, personaId, judge: judgeScore, weightedScore: weighted(judgeSum) };
    });

    state.results = results;
    state.lastRunAt = new Date().toISOString();
    localStorage.setItem("epcfix-feat-results", JSON.stringify(results));
    localStorage.setItem("epcfix-feat-lastrun", state.lastRunAt);

    renderAll();
  } finally {
    state.running = false;
    setButtonsDisabled(false);
  }
}

function pickJudge() {
  if (state.provider === "gemini") {
    if (!state.apiKey) throw new Error("Gemini API key required — paste it above and click Save");
    return (p, v) => judgeWithGemini(p, v, state.apiKey);
  }
  return (p, v) => judgeStub(p, v);
}

/* -------------------------------------------------------------------------- */
/*                                 Renderers                                  */
/* -------------------------------------------------------------------------- */

function $(id) { return document.getElementById(id); }
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

function setButtonsDisabled(disabled) {
  $("run").disabled = disabled;
  $("save-key").disabled = disabled;
  $("clear-key").disabled = disabled;
  $("provider").disabled = disabled;
  $("apikey").disabled = disabled;
}

function renderMeta() {
  $("meta-variants").textContent = String(variants.length);
  $("meta-personas").textContent = String(personas.length);
  $("meta-calls").textContent = String(variants.length * personas.length);
  $("meta-lastrun").textContent = state.lastRunAt ? new Date(state.lastRunAt).toLocaleString("en-GB") : "never";
}

function renderProgress() {
  const { done, total } = state.progress;
  if (!total) { $("progress").textContent = ""; $("progress-fill").style.width = "0"; return; }
  $("progress").textContent = `${done}/${total}`;
  $("progress-fill").style.width = `${(done / total) * 100}%`;
}

function renderProviderNote() {
  const note = $("provider-note");
  note.innerHTML = "";
  if (state.provider === "gemini") {
    note.append(el("div", { class: "banner" },
      "Gemini 2.5 Flash free tier allows ~15 calls/min — fine for a 40-call run. Get a key at aistudio.google.com/apikey. Key is stored only in this browser's localStorage."));
  } else {
    note.append(el("div", { class: "banner" },
      "Dry preview: no LLM calls. Scores are biased by whether a persona id is listed in the feature's primaryFor, so the heatmap shape is plausible but not real. Useful for sanity-checking the UI before getting a Gemini key."));
  }
}

function renderKeyStatus() {
  const status = $("key-status");
  if (state.provider === "dry") {
    status.textContent = "not required for dry preview";
    status.className = "key-status";
  } else if (state.apiKey) {
    status.textContent = `saved locally · ${state.apiKey.slice(0, 6)}…${state.apiKey.slice(-4)}`;
    status.className = "key-status saved";
  } else {
    status.textContent = "no key set";
    status.className = "key-status";
  }
}

function effortPill(effort) {
  return el("span", { class: `pill effort-${effort}` }, effort);
}

function renderVariants() {
  const wrap = $("variants-list");
  wrap.innerHTML = "";
  for (const v of variants) {
    wrap.append(
      el("div", { class: "list-item" },
        el("div", { class: "name" }, v.name),
        el("div", { class: "pitch" }, v.pitch),
        el("div", { class: "body-copy" }, v.description),
        el("div", { class: "pill-row" },
          effortPill(v.effort),
          el("span", { class: "pill" }, `for: ${v.primaryFor}`),
        ),
      )
    );
  }
}

function renderPersonas() {
  const wrap = $("personas-list");
  wrap.innerHTML = "";
  for (const p of personas) {
    wrap.append(
      el("div", { class: "list-item" },
        el("div", { class: "name" }, p.name),
        el("div", { class: "body-copy" }, p.oneLiner),
        el("div", { class: "meta-line" }, `${p.id} · jargon ${p.jargonTolerance} · payback appeal ${p.paybackAppeal}`),
      )
    );
  }
}

function renderLeaderboard() {
  const wrap = $("leaderboard");
  wrap.innerHTML = "";
  if (!state.results) { wrap.append(el("div", { class: "empty" }, "No results yet. Run an eval above.")); return; }
  const rows = variants.map(v => {
    const rs = state.results.filter(r => r.variantId === v.id);
    const avg = Math.round(rs.reduce((s, r) => s + r.weightedScore, 0) / rs.length);
    return { v, avg };
  }).sort((a, b) => b.avg - a.avg);
  rows.forEach((row, i) => {
    wrap.append(
      el("div", { class: "leaderboard-row" },
        el("div", { class: "rank" }, String(i + 1).padStart(2, "0")),
        el("div", { class: "name" }, row.v.name),
        el("div", { class: "effort-cell" }, row.v.effort),
        el("div", { class: "score" }, String(row.avg)),
        el("div", { class: "score-bar" }, el("div", { style: `width:${row.avg}%` })),
      )
    );
  });
}

function scoreColor(score) {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const r = Math.round(246 - t * (246 - 31));
  const g = Math.round(241 - t * (241 - 93));
  const b = Math.round(231 - t * (231 - 64));
  return `rgb(${r},${g},${b})`;
}

function textColorForBg(score) {
  return score > 55 ? "white" : "var(--ink)";
}

function renderHeatmap() {
  const wrap = $("heatmap-wrap");
  wrap.innerHTML = "";
  if (!state.results) { wrap.append(el("div", { class: "empty" }, "No results yet.")); return; }

  const table = el("table", { class: "heatmap" });
  const thead = el("tr", {}, el("th", {}, "Persona"));
  variants.forEach(v => thead.append(el("th", { class: "var", title: v.name }, v.id.split("-").slice(0, 2).join("-"))));
  table.append(thead);

  personas.forEach(p => {
    const row = el("tr", {}, el("td", { class: "label" }, p.id));
    variants.forEach(v => {
      const r = state.results.find(r => r.variantId === v.id && r.personaId === p.id);
      const score = r ? r.weightedScore : 0;
      row.append(el("td", { class: "cell", style: `background:${scoreColor(score)};color:${textColorForBg(score)}` }, String(score)));
    });
    table.append(row);
  });
  wrap.append(table);
}

function renderDetails() {
  const wrap = $("details");
  wrap.innerHTML = "";
  if (!state.results) { wrap.append(el("div", { class: "card" }, el("div", { class: "empty" }, "No results yet."))); return; }

  variants.forEach(v => {
    const rs = state.results.filter(r => r.variantId === v.id);
    const card = el("div", { class: "card detail" },
      el("h3", {}, v.name),
      el("div", { class: "pitch-line" }, v.pitch),
      el("div", { class: "body-copy" }, v.description),
      el("div", { class: "pill-row" },
        effortPill(v.effort),
        el("span", { class: "pill" }, `for: ${v.primaryFor}`),
      ),
    );

    const table = el("table", { class: "scoretable" });
    table.append(el("tr", {},
      el("th", {}, "Persona"),
      el("th", { class: "num", title: "Pain match" }, "Pain"),
      el("th", { class: "num", title: "Frequency of use" }, "Freq"),
      el("th", { class: "num", title: "Willingness to pay extra" }, "Pay"),
      el("th", { class: "num", title: "Switch trigger" }, "Switch"),
      el("th", { class: "num", title: "Effort-to-value" }, "E/V"),
      el("th", { class: "num" }, "Score"),
      el("th", {}, "Reasoning"),
    ));
    personas.forEach(p => {
      const r = rs.find(x => x.personaId === p.id);
      const j = r.judge;
      table.append(el("tr", {},
        el("td", {}, p.id),
        el("td", { class: "num" }, String(j.painMatch)),
        el("td", { class: "num" }, String(j.frequency)),
        el("td", { class: "num" }, String(j.willingnessToPay)),
        el("td", { class: "num" }, String(j.switchTrigger)),
        el("td", { class: "num" }, String(j.effortValue)),
        el("td", { class: "num", style: `color:${scoreColor(r.weightedScore)};font-weight:600` }, String(r.weightedScore)),
        el("td", { class: "reason" }, j.reasoning),
      ));
    });
    card.append(table);
    wrap.append(card);
  });
}

function renderAll() {
  renderMeta();
  renderProviderNote();
  renderKeyStatus();
  renderVariants();
  renderPersonas();
  renderLeaderboard();
  renderHeatmap();
  renderDetails();
  $("download").disabled = !state.results;
  $("reset").disabled = !state.results;
}

/* -------------------------------------------------------------------------- */
/*                              Report download                               */
/* -------------------------------------------------------------------------- */

function buildMarkdownReport() {
  const lines = [];
  lines.push(`# EPCFix feature evals scorecard`);
  lines.push(`Generated ${state.lastRunAt}\n`);

  const leaderboard = variants.map(v => {
    const rs = state.results.filter(r => r.variantId === v.id);
    const avg = Math.round(rs.reduce((s, r) => s + r.weightedScore, 0) / rs.length);
    return { v, avg };
  }).sort((a, b) => b.avg - a.avg);

  lines.push(`## Leaderboard\n`);
  lines.push(`| Rank | Feature | Effort | Score |`);
  lines.push(`| --- | --- | --- | --- |`);
  leaderboard.forEach((row, i) => lines.push(`| ${i + 1} | ${row.v.name} | ${row.v.effort} | **${row.avg}** |`));
  lines.push(``);

  lines.push(`## Persona × feature heatmap\n`);
  lines.push(`| Persona | ${variants.map(v => v.id.split("-").slice(0, 2).join("-")).join(" | ")} |`);
  lines.push(`| --- | ${variants.map(() => "---").join(" | ")} |`);
  personas.forEach(p => {
    const cells = variants.map(v => {
      const r = state.results.find(r => r.variantId === v.id && r.personaId === p.id);
      return String(r.weightedScore);
    });
    lines.push(`| ${p.id} | ${cells.join(" | ")} |`);
  });
  lines.push(``);

  variants.forEach(v => {
    const rs = state.results.filter(r => r.variantId === v.id);
    lines.push(`### ${v.name}  *(effort: ${v.effort})*`);
    lines.push(`*${v.pitch}*\n`);
    lines.push(`${v.description}\n`);
    lines.push(`Stated primary audience: \`${v.primaryFor}\`\n`);
    lines.push(`| Persona | Pain | Freq | Pay | Switch | E/V | Score | Why |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    personas.forEach(p => {
      const r = rs.find(x => x.personaId === p.id);
      const j = r.judge;
      lines.push(`| ${p.id} | ${j.painMatch} | ${j.frequency} | ${j.willingnessToPay} | ${j.switchTrigger} | ${j.effortValue} | **${r.weightedScore}** | ${j.reasoning.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
    });
    lines.push(``);
  });

  return lines.join("\n");
}

function downloadReport() {
  const md = buildMarkdownReport();
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const stamp = state.lastRunAt.replace(/[:.]/g, "-").slice(0, 19);
  const a = document.createElement("a");
  a.href = url; a.download = `epcfix-features-${stamp}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*                                  Wire-up                                   */
/* -------------------------------------------------------------------------- */

function init() {
  $("provider").value = state.provider;
  $("apikey").value = state.apiKey;
  $("conc").value = String(state.concurrency);

  $("provider").addEventListener("change", e => {
    state.provider = e.target.value;
    localStorage.setItem("epcfix-feat-provider", state.provider);
    renderProviderNote();
    renderKeyStatus();
  });

  $("save-key").addEventListener("click", () => {
    state.apiKey = $("apikey").value.trim();
    state.concurrency = Math.max(1, Math.min(10, Number($("conc").value) || 3));
    localStorage.setItem("epcfix-feat-key", state.apiKey);
    localStorage.setItem("epcfix-feat-conc", String(state.concurrency));
    renderKeyStatus();
  });

  $("clear-key").addEventListener("click", () => {
    state.apiKey = "";
    $("apikey").value = "";
    localStorage.removeItem("epcfix-feat-key");
    renderKeyStatus();
  });

  $("run").addEventListener("click", runEval);

  $("download").addEventListener("click", downloadReport);

  $("reset").addEventListener("click", () => {
    state.results = null;
    state.lastRunAt = null;
    localStorage.removeItem("epcfix-feat-results");
    localStorage.removeItem("epcfix-feat-lastrun");
    renderAll();
  });

  renderAll();
}

init();
