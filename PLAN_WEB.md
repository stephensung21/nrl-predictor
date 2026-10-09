# NRL Predictor: Weekly Automation and Website Plan

This plan extends [PLAN.md](PLAN.md). The visual and UX design is in [DESIGN_BRIEF.md](DESIGN_BRIEF.md). The website's working name is **rugbyleague-tipper**. It covers two things:

1. **Weekly automation:** run the model on a fixed schedule each week. Fetch team lists, stats, results and odds, rebuild the features, and publish new predicted scores, winners and margins.
2. **A personal website** with five sections:
   - **Predictions:** model scores, predicted winner and margin for each game
   - **Model vs market:** model probabilities and margins compared with betting odds
   - **Elo:** current ratings and how they change over a season
   - **Tipping comp:** a few friends sign in and tip each week, with a ladder
   - **News:** a feed from Reddit's r/nrl

### Status (October 2026)

The core model is built and tested (see [IMPROVEMENTS.md](IMPROVEMENTS.md) and [MODELLING_PLAN.md](MODELLING_PLAN.md)):

- **Main model:** the **with-odds ensemble** (average of a linear model and LightGBM, with the opening odds as inputs). On the 2023–25 backtest it scores 0.622 log loss against 0.638 for Elo and 0.633 for the opening market, and on the unseen 2026 season it was level with the closing market. The **no-odds ensemble** (0.627) is the independent model for the model-vs-market page and the fallback when odds aren't available.
- **Predicting from Tuesday's team lists** costs almost nothing in accuracy (+0.0014 log loss, item 40), so the Tuesday-evening job is the right main prediction.
- **`src/predict.py` exists:** it predicts a round with frozen models from the current team lists, validates the result, and writes a CSV, a Markdown table and a run record. A replay mode re-predicts past rounds as of their Tuesday and reproduces the backtest's Tuesday-list predictions exactly.
- **Models are frozen once before the season** (`python src/train.py --freeze` → `models/2027/`). Weekly refitting was tested and was worse (item 24); during the season only the features update.

So the Elo-only stage in the milestones below is no longer needed: the website can publish the ensemble from the first run.

### Build status

✅ built · 🔶 partly built or run by hand · ❌ not started. Everything marked ✅ still runs by hand until the automation section is done.

**Getting the data**

| Step | Status | Where / notes |
|---|---|---|
| Results and match stats (nrl.com) | ✅ | `python src/scrape.py`; skips games already cached, so re-running is cheap |
| State of Origin and reserve-grade stats | ✅ | `scrape.py` (`--reserve` for reserve grade) |
| Live team lists, every version kept | ✅ | Fetched by `predict.py`; each fetch saved to `data/raw/teamlists_live/` with a timestamp |
| Historical pre-kickoff (Tuesday) lists | ✅ | `python src/teamlists.py` (Internet Archive), 2023–2026 |
| Historical betting odds (aussportsbetting.com sheet) | 🔶 | `data/nrl_betting odds.xlsx`, downloaded by hand. Needed for retraining and, until live odds exist, for the with-odds model. An automatic download is still to do. |
| Live odds (The Odds API) | ❌ | §1.2 step 4. Without it, games not yet in the sheet get the no-odds prediction only. |
| Elo, team rating, player ratings (RAPM), features | ✅ | Recomputed from the latest results by `features.py` and `predict.py` |

**Predicting**

| Step | Status | Where / notes |
|---|---|---|
| Pre-season model freeze | ✅ | `python src/train.py --freeze` → `models/2027/` (version `2027.1`, trained on 2021–2026). Rerun before Round 1 if more 2026 data or settings change. |
| Predict a round from current team lists | ✅ | `python src/predict.py --round N` (live) |
| Validation before publishing | ✅ | `predict.validate`: missing inputs, probabilities, 17 named per team, duplicate teams; margin/probability disagreement is a warning |
| Replay a past round as a test | ✅ | `predict.py --replay --season 2026 --round N`; reproduces the backtest exactly; slow test in `tests/test_predict.py` |
| Impossible-price check on live odds | 🔶 | In `betting.py` for the simulation; to add to the odds fetcher |
| Edges and fair odds against live prices | ❌ | Needs live odds |

**Scoring**

| Step | Status | Where / notes |
|---|---|---|
| Grade last round's predictions (tips correct, margin error, log loss, Brier, vs the market) | ❌ | The metric code exists (`evaluate.py`, used for the backtest and the 2026 test) but no weekly step runs it. Can be built in Python now, writing a season record to a file, before Supabase exists. |
| Prediction of record (last prediction before kickoff) and season record | 🔶 | Each run writes `reports/predictions/<season>_round<N>.*`; nothing yet picks the last one before kickoff or collects a season record. Later a database view (§2). |
| Betting results and closing line value per round | 🔶 | `betting.py` does whole seasons, not week by week |
| Tipping-comp scoring (points, auto-tips, bonus, margin, ladder) | ❌ | Needs the database (§2, §3.5) |

**Automation and publishing**

| Step | Status | Where / notes |
|---|---|---|
| `pipeline/run.py --job results / predict / refresh` | ❌ | Chains the steps above (§1.2) |
| GitHub Actions workflows on the weekly schedule | ❌ | §1.1, §4 |
| Run log, alerts on failure | 🔶 | Each `predict.py` run writes a JSON record (commit, model version, errors); no alerts yet |
| Supabase schema, row-level security, publishing | ❌ | §2, milestone 1 |
| Website and tipping comp | ❌ | §3, milestones 5–8 |

**Suggested order for the rest:** `pipeline/run.py` with the weekly grading step (both testable now on 2026 replays), then The Odds API fetcher and the automatic odds-sheet download, then the GitHub Actions workflows, then Supabase and the website.

### Notes for the next phase

Things learned while building the model and `predict.py` that the automation has to handle. Each has a recommendation.

**1. Where the scraped data lives in automated runs.**
`data/raw/` (the cached nrl.com pages) is in `.gitignore`, but `scrape.py`'s `build_tables` rebuilds `matches.csv`, `team_match_stats.csv` and `player_match_stats.csv` from the raw files of every season it's given. A GitHub Actions run starts with an empty cache, so it would either re-download every game since 2020 (about 1,500 pages) or rebuild the tables from one season and lose the rest.
- *Recommendation:* make the weekly scrape **incremental**. Fetch only the current season (`--years 2027`), rebuild that season's rows, and replace just those rows in the committed processed tables. Keep the current season's raw pages between runs with `actions/cache` (keyed by season) so each run only fetches new games. The results job then commits the updated tables, which also keeps the repo active (scheduled workflows stop after 60 days without activity).
- The same applies to `reports/predictions/` (also ignored): run records and predictions must be kept somewhere durable for grading (see 6), so commit them or write them to the database from the start.

**2. Which round to predict.**
`predict.py` needs `--round N`.
- *Recommendation:* the predict and refresh jobs take the first round in the nrl.com draw (`vue-draw` data, as `scrape.fetch_fixtures` reads it) that has a game with `matchMode` not `Post`, and predict only its games that haven't kicked off. A round with byes simply has fewer games.
- **Postponed games:** predict them in whichever round's run comes before their new kickoff. Fixtures are keyed by match id, so a moved game isn't predicted twice.
- **Neutral venues** (Magic Round, Las Vegas, grand finals): when the odds sheet doesn't have the game yet, `predict.py` adds a placeholder row that assumes the home team is at its own ground. Before that matters, set the neutral flag from the draw: a venue where the home team isn't drawn to host at least 2 regular-season games is neutral, the same rule `ingest.add_venue_flags` uses.

**3. Weather is unknown on Tuesday.**
The wet-conditions flag (rain or a wet ground) is used by the total-points models. It's known on the day; on Tuesday `predict.py` sets it to 0, so totals are slightly worse than in the backtest.
- *Recommendation:* keep 0 for the Tuesday prediction. Add the flag in the game-day refresh if nrl.com's match centre shows ground conditions before kickoff, or from a rain forecast. Measure the cost first by replaying 2026 rounds with `--no-weather` against the recorded conditions.

**4. The odds sheet.**
`data/nrl_betting odds.xlsx` comes from aussportsbetting.com's historical NRL results-and-odds download. It's the only source of the *opening* prices the with-odds model was trained on, and of closing prices for grading against the market.
- *Recommendation:* download it in the Monday results job (confirm the direct file link and the site's terms first), and check whether it already lists the coming round's games with opening odds. If it does, it's the most consistent source of opening prices for the with-odds model until The Odds API is set up.
- `ingest.load_odds` stops on unknown team names, so a new team or renamed column fails loudly rather than silently.
- Run the impossible-price check (implied probabilities summing to under 100%) on every download; the 2026 sheet had bad line and totals prices.

**5. The yearly routine (after each grand final, before the next Round 1).**
1. Scrape the finished season and download the final odds sheet; rebuild the features.
2. Check for rule or format changes, like the 2026 six-man interchange on Tuesday lists, and **new teams**. A new club (the Perth Bears are due to join in 2027) needs entries in `ingest.TEAM_MAP` (the odds sheet's name), `TEAM_STATE` and `features.TEAM_BASE`. It starts with an average Elo and team rating; its players' ratings carry over from their old clubs. Expect its early predictions to be rough.
3. Optionally add the finished season to the backtest (`BACKTEST_SEASONS`) and rerun `train.py --backtest` to confirm nothing has drifted.
4. Commit, then freeze the models for the new season: set `config.PREDICT_SEASON` and run `python src/train.py --freeze` (it refuses to run with uncommitted changes).
5. Rerun the tests, including the replay test, and replay a few rounds of the finished season with its own frozen models as a final check.
6. Check `requirements.txt` still installs; upgrading scikit-learn or LightGBM means refreezing.

**6. Weekly grading and the season record.**
- **Prediction of record:** for each game, the latest prediction made before its kickoff (from the run records; each run has a `run_at` time and a model version).
- **Grading (Monday results job):** join the round's predictions of record to the results and to the market (opening and closing prices from the odds sheet), and append one row per game to a season record (committed CSV first, later the `predictions` table and `model_accuracy` view).
- **Metrics per round and cumulative:** tips correct and accuracy, margin and total-points error, log loss and Brier score, each for the model, the opening market, the closing market and Elo.
- **Paper trading** (IMPROVEMENTS.md item 33): with live odds, also record the bets the model would have made (2% minimum edge at the price available when predicting), and grade them for profit and closing line value. This is the honest test of the betting edge on fully live information.

---

## Overview

- **The model stays in Python.** The weekly pipeline is plain, deterministic code (see PLAN.md §7.5). It writes its results to a database and never talks to the website directly.
- **The database is the contract between the model and the website.** The pipeline writes matches, Elo, predictions and odds. The website reads them, and writes only tipping data.
- **A personal project for a few friends.** The site says so plainly on every page (see §3.7). That keeps everything small: one invite-only tipping comp, no public sign-up, no moderation, and everything on free plans.
- **The tipping comp is the only part that needs accounts.** Everything else is read-only and can be heavily cached.
- **Timing:** the 2026 season has just finished, so the off-season is the build window. Aim to have everything live for **pre-season trials in February 2027**, which gives a few weeks of real runs before Round 1.

### How the parts connect

```
                     GitHub Actions (cron)
                             │
   NRL.com draw / match centre / team lists ─┐
   Odds API ─────────────────────────────────┼──► weekly pipeline (Python)
   Results ──────────────────────────────────┘     ingest → Elo → features → predict → validate
                                                             │
                                                             ▼
                                                   Supabase (Postgres + auth)
                                                     ▲                 │
                                tips, invites, users │                 │  matches, predictions,
                                                     │                 ▼  Elo history, odds
                                                 Next.js website (Vercel)
                                                     ▲
                                 Reddit API ─────────┘  (news feed, cached server-side)
```

### Recommended stack

| Part | Choice | Why |
|---|---|---|
| Scheduler | **GitHub Actions** cron workflows | Free, already in the repo, secrets management built in, manual re-runs with `workflow_dispatch` |
| Database and auth | **Supabase** (Postgres) | One service gives the database, user sign-in (email magic link, Google) and row-level security, which is what makes tip lockout safe. Free tier is enough. |
| Website | **Next.js** (App Router, TypeScript) on **Vercel** | Server rendering with caching suits pages that change a few times a week. Free tier is enough, and the free `rugbyleague-tipper.vercel.app` address means no domain needs buying. |
| Charts | Recharts | Elo lines, model vs market charts |
| Styling | Tailwind CSS | Fast to build, works well on phones, which is where most tipping happens |

This replaces the Streamlit dashboard in PLAN.md §8. Streamlit is good for a personal analysis tool, but it is a poor fit for a multi-user tipping comp. It can still be kept for private model analysis.

Alternatives considered: a fully static site (GitHub Pages) works for predictions, Elo and news, but the tipping comp needs a database and sign-in; Django or FastAPI would keep everything in Python, but means hosting and securing a server yourself.

---

## 1. Weekly automation

### 1.1 The NRL week and when to run

NRL team lists are named on **Tuesday at about 4pm (Sydney time)**. Changes follow up to the 24-hour update and the final team list one hour before kickoff. Odds move all week. So one run a week isn't enough. Run a few small jobs:

| Job | When (Sydney time) | What it does |
|---|---|---|
| **Results** | Monday 10am | Pull final scores and match stats for the round just played. Update Elo. Score the tipping comp and update the ladder. Grade last round's predictions. |
| **Main prediction** | Tuesday 5:15pm | Pull the draw and the new team lists. Rebuild features. Predict with the frozen models (no refit). Publish predicted scores, winners and margins for the coming round. |
| **Refresh** | Wednesday to Sunday, 9am and 3pm | Re-fetch odds and team-list changes. Re-predict only the games whose inputs changed. |
| **Prediction of record** | Each game's kickoff | The last prediction made before kickoff is frozen as the official one. This is what accuracy and "beat the model" are measured against. |

GitHub Actions cron uses **UTC only** and doesn't follow daylight saving. Pick UTC times that work in both AEST and AEDT. For example, `15 7 * * 2` (07:15 UTC Tuesday) is 5:15pm AEST or 6:15pm AEDT, both after team lists. Use an off-the-hour minute, because GitHub delays jobs that start on the hour when it's busy.

Freezing the prediction of record doesn't need a job at kickoff. It is a database view: "the latest prediction with `created_at < kickoff`".

### 1.2 Pipeline steps

`pipeline/run.py --job {results|predict|refresh}` runs these steps. Each one is a plain function, can be run on its own, and is safe to re-run (writes are upserts keyed on match and run).

1. **Fetch the draw:** fixtures, kickoff times, venues and match status for the season. NRL.com's draw page is backed by a JSON endpoint, which is far more stable than scraping HTML.
2. **Fetch results and match stats** for completed games (the same scraper as the core model).
3. **Fetch team lists:** the named players plus reserves for each team, with an `announced_at` timestamp. Keep every version, so changes between Tuesday and kickoff are visible and features can be rebuilt as they were at any point. (`predict.py` already saves each fetch to `data/raw/teamlists_live/`.)
   - **The named 17** is the 17 lowest-numbered players who aren't reserves (`features.named_from_list`). Since 2026 the Tuesday squad lists a **six-man interchange** (jerseys 14–19) that is cut to four later in the week, so a Tuesday list has 19 non-reserves and jerseys 1–17 are the expected team. On final lists, late replacements keep higher numbers (e.g. 20), and the rule still finds the 17.
4. **Fetch odds:** head-to-head, line and total from [The Odds API](https://the-odds-api.com) (NRL is `rugbyleague_nrl`). Store each fetch as a timestamped snapshot. The free plan is enough (see §1.6).
   - **Match what the model was trained on.** The with-odds model learned from *opening* prices of one bookmaker in the aussportsbetting.com sheet (bet365 until April 2024, BlueBet since, with BlueBet indicator inputs). Use the same bookmaker if The Odds API carries it (check whether BlueBet is in its Australian list), and use the **first snapshot after odds open** as the opening price. Keep downloading the aussportsbetting sheet too, for retraining.
   - **Without odds** (not yet open, or the fetch failed), publish the no-odds model's prediction for that game; `predict.py` already does this.
5. **Update Elo** from all completed results, and write each team's pre-match and post-match rating per game.
6. **Build features** for the upcoming round with the same leakage-safe code as training (`features.build_features` with the current team lists). Every result before the round updates Elo, the team rating and the player ratings (RAPM), so the features stay current without refitting the models.
7. **Predict with the frozen models.** The models are fitted once before the season (`python src/train.py --freeze`, which runs the backtest's development procedure on every earlier season and saves `models/<season>/bundle.joblib` with its commit, settings and data hash). **Don't refit weekly:** it was tested and was worse, clearly so late in the season (IMPROVEMENTS.md item 24). Predict win probability, margin and total points; `predict.py` does steps 6–8.
8. **Validate** before publishing (see §1.4). If a check fails, stop and alert. Never publish a half-finished round.
9. **Publish** to Supabase, then call the website's revalidation hook so cached pages refresh straight away.
10. **Optional:** write a short LLM match preview for each game (PLAN.md §7).

### 1.3 Predicted scores

The website shows a predicted score for each team, for example "Storm 24 – Broncos 16". That needs a **total points** model as well as the margin model. Both exist (the total model beats the opening total on the backtest).

- Home score = (total + margin) / 2
- Away score = (total − margin) / 2
- Round to whole numbers for display only. Store the unrounded values.
- The predicted winner comes from the **win probability**, not from the rounded scores. In a close game the two can disagree (the win and margin models are separate), so the displayed scores never contradict the tip: `predict.display_scores` gives the tipped team one point more when they would.

### 1.4 Reliability

- **Validation checks before publishing** (`predict.validate`; a failure stops the run and writes the reason to the run record):
  - every game in the round has a prediction, and probabilities are between 0 and 1;
  - **every model input is present** for every game (the linear models would otherwise silently fill a gap with the median; this check caught a real bug while building `predict.py`);
  - each team has 17 named players (by the rule in §1.2 step 3);
  - no team appears twice in a round;
  - all odds timestamps are before kickoff, and **no impossible prices**: a two-way market whose implied probabilities add up to less than 100% is a data error (the 2026 odds sheet had some).
  - A predicted margin and win probability pointing different ways is a **warning**, not an error: the two models are separate and can disagree in close games.
- **Run log table:** start time, job, status, rows written, model version and git commit for each run, so every number on the site can be traced back to the run that made it.
- **Alerts:** GitHub emails on a failed workflow by default. Add a Discord or Slack webhook message for failures and for big changes (e.g. a favourite flipping after a late team change).
- **Manual override:** every workflow has `workflow_dispatch`, so a run can be started by hand (e.g. for a Thursday game or a postponed match).
- **Scraper breakage** is the most likely failure. The scraper-maintenance agent (PLAN.md §7.4) fits here later.
- **Model versioning:** tag each published prediction with a model version (`predict.py` records it, e.g. `2027.1`, with the commit). A model change mid-season starts a new version, so the accuracy record stays honest.
- **Replays as a test:** `python src/predict.py --replay --season 2026 --round 10` re-predicts a past round as of its Tuesday (results hidden, archived lists). It reproduces the backtest's Tuesday-list predictions exactly, and a slow test checks the replayed features match the full build. Run it after any change to the pipeline.
- Scheduled workflows are switched off after 60 days without repo activity. The weekly commits of run logs or a monthly keep-alive avoid this, and the off-season needs a check before February.

### 1.5 Secrets

Stored as GitHub Actions secrets and Vercel environment variables, never in the repo:

| Secret | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Pipeline (writes predictions; bypasses row-level security, so never sent to the browser) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website (public, limited by row-level security) |
| `ODDS_API_KEY` | Pipeline |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Website (news feed) |
| `REVALIDATE_SECRET` | Pipeline calls the website's revalidation hook with it |
| `ANTHROPIC_API_KEY` (optional) | Match previews |

### 1.6 Staying on free plans

Every service fits in its free plan at this size:

| Service | Free allowance | This project's use |
|---|---|---|
| GitHub Actions | Unlimited for public repos; 2,000 minutes a month for private ones | About 12 short runs a week, a few minutes each, so under 200 minutes a month |
| Supabase | 500 MB database, 50,000 monthly active users | A few MB of data and a handful of users. Free projects pause after a week with no activity, and the pipeline's weekly writes keep it awake in season. Check it in the off-season. |
| Vercel (Hobby) | Free for personal, non-commercial sites | Exactly this case |
| The Odds API | 500 credits a month | See below |
| Reddit API | Free for low-volume, non-commercial use | A few requests an hour, thanks to caching |

**The Odds API doesn't need a paid plan.** Credits aren't the same as requests: each call costs *markets × regions* credits. One call for head-to-head, line and total in the Australian region costs 3 credits and returns every game in the round. About 10 fetches a week is about 30 credits a week, or about 130 a month, well inside 500. Calls that return no games cost nothing, and there are no games in the off-season.

A paid plan would only be needed to:

- fetch odds much more often (for example hourly, about 1,500 credits a month)
- add more regions or markets
- download **historical** odds through the API, which costs 10 times as much per call. This isn't needed, because historical closing odds for backtesting come free from aussportsbetting.com (PLAN.md §1).

To stay safe, the pipeline reads the remaining credits from the response headers (`x-requests-remaining`) after each call, logs them, and skips the odds step with a warning if fewer than 50 are left.

---

## 2. Database

One Postgres database in Supabase. Schema changes live in `supabase/migrations/` so they are versioned with the code.

### Model data (written by the pipeline only)

| Table | Key columns |
|---|---|
| `teams` | id, name, short name, colours, logo |
| `matches` | id, season, round, kickoff (UTC), home team, away team, venue, status (scheduled / live / final / postponed), home score, away score |
| `team_lists` | match, team, player, jersey number, position, `announced_at` (one row per player per version) |
| `odds_snapshots` | match, bookmaker, `captured_at`, home and away price, line, total |
| `elo_ratings` | team, match, season, date, rating before, rating after |
| `predictions` | match, run, model version, `created_at`, home win probability, predicted margin, predicted total, predicted home and away score |
| `pipeline_runs` | id, job, started, finished, status, git commit, model version, notes |

Views:

- `prediction_of_record`: the latest prediction made before each game's kickoff.
- `latest_odds`: the latest snapshot per game, with implied probabilities and the bookmaker margin removed.
- `model_accuracy`: per round and per season, tips correct, average margin error, log loss and Brier score, for both the model and the market.

### Tipping data (written by the website)

| Table | Key columns |
|---|---|
| `profiles` | user id (from Supabase auth), display name, favourite team, auto-tip choice (home team / crowd / ladder), admin flag |
| `invites` | code, created by, used by, expires |
| `rounds` | season, round, featured match (for the margin) |
| `tips` | user, match, team picked, margin (featured game only), `is_auto` (filled in by an auto-tip, not by the user), updated |

There is **one comp** for the whole group, so no comp or membership tables are needed. Adding them later is easy if a second group ever wants in.

Views: `tip_results` (each tip marked correct or not once the game is final), `round_scores` (points, bonus point and margin score per user per round) and `ladder` (season totals, ranked by the rules in §3.5).

### Row-level security

This is where the rules are enforced, not just in the website code:

- Anyone can read model data. Only the pipeline's service key can write it.
- A user can insert or change their **own** tips only while `now() < kickoff` for that match. A tip can't be sneaked in after kickoff, even by calling the API directly.
- A user can see **other people's tips** for a game only after it kicks off. Before then, tips stay hidden so nobody copies.
- Only signed-in users can see the ladder and tips. Only an admin can create invites, set the featured game or remove a user.

---

## 3. Website

### 3.1 Pages

| Path | Content |
|---|---|
| `/` | This round at a glance: each game with predicted score, winner, win probability and margin, plus the model's season record |
| `/round/[season]/[round]` | Any past or future round. Past rounds show the prediction of record next to the real result, marked right or wrong |
| `/match/[id]` | One game in detail: prediction, team lists (with changes since Tuesday), odds history, Elo for both teams, head to head, the LLM preview, and what drove the prediction (SHAP, later) |
| `/odds` | Model vs market for the round, and the season-long comparison |
| `/elo` | Elo ratings and history |
| `/tipping` | My tips for this round |
| `/tipping/ladder` | The ladder and round-by-round results |
| `/tipping/admin` | Invites, featured game, user list (admin only) |
| `/news` | r/nrl feed |
| `/about` | How the model works, in plain words, and its limits |

### 3.2 Predictions

One card per game, ordered by kickoff:

- Teams as colour badges (see §3.7), kickoff time in the viewer's local time, venue
- **Predicted score**, e.g. "Storm 24 – 16 Broncos"
- **Predicted winner** and **win probability** as a bar (e.g. 68% / 32%)
- **Margin**, e.g. "Storm by 8"
- A badge when the prediction changed since Tuesday (e.g. "Updated: Hughes out"), and the time of the last update
- After the game: the result, and a tick or cross

Above the cards, a season summary: tips correct, accuracy, average margin error, compared with the bookmaker favourite.

### 3.3 Model vs betting odds

For each game in the round, a table:

| Column | Meaning |
|---|---|
| Model win % | From the no-odds ensemble (Model B, PLAN.md §6), so the comparison is independent. The predictions page and the "Model" tipper use the with-odds ensemble, which is more accurate. |
| Market win % | From the latest odds, with the bookmaker margin removed |
| Difference | Model minus market, highlighted when large |
| Model margin vs line | Model margin next to the bookmaker line (e.g. model "Storm by 8", line "Storm −4.5") |
| Model total vs market total | For over/under comparison |
| Odds movement | A small chart of the market probability since odds opened |

A season tab shows how the model and the market have done over time: cumulative tips correct, log loss by round, and a calibration chart for each. This is the honest scoreboard: most weeks the market will be hard to beat, and the page should show that plainly.

Notes:

- Just show the odds: no disclaimer or gambling message on the page (decided October 2026, see DESIGN_BRIEF.md). Bookmaker names appear as plain text only, with no logos, links or affiliate deals.
- Odds data has terms of use. The Odds API allows display, but check the plan's terms, and credit the source.

### 3.4 Elo

- **Ratings table:** all 17 teams, current rating, change from last round (with an up/down arrow), rank, and rating at the start of the season.
- **Season chart:** one line per team, rating after each round. Every line is shown faint, and the user picks teams to highlight (defaulting to their favourite team if signed in). Team colours for lines, with names labelled at the end of each line instead of a legend.
- **Season picker,** back to the earliest season with results (about 2009, per PLAN.md).
- **Team view:** a single team's rating over several seasons, with the big rises and falls labelled by the match that caused them.
- A short explanation of what Elo is and what a rating gap means as a win probability (e.g. "+100 points ≈ 64% before home advantage").

The data comes straight from `elo_ratings`; no calculation happens in the website.

### 3.5 Tipping comp

A single invite-only comp for a few friends, following the **official NRL Tipping rules** (tipping.nrl.com, 2026 rules).

**Joining:**

1. The admin (you) creates an invite link from `/tipping/admin` and sends it to a friend.
2. The friend signs in with an email magic link or Google through the invite link. There is no public sign-up page.
3. They choose a display name, favourite team and **auto-tip option** (see below).

**Rules (as NRL Tipping):**

| Rule | How it works |
|---|---|
| **Points** | 1 point for each correct tip |
| **Lockout** | Each game locks at its own scheduled kickoff, so later games in a round stay open. Tips can be changed any number of times until then. |
| **Draws** | A drawn game counts as **a win for both teams**, so everyone who tipped it gets the point. The same applies to a game that is cancelled, abandoned, not completed, or without an official result within 3 days of its scheduled date. |
| **Auto-tips** | A game you didn't tip is filled in at lockout with your auto-tip choice: **Home team** (the home team in the official draw, even at a neutral venue), **The crowd** (the team most of the other tippers picked) or **Ladder** (the team higher on the NRL ladder). If the crowd or ladder option is tied, it falls back to the home team. You choose when you join and can change it until the first game of the season locks. |
| **Bonus point** | 1 bonus point for tipping **every** winner in a round with **8 or more games**. No bonus if any of your tips in that round were auto-tips, or in shorter rounds (for example Origin-period rounds). |
| **Margin** | Each round has a **featured game** (default: the first game of the round; the admin can change it before it locks). Enter a predicted winning margin for it. Your margin score for the round is the gap between your predicted margin and the real one, and it adds up over the season. If you don't enter one, a default margin applies. |
| **Ladder ties** | Most points first, then the **lowest accumulated margin score**. |
| **Finals** | Same rules as the regular season. |

Rule details to settle while building:

- **Margin when you tipped the wrong team:** treat your margin as negative for the team that won, so tipping Storm by 6 when the Broncos win by 4 gives a margin score of 10.
- **Default margin** when none is entered: NRL Tipping applies one but its current rules don't say how much. Use 12 (about an average NRL margin) and show it on the tip page.
- **"The crowd" with only a few tippers** can easily be tied or empty. In that case the home-team fallback applies, as above.
- Older NRL.com help pages mention a 2-point bonus and a cap on points for rounds left completely untipped. The current rules say 1 bonus point and no cap, so the plan follows the current rules. Re-check them before the 2027 season, since NRL Tipping updates its rules each year.

**Scoring:** a database function scores tips once a game is final. It runs from the Monday results job, and also from the refresh jobs so the ladder moves during the weekend. Auto-tips are filled in by the same jobs for any game that has locked.

**Extras:**

- **The model is a tipper.** A "Model" user tips its prediction of record (and margin, for the featured game) every round. Everyone can see whether they're beating it. It never uses an auto-tip.
- **The tip page shows the model's pick and probability** as a hint, with a toggle to hide it for anyone who wants to tip blind.
- After lockout, show how the group tipped each game (e.g. "4 of 5 tipped Storm").
- **Reminder emails** before the first game of the round to anyone with missing tips, so fewer games go to auto-tips.
- Round winner and season stats: perfect rounds, longest streak, biggest upset tipped.

**Testing:** tipping is where bugs upset people, even among friends. Write tests for:

- lockout: a tip before kickoff succeeds and after kickoff fails, at the database level
- hidden tips before kickoff
- draws and cancelled games
- each auto-tip option, including ties
- the bonus point, including the 8-game minimum and auto-tips
- margin scores, including a wrong-team tip
- postponed games (tips stay open until the new kickoff)
- ladder order, including the margin tiebreak

### 3.6 News feed (r/nrl)

- **Source:** Reddit's API, using a registered "script" app with OAuth (client ID and secret). Unauthenticated requests from cloud servers such as Vercel are often blocked or rate limited, so authenticate.
- **Fetch on the server, not in the browser,** and cache for about 10 minutes. However many people view the page, Reddit gets a handful of requests an hour, which keeps well inside the free rate limit.
- **Show:** post title, flair (e.g. "Team News", "Match Thread"), score, comment count, age, thumbnail, linked domain. Every item links to the Reddit thread. Clicking through, rather than copying post bodies or comments onto the site, keeps within Reddit's terms and avoids moderation problems.
- **Filters:** Hot / New / Top today, and flair chips (Team News, Discussion, Match Thread, Highlights). Hide NSFW and removed posts.
- **Useful links:** on each match page, link to the r/nrl match thread for that game when one exists.
- **Later:** add other sources (NRL.com news RSS, club news) into the same feed, each marked with its source. The team-news agent (PLAN.md §7.1) can also use the "Team News" flair as one of its inputs.
- Check Reddit's current Data API terms before launch; free, non-commercial use with attribution is the expected case.

### 3.7 General

- **Personal project, said plainly:** the header carries the name **rugbyleague-tipper** and a "personal project" tag, and every page has a one-line footer: "Tipping comp and predictor for the boys. I'm not responsible if you lose money." Use team names but not official NRL or club logos. Use plain coloured badges in team colours instead.
- **Kept out of search engines:** `noindex` on every page and a `robots.txt` that blocks crawlers. Friends get the link directly.
- **Phone first:** most tipping happens on a phone. Design every page for a narrow screen first.
- **Dark only** (see DESIGN_BRIEF.md), with team colours lightened where needed to read on the dark background.
- **Caching:** prediction, odds and Elo pages are cached and refreshed when the pipeline calls the revalidation hook. Tipping pages are rendered per user and never cached.
- **Times:** store everything in UTC; show times in the viewer's time zone.
- **Privacy:** a short note on the about page saying the site stores only email addresses, display names and tips, for running the comp. Let users delete their account and tips.

---

## 4. Repository layout

The repo becomes a monorepo: the Python model, the website and the database schema live together, so a schema change and the code that uses it land in one commit.

```
nrl-predictor/
  src/                         # core model (PLAN.md §8)
    predict.py                 # predict a round with the frozen models (exists; live and replay modes)
    teamlists.py               # historical pre-kickoff lists from the Internet Archive (exists)
  models/<season>/             # frozen model bundles from `train.py --freeze` (exists)
  pipeline/
    run.py                     # entry point: --job results|predict|refresh (wraps scrape.py, features.py, predict.py)
    fetch_draw.py              # fixtures, kickoffs, match status
    fetch_team_lists.py        # versioned team lists
    fetch_odds.py              # Odds API snapshots
    publish.py                 # upsert to Supabase, call revalidation hook
    validate.py                # checks before publishing
  supabase/
    migrations/                # tables, views, row-level security policies
    functions/tip-reminders/   # scheduled reminder emails
  web/                         # Next.js app
    app/                       # pages: /, /round, /match, /odds, /elo, /tipping, /news
    components/                # match card, Elo chart, odds table, ladder
    lib/supabase.ts, lib/reddit.ts
  tests/
    test_pipeline.py
    test_tipping_rules.sql     # lockout, hidden tips, scoring
  .github/workflows/
    results.yml                # Monday
    predict.yml                # Tuesday after team lists
    refresh.yml                # Wednesday to Sunday
    ci.yml                     # tests and lint on every push
```

---

## 5. Milestones

The core model is done and beats Elo, so there's no Elo-only stage: publish the ensemble from the start. The website doesn't change when the model does.

| # | Milestone | Depends on | Done when |
|---|---|---|---|
| 1 | **Database schema** and row-level security in Supabase | — | Migrations apply cleanly; security tests pass |
| 2 | **Pipeline skeleton:** draw, results, Elo, publish | PLAN.md milestones 1–2 | Running it by hand fills `matches` and `elo_ratings` for past seasons |
| 3 | **Ensemble predictions** published to the database: `predict.py` output written by `publish.py` | 2 | Predicted scores, winners and margins appear for a round (replays of 2026 rounds first) |
| 4 | **Scheduled workflows** (results, predict, refresh) with validation, run log and alerts | 3 | A full week runs on its own, including a deliberately broken run that alerts and doesn't publish |
| 5 | **Website, read-only:** predictions, round and match pages, Elo tab | 3 | Deployed on Vercel; pages refresh after a pipeline run |
| 6 | **News feed** | — (independent) | r/nrl posts show with filters and caching |
| 7 | **Odds:** odds fetching plus the model vs market page | 4, 5 | Round and season comparisons show, with odds history |
| 8 | **Tipping comp:** invites, sign-in, tips, lockout, auto-tips, scoring, bonus, margin, ladder, model as a tipper | 1, 5 | All the rule tests in §3.5 pass; a mock round is played through from tips to ladder |
| 9 | **Team-list changes** in the refresh job | 4 | Late changes trigger a re-prediction and an "Updated" badge (team-list features and Tuesday-list fetching already exist) |
| 10 | **Pre-season model freeze** (`train.py --freeze`, version `2027.1`) | — | ✅ Code done; rerun once the 2027 draw and any late 2026 data are in |
| 11 | **Dry run on 2027 pre-season trials** (February) | 4–8 | A week of trials runs end to end with friends tipping |
| 12 | **Launch for Round 1, 2027** (early March) | 11 | — |

**Later:** live score updates during games, tip reminders by push notification, SHAP explanations on match pages, LLM previews, the MCP chat interface (PLAN.md §7.2) as an "Ask the model" box on the site, and the monitoring agent's weekly report (PLAN.md §7.7) as a page on the site.

---

## 6. Decisions made

| Question | Decision |
|---|---|
| Who is the tipping comp for? | A few friends only: one invite-only comp, no public sign-up |
| Budget | Free plans only (§1.6). No paid odds plan is needed. |
| Name | **rugbyleague-tipper** for now, at `rugbyleague-tipper.vercel.app` |
| How public | A personal project, said plainly on every page, and kept out of search engines (§3.7) |
| Tipping rules | The official NRL Tipping rules (§3.5) |
| Which model | With-odds ensemble for predictions and the "Model" tipper; no-odds ensemble for model vs market and as the fallback without odds |
| Refitting | Frozen once before the season; features update weekly (weekly refitting tested worse) |
| Team lists | Predict from Tuesday's list, re-predict on changes (item 40 showed Tuesday lists lose almost no accuracy) |
