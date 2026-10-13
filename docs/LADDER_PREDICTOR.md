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

### How it works, step by step

**1. Opening the page.** The page loads two things:

- every decided game of the season, from `matches`;
- every game still to play, from the draw (`fixtures`, below).

It also loads the latest run-home chances (`run_home`, below). If this browser has saved picks for
the season, it loads those too. A pick for a game that has since been played is dropped: the real
result replaces it.

**2. The real ladder.** The page builds it from the decided games under the NRL's rules:

- 2 points a win, 1 a draw and 0 a loss.
- 2 points a bye. A bye is a round with no game for the team.
- Points difference: points scored minus points conceded.
- Regular season only.
- Sorted on points, then points difference, then wins, as nrl.com's did. Teams level on all three
  are listed alphabetically.

This is the same function as the tipping comp's ladder auto-tip (`nrlLadderBefore`), so the two always agree.

**3. Picking games.** The remaining games are listed round by round, starting at the next one. For each game:

- Tap the winner, or "Draw".
- Then a margin step: 1, 2, 4, 8, 12, 18, 24, 30, 38 or 48. The default is 12.

Each round shows how many games are left to pick ("3 of 8 picked"). Rounds with byes list the teams
on a bye, so it's clear why a team is missing. A game that's under way can't be picked; once it's decided, its real result counts. A postponed game keeps its round, as in `matches`, and can be picked again once it has a new kickoff.

**4. The predicted ladder.** It's the real ladder plus every pick, recalculated on each tap:

- A picked win adds 2 points to the winner, and the margin to its points difference (taking the
  same off the loser's).
- A picked draw adds 1 point to each team and nothing to points difference.
- Byes in the remaining rounds add 2 points each.

**The table.** Its columns are position, team, played, points, W-D-L, byes and points difference.
Beside each team:

- an arrow and number for how far it has moved from the real ladder;
- the run-home chance of making the top 8.

A line marks the top 8, and a lighter one the top 4. A switch flips between the predicted ladder
and the real one. The viewer's favourite team is highlighted, and can be pinned at the top of the
table on a phone.

**5. Auto fill.** It picks every game not yet picked, and leaves the viewer's own picks alone:

- Round in play: the Model's tip and its margin rounded to the nearest step, from `predictions`.
- Later rounds: the team Elo favours, with the Elo margin (the mean of the simulation's margin for
  that game) rounded to the nearest step.

"Reset" clears every pick, and asks first ("Are you sure you want to reset all of your predictions?").
A smaller "Reset round" clears one round.

**6. The finals bracket.** Once every regular-season game is picked, the predicted top 8 goes into
the NRL's finals system:

| Week | Games | Who goes on |
|---|---|---|
| 1 | Qualifying finals 1v4 and 2v3; elimination finals 5v8 and 6v7 | Qualifying-final winners skip a week. The losers get a second chance. The elimination-final losers are out |
| 2 | Semi-finals: each qualifying-final loser at home against an elimination-final winner | The winners go through. The losers are out |
| 3 | Preliminary finals: each qualifying-final winner at home against a semi-final winner | The winners go through |
| 4 | Grand Final | The premiers |

The team that finished higher hosts each game. Finals have no draws: picking a winner is all there
is, and finals margins don't matter. Auto fill works here too, from Elo. The page ends with "Your
2027 premiers: …".

**7. Saving and sharing.**

- Saving: picks are kept in this browser's `localStorage`, keyed by season. They survive a reload,
  but not a different device. Nothing goes to the database, so there's no sign-in, and the tipping
  comp can't be affected. If storage is blocked (a private window), the page still works and simply
  forgets on reload.
- Sharing: "Share" makes a link with the picks packed into the address. Opening it shows that ladder,
  and offers to copy the picks into your own.

**8. The run home, beside it.** The chances come from the pipeline, not from the viewer's picks:

- They're the Model's view, the same for everyone, and updated each Monday after the results.
- The page says which round they're as of ("Model's chances after Round 12").
- They don't change as you pick.

Re-running 10,000 seasons on every tap in a phone's browser would be possible, but it would muddle
two different things: the Model's view of the season, and your own.

**9. When the draw changes.** The pipeline refreshes `fixtures` from nrl.com on every run. Picks are
matched to games on round, home team and away team:

- A moved kickoff keeps its pick.
- A game moved to another round, or dropped from the draw, loses its pick. The round's "picked" count
  shows it's missing.

### What it needs

#### 1. The rest of the season's draw in the database

**The gap.** `publish.py` (`match_rows`) publishes two kinds of game to `matches`: the ones already
played, and the coming ones the predict job has seen. The predict job only looks at the round in play.
So on a Tuesday in Round 12 the database has Rounds 1–12, and nothing for Rounds 13–27. A ladder
predictor needs every remaining game.

**Why it isn't just "publish more rows".** `matches.id` is nrl.com's match id, and `tips`, `predictions`,
`odds` and the rest point at it. nrl.com's draw pages (the `vue-draw` data that `scrape.fetch_fixtures`
and `draw.live_draw` read) don't carry that id. A game only has its URL
(`/draw/nrl-premiership/2026/round-1/knights-v-cowboys/`) until its match-centre page is fetched, which
the pipeline does with the team lists in the week of the game. `live_draw` leaves `match_id` empty for
those games.

**Options:**

| Option | How | Catch |
|---|---|---|
| **A. A separate `fixtures` table** (recommended) | Keyed on `(season, url)`: round, kickoff, home, away, venue, `is_final`. `publish.py` replaces the season's rows from `live_draw` on every run, so moved kickoffs and postponements follow nrl.com | A second list of games. It's for the ladder predictor only, and nothing in tipping reads it |
| B. Every game in `matches`, with ids from the match-centre pages | Fetch each future game's match-centre page for its id: about 100–200 extra page fetches a week, before the polite delay | Pages for games months away may not exist yet. Every view and page that reads "scheduled games" has to be checked: the tip page's round in play, the admin's "still to tip" counts, Auto Pick, the Model's tips |
| C. Made-up ids for future games | Negative ids until the real one is known | It swaps ids under the tips and predictions that point at them. Not worth the risk |

With A, the predictor reads the decided games from `matches` and the rest from `fixtures`, joining
them on round, home and away. Byes come out of it naturally: a team with no game in a round has a
bye. The draw for a new season usually comes out late in the year, so before that the page has
nothing to show beyond the real ladder.

#### 2. A pure ladder function

It goes in `web/lib/`, or as an extension of `nrlLadderBefore`. It takes the decided games plus the
picks and returns the rows: played, points, W-D-L, byes and points difference. It's tested against
hand-worked cases, as `tests/tipping/cases.json` does. It can share the tie-break with the tipping
ladder auto-tip, so the two never disagree.

#### 3. The run-home simulation

**Engine: Elo, not the full Model.** The Model needs team lists, odds and the latest form, none of
which exist for a game weeks away. Elo needs only the two ratings and home advantage. With the tuned
settings (`data/processed/elo_params.json`: home advantage 50, K 12, 40% regression to the mean
between seasons), the home win chance is `1 / (1 + 10^((away − home − 50) / 400))`. In the 2026 final
test, Elo alone got 62.4% of winners, against 63–67% for the Model (`reports/final_2026.md`). That's
good enough for weeks ahead.

**Margins.** Points difference breaks ties on points, so each simulated game needs a margin. NRL
margins have a spread of about 20 points (2020–2026 regular season: standard deviation 20.0, median
winning margin 14). The Model's margin errors are a little smaller (mean absolute error about 15,
which is a spread of about 19). So each game's margin is drawn from a normal distribution, with its
mean set so that the chance of a home win matches Elo's, and a spread of 19.

**How it runs:**

- 10,000 seasons, each playing every remaining game.
- Update the ratings inside each season, as FiveThirtyEight's forecasts do. A team that wins
  simulated games then goes in stronger, which widens the range realistically. Without this, the
  favourites' chances come out too certain.
- Count, for each team, how often it finishes top 8, top 4 and first, plus its average points and
  position.

**Where it runs: the pipeline**, after the Monday results job (`results.yml`), as a new step:

- It's the same for everyone and can be tested in Python.
- It writes one small table, for example `run_home(season, after_round, team, top8, top4, minor_premiership, avg_points, avg_position)`.
- The site only reads that table.

10,000 seasons of about 100 games each takes a few seconds in numpy. Keeping every week's rows also
gives a "chances over the season" chart for free.

**Auto fill uses the same numbers.** For the round in play, it uses the Model's own tip and margin
(from `predictions`). For later rounds, it uses the Elo favourite and the Elo margin, rounded to the
nearest margin step.

#### 4. The page

The parts:

- the round-by-round picker,
- the ladder table, with the actual/predicted switch and movement arrows,
- Auto fill and Reset,
- the finals bracket.

Picks are kept in the browser. A share link could carry them in the address.

Size: one website branch for the page and the ladder function, and one backend branch for the full
draw and the simulation, since website and backend work go on separate branches.

### Open questions

**Draws in the simulation.** Since golden point, regular-season draws are rare: 8 in 1,360 games from
2020 to 2026 (0.6%), and none in 2026. That's about one a season. A draw gives each team 1 point
instead of 2 and 0, so it only matters when two teams finish level.

- *Recommended:* no draws in the simulation, which keeps it simple. Points difference already
  separates most teams level on points, and leaving out about one draw a season moves no team's
  chances by more than a point or so.
- *But keep "Draw" in the picker*, as nrl.com did, so a fan can play out a draw.
- If the chances are ever compared with the bookmakers' top-8 prices, a 0.6% draw rate is a one-line
  change.

**Margin steps or free entry?**

| | nrl.com's steps (1, 2, 4, 8, 12, 18, 24, 30, 38, 48) | Free entry |
|---|---|---|
| Speed | One tap. Mid-season there are about 100 games left, so it has to be quick on a phone | A keyboard for every game |
| Fit to real margins | Good: real winning margins have a median of 14, a middle half of 6–24 and 90% under 34, and the steps are spread across that | Exact |
| Precision needed | Low: a margin only moves points difference, which only matters for teams level on points | Not needed |
| Default | 12 points: the same as nrl.com and the tipping comp's default margin | — |

*Recommended:* steps, with 12 as the default. Auto fill rounds the Model's margin to the nearest step.

**Where else to show the run home?** Once the `run_home` table exists, each of these is a small
addition:

| Place | What | Effort |
|---|---|---|
| `/elo` | A "Top 8 %" column beside each rating | Smallest: one join |
| Home page | The viewer's favourite team: "Storm: 87% to make the top 8, 41% top 4" | Small (needs sign-in for the favourite team) |
| Match page | **What's at stake**: each team's top-8 chance if it wins and if it loses, as FiveThirtyEight showed. It comes from the same simulations, split by that game's result, so it costs no extra runs | Medium: the pipeline keeps the split for the coming round |
| Round page | A line on the biggest swing of the round: "Biggest game: Eels v Dolphins, 30 points of top-8 chance at stake" | Small, once the match page has it |
| `/model` | Chances over the season as a chart, and at season's end how they compared with what happened | Later |

*Recommended:* the `/elo` column and the match-page "what's at stake" first. They show the Model's
view on pages people already visit, and the ladder predictor page then adds the do-it-yourself part.

**When to show it.** The chances mean little until a few rounds are played, because the pre-season
ratings are pulled 40% back to the average. So show them from about Round 5, or before that with a
note that they're mostly last year's form.

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
