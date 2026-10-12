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

- **Main model:** the **with-odds ensemble** (average of a linear model and LightGBM, with the opening odds as inputs). On the 2023–25 backtest it scores 0.621 log loss against 0.638 for Elo and 0.633 for the opening market, and on the unseen 2026 season it was level with the closing market. The **no-odds ensemble** (0.626) is the independent model for the model-vs-market page and the fallback when odds aren't available.
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
| Historical betting odds (aussportsbetting.com sheet) | 🔶 | `data/nrl_betting_odds.xlsx`, downloaded by the live results job (`pipeline/fetch_sheet.py`, step 4c) and used only if it loads, has at least as many games and ends no earlier; impossible prices are counted. It only updates now and then, so the weekly predictions don't depend on it (live odds below); it's for closing prices (grading), retraining and the yearly routine. **Terms:** "personal use only. Do not make the data available elsewhere", so the workflow never commits the downloaded copy; but the copy already committed to this public repo, and the odds sheet's prices on the public site, need a decision (see Open questions). **Blocked on GitHub (11 October 2026):** the first scheduled-style results run got `403 Forbidden` from `https://www.aussportsbetting.com/historical_data/nrl.xlsx`, most likely because the site blocks GitHub's servers or the script's user agent. It's only a warning (the run finished "nothing to do"), and the committed copy is used meanwhile. See step 4c. |
| Live odds (The Odds API, Betr) | 🔶 | `pipeline/fetch_odds.py`, run at the start of every live job and by `run.py --job odds`: Betr's head-to-head, line and total (Betr is BlueBet since the 2024 merger, the sheet's bookmaker), every snapshot kept in `odds_snapshots.csv`, impossible prices dropped, credits guarded. A game's first snapshot is its opening price when the sheet doesn't have it. Built and tested; the key works and Betr prices come through on the free plan (checked October 2026 on the EPL, as NRL is out of season). Still to confirm in the February trials: Betr lists NRL, and its first snapshot matches the sheet's opening price (see step 4). |
| Elo, team rating, player ratings (RAPM), features | ✅ | Recomputed from the latest results by `features.py` and `predict.py` |

**Predicting**

| Step | Status | Where / notes |
|---|---|---|
| Pre-season model freeze | 🔶 | `python src/train.py --freeze` → `models/2027/` (version `2027.1`, trained on 2021–2026). **Needs refreezing before Round 1:** item 47 (12 October 2026) dropped two LightGBM inputs, and the frozen models still use the old set. Rerun again if more 2026 data arrives. |
| Predict a round from current team lists | ✅ | `python src/predict.py --round N` (live) |
| Validation before publishing | ✅ | `predict.validate`: missing inputs, probabilities, 17 named per team, duplicate teams; margin/probability disagreement is a warning |
| Replay a past round as a test | ✅ | `predict.py --replay --season 2026 --round N`; reproduces the backtest exactly; slow test in `tests/test_predict.py` |
| Impossible-price check on live odds | ✅ | `fetch_odds.check_prices`: a market whose implied probabilities add to under 100%, a price at or below 1, or mismatched handicaps is blanked and logged as a warning |
| Edges and fair odds against live prices | 🔶 | Built (October 2026): `pipeline/edges.py`, run after every live job, writes `edges.csv` and `edges.md` beside the records: for each coming game the Model's fair odds (1 / probability), Betr's latest price, the market's margin-free chance, the edge on each side and paper trading's bet (bigger edge, at least 2%). **Head to head only**, the market whose edge held up in 2026 (line bets lost; the totals' edge was mostly the rain flag). The database has the same rule in `edges_at()` and the `match_edges` view (migration `20261016000000_match_edges.sql`, readable by anyone and the `analyst` role), checked equal to `edges.py` in `tests/test_publish.py`; pushed to the live project (12 October 2026; checked: the view and functions exist, readable but not writable by visitors and `analyst`, empty off-season). Merged into `main`. Shown on `/odds` ("This round" tab, above the latest graded round: fair odds, Betr's price, the edge on each side and paper trading's bet; `upcomingEdges` in `web/lib/data.ts`, `web-live-extras` branch). **Value underdogs** (`value-underdog` branch): a paper bet on the team the Model tips to lose is labelled as one on `/odds`, with the tip unchanged, and the Season tab gives those bets' own record (`valueUnderdog`, `underdogBets` in `web/lib/odds.ts`). Out of sample they made about half the head-to-head profit (+31% ROI 2023–25, +29% in 2026, at the opening price with a 2% edge; wide intervals), while flipping the *tip* to the underdog lost tips and log loss, so the tip never changes (`IMPROVEMENTS.md` item 48). The Season tab's "If you'd bet it" now bets on the Model with odds, as paper trading does (`seasonBets`, and the sample from `build_odds_sample.py`: 107 bets, +29.05 units, as `betting_2026.md`); its tips and calibration still use the no-odds Model, so they stay independent of the market. *Still to do:* check against real NRL prices in the February trials |

**Scoring**

| Step | Status | Where / notes |
|---|---|---|
| Grade last round's predictions (tips correct, margin error, log loss, Brier, vs the market) | ✅ | `pipeline/grade.py`, run by the results job: each finished game's prediction of record joined to the result, opening and closing market and Elo; metrics per round and for the season so far, written to `data/pipeline/<live\|replay>/<season>/graded.csv` and `season.md`. Grading the final test's predictions reproduces `reports/final_2026.md` exactly (`tests/test_pipeline.py`). |
| Prediction of record (last prediction before kickoff) and season record | ✅ | The pipeline keeps every prediction it makes, with when it was made (`predictions.csv` beside the run log), and `grade.prediction_of_record` picks the latest before kickoff. Becomes the `prediction_of_record` view once the database exists. |
| Betting results and closing line value per round | ✅ | Paper trading (`pipeline/paper.py`, IMPROVEMENTS.md item 33): each prediction of record's head-to-head bet at Betr's live price when it was made (2%+ edge, as `betting.py`), graded for profit and closing line value; the live results job rebuilds `paper_bets.csv` and `paper.md` |
| Tipping-comp scoring (points, auto-tips, bonus, margin, ladder) | ✅ | In SQL: `supabase/migrations/20261010000000_tipping.sql` (`effective_tips`, `tip_results`, `round_scores`, `ladder()`, lockout and hidden tips in row-level security). The website's copy is `web/lib/scoring.ts`. Both are checked against the same hand-worked cases (`tests/tipping/cases.json`) by `npm test` in `web/`, the SQL in PGlite (Postgres 17 in WebAssembly). Not yet applied to a Supabase project. |

**Automation and publishing**

| Step | Status | Where / notes |
|---|---|---|
| `pipeline/run.py --job results / predict / refresh / odds` | ✅ | Scheduled by the workflows below; `--as-of` replays a past season, and `pipeline/replay.py` runs the whole weekly schedule over one. Before the season's year, a draw nrl.com hasn't published is "nothing to do"; from January it's a failure. Not yet publishing (step 7). |
| GitHub Actions workflows on the weekly schedule | 🔶 | `.github/workflows/`: `results.yml`, `predict.yml`, `refresh.yml`, `odds.yml`, each calling `pipeline-job.yml`; `ci.yml` for tests. On `main`, with `ODDS_API_KEY` set as a GitHub secret; every workflow was run by hand on 11 October 2026, and the deliberate-failure alert test worked (step 8). Still to come: a full in-season week unattended. |
| Run log, alerts on failure | ✅ | Every pipeline run is logged to `runs.jsonl` (job, clock, status, round, games, model version, commit, errors); a failed run exits non-zero, which fails the workflow: GitHub emails, and `ALERT_WEBHOOK_URL` (Discord or Slack, optional) gets the reason. `run.py --fail` (the workflows' "fail" box) fails on purpose to test it. |
| Supabase schema, row-level security, publishing | ✅ | The migrations (tipping, model data, Perth Bears, weather) are tested locally in PGlite with Supabase's default permissions reproduced, and applied to the live project `nrl-predictor` (11 October 2026, step 6). `SUPABASE_DB_URL` is set locally and in GitHub, so every scheduled run publishes (step 7); 2026 is backfilled. |
| Website and tipping comp | 🔶 | Every planned page designed and built (see Website status below). The model pages read the database when `SITE_DATABASE_URL` is set (step 9); sign-in, tips and the admin page have live Supabase stores (step 10, `live-tipping` branch, not yet tried against the live project). Ladder and `/model` on real scores (step 10b); `/tipping` and the admin page's invites checked live (October 2026); deployed (step 12) |

### Website status (October 2026)

Every planned page is designed (DESIGN_BRIEF.md, recorded in DESIGN.md) and built in `web/` on the `web-design` branch, and each passed an independent design review. Every page except `/news` reads live data when the site's settings are present (steps 9–10b), and otherwise falls back to a sample module or a browser-storage stand-in, behind an interface that the real source replaces in one place. Every sample page carries a dashed "Sample data" note saying what is real and what is made up.

#### Pages and how each is wired

"Real data, frozen" means real project data generated into a TypeScript file by a script in `web/scripts/`, not read live. "Stand-in" means it works end to end in the browser but stores nothing on a server.

| Page | Built | Data today | Wired to live? | What replaces it |
|---|---|---|---|---|
| `/` home (round, tipping strip, recap) | ✅ | Real 2026 Round 10 replay predictions and results (frozen); invented tippers and tips | 🔶 Model data live when `SITE_DATABASE_URL` is set (the round in play, margin game, record, off-season); tipping strip and tips with step 10 | `prediction_of_record`, `matches`, the viewer's `tips`, `ladder` |
| `/round/[season]/[round]` | ✅ | Real replays of rounds 3, 5, 10 (frozen); invented tips | 🔶 Live for any predicted round (games, results, the Model's score, the Claude recap); the tippers' recap with step 10 | Same views, any round |
| `/match/[id]` | ✅ | Real replay data: no-odds model, opening price, Elo (both teams going in, the season so far, last five games, the change from the result), Tuesday and final team lists, head to head (frozen; rounds 3, 5, 10 only) | 🔶 Live for any predicted game (checked equal to the sample on Round 10); tips with step 10 | `predictions`, `odds_snapshots`, `elo_ratings`, `team_lists`, `matches` |
| `/tipping` | ✅ | Tips save in the browser (`BrowserTipStore`) | 🔶 Built (step 10): with Supabase configured, the round in play from the model's data, your tips in `tips` (`SupabaseTipStore`), the comp's tally and your auto-tips after lockout; "No round to tip" in the off-season. Checked live (October 2026: "No round to tip" off-season); tipping itself waits for 2027's first predicted round | `SupabaseTipStore` from `createTipStore()`; lockout enforced by row-level security |
| `/tipping/ladder` | ✅ | A generated 2026 season to Round 10: real games, results and Model tips; invented friends, tips, margins, forgotten tips | ✅ Built (12 October 2026, `live-ladder`): for signed-in tippers, the latest comp season (2027 on) from `ladder()`, `round_scores` and `tip_results`, read as the viewer (`lib/comp.ts`); before the comp's first decided game, "The ladder starts with Round 1" | `ladder()`, `round_scores`, `tip_results`, `prediction_of_record` (the upset's chance) |
| `/odds` | ✅ | Real 2026 prices (aussportsbetting sheet) and test-season predictions; recomputed bets match `reports/betting_2026.md` | ✅ Live (the latest graded season; equal to the sample on 2026: 134/133/133 tips, 122 bets, +24.05 units) | `match_odds_probs`, `odds_snapshots` (The Odds API), `predictions`, `model_accuracy` |
| `/elo` | ✅ | Real ratings 2009–2026 from `src/elo.py` (asserted equal); 2026 to Round 9 | ✅ Live (every season in `elo_ratings`) | `elo_ratings` |
| `/model` | ✅ | Real 2026 test-season tips to Round 9; invented tippers for the comp comparison | ✅ Live (12 October 2026, `live-ladder`): the latest graded season from `graded_games` (2026: 143/135/133 of 213, equal to `model_accuracy`), finals as FW1–FW3 and GF; the comp line only for a signed-in tipper in a comp season | `graded_games`, `matches`; `ladder()` for the comp line |
| `/about` | ✅ | Figures from `reports/final_2026.md` and `reports/backtest.md` | n/a | Update by hand after each season's test |
| `/join/[code]`, `/sign-in`, `/auth/callback`, `/account` | ✅ | Browser stand-in (`BrowserAuthStore`): fake Google and email sign-in, profile in the browser; sample invites | 🔶 Built (step 10): Supabase auth, **Google only** for now, `join_comp()` and `check_invite()`, deleting through `/api/account`. Not yet tried live | Supabase auth (Google, email link), `profiles`, `invites` via `createAuthStore()` |
| `/tipping/admin` | ✅ | Browser stand-in (`BrowserAdminStore`): invites, tippers and pipeline runs invented; real Round 10–11 fixtures | 🔶 Built (step 10): invites, tippers with their "still to tip" counts (`admin_tip_counts()`), removing a tipper (`/api/admin/tipper`), the margin game from `rounds`, the latest runs. Invites checked live (October 2026); removing a tipper not yet tried | `invites`, `profiles` (admin flag), `rounds` (stored draw), `pipeline_runs` via `createAdminStore()` |
| `/news` | ✅ | One saved snapshot of r/nrl's RSS feed (10 Oct 2026): real titles, links, times and linked sites; flairs guessed from titles | ❌ Frozen | Reddit API (OAuth app, cached) via `createNewsSource()`, with real flair |
| Not-found page | ✅ | n/a | n/a | n/a |

#### The swap points

Each one is a single function that returns the real implementation once the backend exists. The pages don't change.

| Interface | File | Sample implementation | Live implementation needs |
|---|---|---|---|
| Row shapes | `web/lib/types.ts` | `lib/sample*.ts` modules, generated by `web/scripts/build_sample.py`, `build_odds_sample.py`, `build_elo_sample.py`, `build_news_sample.py` | Server-side Supabase queries returning the same types |
| `TipStore` | `web/lib/tip-store.ts` | Browser storage | Supabase `tips`, with lockout and hidden tips in row-level security |
| `AuthStore` | `web/lib/auth.ts` | Browser storage, mock redirect through `/auth/callback` | Built as `SupabaseAuthStore` (step 10): joining only through `join_comp()`, `check_invite()`, `/api/account` for deletion. A Google sign-in without an invite makes a sign-in but no profile, and is signed straight out (no before-user-created hook). Stripping Google's name and photo: migration `20261015000000_no_google_profile.sql` (`strip-google-profile` branch) |
| `AdminStore` | `web/lib/admin.ts`, `web/lib/invites.ts` | Browser storage and a fixed sample clock | Supabase tables, the database clock, the `profiles` admin flag, and the stored margin-game draw |
| `NewsSource` | `web/lib/news.ts` | Saved RSS snapshot | Reddit API: real flair, NSFW and removed posts hidden, cached about 10 minutes |
| Tipping rules | `web/lib/ladder.ts`, `web/lib/rules.ts` | Computed in the browser | SQL scoring functions and views ported from these, sharing their test cases |

#### Not connected yet

- **The model pipeline:** `publish.py` writes everything to the database, and `/`, `/round`, `/match`, `/odds` and `/elo` read it when `SITE_DATABASE_URL` is set (step 9), and so does `/model`. `/tipping`, `/tipping/admin` and `/tipping/ladder` are converted too (step 10, with Supabase configured). Without them the site shows the sample.
- **The database:** the Supabase project exists and holds the model's data (2021–2026 games, Elo since 2009, the 2026 predictions and grades), published by every scheduled run. The site reads it as `analyst` (`SITE_DATABASE_URL`, locally and in Vercel), the step 10 migrations are pushed, and the admin ("sbeve") has joined; no tips yet.
- **Live sources:** the Odds API fetcher and the odds-sheet download feed the pipeline (and through it the database); no Reddit API, no live scores.
- **Accounts:** with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (they are, in `web/.env.local`), sign-in is real Supabase auth with Google, and tips, profiles and invites are in the database (step 10). The first tipper joined on 12 October 2026: "sbeve" (the comp's admin), with an invite made in the SQL editor in the Model's name, since nobody can make one before there's an admin. Without those settings the site keeps the browser stand-ins.
- **Admin:** live, the page is only for a profile with `is_admin`; in the sample it's open to anyone and the admin flag always says yes.
- **The margin-game draw** (random, excluding last round's teams; §3.5) is made by the pipeline's predict job and published to `rounds` (step 11a), but the site still shows the sample's Round 10 game (simply the round's first game) until step 9.
- **Deployment:** live at **https://nrl-predictor.vercel.app** (12 October 2026, step 12), on Vercel's free Hobby plan, deployed from `main` on every push, reading the live Supabase project. `noindex` and `robots.txt` are in place.

#### Still to add to the website

- **Live states the sample can't show:** live scores during games (§3.2 "Later") and the "Updated: Hughes out" refresh badge driven by real team-list changes (milestone 9).
- **Odds history** on match pages (a chart of the market since opening, §3.3). It needs `odds_snapshots`.
- **The r/nrl match thread link** on each match page (§3.6).
- **What drove the prediction** on match pages (§7.1): a "What drove this" bar list on `/match/[id]`, in margin points, each bar naming the side it favours, read from the `record_drivers` view (live, filled from the first 2027 prediction; the pipeline side is built). Needs a read in `web/lib/data.ts`, a sample for the sample pages (generated from a replayed 2026 round with `explain.py`), and the design pass like the other panels. Claude's match previews are shown (`web-live-extras` branch); none are written until `summaries.py` runs on a live round with API credit.
- **Post-mortems** of badly missed games on match pages (§7.2).
- **Tip reminders** before each round's first game (email, §3.5 extras).
- **Notifications and push** (§5 "Later").

### Next steps

Step numbers are fixed (other sections refer to them). Steps 1–3 are done and step 4 is mostly done. The `pipeline` and `web-design` branches were merged into `main` in October 2026 (PRs #4 and #5); backend work now continues on **`backend`** and the site on **`web-development`**, both from `main`.

**Done**

- ✅ **Step 1. `pipeline/run.py --job results|predict|refresh`** (October 2026, `pipeline` branch): incremental scrape of the current season (`scrape.build_tables(..., merge=True)`; rebuilding 2026 alone reproduces the committed tables byte for byte), the round to predict from the draw including postponed games (`draw.games_to_predict`), neutral venues from the draw (`draw.neutral_games`, agrees with the odds sheet's flags), `predict.py`, validation, and every run and prediction recorded. *Checked:* `python pipeline/replay.py --season 2026 --rounds 1 10 --check` runs the whole weekly schedule (132 jobs) and every Tuesday run equals `predict.py --replay`. Only 64 of 2026's 213 games have an archived Tuesday list, so the replay predicts 45 of rounds 1–10's games; refreshes correctly find nothing changed.
- ✅ **Step 2. Weekly grading** (`pipeline` branch): `pipeline/grade.py`, run by the results job, writes `graded.csv` and `season.md`. *Checked:* grading the final test's predictions as predictions of record reproduces every number in `reports/final_2026.md`. (The plan's original check, grading the replayed season, can't reach those totals: the final test used final team lists for all 213 games, and the Tuesday archive covers only 64.)
- ✅ **Step 3. Tipping scoring outside the browser** (`web-design` branch): `supabase/migrations/20261010000000_tipping.sql`, with the website's rules moved to `web/lib/scoring.ts`; both pass the shared cases in `tests/tipping/cases.json`, and the lockout, hidden-tips and permission rules pass in PGlite (`npm test` in `web/`, 24 tests).

**Pipeline (`backend` branch)**

- 🔶 **Step 4. Odds.** *Built (October 2026):* the sheet only updates now and then, so the weekly opening prices come from The Odds API instead. The sheet's bookmaker since April 2024, BlueBet, took over Betr in July 2024 and now trades as Betr on BlueBet's platform, and The Odds API carries Betr (`betr_au`; BlueBet isn't listed). `pipeline/fetch_odds.py` fetches Betr's head-to-head, line and total at the start of every live job and in the Sunday-night odds job, keeps every snapshot in `data/pipeline/live/<season>/odds_snapshots.csv` (raw responses in `data/raw/odds_api/`), blanks impossible prices (note 4) and logs them as warnings, and skips while fewer than 50 credits are left. A game's first snapshot before kickoff is its opening price when the sheet doesn't have the game; the sheet's prices come first when it does. A refresh re-predicts a game when its first price arrives; a failed fetch is a warning and unpriced games get the no-odds prediction. Errors never carry the key (they go into the committed run log). *Checked:* `tests/test_odds.py` on a saved response, including a 2026 game priced from "live" odds predicting exactly as from the sheet; a real call with the key returned Betr's prices on the free plan (EPL, 1 credit; NRL is out of season). *Still to do:* (a) in the February trials, confirm Betr lists NRL and the team names map; (b) once the sheet has the same games, compare its BlueBet opening prices with our first snapshots, and change which snapshot counts as opening if they differ consistently; (c) download the sheet automatically in the results job, for closing prices and retraining (check the site's terms). *Needs:* `ODDS_API_KEY` in `.env` locally (done) and in GitHub secrets (done 11 October 2026; the first Actions run fetched odds, 498 credits left).
- 🔶 **Step 5. Weather** (note 3).
  - *In the model: not adopted (October 2026, IMPROVEMENTS.md item 45).* Open-Meteo weather (`src/weather.py`, free, no key) didn't help as model features. The live jobs' wet flag of 0 costs the totals about 0.1 points of MAE (2024–25), and filling it from Open-Meteo's forecast (Tuesday or game day) wins back most of that; win and margin are unaffected. Too small to adopt. If the totals ever matter, fill the wet flag from the forecast in the predict and refresh jobs.
  - ✅ *On the site: the backend is built (`extras` branch).* `pipeline/fetch_weather.py` runs after every live job except odds (a failure is only a warning). It records the latest Open-Meteo forecast for each coming game up to 16 days ahead, and what the weather was once a game is over, in `weather.csv` in the live records. Each game gets: temperature at kickoff, rain over the 2 hours from kickoff, the chance of rain (forecasts only), wind and gusts, wind direction, and conditions ("Light rain", from the WMO code). Roofed venues (Allegiant, Marvel, One NZ Stadium) are marked and get no weather. `publish.py` writes the latest forecast and the observation to the `weather` table (migration `20261013000000_weather.sql`); the view `match_weather` gives one row per game (observed if known, otherwise the forecast), readable by anon, authenticated and `analyst`. 2026 is backfilled (`fetch_weather.py --backfill 2026`, the reanalysis archive) and goes with `publish.py --backfill 2026`. Tests: `tests/test_weather.py`, plus the views in `tests/test_publish.py`. Tests never download weather (`tests/conftest.py`).
  - ✅ *On the site (`web-live-extras` branch):* `weatherFor` in `web/lib/data.ts` puts `match_weather` on each game. The match page shows the forecast (with its time) before kickoff and what it was afterwards, or "Under the roof"; a game row flags only weather that could matter (a forecast of 50%+ rain, 1 mm+ of rain, or gusts of 50 km/h+), about 1 game in 12 in 2026. Open-Meteo is credited on the match page and under any list that shows a flag (`WeatherCredit`). Wording in `web/lib/weather.ts`, tested in `web/tests/weather.test.ts`.
- 🔶 **Step 8. GitHub Actions.** *Built (October 2026, `backend`):* `results.yml` (Monday 00:15 UTC), `predict.yml` (Tuesday 07:15), `refresh.yml` (Tuesday–Saturday 23:15 and Sunday, Wednesday–Saturday 05:15, i.e. Wednesday–Sunday mornings and afternoons in Sydney), `odds.yml` (Sunday 11:15), each a thin caller of `pipeline-job.yml`, plus `ci.yml` (the fast Python tests and the website's `npm test` on every push). `pipeline-job.yml` installs Python 3.12 and `requirements.txt`, restores the season's raw match pages from `actions/cache` (saved again after each results run), runs `pipeline/run.py --job …` with `ODDS_API_KEY`, commits `data/pipeline/live/`, `data/processed/` and the fetched team lists, and alerts on failure. Pipeline jobs queue one at a time (they commit to the same records). A run that only logged "nothing to do" isn't committed, except the weekly results run, which is also the keep-alive. Every workflow can be run by hand, with a "fail" box for the broken-run test. *Checked:* actionlint passes; the commit step was run against a scratch repository under `bash -e` (nothing to do, predictions, results, failure, and a crash before any records); every job was run live from a clean checkout as Actions will (off-season: all "nothing to do", tables unchanged). *Merged into `main`* (October 2026), so the schedules are live. *Turned on (11 October 2026):* `ODDS_API_KEY` added as a GitHub secret and every workflow run once by hand. `ci`, `odds`, `results`, `predict` and `refresh` were green; `results` committed `pipeline: results (nothing to do)` with odds `ok` (0 games, 498 credits left); the deliberate failure (`predict` with *fail* ticked) went red and committed `pipeline: predict (failed)`. The one problem: the odds sheet download got a 403 (step 4c). *Still to do:* a full in-season week unattended (milestone 4). Publishing is added after step 7. *Scraping guards (13 October 2026, `scrape-guards` branch):* a review of the weekly scraping found it sound (nrl.com's pages embed each match as JSON; features are rebuilt from the processed tables on every prediction) but with three quiet failure modes, now closed. (1) A blocked or broken nrl.com used to read as "nothing there": `scrape.get_q_data` now raises `FetchError` for anything but a 404 on a draw page (a season or round not published yet, e.g. the 2027 draw in October), so the results job fails and alerts instead of logging "nothing to do". (2) Rebuilding the season reads only the cached raw pages, so a lost Actions cache plus a failed download could have dropped games from `matches.csv` and committed it: `merge_seasons` now refuses to drop a game the tables already have (and nothing is written), every finished game's page is tried with the failures listed (`fetch_matches`), and the results job still builds and grades what it fetched before failing. (3) Only the results job scraped, so a game finished after Monday morning (Easter Monday) was missing from Tuesday's features: the predict and refresh jobs now fetch any game the draw shows finished that the tables don't have (`run.catch_up`; a failure is a warning). Team lists that fail to download still skip that game until the next refresh. Tests: `tests/test_scrape.py`; checked live against nrl.com (the 2027 draw's 404 is empty in 1 s; the 2026 Grand Final page downloads). Still open: late team changes about an hour before evening kickoffs fall between the refresh runs (item 40 says this costs little).
- ✅ **Step 11a. The pipeline draws each round's margin game** (October 2026, `margin-draw` branch): `draw.draw_featured`, the same rule as `drawFeatured` in `web/lib/rules.ts` (any game not involving a team from the previous round's margin game, or any game if none qualify), with a fresh secure random source. The predict job draws once per round (`run.margin_game`), on the first run with the round's fixtures and only before its first kickoff; later runs keep the draw. Kept in `data/pipeline/live/<season>/rounds.csv` (with the eligible games, for the admin page), recorded in the run log, and published to `rounds`, where the Model's margin tip picks it up. *Checked:* `tests/test_pipeline.py` (the rule, every eligible game drawn and nothing else, once per round, never after kickoff) and `tests/test_publish.py` (published, and the Model enters its margin).

**Turning on the schedule: steps only you can do** (on github.com, repo `stephensung21/nrl-predictor`). ✅ Steps 1, 3, 4 and 5 done on 11 October 2026 (see step 8). Step 2 (`ALERT_WEBHOOK_URL`) is not wanted: GitHub's failure emails are enough. Step 6 is for February.

1. **Add the odds key as a secret.** Settings → Secrets and variables → Actions → *New repository secret*. Name `ODDS_API_KEY`, value the key from your local `.env` (the part after `ODDS_API_KEY=`, no quotes). Without it the workflows still run, but the odds fetch is skipped and every game gets the no-odds prediction. Secrets are never shown in logs and aren't passed to workflows triggered from forks.
2. **Optional: chat alerts** (decided against, October 2026; left here in case that changes). GitHub already emails you when a scheduled run fails (the emails go to whoever last changed the schedule). For a Discord message as well: Discord server settings → Integrations → Webhooks → *New webhook* → *Copy webhook URL*, then add it as a secret named `ALERT_WEBHOOK_URL`. A Slack incoming-webhook URL works too.
3. **Check the repository settings.**
   - Settings → Actions → General: actions are allowed (the default). The workflows ask for permission to commit themselves, so "Workflow permissions" can stay on read-only.
   - Settings → Branches / Rules: if `main` has a rule that requires pull requests, the bot's record commits will be rejected. Either don't protect `main`, or add GitHub Actions to the rule's bypass list.
4. **Run each workflow once by hand.** Actions tab → pick the workflow on the left → *Run workflow* → branch `main` → *Run workflow*. Do `ci`, `odds`, `results`, `predict` and `refresh`. Off-season, each should finish green with "nothing to do" in the log; `results` makes a commit `pipeline: results (nothing to do)`. In the `odds` run, open *Run the odds job*: it should print `odds: {'status': 'ok', ...}` with `credits_remaining`. If it says `skipped` and `no ODDS_API_KEY`, the secret's name or value is wrong.
5. **Test the alert.** Run `predict` by hand again with *fail* ticked. Expect a red run, an email (and a Discord message if step 2 is done) saying "deliberate failure (--fail)", and a commit `pipeline: predict (failed)` with the run log.
6. **Before the February trials:** check the Actions tab shows the four schedules still enabled (GitHub turns them off after 60 days without a commit; the Monday results commit should prevent that), and that the `odds` runs show NRL games once markets open (step 4's checks). If the key is ever exposed, make a new one at the-odds-api.com and update both the secret and `.env`.

**Database and website**

- 🔶 **Step 6. The Supabase database.** *Built (October 2026, `supabase` branch):* `supabase/migrations/20261011000000_model_data.sql` beside the tipping migration: the model tables and views in §2, invites with `check_invite()` and `join_comp()` (joining is the only way to get a profile), the `summaries` and `model_versions` tables for the agent features (§7), the read-only `analyst` role for agents, and every grant made explicitly (Supabase's defaults grant everything, so the migration revokes them first). *Checked:* `npm test` in `web/` (39 tests): the tipping rules and lockout as before, plus the views (prediction of record, the market's opening and closing price, the model's record against `grade.metrics`' definitions), invites and joining, who can read and write what (including the analyst role), postponed games in the scores and unknown teams. The tests now start from Supabase's default permissions (`web/tests/db.ts`), so they check what a real project would allow. Ladder ties were already covered. *Live (11 October 2026):* project `nrl-predictor` (ref `szukyfanuvjajjezxuar`, Sydney, free plan), all four migrations pushed; checked on the live database: 16 tables, every one with row-level security, 8 views, 18 teams, and the `analyst` role (no password yet). The margin-game draw (11a) and publishing (7) fill `rounds` and the model tables.
- 🔶 **Step 9. The pages read the database.** *Built (October 2026, `extras` branch):* `web/lib/data.ts` reads the model's data into the row shapes in `lib/types.ts` (rounds, match detail, model vs market, season scoreboard and bets, model record, Elo by season and by team, previews and recaps); `web/lib/source.ts` gives each page the database's data when `SITE_DATABASE_URL` is set, the sample otherwise, and the sample notes show only on sample data. **Design change:** model data is read server-side straight from Postgres (postgres.js over Supabase's transaction pooler, as the read-only `analyst` role, which sees nothing about the tippers) rather than through Supabase's JavaScript client: it's testable here against the same Postgres as everything else and reads the views as they are. Tips and sign-in stay on Supabase's client (step 10), so row-level security applies per tipper. Converted: `/`, `/round`, `/match`, `/odds`, `/elo`. *Checked:* `web/tests/data.test.ts` against PGlite as `analyst`, and against the whole 2026 backfill (`TEST_SITE_DATABASE_URL`); the pages rendered against a local database holding the backfill, and `/odds` and the match page's Elo give exactly the sample's numbers; without a database every page renders the sample as before. *Still to do:* odds history on match pages; the coming round on `/odds` (live, it shows finished rounds).
- 🔶 **Step 10. Implement the live stores.** *Built (October 2026, `live-tipping` branch, merged into `main`), and joining tried against the live project (12 October 2026):* `SupabaseTipStore`, `SupabaseAuthStore` and `SupabaseAdminStore`, each returned by its `create…()` function when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (the sample stores otherwise). `lib/supabase.ts` and `lib/supabase-server.ts` hold the clients, with the session in cookies (`@supabase/ssr`) and `middleware.ts` refreshing it. **Sign-in is Google only for now** (decided October 2026: email links need custom SMTP); `EMAIL_SIGN_IN` in `lib/auth.ts` turns email back on. The `/tipping` page reads the round in play from the model's data and the tips from Supabase as the viewer, so row-level security decides what they see; the auto-tip lock comes from the season's first kickoff (`autoTipLocked()`). Server routes hold the service key for the two deletions: `/api/account` (your own account) and `/api/admin/tipper` (admin only, never yourself or the Model). New migration `20261014000000_live_tipping.sql`: `admin_tip_counts()` for the admin's "still to tip" list (counts, not picks), and invites stay used after their tipper leaves (judged on `used_at`). *Checked:* `npm test` (50 tests, including the new function and the departed-tipper case), the publish tests, type-check, lint and a sample-mode build. Google's name and photo are dropped from each sign-in by triggers on `auth.users` and `auth.identities` (migration `20261015000000_no_google_profile.sql`; tested in PGlite, tried on the live project in a rolled-back transaction, then pushed). *The trial (12 October 2026):* both new migrations pushed and checked on the live database (the function, both triggers, and the one existing sign-in stripped); joining with Google on `localhost` worked, and "sbeve" (stephen.j.sung@gmail.com) is in the comp and the admin. It found three bugs, now fixed: the callback exchanged the one-time code twice (React runs effects twice in development, and Supabase's client exchanges the code itself as it starts), so a working sign-in showed "link-failed"; the join page had no way to sign out of the wrong Google account (now "Not you?"); and Google reused the last account without asking (now `prompt: select_account`). A wrong-account sign-in that never joined was deleted. *Checked live (October 2026):* `SITE_DATABASE_URL` connects locally, `/tipping` shows "No round to tip" off-season, and the admin page makes invites. *Still to do:* deleting an account and removing a tipper need `SUPABASE_SERVICE_ROLE_KEY`; tipping itself can only be tried once 2027's games are predicted (February trials); the tippers' parts of `/` and `/round`. *Done (12 October 2026, `live-ladder`):* `/tipping/ladder` and `/model` (see below).
- ✅ **Step 10b. The ladder and `/model` on real scores** (12 October 2026, `live-ladder` branch). *Ladder:* `lib/comp.ts` reads the season's `ladder()`, `round_scores`, `tip_results` (each tip, own or auto, on every decided game), the decided games and their prediction of record through Supabase as the signed-in tipper, and `ladderView` shapes them into the sample's ladder entries, so the table, round grid, "you're 3rd" line, bragging rights and tags are one layout for both (bragging rights and tags moved to `lib/comp-stats.ts`; tags only with 3+ tippers). Signed out: "Sign in to see the ladder"; signed in but not joined: the same message as `/tipping`. Requests are paged past Supabase's 1,000-row limit. **The comp starts in 2027** (`COMP_FIRST_SEASON`, decided 12 October 2026): the scoring auto-tips every game since a season began, so the 2026 ladder would have shown "sbeve" on 213 home-team auto-tips (1st, 116 points); earlier seasons are never shown. **Late joiners keep the current rule** (decided the same day): games before someone joined get their auto-tip, as a forgotten tip would. *`/model`:* the latest graded season from `graded_games` through the shared `buildRecord` (`lib/model-record.ts`), counting tips as `grade.py` and `model_accuracy` do (50% or more tips the home team; the sample used to count an exact 50-50 price as no tip, so its bookies' count moved from 39 to 40 of 70); every best call and worst miss links to its match page; the comp line appears only for a signed-in tipper in a comp season. Both pages render per request. *Checked:* `tests/comp.test.ts` (a hand-worked two-round comp read as a signed-in tipper under row-level security: order, the Model unranked, margin tiebreak, movement, a late joiner's auto-tips, bragging rights, tags, nothing before a decided game, no ladder without signing in); `tests/data.test.ts` (the record from graded games, and against the live database the 2026 record equals `model_accuracy`: 143, 135 and 133 of 213); a production build against the live project (`/model` shows the real 2026 record, finals as FW1–FW3 and GF; the ladder asks to sign in) and in sample mode. *Not yet seen:* a signed-in ladder with real tips, which needs 2027's first decided game. *Speed:* every ladder view recomputes the auto-tips in SQL three times (`ladder()`, `round_scores`, `tip_results`); fine for a few friends, cache it if it gets slow.
- **Step 11b. The Reddit API** goes behind `NewsSource`. *Needs:* a Reddit app.
- ✅ **Step 12. Deploy to Vercel** (milestone 5). *Live (12 October 2026):* **https://nrl-predictor.vercel.app** (Vercel project `nrl-predictor`, Hobby plan, imported from GitHub with **Root Directory `web`**; every push to `main` deploys). Environment variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `sb_publishable_` key), `SITE_DATABASE_URL` (the `analyst` role over the transaction pooler) and `SUPABASE_SERVICE_ROLE_KEY` (Supabase now calls it the **secret key**, `sb_secret_…`, under Project Settings → API Keys; the variable keeps its old name). Vercel's Supabase integration was deliberately **not** added: it makes a new project or its own variables, and would connect as `postgres` rather than `analyst`. Supabase's Site URL is the Vercel address, with `https://nrl-predictor.vercel.app/**` beside `localhost` in the redirect URLs. The deploy needed three changes:
  - **Next.js 15.5.4 → 15.5.27** (and `sharp` patched): Vercel refuses to publish a build with Next.js's CVE-2025-66478, even after it builds. `npm audit` still reports a PostCSS advisory inside Next that only Next 16 clears; it runs at build time on our own CSS, so it's no risk to the live site.
  - **`/tipping` renders per request** (`export const dynamic = "force-dynamic"`). Live, it read the database before anything marked it dynamic, so the build prerendered it from Supabase; one query waited the server's full 2-minute statement timeout (most likely a lock held by a migration or publish at that moment; the same code takes 0.13 s) and the build failed. Checked: a build with `SITE_DATABASE_URL` pointing nowhere passes, so no page reads the database at build time. Every data page is now rendered per request (`ƒ`), so it always shows the latest published data.
  - **Functions in Sydney** (`web/vercel.json`, `"regions": ["syd1"]`, also set in the dashboard): Vercel's default is Washington (`iad1`), a Pacific round trip from the database for every query. Builds still run in Washington; that's normal. Check: a deployment's Resources tab shows `SYD1`.
  - Also, migration `20261018000000_analyst_timeout.sql`: the `analyst` role's queries time out at 15 s instead of 2 min, so a stuck read fails fast. The transaction pooler ignores a timeout sent when connecting, hence the role setting. Pushed and checked on the live database (`statement_timeout=15s`).
  
  *The revalidation endpoint isn't needed for now:* no data page is cached, so nothing needs refreshing after a publish (`REVALIDATE_URL` stays unset and `publish.py` skips the call). Add it only if pages get cached later for speed. *Not done:* a custom domain (about US$10–15 a year for a `.com`, A$15–25 for `.au`; Vercel connects it for free on Hobby; if added, update Supabase's Site URL and redirect URLs).

**Setting up Supabase: steps only you can do** (no Docker needed). Where they stand (11 October 2026):
- ✅ Steps 1–5: project `nrl-predictor` (ref `szukyfanuvjajjezxuar`), migrations pushed, `SUPABASE_DB_URL` locally and in GitHub, 2026 loaded. The spare project made by mistake is deleted.
- ✅ Step 7, Google: OAuth client made in Google Cloud and the Google provider turned on; `http://localhost:3000` added to the redirect URLs. **Email links: not set up, by choice** (Google only for now, so no custom SMTP).
- ✅ Step 9: `ANTHROPIC_API_KEY` in GitHub secrets and the local `.env`.
- 🔶 Step 6: the `analyst` role has a password (12 October 2026; kept as is, by choice) and `SITE_DATABASE_URL` in `web/.env.local` connects (password fixed, checked 13 October 2026). The Vercel variables are set (12 October 2026, step 12), and the Site URL and redirect URLs point at `https://nrl-predictor.vercel.app`. Still to do: the secret key in `web/.env.local` too, only to try the deletions locally.
- ✅ Step 8: "sbeve" (stephen.j.sung@gmail.com) is the admin (12 October 2026).
- ✅ Step 10: `BACKUP_PASSPHRASE` in GitHub secrets and the password manager (confirmed 12 October 2026).

Lessons from doing them:
- `npx supabase login` and `link` need a real terminal: from Claude Code's `!` prompt the login fails ("non-TTY"). Run them in a separate PowerShell window; the login is saved for later commands.
- The Connect panel shows the *direct* connection first (`db.<ref>.supabase.co`, user `postgres`). It doesn't resolve from here or from GitHub. Use the session pooler: user `postgres.<ref>`, host `aws-0-ap-southeast-2.pooler.supabase.com:5432`.
- After a few wrong passwords the pooler blocks all new connections for about 10 minutes (`ECIRCUITBREAKER`). Test a new password with a single connection, not a retry loop.
- Keep the password to letters, digits and `! - _ . ~`, so it never needs percent-encoding in the URL.
- Deploying (12 October 2026): on Vercel's New Project page, the box at the top is v0 (the AI app builder), not an import; use *Import Git Repository*, and set the Root Directory to `web`. A region or variable change only applies to the next deployment (Deployments → ⋯ → Redeploy). The address to give Supabase and friends is the project's domain (`nrl-predictor.vercel.app`), not the per-deployment one with random letters.

1. **Create the project.** supabase.com → sign in with GitHub → *New project*. Name `rugbyleague-tipper`, region **Sydney (ap-southeast-2)**, free plan. Choose a strong **database password** and keep it in a password manager: the CLI asks for it, and it can't be shown again (only reset).
2. **Note the project's details** (Project Settings → API, and → General): the **project URL**, the **anon (public) key**, the **service-role key** (secret: never in the browser or the repo), and the **project ref** (the id in the dashboard's address, e.g. `abcdefghijkl`).
3. **Push the migrations from the repo** (in a terminal at the repo root, on `main`):
   > ⚠️ **Do this before step 4.** Once the `SUPABASE_DB_URL` secret is in GitHub, every scheduled run publishes. If the tables don't exist yet, publishing fails and the workflow sends a failure alert. Push the migrations first, check them in the Table Editor, and only then add the secret.
   ```
   npx supabase login                         # opens the browser once
   npx supabase init                          # only if supabase/config.toml doesn't exist yet
   npx supabase link --project-ref <ref>      # asks for the database password
   npx supabase db push --dry-run             # lists the four migrations it would apply (tipping, model data, Perth Bears, weather)
   npx supabase db push
   ```
   Then the Table Editor should show `matches`, `tips`, `predictions` and the rest, each with RLS enabled. The CLI needs Docker only for `db pull` and the local stack, not for `db push`.
4. **The pipeline's connection string.** Dashboard → *Connect* (top bar) → *Session pooler* → copy the URI (it looks like `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`) and put the database password in place of `[YOUR-PASSWORD]`. Use the **session pooler**, not the direct connection: free projects' direct connection is IPv6 only, and GitHub's runners have no IPv6.
   - Add it to GitHub as the secret `SUPABASE_DB_URL` (Settings → Secrets and variables → Actions), **only after step 3's migrations are in**. From then on every scheduled run publishes.
   - Add it to your local `.env` as `SUPABASE_DB_URL=...` too (ignored by git).
5. **Load the 2026 season** (once, from your computer, which has the final test's predictions in `reports/`): `.venv/Scripts/python pipeline/publish.py --backfill 2026`. It prints the rows written: 1,423 games (2021–2026, for head to head), 7,268 Elo ratings since 2009, 213 predictions and graded games, and the Model's 213 tips. Safe to run again. `--dry-run` counts the rows without connecting.
6. **The website's keys** (for step 12):
   - The project URL and the anon key, as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (sign-in and tips, step 10).
   - **`SITE_DATABASE_URL`** for the pages' model data: in the SQL editor give the read-only role a password (`alter role analyst login password '...';`), then take the **transaction pooler** string (Connect → Transaction pooler, port 6543) and use `analyst.<ref>` as the user and that password. Vercel only; the role can't see tips or profiles.
   - The service-role key only for the website's server routes (deleting an account, step 10), as `SUPABASE_SERVICE_ROLE_KEY` in Vercel; it never goes in the browser, the repo or GitHub.
7. **Sign-in settings** (Authentication → Sign In / Providers; needed for step 10):
   - **Email links:** Supabase's built-in email only sends to members of your Supabase organisation, about 2 an hour, so friends' links wouldn't arrive. Set up custom SMTP (Authentication → Emails → SMTP; for example Resend's free plan, with link tracking off) before inviting anyone, or offer Google only.
   - **Google:** create an OAuth client in Google Cloud (APIs & Services → Credentials), add the callback URL Supabase shows, and paste the client id and secret into the Google provider.
   - Set the Site URL and redirect URLs to the Vercel address (and `http://localhost:3000` for development).
8. **Make yourself the admin** after you've joined through the site once (Table Editor → `profiles` → your row → `is_admin` = true), or in the SQL editor: `update profiles set is_admin = true where display_name = '<you>';`. The Model's profile is made by the pipeline (step 7).
9. **Agents** use the same `analyst` role (its password is set in step 6; never in a migration). **Claude-written previews and recaps:** add `ANTHROPIC_API_KEY` to GitHub secrets (console.anthropic.com → API keys); without it the step is skipped.
10. **Off-season and backups:** free projects pause after a week with no activity (restore from the dashboard; nothing is lost). Every scheduled run publishes, even with nothing to do, which keeps it awake all year. The free plan has no backups you can download, so Monday's run saves an encrypted backup of the tipping tables (`pipeline/backup.py`) as a 90-day workflow artifact: add a long passphrase as the GitHub secret **`BACKUP_PASSPHRASE`**, and keep a copy in your password manager (without it a backup can't be read). To restore: download the artifact, then `python pipeline/backup.py --restore FILE` with `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` set.

**Optional: Docker, to run Supabase on your computer.** Useful from steps 9–10: real sign-in, a mail catcher for email links, and the dashboard, all offline. Not needed for steps 6–7, which are tested in PGlite. Checked October 2026: virtualisation is on, 15 GB RAM and 700 GB free, so only WSL is missing. About 30 minutes:

1. Open PowerShell **as administrator** and run `wsl --install`, then restart.
2. Install **Docker Desktop** (docker.com, free for personal use), keeping "Use WSL 2", then open it once so it's running (the whale icon in the taskbar).
3. In the repo: `npx supabase start`. The first run downloads the images (a few GB, a few minutes) and prints local URLs and keys: the API, Studio (the dashboard) and Mailpit (where email links land). `npx supabase db reset` reapplies every migration from scratch, and `npx supabase stop` shuts it down. It uses about 2–3 GB of RAM while running.

**Joining the two** (the branches are merged, so this can start once step 6 exists)

- 🔶 **Step 7. `pipeline/publish.py`.** *Built (October 2026, `publish` branch):* copies the season's records into the step 6 tables, every write an upsert on the table's key in one transaction, so it's safe to re-run and the database can be rebuilt from the repo: the games (finished ones, and the coming ones the predict job has seen, now saved in `fixtures.csv` with their match ids, since the draw doesn't give them), the odds sheet's prices and the live snapshots (turned round where the API lists home and away the other way), every team list fetched, Elo before and after every game (`run_elo(..., after=True)`), the model versions from `meta.json`, the run log, every prediction and the graded games. The Model gets a profile and tips its prediction of record (and its margin for the round's margin game) for games not yet started. `--backfill 2026` publishes the final test's predictions as the 2026 record, with every scraped season's games (2021 on, for head to head) and Elo since 2009. It connects with `SUPABASE_DB_URL` (the session pooler) and skips without it; it calls `REVALIDATE_URL` once the site exists. The scheduled workflow publishes after every job that didn't fail. *Checked:* `tests/test_publish.py` against a real Postgres (CI's Postgres service, or PGlite over the Postgres protocol locally, `web/tests/pglite_server.mjs`): publishing twice gives the same rows; the views return the prediction of record and the live opening price; the Model tips only coming games; Elo equals the engine's; and the 2026 backfill's `model_accuracy` equals `grade.metrics` exactly for the model, both markets and Elo, with the Model's tipping record equal to its graded tips. *Live (11 October 2026):* pointed at the real project; `publish.py --backfill 2026` wrote 1,423 games, 1,423 odds-sheet rows, 7,268 Elo ratings, 213 predictions, graded games and weather rows, and the Model's 213 tips, and the live `model_accuracy` for 2026 equals `reports/final_2026.md` (213 games, log loss 0.6516, Brier 0.2289, 67.1% tips, margin MAE 15.32, total MAE 10.96). *Still to do:* a private weekly export of the tipping tables before friends start tipping (GitHub artifacts on a public repo aren't private, so it needs encrypting or another home); the revalidation call once the site is deployed (step 12).

**Built without keys (October 2026, `extras` branch), beyond the steps above**

- ✅ **Encrypted backup of the tipping tables** (`pipeline/backup.py`): sign-in ids and emails, profiles, rounds, invites and tips, AES-256-GCM under a key from `BACKUP_PASSPHRASE`; Monday's workflow keeps it 90 days. Tested: export, wipe, restore gives the same rows; no names or emails readable without the passphrase.
- ✅ **Claude-written previews and recaps** (`pipeline/summaries.py`, §7): a preview of each coming game after predict and refresh, a recap of each fully graded round after results, from model data only (never the tippers), Claude Opus 5.5 at low effort with server-side refusal fallbacks; each text records the model and prompt version, goes to `summaries.csv` and the `summaries` table, and the round and home pages show the recap. Without `ANTHROPIC_API_KEY` it does nothing, and it can't fail a run. Tested with a fake client.
- ✅ **Paper trading** (above, build status).
- 🔶 **Step 4c, the odds sheet download** (above, build status). Built, but on GitHub's runners the site answers `403 Forbidden` (first seen 11 October 2026, in the results run's `odds_sheet` entry in `runs.jsonl`). Options: send a browser-like user agent, if the terms allow automated downloads at all; download it by hand or from your computer before the yearly routine; or drop the automatic download. It only matters for closing prices, grading against the market and retraining, not for the weekly predictions. Tie this to the open question on the sheet's terms.
- 🔶 **Step 13, the Perth Bears:** in `ingest.TEAM_MAP`/`TEAM_STATE`, `features.TEAM_BASE` (Perth; left out of seasons before 2027, and the features are identical with and without them), the `teams` table (migration `20261012000000_perth_bears.sql`) and `web/lib/teams.ts` (red and black, PER). Assumes nrl.com calls them "Bears" and the odds sheet "Perth Bears": check both when the 2027 draw is out. Still to do in step 13: `REGULAR_ROUNDS[2027]` once the draw is known, the final 2026 data and the `2027.1` freeze.

**Trying step 10 on your computer** (steps 1–5 done; the `SITE_DATABASE_URL` password fixed by 13 October 2026):
1. Push the new migration: `npx supabase db push` in a PowerShell window at the repo root (it lists `20261014000000_live_tipping.sql`).
2. In the SQL editor: `alter role analyst login password '<letters and digits>';`, then in `web/.env.local` uncomment `SITE_DATABASE_URL` and put that password in it (transaction pooler, port 6543, user `analyst.szukyfanuvjajjezxuar`).
3. The first invite, made in the Model's name since nobody can make one before there's an admin: `insert into invites (code, created_by) values ('FIRST27', '00000000-0000-4000-8000-00000000a0de');`
4. `npm run dev` in `web/`, open `http://localhost:3000/join/FIRST27`, *Continue with Google*, fill in name, team and auto-tip. If the Google app is in "Testing", add your Gmail as a test user first.
5. `update profiles set is_admin = true where display_name = '<you>';`, then try the admin page's invites. Off-season, `/tipping` says "No round to tip".
6. Optional: `SUPABASE_SERVICE_ROLE_KEY` (the secret key) in `web/.env.local`, to try deleting an account and removing a tipper.

**What's still to do** (12 October 2026):

*You:*
- ✅ Checked `/tipping` and made an invite on the admin page (October 2026).
- Optional: `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`, to try deleting an account.
- The odds sheet decision (open question below; making the repo private is the simplest).
- On the live site (https://nrl-predictor.vercel.app, deployed 12 October 2026): sign in with Google, make an invite on `/tipping/admin`, and have a friend join with `/join/<CODE>`. While the Google OAuth app is in "Testing", only Gmail addresses added as test users can sign in: add friends there, or publish the app (name and email only, so no review is usually needed).
- Optional: a custom domain (step 12).
- Optional: a Reddit app (step 11b).
- Add credit to the Anthropic API account before the season (**deferred by choice**, 12 October 2026). Until then `summaries.py` can't write previews or recaps: the API answers "credit balance is too low", the workflow step fails without stopping the run, and the site shows no text. Everything else (drivers, briefs, publishing) works without it. Once there's credit, try the previews on a replayed round before relying on them (§7.4, not yet tried with real Claude).

*Me (Claude):*
- Step 10, the rest: the tippers' parts of `/` and `/round`; tipping itself, and the live ladder with real tips, in the February trials.
- Step 12 is done; the revalidation endpoint only if pages are ever cached.
- Step 4c: the odds sheet's 403 on GitHub.
- Step 11b: the Reddit API, once there's an app.
- Step 13 when the 2027 draw is out, and step 14 in February.
- §7.1 on the site: the "What drove this" panel on match pages, from `record_drivers` (web branch; see "Still to add to the website").
- Refreeze the 2027 models with item 47's LightGBM inputs (`python src/train.py --freeze --force`, version `2027.1` kept), on a backend branch: `models/2027/` still has `diff_rapm_attack` and `is_final`. Then replay a few 2026 rounds with them as a check. Repeat at step 13 if more 2026 data arrives.

**Open questions**

- **The odds sheet's terms** ("personal use only; do not make the data available elsewhere"): the sheet is committed to this public repo, and its prices appear on the public site (`/odds`, match pages) and in `odds_sheet`. Options: make the repo private (GitHub Actions stays free at 2,000 minutes a month, more than enough), stop committing the sheet (download it in each run instead), ask aussportsbetting.com, or show only Betr's live prices on the site. Your call. Related: the site refuses the automatic download from GitHub's runners (403, step 4c), which may itself be a sign it doesn't want automated downloads.

**The 2027 season**

- **Step 13. The yearly routine** (note 5): the final 2026 data, the Perth Bears added, then freeze `2027.1` (with item 47's LightGBM inputs; if the refreeze above is done first, refreeze again only if the data changed).
- **Step 14. Dry run on the February trials** with friends tipping (milestone 11), then **launch for Round 1** (milestone 12).


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
`data/nrl_betting_odds.xlsx` comes from aussportsbetting.com's historical NRL results-and-odds download. It's the only source of the *opening* prices the with-odds model was trained on, and of closing prices for grading against the market.
- *Recommendation:* download it in the Monday results job (confirm the direct file link and the site's terms first). It doesn't reliably list the coming round in time, so the week's opening prices come from Betr through The Odds API (step 4); the sheet stays the source of closing prices and of the history for retraining.
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

There is no always-on server. The model is the frozen bundle committed in `models/<season>/`; each scheduled run checks out the repo, loads it, predicts and exits. Supabase holds everything the website shows, and Vercel re-renders pages when the pipeline tells it new data is in.

**The backend pieces, and where each is built** (step numbers from Next steps):

| Piece | What it does | Branch / step | Status |
|---|---|---|---|
| Scheduled runs | GitHub Actions `results.yml` (Mon), `predict.yml` (Tue), `refresh.yml` (Wed–Sun), `odds.yml` (Sun night), each calling `pipeline-job.yml`, and `ci.yml`: install, restore the raw-page cache, call `pipeline/run.py`, alert on failure, commit records (also the keep-alive) | `backend`, step 8 | 🔶 on `main` and scheduled; every workflow run by hand (11 October 2026); a full in-season week still to come |
| The weekly jobs | `pipeline/run.py`: scrape, round detection, predict, validate, grade, run log | `pipeline`, steps 1–2 | ✅ |
| Data sources | Draw, results and team lists (`scrape.py`, `draw.py`); Betr's live prices from The Odds API (`fetch_odds.py`); odds sheet download (`fetch_sheet.py`); weather for the site (`fetch_weather.py`) | `backend`, steps 4–5 | ✅ built; the weather display is on the website side |
| Interim storage | Run log, every prediction and the graded season as CSV in `data/pipeline/live/<season>/`, committed by the results job | `pipeline` | ✅ (until step 7) |
| Database: tipping | `matches`, `profiles`, `rounds`, `tips`, scoring views, `ladder()`, row-level security | step 3 | ✅ tested locally and pushed to the live project |
| Database: model data | `teams`, `model_versions`, `pipeline_runs`, `predictions`, `graded_games`, `team_lists`, `odds_snapshots`, `odds_sheet`, `elo_ratings`, `summaries`, `invites`; views `prediction_of_record`, `match_odds_probs`, `model_accuracy`; the `analyst` role; the Supabase project itself | `supabase`, step 6 | ✅ live project `nrl-predictor`, migrations pushed, 2026 loaded |
| Publishing | `pipeline/publish.py`: upsert the season's records in one transaction over the session pooler (safe to re-run), the Model's tips, call the revalidation hook; `--backfill 2026`; run after every scheduled job | `publish`, step 7 | ✅ publishes after every scheduled run; the revalidation call isn't needed while pages aren't cached |
| Website server side | `lib/supabase.ts` (server and browser clients), queries replacing `sample*.ts`, Supabase tip/auth/admin stores, `/auth/callback`, the `/api/revalidate` endpoint (secret-protected), Reddit fetched and cached on the server | `web-design`, steps 9–11b | 🔶 steps 9–10b built and live; the Reddit API (11b) not done |
| Hosting | Vercel deploy with `noindex`, `robots.txt` and the environment variables in §1.5 | step 12, live at `nrl-predictor.vercel.app` (12 October 2026) | ✅ |
| Tip reminders (optional) | A scheduled Supabase function emailing tippers before each round's first game | later (§3.5 extras) | ❌ |

Accounts and secrets only you can set up: Supabase, The Odds API, a Reddit app and Vercel, with their keys in GitHub and Vercel secrets (§1.5). Free Supabase projects pause after a week without activity; the weekly runs keep it awake in season, so check it after the off-season.

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
| **Odds** | Sunday 9:15pm | Fetch Betr's prices only (`run.py --job odds`). The next round's markets usually open once the round ends, so this catches each game's price close to when it opens, as the odds sheet's opening price was, instead of at Monday's results job. |
| **Prediction of record** | Each game's kickoff | The last prediction made before kickoff is frozen as the official one. This is what accuracy and "beat the model" are measured against. |

GitHub Actions cron uses **UTC only** and doesn't follow daylight saving. Pick UTC times that work in both AEST and AEDT. For example, `15 7 * * 2` (07:15 UTC Tuesday) is 5:15pm AEST or 6:15pm AEDT, both after team lists, and `15 11 * * 0` (11:15 UTC Sunday) is 9:15pm AEST or 10:15pm AEDT, after the round's last game. Use an off-the-hour minute, because GitHub delays jobs that start on the hour when it's busy.

Freezing the prediction of record doesn't need a job at kickoff. It is a database view: "the latest prediction with `created_at < kickoff`".

### 1.2 Pipeline steps

`pipeline/run.py --job {results|predict|refresh}` runs these steps. Each one is a plain function, can be run on its own, and is safe to re-run (writes are upserts keyed on match and run).

1. **Fetch the draw:** fixtures, kickoff times, venues and match status for the season. NRL.com's draw page is backed by a JSON endpoint, which is far more stable than scraping HTML.
2. **Fetch results and match stats** for completed games (the same scraper as the core model).
3. **Fetch team lists:** the named players plus reserves for each team, with an `announced_at` timestamp. Keep every version, so changes between Tuesday and kickoff are visible and features can be rebuilt as they were at any point. (`predict.py` already saves each fetch to `data/raw/teamlists_live/`.)
   - **The named 17** is the 17 lowest-numbered players who aren't reserves (`features.named_from_list`). Since 2026 the Tuesday squad lists a **six-man interchange** (jerseys 14–19) that is cut to four later in the week, so a Tuesday list has 19 non-reserves and jerseys 1–17 are the expected team. On final lists, late replacements keep higher numbers (e.g. 20), and the rule still finds the 17.
4. **Fetch odds:** head-to-head, line and total from [The Odds API](https://the-odds-api.com) (NRL is `rugbyleague_nrl`). Store each fetch as a timestamped snapshot. The free plan is enough (see §1.6).
   - **Match what the model was trained on.** The with-odds model learned from *opening* prices of one bookmaker in the aussportsbetting.com sheet (bet365 until April 2024, BlueBet since, with BlueBet indicator inputs). BlueBet now trades as Betr (merged 2024), which The Odds API carries as `betr_au`, so the pipeline fetches Betr and uses the **first snapshot after odds open** as the opening price (`fetch_odds.py`). Keep downloading the aussportsbetting sheet too, for closing prices and retraining.
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
| `SUPABASE_DB_URL` | Pipeline (`publish.py`): the session pooler connection string, with the database password. Writes as the database owner, so it never goes near the website |
| `SUPABASE_SERVICE_ROLE_KEY` | Website server routes only (deleting an account; bypasses row-level security, so never sent to the browser) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website (public, limited by row-level security) |
| `ODDS_API_KEY` | Pipeline |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Website (news feed) |
| `REVALIDATE_SECRET` | Pipeline calls the website's revalidation hook with it |
| `ANTHROPIC_API_KEY` (optional) | Pipeline: Claude-written previews and recaps (`summaries.py`) |
| `BACKUP_PASSPHRASE` | Pipeline: encrypts Monday's tipping backup (`backup.py`); keep a copy outside GitHub |
| `SITE_DATABASE_URL` | Website (Vercel): the read-only `analyst` role over the transaction pooler, for the pages' model data |

### 1.6 Staying on free plans

Every service fits in its free plan at this size:

| Service | Free allowance | This project's use |
|---|---|---|
| GitHub Actions | Unlimited for public repos; 2,000 minutes a month for private ones | About 13 short runs a week, a few minutes each, so under 200 minutes a month |
| Supabase | 500 MB database, 50,000 monthly active users | A few MB of data and a handful of users. Free projects pause after a week with no activity, and the pipeline's weekly writes keep it awake in season. Check it in the off-season. |
| Vercel (Hobby) | Free for personal, non-commercial sites | Exactly this case |
| The Odds API | 500 credits a month | See below |
| Reddit API | Free for low-volume, non-commercial use | A few requests an hour, thanks to caching |

**The Odds API doesn't need a paid plan.** Credits aren't the same as requests: each call costs *markets × regions* credits. One call for head-to-head, line and total in the Australian region costs 3 credits and returns every game in the round. Every job fetches once, 13 fetches a week (§1.1), so about 39 credits a week, or about 170 a month, well inside 500. Calls that return no games cost nothing, and there are no games in the off-season.

A paid plan would only be needed to:

- fetch odds much more often (for example hourly, about 1,500 credits a month)
- add more regions or markets
- download **historical** odds through the API, which costs 10 times as much per call. This isn't needed, because historical closing odds for backtesting come free from aussportsbetting.com (PLAN.md §1).

To stay safe, the pipeline reads the remaining credits from the response headers (`x-requests-remaining`) after each call, logs them, and skips the odds step with a warning if fewer than 50 are left.

---

## 2. Database

One Postgres database in Supabase. Schema changes live in `supabase/migrations/` so they are versioned with the code.

Written in `supabase/migrations/` (`20261010000000_tipping.sql`, `20261011000000_model_data.sql`) and tested in PGlite by `npm test` in `web/`. The repo stays the source of truth for model data: `data/pipeline/live/` is committed and publishing is a re-runnable upsert, so the model tables can always be rebuilt from it. Only the tipping data lives only here.

### Model data (written by the pipeline only)

| Table | Key columns |
|---|---|
| `teams` | name (nrl.com's nickname, e.g. `Storm`), full name, state. Matches and team lists must use these names; a new club is added here |
| `matches` | id (nrl.com), season, round, kickoff (UTC), home team, away team, venue, city, neutral, status (scheduled / live / final / postponed / cancelled), home score, away score |
| `model_versions` | version (`2027.1`), season, seasons trained on, commit, features hash, settings, headline backtest figures, notes |
| `pipeline_runs` | id, job, season, mode, clock, started, finished, status, round, games, model version, commit, notes, and the whole `runs.jsonl` entry |
| `predictions` | run, match, `created_at`, model version, with or without odds, home win probability, margin, total, display scores, the no-odds probability, the opening price used, inputs fingerprint, why it changed |
| `graded_games` | match, run, model version, the prediction of record, opening and closing market, Elo, the result, tip correct (from `pipeline/grade.py`) |
| `team_lists` | match, team, `fetched_at`, nrl.com's update time, player, jersey number, position (every version kept) |
| `odds_snapshots` | match, bookmaker (`betr_au`), `captured_at`, head-to-head prices, line and its prices, total and its prices |
| `odds_sheet` | match, bookmaker, opening and closing price, line and total from the aussportsbetting sheet, and whether the closing figures are reliable |
| `elo_ratings` | team, season, date, round, opponent, home or away, match (none before 2021), win chance, rating before and after |
| `summaries` | kind (match preview / round recap / model review), season, round, match, text, Claude model, prompt version, run (written by the pipeline, §7) |

Views:

- `prediction_of_record`: the latest prediction made before each game's kickoff.
- `match_odds` and `match_odds_probs`: each game's opening price (the sheet's, else the first live snapshot, as the predictions use) and closing price (the sheet's when reliable, else the last live snapshot before kickoff), with the bookmaker's margin removed.
- `model_accuracy`: per round and per season, for the model, the opening market, the closing market and Elo on the same games: games, tips correct, accuracy, log loss, Brier score, margin and total error. It adds up `graded_games`, so the metric definitions stay in `grade.py`.

### Tipping data (written by the website)

| Table | Key columns |
|---|---|
| `profiles` | user id (from Supabase auth), display name, favourite team, auto-tip choice (home team / crowd / ladder), admin flag |
| `invites` | code (8 characters, made by the database), created by, expires (7 days), used by and when, cancelled. `check_invite(code)` tells the join page a code's status and who sent it before sign-in; `join_comp(code, name, team, auto-tip)` makes the profile and uses the invite together, and is the only way to get a profile |
| `rounds` | season, round, featured match (for the margin; drawn at random by the predict job, excluding last round's featured teams, §3.5), drawn at |
| `tips` | user, match, team picked, margin (featured game only), updated. Only tippers' own tips: auto-tips aren't stored but filled in by the `effective_tips` view once a game locks, so a job that didn't run can't leave a gap |

There is **one comp** for the whole group, so no comp or membership tables are needed. Adding them later is easy if a second group ever wants in.

Views: `effective_tips` (every tipper's tip for every locked game, own or auto), `tip_results` (each tip marked correct or not once the game is final or cancelled), `round_scores` (points, bonus point and margin score per user per round) and the `ladder(season)` function (season totals, ranked by the rules in §3.5, with movement). Written in `supabase/migrations/20261010000000_tipping.sql`.

### Row-level security

This is where the rules are enforced, not just in the website code:

- Anyone can read model data. Only the pipeline's service key can write it.
- A user can insert or change their **own** tips only while `now() < kickoff` for that match. A tip can't be sneaked in after kickoff, even by calling the API directly.
- A user can see **other people's tips** for a game only after it kicks off. Before then, tips stay hidden so nobody copies.
- Only signed-in users can see the ladder and tips. Only an admin can see, create or cancel invites and see the run log. Removing a user deletes their sign-in account, which needs the service key (a server route, step 10). The featured game is drawn by the pipeline, not set by hand.
- Supabase grants every table to the public roles by default and relies on these policies. The migrations revoke that and grant each role only what it needs, so a table without a policy is closed rather than open.
- **The `analyst` role** is for agents (§7): it reads the model's tables and views and nothing about the tippers (no tips, profiles, invites or run log), and can't write anything. It can't log in until you give it a password by hand.

---

## 3. Website

### 3.1 Pages

Built pages are listed in [Website status](#website-status-october-2026) above.

| Path | Content |
|---|---|
| `/` | This round at a glance: each game with predicted score, winner, win probability and margin, plus the model's season record |
| `/round/[season]/[round]` | Any past or future round. Past rounds show the prediction of record next to the real result, marked right or wrong |
| `/match/[id]` | One game in detail: prediction, team lists (with changes since Tuesday), odds history, Elo for both teams, head to head, the LLM preview, and what drove the prediction (SHAP, later) |
| `/odds` | Model vs market for the round, and the season-long comparison |
| `/elo` | Elo ratings and history |
| `/tipping` | My tips for this round |
| `/tipping/ladder` | The ladder and round-by-round results |
| `/tipping/admin` | Invites (one use, 7 days), the tippers (remove one), this round's featured game and how it was drawn, and pipeline run status (admin only) |
| `/news` | r/nrl feed |
| `/model` | The Model's own page: its record this season as a tipper (tips right against the bookies' favourite and Elo, its place among the tippers, round by round, best calls and worst misses) and a short tested record |
| `/about` | How the model works, in plain words, and its limits, with a technical section and a link to `/model` |

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
| **Margin** | Each round has a **featured game**, **drawn at random** when the round's predictions publish, from the games that don't involve either team in the previous round's featured game (decided October 2026; if no game qualifies, from all the round's games). The draw is stored with the round and doesn't change, and everyone sees it before tipping. Enter a predicted winning margin for it. Your margin score for the round is the gap between your predicted margin and the real one, and it adds up over the season. If you don't enter one, a default margin applies. |
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
    run.py                     # entry point: --job results|predict|refresh, --as-of to replay (exists)
    draw.py                    # the draw, which games to predict, neutral venues (exists)
    grade.py                   # prediction of record, grading, season report (exists)
    replay.py                  # runs the weekly schedule over a past season, as a test (exists)
    common.py                  # paths and the run/prediction records (exists)
    fetch_odds.py              # Betr's prices from The Odds API, every snapshot kept (exists, step 4)
    publish.py                 # copy the records into Supabase, the Model's tips, revalidate (exists, step 7)
  supabase/
    migrations/                # tables, views, row-level security policies (tipping part exists)
    functions/tip-reminders/   # scheduled reminder emails
  web/                         # Next.js app (exists, on sample data)
    app/                       # pages: /, /round, /match, /odds, /elo, /model, /about, /tipping, /tipping/ladder (built); /news, /tipping/admin (to do)
    components/                # game rows, pitch bars, charts, market track, tip list, ladder
    lib/                       # types.ts (row shapes), scoring.ts and rules.ts (tipping rules), tip-store.ts, sample*.ts (generated)
    tests/tipping.test.ts      # the tipping rules in scoring.ts and in SQL (PGlite), and row-level security (npm test)
    scripts/                   # build_sample.py, build_odds_sample.py, build_elo_sample.py
    lib/supabase.ts, lib/reddit.ts  # to do
  tests/
    test_pipeline.py           # round detection, neutral venues, grading (exists)
    tipping/cases.json         # hand-worked tipping rule cases, shared by scoring.ts and the SQL (exists)
  .github/workflows/
    pipeline-job.yml           # one pipeline job: run, commit the records, alert (called by the four below)
    results.yml                # Monday
    predict.yml                # Tuesday after team lists
    refresh.yml                # Wednesday to Sunday
    odds.yml                   # Sunday night, odds only
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
| Backend | **Supabase**, reviewed again in October 2026 with the agent features in mind (§7): the tipping rules and lockout are Postgres SQL and row-level security, tested in PGlite; the website's sign-in, tip and admin stores are designed around Supabase; the pipeline writes with the service key; and it's free. The alternatives (Postgres on Neon with Auth.js, Firebase, SQLite-style databases) mean rewriting the tested rules or building sign-in by hand. Watch the free plan's limits: email sign-in needs custom SMTP, projects pause after a week idle, and there are no downloadable backups |
| Odds source | Betr through The Odds API (BlueBet, the sheet's bookmaker, now trades as Betr); the sheet for closing prices and history |

---

## 7. Agent features (later)

Planned: LLM-written match previews and round recaps, a weekly review of the model's results, an agent that reviews results and formulas and suggests changes, and an "Ask the model" chat. Where each part lives:

| Feature | Runs where | Reads | Writes |
|---|---|---|---|
| Match previews, round recaps, post-mortems, the weekly review | A step in the pipeline (Python, GitHub Actions, the Claude API with `ANTHROPIC_API_KEY`) after predict or results | The match brief (§7.4): one fact pack per game, assembled by code from the prediction, its drivers, Elo, form, team lists, odds and weather | `summaries` (with the Claude model, prompt version and the brief it was written from), shown by the site |
| Results-and-formulas reviewer | A scheduled GitHub Actions job working in the repo (for example Claude Code or the Agent SDK, headless), since it needs the code in `src/`, the history and the Python environment to run backtests | `data/pipeline/live/` (graded games, predictions), `models/<season>/meta.json`, the backtest reports, IMPROVEMENTS.md | A pull request with the change and its backtest, judged by the adoption rule (only a meaningful backtest gain is adopted; small gains go to "Already tried"). It never changes the live models or the database: you merge, then refreeze a new model version, which `model_versions` records |
| "Ask the model" chat | A website route on Vercel calling Claude with read-only SQL as its tool | The model's tables and views, through the `analyst` role | Nothing |

Rules for all of them: agents read through the `analyst` role or the repo, never the service key; nothing about the tippers goes into a prompt; and anything that changes the model goes through a pull request and a backtest.

### 7.1 Game-by-game explanations 🔶 (pipeline built; the match page's panel to come)

Every prediction says what drove it: "Storm 68%: the market had them at 62%; Hughes is back (+4 points); the Storm's line-up is stronger than usual (+2)". This is plain code in the pipeline, not an agent: the numbers have to be exact and reproducible.

- **Where it's calculated:** `predict.py`, at the same time as the prediction, from the same frozen models. It must not be recomputed later from a newer model.
- **How the ensemble is split up:** the main model is the 50/50 average of the linear model and LightGBM, so each half is explained separately and then averaged:
  - **Linear half:** exact. Each feature's contribution is its coefficient × (its value − the training mean), on the scaled inputs.
  - **LightGBM half:** SHAP values from LightGBM's own `pred_contrib`, averaged over the 5 seeds (as `evaluate.importance` does for the season summary).
  - **Margin blend and Platt calibration** sit on top of both halves, so the contributions add up to the prediction **before calibration**, not to the final probability. The page shows them in points of margin (easy to read) and says the parts are approximate. Whatever is left over is shown as "calibration".
- **Grouping:** about 20 features become 5–6 readable groups: the market (opening odds, BlueBet), team strength (Elo, team rating), line-up (RAPM total, defence, vs usual), star absences, context (rest, travel, finals) and conditions (wet). Each group is named in plain words with the players behind it where there are any ("Hughes, Munster out").
- **Change since Tuesday:** when a refresh changes the prediction, the difference between the two explanations says why. This replaces the hand-written `updated_reason` ("Hughes out") with one taken from the numbers.
- **Stored:** a new `prediction_drivers` table (run, match, model, group, feature, contribution in margin points and in log-odds), written with the prediction it explains.
- **Shown:** on `/match/[id]` as a "What drove this" bar list. The drivers are also the first section of the match brief (§7.4), so the preview quotes the real drivers instead of guessing.
- **Checks:** a test that the contributions plus the baseline give back the uncalibrated prediction for every model; and a replay of a 2026 round that gives the same drivers twice.
- **Built (October 2026, `explain-briefs` branch):** `src/explain.py` (`explain()`, `by_group()`; `python src/explain.py --season 2026 --round 10` prints a replayed round's drivers). The predict job records them in `drivers.csv` beside the predictions (`run.explain_step`, after the predictions are recorded; a failure is only a warning), and `publish.py` writes them to `prediction_drivers` (migration `20261017000000_explanations.sql`, with the `record_drivers` view: each game's prediction of record, summed by group). Two scales per input: margin points, which add up exactly to the ensemble's predicted margin (the baseline is the home side's average edge, about +2.8), and win log-odds before calibration, with a `(calibration)` row closing the gap to the published probability. The BlueBet inputs are read as part of the opening price. *Checked:* `tests/test_explain.py` (both variants add up to 1e-9 on 2026 Round 10, mixed variants, every input in a named group; slow: a replayed Tuesday run gives the same drivers twice and they add up to the recorded margins) and the publish test. *Still to do:* the "What drove this" panel on `/match/[id]` (web branch, from `record_drivers`); player names behind star absences (the brief's team news lists ins and outs meanwhile); the change since Tuesday as `updated_reason`.

### 7.2 Post-mortems of wrong predictions ⬜

After each round is graded, every badly missed game gets a short post-mortem: what the model believed, what happened, and why it was wrong.

**Which games count as wrong.** A wrong tip isn't enough: a 55% favourite loses 45% of the time, and explaining those would mostly explain noise. A game gets a post-mortem when the model was confident and lost (the winner had under 35%), or the margin was off by more than 2 standard deviations (about 30 points), or the market got it right and the model didn't (it tipped against the closing price and lost).

**Step 1, the facts (plain code, `pipeline/postmortem.py`).** Everything the explanation may use, assembled from data the pipeline already keeps:
- **The prediction's drivers** (7.1): what the model leaned on.
- **What changed after the prediction:** the final 17 against the list the prediction used (late outs), and the opening price against the closing price (did the market also move, and which way?).
- **Conditions:** the recorded wet flag and the weather (`weather` table) against what was assumed.
- **What happened in the game:** the team stats (errors, penalties, completion rate, possession), players who left the field early (minutes well below their role's usual), sin bins and send-offs where the data has them.
- **The market's view:** whether the closing price also had the loser favoured. If it did, the miss was shared, not the model's own.

**Step 2, the classification (plain code).** Each miss gets one main cause, so they can be counted over time:

| Cause | Test |
|---|---|
| Late team news | the final 17 differed from the list predicted on, and the line-up's driver moved enough to change the tip |
| In-game events | a key player played well under his usual minutes, or a send-off or several sin bins |
| Conditions | wet game not expected at prediction time |
| Shared upset | the closing price also favoured the loser |
| Model's own miss | none of the above, and the market got it right |
| Variance | none of the above (a close game, or an outcome no input pointed to) |

**Step 3, the write-up (Claude, like the recaps).** Claude turns the facts and the cause into 80–120 words, from those facts only: no outside knowledge, nothing invented about the game. Stored in `summaries` as a new kind, `match_postmortem`, with the cause as a separate column so it can be counted, and shown on the match page under the result.

**What a post-mortem never does:** suggest a model change. One game can't show a flaw in the model, and acting on single games is how a model gets tuned to noise.

### 7.3 From post-mortems to model changes (the agent loop) ⬜

Model changes come from patterns across many games, never from one. This is the "results-and-formulas reviewer" in the table above, with post-mortems as one of its inputs.

**Trigger:** every 6 rounds and at the end of the season, or sooner when the monitoring check (PLAN.md §7.7) flags drift. Not every round: a round is 8 games.

**The loop:**
1. **Look for patterns** (plain code first, so the agent reads statistics rather than stories): the share of each post-mortem cause against what the backtest would expect; the model's errors against each feature and each team (is there a feature it under-weights?); calibration by probability band; how the model does against the closing price, by month and by type of game.
2. **Decide whether anything is systemic.** A pattern counts only if it holds across at least 40 or so games and is unlikely to be chance (for example a bootstrap interval excluding zero), or if it repeats a bias already measured in the backtest (like the star under-reaction, item 38).
3. **Propose a change**, written down with its pass criteria before it runs: what changes, why the pattern points to it, and what backtest result would count as a meaningful gain.
4. **Test it** with the experiment harness (`experiments.py`, `pipeline_backtest`) on the 2023–25 backtest, plus the live season so far as extra evidence.
5. **Report:** a pull request with the change, the experiment report and the result against the criteria. If it doesn't pass, the idea goes to "Already tried" in IMPROVEMENTS.md and nothing changes.

**Limits:**
- **It never changes the live models.** You merge, then refreeze a new model version.
- **A budget of 2–3 experiments per run,** each with criteria set before it runs. The backtest has already been used for about 50 or more comparisons; an agent free to try ideas until one wins would find one by chance.
- **The current season is evidence, not the test.** A change adopted mid-season is judged on the seasons after it.
- Usually the right outcome is **"no systemic problem: the misses are shared upsets and variance".** The report should say so plainly rather than find something to change.

**Why this split.** The post-mortem is a fixed sequence (gather facts, classify, write), so it's a pipeline step with one Claude call, like the recaps. Only the reviewer needs to be an agent: it has to look at the patterns, decide what to test, edit code, run backtests and judge the result.

### 7.4 Match briefs: one fact pack for every LLM summary 🔶 (built for previews)

The aim, over time: one plain-English summary per game that pulls everything together: what drove the prediction (7.1), Elo, form, team news, the market and its moves, the weather, and later data not collected yet. The design keeps one split: **code decides the facts, Claude only words them.** Today's previews already work this way on a small scale (`summaries.game_facts`); the brief makes it the general pattern, so adding a data point is one new section and never a rewrite of the prompts.

**The brief.** A structured JSON document per game, assembled by plain code (`pipeline/brief.py`) from data the pipeline already holds. It's built from sections, each a small function that returns its facts, or nothing when the data isn't there:

| Section | From | Available |
|---|---|---|
| `prediction` | the prediction: tip, chance, score, margin, total, model version | now |
| `drivers` | 7.1's grouped contributions, with the players behind them | with 7.1 |
| `market` | opening and latest Betr price, its margin-free chance, the move since opening, the edge | now (`odds_snapshots`, `edges.py`) |
| `elo` | both ratings, the gap, each side's change over the last five games and the season | now (`elo_ratings`) |
| `form` | last five results, points for and against, head to head | now (moves from `game_facts`) |
| `team_news` | ins and outs against last week, star absences, changes since Tuesday | now (team lists), with 7.1 for the changes' effect |
| `conditions` | forecast or observed weather, roof, neutral venue, rest and travel | now (`weather`, features) |
| `result` | score and the model's error, after the game | after grading |
| `postmortem` | 7.2's facts and cause, for badly missed games | with 7.2 |
| *later* | new sources (injury reports, the r/nrl match thread, live scores) | each a new section |

**Rules for the brief:**
- **Built at prediction time, frozen with the prediction.** Each brief belongs to one run and one game, like the drivers, so a text can always be traced to exactly what it saw. A refresh makes a new brief; the change between the two is itself a fact ("Hughes ruled out since Tuesday: Storm 68% → 61%").
- **Only facts, already worked out.** Code does every calculation (differences, percentages, rankings, "biggest driver") so Claude never does arithmetic. Each number carries its unit and a short label.
- **Missing means absent, not zero.** A section with no data is left out, and the prompt says only the sections present may be used.
- **Compact:** a target of about 1,500 tokens per game, so a whole round's briefs fit one recap prompt. Sections can be trimmed for shorter texts (a preview needs the top 3 drivers, a post-mortem all of them).
- **Nothing about the tippers,** as for every agent feature.
- **Versioned:** `BRIEF_VERSION` beside `PROMPT_VERSION`, bumped when a section is added or changed.

**Stored:** a `match_briefs` table (run, match, brief version, the JSON, created at), written by `publish.py` with the prediction, readable by the `analyst` role. `summaries` gets a `brief_id` column, so each text points at its facts, and its `kind` check gains `match_summary` and `match_postmortem`. The site can also show sections straight from the brief (the drivers' bars, the Elo gap) without an LLM.

**The summaries that read it:**
- **Match preview** (now), then a **full match summary** that uses every section present: the main future addition.
- **Post-mortem** (7.2): the brief plus its `result` and `postmortem` sections.
- **Round recap:** the round's briefs, trimmed.
- **"Ask the model" chat:** the brief as the starting context for a question about a game, with SQL for anything beyond it.

**Checks:**
- **Grounding:** every number in a text must appear in its brief (a cheap pattern match on the numbers, rounding allowed). A text that fails is written again once, then dropped and logged. It's never published with invented figures.
- **Sections:** each section function has a test on a replayed 2026 game, and the brief for a replayed round is the same twice.
- **Prompt changes** are tried on a fixed set of saved briefs (a few ordinary games, an upset, a game with late changes, one with missing odds) and read side by side before `PROMPT_VERSION` is bumped.

**Built (October 2026, `explain-briefs` branch):** `pipeline/brief.py` with the sections `prediction`, `drivers`, `market` (opening price, Betr's latest price and its move), `elo` (both ratings going in, the gap, the change over the last five games and the season), `form`, `team_news` (ins and outs against each side's last game) and `conditions` (neutral venue, playing outside home state, rest, the latest weather). The predict job records a brief per prediction in `briefs.jsonl`; `publish.py` writes `match_briefs` (and the `record_briefs` view), and `summaries` gained `brief_run_id` and the new kinds. Previews are written from the brief (`PROMPT_VERSION` 2026-10-v2) with the grounding check (`brief.ungrounded`: one retry naming the stray numbers, then dropped), which recaps use too. A brief comes to about 700 tokens. *Checked:* `tests/test_explain.py` (sections, which side each driver favours, missing sections left out, the grounding check, the same briefs twice on a replay), `tests/test_summaries.py` (a preview uses the brief recorded with its prediction; invented numbers retried, then dropped) and the publish test. *Live:* the migration is pushed to the live project and checked (12 October 2026: both tables, both views and `summaries.brief_run_id`); merged into `main`. *Not yet tried with real Claude:* the API account has no credit, and adding it is deferred until nearer the season. *Still to do:* the full match summary prompt, and the post-mortem sections with 7.2.

**Order of work:** the brief comes with 7.1. `brief.py` starts with the sections available now plus `drivers`, and `summaries.game_facts` is replaced by it, so the previews move onto the brief straight away. The full match summary, post-mortems and later sources then each add a section and a prompt; none of them change the brief's structure.
