# EPCFix Feature Evals

Sibling of `epcfix-evals-static`. Same browser-based, GitHub-Pages-hostable
pattern — but instead of scoring **hero copy variants** against landlord
personas, this scores **feature ideas**. The heatmap tells you *which feature
serves which segment*, which is the question every roadmap decision hinges on.

## What it scores

For each `(feature × persona)`:

- **pain_match** — does this hit one of THIS persona's stated fears or goals?
- **frequency** — would they actually use it (daily / monthly / once)?
- **willingness_to_pay** — would they pay extra specifically for this?
- **switch_trigger** — would this alone make them choose EPCFix over DIY / spreadsheets / competitor?
- **effort_value** — given the stated build effort, is per-persona value worth it for THIS persona alone?

The 0–100 weighted score is the sum of the five dimensions, rescaled.

## Why this is more useful than a generic ranked list

The heatmap exposes patterns a single overall score hides:

- **Tier discriminator**: a feature loved by Raj + Hannah, mediocre for the
  rest — premium tier candidate.
- **Hero feature**: loved by 6+ personas — put it in base tier as your
  conversion driver.
- **Niche or scoped**: only one persona scores it high — only build it if
  that persona is your strategic target.
- **Universally meh**: everyone scores it 5–6 — kill it; opportunity cost
  is the real loss here.

## Deploy to GitHub Pages

1. New public repo (e.g. `epcfix-feature-evals`).
2. Drop these four files at the root:
   - `index.html`
   - `app.js`
   - `personas.js`
   - `variants.js`
3. Settings → Pages → Source: Deploy from branch → `main` / root.
4. Live at `https://<username>.github.io/epcfix-feature-evals/`.

## Two run modes

- **Dry preview** (no key) — scores biased by whether the persona id is in
  the feature's `primaryFor`. Plausible-looking heatmap so you can sanity-check
  the UI before getting a key.
- **Gemini 2.5 Flash** (BYOK, free tier) — real scoring. Get a key at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

A 64-call run (8 features × 8 personas) takes ~1 minute on the free tier.

## Editing the feature list

`variants.js` is a plain ES module. Add an entry:

```js
{
  id: "tenant-comms-templates",
  name: "Tenant comms templates",
  pitch: "Explain retrofit works to tenants without the awkwardness.",
  description: "Library of pre-written tenant notifications: scheduled works, access requirements, expected disruption, rebates. Generated per property. Editable.",
  primaryFor: "diy-cost-conscious, letting-agent, hmo-operator",
  effort: "weekend",
}
```

Effort tiers: `weekend` (1–3 days) · `week` (1–2 weeks) · `month` (3–6 weeks) · `quarter` (multi-month).

The `primaryFor` field is used by the dry preview and is also presented to
the judge as context — it doesn't constrain scoring, just declares intent.

## Reusing for HygieneFix / AsbestosCheck

Fork, swap `personas.js` for the relevant audience segments, replace
`variants.js` with that product's candidate features. The rubric in
`app.js` (`buildJudgePrompt`) usually doesn't need editing — pain/frequency/
pay/switch/effort-value generalises across compliance-SaaS products.

## How to use the output

After a run, look at the heatmap *first*, leaderboard *second*. The
leaderboard tells you "what wins overall"; the heatmap tells you "*for whom*"
— which is what you actually need to decide what to build, what tier it
goes in, and what to cut.

A useful follow-up loop:
1. Run with current shortlist
2. Look at any feature with a high score for personas you *don't* care about — reconsider
3. Look at any persona with no feature above 70 — underserved, opportunity
4. Update `variants.js`, re-run
