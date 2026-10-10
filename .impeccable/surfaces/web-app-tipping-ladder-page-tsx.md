---
version: 1
slug: "web-app-tipping-ladder-page-tsx"
primary_target: "web/app/tipping/ladder/page.tsx"
related_targets: []
---

# Ladder (`/tipping/ladder`)

Visitor mode: **Operate**. A friend checking where they sit, who's above and below the Model, and who's in form.

## Scope
Production Next.js route in `web/`. Sample season: real 2026 games, results and Model tips for rounds 1-10; friends' tips, margins and favourite teams invented and labelled. Below the table: a round-by-round grid and season stats (perfect rounds, longest streak, biggest upset tipped).

## States
Season under way (default: after Round 10), ties on points broken by margin score, ties on both shown as equal places, a tipper with no rounds yet, start of season (empty).

## Direction contract
THESIS: The ladder as a scoreboard table: position, name, points, margin score, with the Model's row as the line everyone measures against. Refuses the leaderboard of avatars and cards.
OWN-WORLD: DESIGN.md unchanged: tabular Saira figures, hairline rows, the Model row tinted raised-2 with its MDL badge, your row in lime wash, favourite-team badges, trash-talk tags as small ink-3 labels (banter is allowed here).
STORY: Find your row, see the gap to the leader and to the Model, scan the grid for form, read who has the season's bragging rights.
FIRST VIEWPORT: Phone 390px: "Ladder" heading with "After Round 10"; the full table (6 rows) with movement since last round; the top of the round-by-round grid.
FORM: Pinned by DESIGN_BRIEF.md (ranked table, distinct Model row, highlighted own row, tags); no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
