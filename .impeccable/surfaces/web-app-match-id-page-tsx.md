---
version: 1
slug: "web-app-match-id-page-tsx"
primary_target: "web/app/match/[id]/page.tsx"
related_targets: []
---

# Match (`/match/[id]`)

Visitor mode: **Operate**. A friend tapping a game from the round, usually on a phone on Tuesday or Wednesday night before tipping: should I tip with the Model or against it?

## Scope
Production Next.js route in `web/`, inside the existing app shell. Sample data from the real 2026 replays (rounds 3, 5, 10): with-odds and no-odds model probabilities, the bookies' opening price, Elo, Tuesday team lists against the 17 who played, and the last five meetings. Sections in v1: the verdict and voices, team lists with changes, head to head. Not in v1: odds history, Elo charts, the AI-written preview, what drove the prediction.

## States
Upcoming (prediction of record, lists may change), live and full time awaiting a result (no numbers in the score slot), final (result first, each voice marked right or wrong), no odds yet (bookies row absent, no-odds model leads), postponed.

## Direction contract
THESIS: The tipping question answered in one sentence: who backs whom, said plainly in display type, then every voice's win chance on its own pitch bar. Refuses the stats-portal tab stack and the betting-app odds grid.
OWN-WORLD: DESIGN.md's night-game world unchanged: green-black ground, Saira Extra Condensed verdict and figures, Sofia Sans body, the pitch bar as the one chart, the Model's voice row marked with its MDL badge, lime only for your tip and actions. Hairline-ruled voice rows, no card stacks.
STORY: Read the verdict (agree or split), check the four bars to see by how much, then look at team changes and head to head to decide, then tap through to tip.
FIRST VIEWPORT: Phone 390px: back link with round, kickoff and venue; badges with team names; the verdict sentence at 40px display, the dissenting half dimmed; one line with the Model's call and score; four voice rows (Model, Model without odds, Bookies' opening price, Elo), each a label, a team-and-percent figure and a pitch bar; the Team lists / Head to head tabs starting at the fold.
FORM: Surface roll, structure "The split, said plainly" (third of seven on my list), chosen by the user over two others; seed key de554425. Signature move: voices stacked as pitch bars sharing one halfway line, so a split reads as fills crossing halfway in opposite directions.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
