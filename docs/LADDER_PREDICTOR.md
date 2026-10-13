# Ladder predictor

A plan for a ladder predictor on the site: pick the rest of the season's games and see the NRL ladder
they make. This page covers how nrl.com built theirs and how ours could work, with the Model as its
extra. Researched 13 October 2026. Nothing here is built yet.

## How nrl.com built theirs

nrl.com ran a ladder predictor at `ladderpredictor.nrl.com` from 2019. The Wayback Machine has its code
from 2019 to June 2026, and everything below comes from reading that code (`static/js/main.*.chunk.js`).
The articles announcing it say little beyond "add in hypothetical tips and margins".

**The stack.** A React and MobX app built by FanHub, separate from nrl.com. The fixtures, the real
ladder, the teams and the finals were static JSON files on S3 (`rounds.json`, `ladder.json`,
`squads.json`, `fin.json`). In 2019–20 you signed in with an NRL Account and your picks were saved on
their server (`predictor/ladder_prediction`). The later builds hide sign-in (`REACT_APP_HIDE_LOGIN`) and
keep the picks in the browser's `localStorage`.

**Picking a game.** You pick a winner or a draw, then a margin. The margin is one of ten steps,
**1, 2, 4, 8, 12, 18, 24, 30, 38 or 48 points**, and the default is **"By 12 points"**.

**The ladder.** It starts from the real ladder, which includes the completed games, then adds your picks:

- 2 points for a win and 1 for a draw.
- **2 points for each bye**. Byes have their own column.
- Each margin goes into points difference.

Teams are sorted on points, then points difference, then wins.

**The table.** Its columns are played, points, W-D-L, byes, points difference and form. You can:

- switch between the **actual ladder and your predicted one**,
- see arrows showing how far each team moved,
- star a favourite team and pin it in view.

"You have missing selections in …" lists the rounds where you missed a game.

**Auto fill.** One button picks every game you haven't picked. Each pick goes to the team higher on
the current ladder, with a **random** margin step. "Reset all" clears your picks.

**The finals bracket.** After the last round, your top 8 go into a bracket:

- Qualifying finals: 1v4, 2v3, 5v8 and 6v7.
- Then the semi-finals, the preliminary finals and the Grand Final.

You pick each winner, and the page ends with "Congratulations to the …". It could be shared to Facebook.

**The odds view.** From Round 18 there was a sponsored column with each team's bookmaker price to make the top 8.

## How ours could work

It would have the same core as nrl.com's, plus the Model:

| Part | nrl.com | Ours |
|---|---|---|
| Picking a game | Winner or draw, margin from 10 steps, default 12 | The same, so it feels familiar |
| The ladder | Real ladder plus picks; 2 points a bye | The same, from `nrlLadderBefore` in `web/lib/scoring.ts`, which counts byes since the October 2026 fix (below) |
| **Auto fill** | Higher on the ladder, random margin | **The Model's picks**. For the current round, the Model's prediction (winner and margin). For later rounds, the Elo ratings (`src/elo.py` settings: the rating gap plus home advantage gives a win chance, and the winner and a margin follow from it) |
| **Run home** | Bookmaker top-8 price (sponsored, from Round 18) | **The Model's chances** for each team: top 8, top 4 and minor premiership. They come from playing out the rest of the season 10,000 times, with each game's winner drawn from its Elo win chance and its margin from the Model's margin spread. They update after every round |
| Finals bracket | Pick each final | The same, with an auto fill from the Model |
| Saving | Server (signed in), later the browser | The browser (`localStorage`), so it doesn't need sign-in or the database and can't touch the tipping comp. A share link could carry the picks in the address |
| Favourite team | Star and pin | The tipper's favourite team from their profile, when signed in |

Where it would go: a new page, `/ladder-predictor`, linked from the round page and `/elo`. It's mainly
for mid-season, once the run home matters. Before Round 1, or in the off-season, the page could show
the Model's pre-season run home on its own.

### What it needs

1. **The whole season's draw in the database.** `matches` holds only the games the predict job has seen
   (`pipeline/publish.py`), so later rounds aren't there. `pipeline/draw.py` already reads the full draw
   from nrl.com (`live_draw`). `publish.py` would publish every game in it as `scheduled`. Check first
   that nothing reads "every scheduled game" as "this round's games".
2. **A pure ladder function** in `web/lib/` (or `nrlLadderBefore` extended). It would take the decided
   games plus the picks and return the rows: played, points, W-D-L, byes and points difference. Test
   it against hand-worked cases, as `tests/tipping/cases.json` does.
3. **The run-home simulation.** It could run in the browser (10,000 seasons of about 100 remaining
   games each takes well under a second) or in the pipeline after each round, saved as one table.
   The pipeline is better: it's the same for everyone, it can be tested in Python, and the site only
   reads it. Elo is the right engine. The full Model needs team lists, so it can't predict games weeks
   ahead.
4. **The page**: the round-by-round picker, the ladder table with the actual/predicted switch and
   movement arrows, Auto fill, Reset, and the finals bracket.

Size: one website branch for the page and the ladder function, and one backend branch for the full
draw and the simulation, since website and backend work go on separate branches.

### Open questions

- **Draws in the simulation.** NRL draws are rare (golden point). Allow none, or about 1%?
- **Margin steps or free entry?** nrl.com's steps are quicker on a phone. Free entry suits the margin
  game's habits. Steps are recommended.
- **Should the run home be on `/elo` or the round page too?** A small "top 8 chance" column on `/elo`
  would be cheap once the table exists.

## The bye fix (done, October 2026)

Looking at nrl.com's predictor showed that our own NRL ladder, behind the **"Ladder" auto-tip** and
**Auto Pick's "Ladder"**, gave byes no points. The real ladder gives 2 points a bye. A team that had
had a bye therefore sat lower than it should, and a ladder auto-tip could pick the wrong team. The
database's version also counted finals games.

Fixed in migration `20261021000000_ladder_byes.sql` (`nrl_ladder_before`) and `nrlLadderBefore` in
`web/lib/scoring.ts`:

- A bye is an earlier regular-season round with no game for the team, and it's worth 2 points.
- Only regular-season games count.
- A new shared case in `tests/tipping/cases.json` shows the difference. The Eels had a Round 1 bye and
  the Panthers drew, so the ladder auto-tip now picks the Eels (2 points to 1). Before the fix it picked
  the Panthers.

2026 had 17 teams and a bye every round, and so does the trial's 2026 replay. It doesn't change Round 1
(no earlier rounds). From Round 2, the team that had the Round 1 bye gets its 2 points.

## Sources

- [NRL Ladder Predictor returns in 2019 (nrl.com)](https://nrl.com/news/2019/07/25/nrl-ladder-predictor-returns-in-2019)
- [Ladder predictor returns for revamped NRL draw (nrl.com, 2020)](https://www.nrl.com/news/2020/05/22/ladder-predictor-returns-for-revamped-nrl-draw/)
- [NRL ladder predictor returns for 2020 (nrl.com)](https://nrl.com/news/2020/03/04/nrl-ladder-predictor-returns-for-2020)
- [The predictor's code, February 2026 (Wayback Machine)](http://web.archive.org/web/20260212081727/https://ladderpredictor.nrl.com/static/js/main.da483e8b.chunk.js)
- [Rugby League Project's ladder predictor](https://www.rugbyleagueproject.org/seasons/nrl-2023/ladder.html) (predicted scores, not margin steps)
- [BettingPro's ladder predictor](https://www.bettingpro.com.au/nrl/nrl-ladder-predictor/) (drag teams into order; no games)
