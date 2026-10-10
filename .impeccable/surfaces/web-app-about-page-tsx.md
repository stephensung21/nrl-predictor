---
version: 1
slug: "web-app-about-page-tsx"
primary_target: "web/app/about/page.tsx"
related_targets: []
---

# About the Model (`/about`)

Visitor mode: **Read**. A friend wondering what the Model is, whether to trust it, and where it falls down.

## Scope
Production Next.js route in `web/`. Plain-words sections for mates (what it is, what goes in, what comes out, how it was tested, its limits), then a collapsible technical section (the two ensembles, feature groups, freezing, metrics table from reports/final_2026.md and the backtest). A prominent link to the dedicated Model page (`/model`). Facts only from the project's reports; no claims beyond them.

## States
Single static state; the technical section open or closed.

## Direction contract
THESIS: An honest explainer you can read in two minutes: short headed sections, numbers only where they prove something, the limits as prominent as the strengths. Refuses the AI-magic pitch and the wall of methodology.
OWN-WORLD: DESIGN.md unchanged: Read-mode measure (60ch prose) in Sofia Sans, Saira section heads, the MDL badge, a stat row for the tested results, hairline rules between sections, a details/summary for the technical part. Straight voice.
STORY: Learn what the Model is and what it uses, see how it was tested and how it did, read where it goes wrong, then go and see its record.
FIRST VIEWPORT: Phone 390px: "How the Model works" heading with one-line summary; a link row to "See its record this season"; the first section ("What it is") in plain words.
FORM: Pinned by PRODUCT.md and DESIGN_BRIEF.md (straight voice; technical metrics allowed here); no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
