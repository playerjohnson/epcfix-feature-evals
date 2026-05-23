# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A four-file static site for evaluating EPCFix feature ideas against UK landlord personas. Runs entirely in the browser. Deployed free on GitHub Pages, BYOK Gemini 2.5 Flash. Sibling of [`epcfix-evals`](https://github.com/playerjohnson/epcfix-evals) (which scores hero copy variants); this one scores feature ideas on a product-fit rubric.

Pattern source: `cwc-workshops/eval-driven-agent-development`. Reusable pattern doc: `Resources/eval-suite-pattern.md` in the Obsidian vault.

## Architecture (the part that requires reading multiple files)

The split is deliberate; respect it when changing things:

- `index.html` — UI shell, all CSS, page structure. Edit rarely.
- `app.js` — state, judge prompt construction, Gemini call, all rendering, markdown report. The judge prompt (`buildJudgePrompt`) and the score-normalisation (`normaliseScores`) are the only places where the rubric lives — change them together or scoring will silently misalign with the schema.
- `personas.js` — exported `personas` array. Edit quarterly.
- `variants.js` — exported `variants` array. Edit daily — this is the iteration surface.

The 0–100 weighted score in `weighted()` divides by `5 dims × 10 = 50`. If you add or remove a rubric dimension, update both `buildJudgePrompt` (prompt text + JSON shape) and `weighted` (the divisor). Otherwise the leaderboard collapses or saturates.

Heatmap colour ramp is `scoreColor()` in `app.js` — interpolates cream → mossy green over 0–100. The two cell-text colours flip at score > 55 (see `textColorForBg`).

State persists in `localStorage` under keys prefixed `epcfix-feat-*`. The API key sits in `epcfix-feat-key` — never log it, never write it back into the DOM as plaintext, never include it in the downloaded markdown report.

## How to develop

No build step. No dependencies. Just open `index.html` over `file://` and the ES modules load. For Gemini calls during local dev, set provider to "dry preview" first — it generates plausible-shape scores without consuming API quota.

To exercise the real Gemini path locally: select "Google Gemini 2.5 Flash" in the provider dropdown, paste a key (`AIza…` from aistudio.google.com/apikey), click Save, click Run eval. 64 calls (8 features × 8 personas) at ~3 concurrency takes ~1 minute on the free tier.

## Deploy

GitHub Pages from the `main` branch root. No build step, no Action needed for deploy itself. Pushing to `main` is sufficient. See `Projects/epcfix.md` "Next Session — Pick Up Here" in the vault for the deploy commands and the per-project rationale.

## Project-specific conventions

- **Editorial typography is a deliberate choice**, not decoration — Fraunces serif + IBM Plex Sans/Mono, cream/navy/mossy-green palette. Picked to avoid AI-slop aesthetic. Don't replace with shadcn/Tailwind defaults without checking.
- **No Anthropic provider**: Gemini-only by design. Anthropic was removed because the user wanted zero per-call cost for personal-project iteration. Don't re-add without explicit ask.
- **`primaryFor` field on variants is NOT a constraint** — it's a hint to the dry-preview stub and a piece of context handed to the judge. The judge can score against any persona regardless. Don't add filtering logic.
- **Cost-conscious framing throughout**: this is for personal SaaS, not 3C work. Default to "free at the margin" when proposing extensions.

## Related vault context

When picking up work here, also read in the user's Obsidian vault:
- `Projects/epcfix.md` — full EPCFix project state, especially dated sections
- `Resources/eval-suite-pattern.md` — the reusable pattern + cross-product reuse plan
- `Daily/2026-05-23.md` — the session that built this
