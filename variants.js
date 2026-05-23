// Feature ideas to evaluate for EPCFix.
// Edit, add, remove freely. Each variant gets scored against every persona.
//
// Effort tiers (informal but consistent):
//   weekend  — 1-3 days, no infra changes
//   week     — 1-2 weeks, possibly one new service
//   month    — 3-6 weeks, multiple services, real complexity
//   quarter  — 2-3 months, platform-level work

export const variants = [
  {
    id: "ai-property-research",
    name: "AI property research assistant",
    pitch: "Chat-first: type any UK address, get a full compliance + retrofit recommendation in 60s.",
    description: "User enters an address in a chat box. Sub-agents fan out in parallel: EPC register lookup, MEES compliance gap, retrofit cost ranking, ECO4/BUS grant eligibility, projected rental impact. Returns a one-page recommendation with cited evidence, saved to the user's portfolio. Premium-tier feature.",
    primaryFor: "portfolio-investor, hmo-operator, letting-agent",
    effort: "month",
  },
  {
    id: "bulk-portfolio-csv",
    name: "Bulk portfolio import & dashboard",
    pitch: "Paste a CSV of addresses; get every property's MEES status on one screen.",
    description: "Upload or paste a list of addresses (CSV, or paste from spreadsheet). System looks up each EPC, calculates MEES gap, flags red/amber/green status. Sortable dashboard with bulk-export. Foundation for capex planning. No AI required.",
    primaryFor: "portfolio-investor, letting-agent, hmo-operator",
    effort: "week",
  },
  {
    id: "plain-english-explainer",
    name: "Plain-English MEES walkthrough",
    pitch: "A 5-step interactive guide: 'What MEES means for your one property, in plain English.'",
    description: "Single-property guided onboarding for non-pros. No jargon, no acronyms in the UI. Asks 5 questions, returns a personalised explainer with a single recommended next action. Designed for users who don't identify as 'landlords'. Free-tier hook.",
    primaryFor: "worried-small, accidental",
    effort: "weekend",
  },
  {
    id: "grant-eligibility-scanner",
    name: "Grant eligibility scanner",
    pitch: "For any property: which grants apply right now (ECO4, BUS, local council schemes).",
    description: "Inputs property characteristics + landlord status + tenant income bracket; outputs every active grant scheme the property qualifies for, with application links, deadlines, and typical award amounts. Maintained scheme database; refreshed monthly.",
    primaryFor: "green-curious, worried-small, hmo-operator",
    effort: "week",
  },
  {
    id: "retrofit-cost-ranker",
    name: "Retrofit cost ranker",
    pitch: "For one property: rank every eligible retrofit by cheapest path to EPC C.",
    description: "Property-level recommendation engine. Models cavity insulation, loft top-up, glazing, heating swap, solar, etc. Ranks combinations by total cost net of grants to hit EPC C. Editable assumptions. Core feature, included in base tier.",
    primaryFor: "portfolio-investor, diy-cost-conscious, hmo-operator",
    effort: "month",
  },
  {
    id: "exemption-advisor",
    name: "MEES exemption advisor",
    pitch: "Find out if your property qualifies for an exemption — and file the register entry for you.",
    description: "Walks the user through the 5 exemption categories (high cost, wall insulation, third-party consent, devaluation, new landlord). If eligible, generates the evidence pack and submits to the PRS Exemptions Register. Targeted at landlords who don't want to retrofit.",
    primaryFor: "old-school, worried-small, diy-cost-conscious",
    effort: "week",
  },
  {
    id: "capex-sequencer",
    name: "Multi-year capex sequencer",
    pitch: "Phased retrofit budget across your whole portfolio, year by year to 2030.",
    description: "Given a portfolio + a max-spend-per-year cap + property priorities, outputs a phased plan: which property to retrofit when, what work, what cost, what grant offset, what the EPC trajectory looks like. Exports to CSV / PDF for finance discussions.",
    primaryFor: "portfolio-investor, hmo-operator",
    effort: "month",
  },
  {
    id: "agent-client-report",
    name: "Letting agent client report",
    pitch: "One-pager PDF an agent can send to landlord clients: 'Here's where your property stands on MEES 2030.'",
    description: "Whitelabel-ish per-property report with agent branding. Covers current rating, MEES gap, recommended action, indicative cost, grant eligibility. Agent enters their logo + colours once. Per-report or unlimited monthly tier.",
    primaryFor: "letting-agent",
    effort: "week",
  },
];
