---
version: 1
slug: "web-app-odds-page-tsx"
primary_target: "web/app/odds/page.tsx"
related_targets: []
---

# Model vs market (`/odds`)

Visitor mode: **Operate** (a data page; desktop gets wider layouts). A friend checking where the Model and the bookies disagree this round, and whether the Model has actually beaten the market over a season.

## Scope
Production Next.js route in `web/`, two tabs. **Round:** every game of a sample round, the no-odds Model (independent of the bookies, explained once) against the bookies' opening price (highlighted: it's what the Model is most comparable to) and closing price, the line and the total. **Season:** the 2026 test season (213 games): correct tips against the bookies' favourite and Elo, calibration of the Model and the opening market, and what flat $10 bets on the Model's 2%+ edges at the opening price returned. Real data only (`web/scripts/build_odds_sample.py`; the bets reproduce reports/betting_2026.md). No disclaimer or gambling message; bookmaker names as plain text; the odds source credited.

## States
Round open (opening price only, closing lands at kickoff), round graded (both prices, results, who was closer), a game with no closing price, no odds at all, season tab.

## Direction contract
THESIS: The honest scoreboard: every game a single pitch track where the Model's, the opening price's and the closing price's win chances sit as markers, so a disagreement is a visible distance and the market's move is an arrow. Refuses the odds-comparison grid of bookmaker logos and the bettor dashboard.
OWN-WORLD: DESIGN.md unchanged plus one validated chart palette for this page: Model blue #3987e5, bookies aqua #199e70, Elo orange #d95926 (validated all-pairs on the ground); text in ink tokens, never series colours; hairline grids; tabular Saira figures in tables, the opening price set heavier than the closing.
STORY: See which games the Model and the bookies split on and by how much, check the line and total, then on the season tab see that the Model and the market are close, with the calibration and the bets as the evidence.
FIRST VIEWPORT: Phone 390px: "Model vs market" heading, one plain line on why this Model ignores odds, Round / Season tabs, the round stepper, then the first two games: teams, the marker track, and a figures row (Model, Opening, Closing, gap).
FORM: Brief-pinned page (DESIGN_BRIEF.md "just the odds") with the plan's table (PLAN_WEB.md §3.3); no roll. Signature move: the pitch track with Model / opening / closing markers.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
