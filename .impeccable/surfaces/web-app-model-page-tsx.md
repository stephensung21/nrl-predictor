---
version: 1
slug: "web-app-model-page-tsx"
primary_target: "web/app/model/page.tsx"
related_targets: []
---

# The Model (`/model`)

Visitor mode: **Operate** (a record to scan; straight voice). A friend clicking through from the tipping side to see how the comp's shared opponent is actually going.

## Scope
Production Next.js route in `web/`, the Model's dedicated page (PRODUCT.md "a dedicated page for the Model's results and record"). Leads with its record this season as a tipper: tips correct so far against the bookies' favourite and Elo on the same games, its place against the tippers, round by round, its best calls and worst misses. Then a short tested track record (2023-25 backtest, the unseen 2026 season) and links to `/about` (how it works) and `/odds` (the full market comparison). Sample season: real 2026 games and the Model's real test-season tips, rounds 1-9 (Round 10 is the sample's current round).

## States
Season under way (default), a round where it went perfect or badly, start of season (no games yet).

## Direction contract
THESIS: The Model as a tipper with a record, read like a player's season card: the tally first, then each round as a row of lamps, then the calls that made or cost it. Refuses the ML-metrics dashboard and the marketing claim.
OWN-WORLD: DESIGN.md unchanged: MDL badge as the page's mark, Saira tabular figures, the recap's lamp rows for round results (lime lamps for right calls), hairline rows, series colours from /odds (Model blue, bookies aqua, Elo orange) on any comparison figure, no new chart.
STORY: See the Model's tally beside the bookies' and Elo's, where it sits among the tippers, scan the rounds, see which calls it nailed and which it blew, then click through to how it works.
FIRST VIEWPORT: Phone 390px: MDL badge and "The Model" heading with "2026 so far, Rounds 1-9"; the three-figure tally row (Model, Bookies' favourite, Elo); one line placing it among the tippers; the first rounds of the lamp list.
FORM: Pinned by PRODUCT.md (dedicated Model page) and DESIGN.md (recap lamps, stat row); no roll. Signature move: each round as a lamp row against its score.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
