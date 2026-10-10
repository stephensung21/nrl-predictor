---
version: 1
slug: "web-app-round-season-round-page-tsx"
primary_target: "web/app/round/[season]/[round]/page.tsx"
related_targets: []
---

# Round (`/round/[season]/[round]`)

Visitor mode: **Operate**. A friend looking back at an earlier round (how did the Model and everyone go) or ahead to one not yet predicted.

## Scope
Production Next.js route in `web/`, an extension of the home surface: same components, same world, no concept roll. Sample data: real 2026 replays for rounds 3, 5 and 10, with invented tippers labelled as sample. Round 10 is the current sample round; later rounds have no predictions yet.

## States
Graded past round (prediction of record beside the result, marked right or wrong, plus everyone's round scores and the Model's), current round (same as home), future round (predictions not out yet), round not found.

## Direction contract
THESIS: A past round read as a scorecard: results first, each beside what the Model said, then how every tipper and the Model scored. Refuses an archive table of fixtures.
OWN-WORLD: Inherits the home surface and DESIGN.md: compact game rows with pitch bars, recap panel with lamps for each tipper, hairline rows, one board at most.
STORY: Pick a round, see what happened against the Model's calls, see who won the round in the comp, step to the previous or next round.
FIRST VIEWPORT: Phone 390px: round heading line with previous / next round controls; the round scores panel (Model's score and the tipper list with lamps); results rows below.
FORM: Extension of the home surface (web/app/page.tsx); no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
