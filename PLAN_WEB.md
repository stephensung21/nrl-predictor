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
| Historical betting odds (aussportsbetting.com sheet) | 🔶 | `data/nrl_betting odds.xlsx`, downloaded by hand. It only updates now and then, so the weekly predictions no longer depend on it (live odds below); still needed for closing prices (grading against the market), retraining and the yearly routine. An automatic download is still to do. |
| Live odds (The Odds API, Betr) | 🔶 | `pipeline/fetch_odds.py`, run at the start of every live job and by `run.py --job odds`: Betr's head-to-head, line and total (Betr is BlueBet since the 2024 merger, the sheet's bookmaker), every snapshot kept in `odds_snapshots.csv`, impossible prices dropped, credits guarded. A game's first snapshot is its opening price when the sheet doesn't have it. Built and tested; the key works and Betr prices come through on the free plan (checked October 2026 on the EPL, as NRL is out of season). Still to confirm in the February trials: Betr lists NRL, and its first snapshot matches the sheet's opening price (see step 4). |
| Elo, team rating, player ratings (RAPM), features | ✅ | Recomputed from the latest results by `features.py` and `predict.py` |

**Predicting**

| Step | Status | Where / notes |
|---|---|---|
| Pre-season model freeze | ✅ | `python src/train.py --freeze` → `models/2027/` (version `2027.1`, trained on 2021–2026). Rerun before Round 1 if more 2026 data or settings change. |
| Predict a round from current team lists | ✅ | `python src/predict.py --round N` (live) |
| Validation before publishing | ✅ | `predict.validate`: missing inputs, probabilities, 17 named per team, duplicate teams; margin/probability disagreement is a warning |
| Replay a past round as a test | ✅ | `predict.py --replay --season 2026 --round N`; reproduces the backtest exactly; slow test in `tests/test_predict.py` |
| Impossible-price check on live odds | ✅ | `fetch_odds.check_prices`: a market whose implied probabilities add to under 100%, a price at or below 1, or mismatched handicaps is blanked and logged as a warning |
| Edges and fair odds against live prices | ❌ | Needs live odds |

**Scoring**

| Step | Status | Where / notes |
|---|---|---|
| Grade last round's predictions (tips correct, margin error, log loss, Brier, vs the market) | ✅ | `pipeline/grade.py`, run by the results job: each finished game's prediction of record joined to the result, opening and closing market and Elo; metrics per round and for the season so far, written to `data/pipeline/<live\|replay>/<season>/graded.csv` and `season.md`. Grading the final test's predictions reproduces `reports/final_2026.md` exactly (`tests/test_pipeline.py`). |
| Prediction of record (last prediction before kickoff) and season record | ✅ | The pipeline keeps every prediction it makes, with when it was made (`predictions.csv` beside the run log), and `grade.prediction_of_record` picks the latest before kickoff. Becomes the `prediction_of_record` view once the database exists. |
| Betting results and closing line value per round | 🔶 | `betting.py` does whole seasons, not week by week |
| Tipping-comp scoring (points, auto-tips, bonus, margin, ladder) | ✅ | In SQL: `supabase/migrations/20261010000000_tipping.sql` (`effective_tips`, `tip_results`, `round_scores`, `ladder()`, lockout and hidden tips in row-level security). The website's copy is `web/lib/scoring.ts`. Both are checked against the same hand-worked cases (`tests/tipping/cases.json`) by `npm test` in `web/`, the SQL in PGlite (Postgres 17 in WebAssembly). Not yet applied to a Supabase project. |

**Automation and publishing**

| Step | Status | Where / notes |
|---|---|---|
| `pipeline/run.py --job results / predict / refresh / odds` | ✅ | Scheduled by the workflows below; `--as-of` replays a past season, and `pipeline/replay.py` runs the whole weekly schedule over one. Before the season's year, a draw nrl.com hasn't published is "nothing to do"; from January it's a failure. Not yet publishing (step 7). |
| GitHub Actions workflows on the weekly schedule | 🔶 | `.github/workflows/`: `results.yml`, `predict.yml`, `refresh.yml`, `odds.yml`, each calling `pipeline-job.yml`; `ci.yml` for tests. Written and linted (actionlint), the commit step simulated; they run only once merged into `main` (step 8). |
| Run log, alerts on failure | ✅ | Every pipeline run is logged to `runs.jsonl` (job, clock, status, round, games, model version, commit, errors); a failed run exits non-zero, which fails the workflow: GitHub emails, and `ALERT_WEBHOOK_URL` (Discord or Slack, optional) gets the reason. `run.py --fail` (the workflows' "fail" box) fails on purpose to test it. |
| Supabase schema, row-level security, publishing | 🔶 | Both migrations written and tested locally in PGlite with Supabase's default permissions reproduced: tipping (above) and model data (`20261011000000_model_data.sql`, step 6). The Supabase project itself (your setup steps under step 6) and publishing (step 7) are still to do (§2, milestone 1). |
| Website and tipping comp | 🔶 | Every planned page designed and built, on sample data and browser stand-ins (see Website status below); not connected to the pipeline, Supabase or live sources, not deployed |

### Website status (October 2026)

Every planned page is designed (DESIGN_BRIEF.md, recorded in DESIGN.md) and built in `web/` on the `web-design` branch, and each passed an independent design review. **None of it is wired to live data yet.** Each page reads from a sample module or a browser-storage stand-in, behind an interface that the real source replaces in one place. Every sample page carries a dashed "Sample data" note saying what is real and what is made up.

#### Pages and how each is wired

"Real data, frozen" means real project data generated into a TypeScript file by a script in `web/scripts/`, not read live. "Stand-in" means it works end to end in the browser but stores nothing on a server.

| Page | Built | Data today | Wired to live? | What replaces it |
|---|---|---|---|---|
| `/` home (round, tipping strip, recap) | ✅ | Real 2026 Round 10 replay predictions and results (frozen); invented tippers and tips | ❌ | `prediction_of_record`, `matches`, the viewer's `tips`, `ladder` |
| `/round/[season]/[round]` | ✅ | Real replays of rounds 3, 5, 10 (frozen); invented tips | ❌ | Same views, any round |
| `/match/[id]` | ✅ | Real replay data: no-odds model, opening price, Elo (both teams going in, the season so far, last five games, the change from the result), Tuesday and final team lists, head to head (frozen; rounds 3, 5, 10 only) | ❌ | `predictions`, `odds_snapshots`, `elo_ratings`, `team_lists`, `matches` |
| `/tipping` | ✅ | Tips save in the browser (`BrowserTipStore`) | ❌ Stand-in | `SupabaseTipStore` from `createTipStore()`; lockout enforced by row-level security |
| `/tipping/ladder` | ✅ | A generated 2026 season to Round 10: real games, results and Model tips; invented friends, tips, margins, forgotten tips | ❌ | `round_scores` view and `ladder()` function (written and tested, step 3) |
| `/odds` | ✅ | Real 2026 prices (aussportsbetting sheet) and test-season predictions; recomputed bets match `reports/betting_2026.md` | ❌ Frozen | `match_odds_probs`, `odds_snapshots` (The Odds API), `predictions`, `model_accuracy` |
| `/elo` | ✅ | Real ratings 2009–2026 from `src/elo.py` (asserted equal); 2026 to Round 9 | ❌ Frozen | `elo_ratings` |
| `/model` | ✅ | Real 2026 test-season tips to Round 9; invented tippers for the comp comparison | ❌ Frozen | `prediction_of_record`, `model_accuracy`, `ladder` |
| `/about` | ✅ | Figures from `reports/final_2026.md` and `reports/backtest.md` | n/a | Update by hand after each season's test |
| `/join/[code]`, `/sign-in`, `/auth/callback`, `/account` | ✅ | Browser stand-in (`BrowserAuthStore`): fake Google and email sign-in, profile in the browser; sample invites | ❌ Stand-in | Supabase auth (Google, email link), `profiles`, `invites` via `createAuthStore()` |
| `/tipping/admin` | ✅ | Browser stand-in (`BrowserAdminStore`): invites, tippers and pipeline runs invented; real Round 10–11 fixtures | ❌ Stand-in | `invites`, `profiles` (admin flag), `rounds` (stored draw), `pipeline_runs` via `createAdminStore()` |
| `/news` | ✅ | One saved snapshot of r/nrl's RSS feed (10 Oct 2026): real titles, links, times and linked sites; flairs guessed from titles | ❌ Frozen | Reddit API (OAuth app, cached) via `createNewsSource()`, with real flair |
| Not-found page | ✅ | n/a | n/a | n/a |

#### The swap points

Each one is a single function that returns the real implementation once the backend exists. The pages don't change.

| Interface | File | Sample implementation | Live implementation needs |
|---|---|---|---|
| Row shapes | `web/lib/types.ts` | `lib/sample*.ts` modules, generated by `web/scripts/build_sample.py`, `build_odds_sample.py`, `build_elo_sample.py`, `build_news_sample.py` | Server-side Supabase queries returning the same types |
| `TipStore` | `web/lib/tip-store.ts` | Browser storage | Supabase `tips`, with lockout and hidden tips in row-level security |
| `AuthStore` | `web/lib/auth.ts` | Browser storage, mock redirect through `/auth/callback` | Supabase auth. Its header lists the work: `shouldCreateUser: false` and a before-user-created hook so signing in never creates an account, a security-definer invite check, redeeming an invite in the same transaction, a service-key route for account deletion, and stripping Google's name and avatar |
| `AdminStore` | `web/lib/admin.ts`, `web/lib/invites.ts` | Browser storage and a fixed sample clock | Supabase tables, the database clock, the `profiles` admin flag, and the stored margin-game draw |
| `NewsSource` | `web/lib/news.ts` | Saved RSS snapshot | Reddit API: real flair, NSFW and removed posts hidden, cached about 10 minutes |
| Tipping rules | `web/lib/ladder.ts`, `web/lib/rules.ts` | Computed in the browser | SQL scoring functions and views ported from these, sharing their test cases |

#### Not connected yet

- **The model pipeline:** nothing publishes predictions. Every Model number on the site is from the 2026 replays or the test season, generated into files.
- **The database:** the migrations and their tests exist (step 6), but no Supabase project yet, so nothing is stored online.
- **Live sources:** the Odds API fetcher exists but only feeds the pipeline's CSV records; no automatic odds-sheet download, no Reddit API, no live scores.
- **Accounts:** sign-in is simulated, and nobody is really signed in. Tips, profiles and invites live only in the visitor's browser.
- **Admin:** the page is open to anyone in the sample, and the admin flag always says yes.
- **The margin-game draw** (random, excluding last round's teams; §3.5) is made by the pipeline's predict job and published to `rounds` (step 11a), but the site still shows the sample's Round 10 game (simply the round's first game) until step 9.
- **Deployment:** the site isn't on Vercel. `noindex` and `robots.txt` are in place.

#### Still to add to the website

- **Live states the sample can't show:** live scores during games (§3.2 "Later") and the "Updated: Hughes out" refresh badge driven by real team-list changes (milestone 9).
- **Odds history** on match pages (a chart of the market since opening, §3.3). It needs `odds_snapshots`.
- **The r/nrl match thread link** on each match page (§3.6).
- **Match previews** (LLM) and **what drove the prediction** (SHAP) on match pages (§3.1, "Later").
- **Tip reminders** before each round's first game (email, §3.5 extras).
- **Notifications and push** (§5 "Later").

### Next steps

Step numbers are fixed (other sections refer to them). Steps 1–3 are done and step 4 is mostly done. The `pipeline` and `web-design` branches were merged into `main` in October 2026 (PRs #4 and #5); backend work now continues on **`backend`** and the site on **`web-development`**, both from `main`.

**Done**

- ✅ **Step 1. `pipeline/run.py --job results|predict|refresh`** (October 2026, `pipeline` branch): incremental scrape of the current season (`scrape.build_tables(..., merge=True)`; rebuilding 2026 alone reproduces the committed tables byte for byte), the round to predict from the draw including postponed games (`draw.games_to_predict`), neutral venues from the draw (`draw.neutral_games`, agrees with the odds sheet's flags), `predict.py`, validation, and every run and prediction recorded. *Checked:* `python pipeline/replay.py --season 2026 --rounds 1 10 --check` runs the whole weekly schedule (132 jobs) and every Tuesday run equals `predict.py --replay`. Only 64 of 2026's 213 games have an archived Tuesday list, so the replay predicts 45 of rounds 1–10's games; refreshes correctly find nothing changed.
- ✅ **Step 2. Weekly grading** (`pipeline` branch): `pipeline/grade.py`, run by the results job, writes `graded.csv` and `season.md`. *Checked:* grading the final test's predictions as predictions of record reproduces every number in `reports/final_2026.md`. (The plan's original check, grading the replayed season, can't reach those totals: the final test used final team lists for all 213 games, and the Tuesday archive covers only 64.)
- ✅ **Step 3. Tipping scoring outside the browser** (`web-design` branch): `supabase/migrations/20261010000000_tipping.sql`, with the website's rules moved to `web/lib/scoring.ts`; both pass the shared cases in `tests/tipping/cases.json`, and the lockout, hidden-tips and permission rules pass in PGlite (`npm test` in `web/`, 24 tests).

**Pipeline (`backend` branch)**

- 🔶 **Step 4. Odds.** *Built (October 2026):* the sheet only updates now and then, so the weekly opening prices come from The Odds API instead. The sheet's bookmaker since April 2024, BlueBet, took over Betr in July 2024 and now trades as Betr on BlueBet's platform, and The Odds API carries Betr (`betr_au`; BlueBet isn't listed). `pipeline/fetch_odds.py` fetches Betr's head-to-head, line and total at the start of every live job and in the Sunday-night odds job, keeps every snapshot in `data/pipeline/live/<season>/odds_snapshots.csv` (raw responses in `data/raw/odds_api/`), blanks impossible prices (note 4) and logs them as warnings, and skips while fewer than 50 credits are left. A game's first snapshot before kickoff is its opening price when the sheet doesn't have the game; the sheet's prices come first when it does. A refresh re-predicts a game when its first price arrives; a failed fetch is a warning and unpriced games get the no-odds prediction. Errors never carry the key (they go into the committed run log). *Checked:* `tests/test_odds.py` on a saved response, including a 2026 game priced from "live" odds predicting exactly as from the sheet; a real call with the key returned Betr's prices on the free plan (EPL, 1 credit; NRL is out of season). *Still to do:* (a) in the February trials, confirm Betr lists NRL and the team names map; (b) once the sheet has the same games, compare its BlueBet opening prices with our first snapshots, and change which snapshot counts as opening if they differ consistently; (c) download the sheet automatically in the results job, for closing prices and retraining (check the site's terms). *Needs:* `ODDS_API_KEY` in `.env` locally (done) and in GitHub secrets for step 8.
- **Step 5. Weather** in the refresh job (note 3). Optional; measure its value on replays first.
- 🔶 **Step 8. GitHub Actions.** *Built (October 2026, `backend`):* `results.yml` (Monday 00:15 UTC), `predict.yml` (Tuesday 07:15), `refresh.yml` (Tuesday–Saturday 23:15 and Sunday, Wednesday–Saturday 05:15, i.e. Wednesday–Sunday mornings and afternoons in Sydney), `odds.yml` (Sunday 11:15), each a thin caller of `pipeline-job.yml`, plus `ci.yml` (the fast Python tests and the website's `npm test` on every push). `pipeline-job.yml` installs Python 3.12 and `requirements.txt`, restores the season's raw match pages from `actions/cache` (saved again after each results run), runs `pipeline/run.py --job …` with `ODDS_API_KEY`, commits `data/pipeline/live/`, `data/processed/` and the fetched team lists, and alerts on failure. Pipeline jobs queue one at a time (they commit to the same records). A run that only logged "nothing to do" isn't committed, except the weekly results run, which is also the keep-alive. Every workflow can be run by hand, with a "fail" box for the broken-run test. *Checked:* actionlint passes; the commit step was run against a scratch repository under `bash -e` (nothing to do, predictions, results, failure, and a crash before any records); every job was run live from a clean checkout as Actions will (off-season: all "nothing to do", tables unchanged). *Merged into `main`* (October 2026), so the schedules are live. *Still to do:* the setup steps below, then a full in-season week unattended (milestone 4). Publishing is added after step 7.
- ✅ **Step 11a. The pipeline draws each round's margin game** (October 2026, `margin-draw` branch): `draw.draw_featured`, the same rule as `drawFeatured` in `web/lib/rules.ts` (any game not involving a team from the previous round's margin game, or any game if none qualify), with a fresh secure random source. The predict job draws once per round (`run.margin_game`), on the first run with the round's fixtures and only before its first kickoff; later runs keep the draw. Kept in `data/pipeline/live/<season>/rounds.csv` (with the eligible games, for the admin page), recorded in the run log, and published to `rounds`, where the Model's margin tip picks it up. *Checked:* `tests/test_pipeline.py` (the rule, every eligible game drawn and nothing else, once per round, never after kickoff) and `tests/test_publish.py` (published, and the Model enters its margin).

**Turning on the schedule: steps only you can do** (on github.com, repo `stephensung21/nrl-predictor`)

1. **Add the odds key as a secret.** Settings → Secrets and variables → Actions → *New repository secret*. Name `ODDS_API_KEY`, value the key from your local `.env` (the part after `ODDS_API_KEY=`, no quotes). Without it the workflows still run, but the odds fetch is skipped and every game gets the no-odds prediction. Secrets are never shown in logs and aren't passed to workflows triggered from forks.
2. **Optional: chat alerts.** GitHub already emails you when a scheduled run fails (the emails go to whoever last changed the schedule). For a Discord message as well: Discord server settings → Integrations → Webhooks → *New webhook* → *Copy webhook URL*, then add it as a secret named `ALERT_WEBHOOK_URL`. A Slack incoming-webhook URL works too.
3. **Check the repository settings.**
   - Settings → Actions → General: actions are allowed (the default). The workflows ask for permission to commit themselves, so "Workflow permissions" can stay on read-only.
   - Settings → Branches / Rules: if `main` has a rule that requires pull requests, the bot's record commits will be rejected. Either don't protect `main`, or add GitHub Actions to the rule's bypass list.
4. **Run each workflow once by hand.** Actions tab → pick the workflow on the left → *Run workflow* → branch `main` → *Run workflow*. Do `ci`, `odds`, `results`, `predict` and `refresh`. Off-season, each should finish green with "nothing to do" in the log; `results` makes a commit `pipeline: results (nothing to do)`. In the `odds` run, open *Run the odds job*: it should print `odds: {'status': 'ok', ...}` with `credits_remaining`. If it says `skipped` and `no ODDS_API_KEY`, the secret's name or value is wrong.
5. **Test the alert.** Run `predict` by hand again with *fail* ticked. Expect a red run, an email (and a Discord message if step 2 is done) saying "deliberate failure (--fail)", and a commit `pipeline: predict (failed)` with the run log.
6. **Before the February trials:** check the Actions tab shows the four schedules still enabled (GitHub turns them off after 60 days without a commit; the Monday results commit should prevent that), and that the `odds` runs show NRL games once markets open (step 4's checks). If the key is ever exposed, make a new one at the-odds-api.com and update both the secret and `.env`.

**Database and website**

- 🔶 **Step 6. The Supabase database.** *Built (October 2026, `supabase` branch):* `supabase/migrations/20261011000000_model_data.sql` beside the tipping migration: the model tables and views in §2, invites with `check_invite()` and `join_comp()` (joining is the only way to get a profile), the `summaries` and `model_versions` tables for the agent features (§7), the read-only `analyst` role for agents, and every grant made explicitly (Supabase's defaults grant everything, so the migration revokes them first). *Checked:* `npm test` in `web/` (39 tests): the tipping rules and lockout as before, plus the views (prediction of record, the market's opening and closing price, the model's record against `grade.metrics`' definitions), invites and joining, who can read and write what (including the analyst role), postponed games in the scores and unknown teams. The tests now start from Supabase's default permissions (`web/tests/db.ts`), so they check what a real project would allow. Ladder ties were already covered. *Still to do:* create the project and push the migrations (your steps below); the margin-game draw (11a) and publishing (7) fill `rounds` and the model tables.
- **Step 9. Swap the sample modules for queries** through `lib/supabase.ts` (a server client for pages, a browser client for tipping) (`lib/sample.ts`, `sample-archive.ts`, `sample-odds.ts`, `sample-elo.ts`, `sample-news.ts`), keeping the types in `lib/types.ts`; remove the sample notes and state chips.
- **Step 10. Implement the live stores:** `SupabaseTipStore`, a Supabase `AuthStore` (with the `/auth/callback` code exchange) and a Supabase `AdminStore`, each returned from its `create…()` function. Their interfaces and the work each needs are documented in their files.
- **Step 11b. The Reddit API** goes behind `NewsSource`. *Needs:* a Reddit app.
- **Step 12. Deploy to Vercel** with `noindex` and `robots.txt`, the revalidation endpoint and the environment variables in §1.5 (milestone 5). *Needs:* a Vercel account.

**Setting up Supabase: steps only you can do** (no Docker needed)

1. **Create the project.** supabase.com → sign in with GitHub → *New project*. Name `rugbyleague-tipper`, region **Sydney (ap-southeast-2)**, free plan. Choose a strong **database password** and keep it in a password manager: the CLI asks for it, and it can't be shown again (only reset).
2. **Note the project's details** (Project Settings → API, and → General): the **project URL**, the **anon (public) key**, the **service-role key** (secret: never in the browser or the repo), and the **project ref** (the id in the dashboard's address, e.g. `abcdefghijkl`).
3. **Push the migrations from the repo** (in a terminal at the repo root, on a branch that has `supabase/migrations/20261011000000_model_data.sql`):
   ```
   npx supabase login                         # opens the browser once
   npx supabase init                          # only if supabase/config.toml doesn't exist yet
   npx supabase link --project-ref <ref>      # asks for the database password
   npx supabase db push --dry-run             # lists the two migrations it would apply
   npx supabase db push
   ```
   Then the Table Editor should show `matches`, `tips`, `predictions` and the rest, each with RLS enabled. The CLI needs Docker only for `db pull` and the local stack, not for `db push`.
4. **The pipeline's connection string.** Dashboard → *Connect* (top bar) → *Session pooler* → copy the URI (it looks like `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`) and put the database password in place of `[YOUR-PASSWORD]`. Use the **session pooler**, not the direct connection: free projects' direct connection is IPv6 only, and GitHub's runners have no IPv6.
   - Add it to GitHub as the secret `SUPABASE_DB_URL` (Settings → Secrets and variables → Actions). From then on every scheduled run publishes.
   - Add it to your local `.env` as `SUPABASE_DB_URL=...` too (ignored by git).
5. **Load the 2026 season** (once, from your computer, which has the final test's predictions in `reports/`): `.venv/Scripts/python pipeline/publish.py --backfill 2026`. It prints the rows written: 1,423 games (2021–2026, for head to head), 7,268 Elo ratings since 2009, 213 predictions and graded games, and the Model's 213 tips. Safe to run again. `--dry-run` counts the rows without connecting.
6. **The website's keys** (for step 12): the project URL and the anon key, as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel. The service-role key is only for the website's server routes (deleting an account, step 10), as `SUPABASE_SERVICE_ROLE_KEY` in Vercel; it never goes in the browser, the repo or GitHub.
7. **Sign-in settings** (Authentication → Sign In / Providers; needed for step 10):
   - **Email links:** Supabase's built-in email only sends to members of your Supabase organisation, about 2 an hour, so friends' links wouldn't arrive. Set up custom SMTP (Authentication → Emails → SMTP; for example Resend's free plan, with link tracking off) before inviting anyone, or offer Google only.
   - **Google:** create an OAuth client in Google Cloud (APIs & Services → Credentials), add the callback URL Supabase shows, and paste the client id and secret into the Google provider.
   - Set the Site URL and redirect URLs to the Vercel address (and `http://localhost:3000` for development).
8. **Make yourself the admin** after you've joined through the site once (Table Editor → `profiles` → your row → `is_admin` = true), or in the SQL editor: `update profiles set is_admin = true where display_name = '<you>';`. The Model's profile is made by the pipeline (step 7).
9. **Later, only when an agent needs it:** give the `analyst` role a password in the SQL editor (`alter role analyst login password '...';`, never in a migration) and use that connection string for the agent.
10. **Off-season and backups:** free projects pause after a week with no activity (restore from the dashboard; nothing is lost). Every scheduled run publishes, even with nothing to do, which keeps it awake all year. The free plan has no backups you can download; the tipping tables (the only data not rebuilt from the repo) still need a private weekly export before the comp starts (see step 7).

**Optional: Docker, to run Supabase on your computer.** Useful from steps 9–10: real sign-in, a mail catcher for email links, and the dashboard, all offline. Not needed for steps 6–7, which are tested in PGlite. Checked October 2026: virtualisation is on, 15 GB RAM and 700 GB free, so only WSL is missing. About 30 minutes:

1. Open PowerShell **as administrator** and run `wsl --install`, then restart.
2. Install **Docker Desktop** (docker.com, free for personal use), keeping "Use WSL 2", then open it once so it's running (the whale icon in the taskbar).
3. In the repo: `npx supabase start`. The first run downloads the images (a few GB, a few minutes) and prints local URLs and keys: the API, Studio (the dashboard) and Mailpit (where email links land). `npx supabase db reset` reapplies every migration from scratch, and `npx supabase stop` shuts it down. It uses about 2–3 GB of RAM while running.

**Joining the two** (the branches are merged, so this can start once step 6 exists)

- 🔶 **Step 7. `pipeline/publish.py`.** *Built (October 2026, `publish` branch):* copies the season's records into the step 6 tables, every write an upsert on the table's key in one transaction, so it's safe to re-run and the database can be rebuilt from the repo: the games (finished ones, and the coming ones the predict job has seen, now saved in `fixtures.csv` with their match ids, since the draw doesn't give them), the odds sheet's prices and the live snapshots (turned round where the API lists home and away the other way), every team list fetched, Elo before and after every game (`run_elo(..., after=True)`), the model versions from `meta.json`, the run log, every prediction and the graded games. The Model gets a profile and tips its prediction of record (and its margin for the round's margin game) for games not yet started. `--backfill 2026` publishes the final test's predictions as the 2026 record, with every scraped season's games (2021 on, for head to head) and Elo since 2009. It connects with `SUPABASE_DB_URL` (the session pooler) and skips without it; it calls `REVALIDATE_URL` once the site exists. The scheduled workflow publishes after every job that didn't fail. *Checked:* `tests/test_publish.py` against a real Postgres (CI's Postgres service, or PGlite over the Postgres protocol locally, `web/tests/pglite_server.mjs`): publishing twice gives the same rows; the views return the prediction of record and the live opening price; the Model tips only coming games; Elo equals the engine's; and the 2026 backfill's `model_accuracy` equals `grade.metrics` exactly for the model, both markets and Elo, with the Model's tipping record equal to its graded tips. *Still to do:* point it at the real project (your setup steps 4–5 above); a private weekly export of the tipping tables before friends start tipping (GitHub artifacts on a public repo aren't private, so it needs encrypting or another home); the revalidation call once the site is deployed (step 12).

Suggested order: finish step 8 (secrets, a run by hand), set up Supabase (above), then 7 → 9–12, with step 4's checks and step 8's unattended week in the February trials.

**The 2027 season**

- **Step 13. The yearly routine** (note 5): the final 2026 data, the Perth Bears added, then freeze `2027.1`.
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
`data/nrl_betting odds.xlsx` comes from aussportsbetting.com's historical NRL results-and-odds download. It's the only source of the *opening* prices the with-odds model was trained on, and of closing prices for grading against the market.
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
| Scheduled runs | GitHub Actions `results.yml` (Mon), `predict.yml` (Tue), `refresh.yml` (Wed–Sun), `odds.yml` (Sun night), each calling `pipeline-job.yml`, and `ci.yml`: install, restore the raw-page cache, call `pipeline/run.py`, alert on failure, commit records (also the keep-alive) | `backend`, step 8 | 🔶 built; runs once merged into `main` |
| The weekly jobs | `pipeline/run.py`: scrape, round detection, predict, validate, grade, run log | `pipeline`, steps 1–2 | ✅ |
| Data sources | Draw, results and team lists (`scrape.py`, `draw.py`); Betr's live prices from The Odds API (`fetch_odds.py`); odds sheet download; weather (optional) | `backend`, steps 4–5 | 🔶 live odds built; sheet download and weather to do |
| Interim storage | Run log, every prediction and the graded season as CSV in `data/pipeline/live/<season>/`, committed by the results job | `pipeline` | ✅ (until step 7) |
| Database: tipping | `matches`, `profiles`, `rounds`, `tips`, scoring views, `ladder()`, row-level security | step 3 | ✅ tested locally |
| Database: model data | `teams`, `model_versions`, `pipeline_runs`, `predictions`, `graded_games`, `team_lists`, `odds_snapshots`, `odds_sheet`, `elo_ratings`, `summaries`, `invites`; views `prediction_of_record`, `match_odds_probs`, `model_accuracy`; the `analyst` role; the Supabase project itself | `supabase`, step 6 | 🔶 migrations tested locally; project to create |
| Publishing | `pipeline/publish.py`: upsert the season's records in one transaction over the session pooler (safe to re-run), the Model's tips, call the revalidation hook; `--backfill 2026`; run after every scheduled job | `publish`, step 7 | 🔶 built and tested; needs `SUPABASE_DB_URL` |
| Website server side | `lib/supabase.ts` (server and browser clients), queries replacing `sample*.ts`, Supabase tip/auth/admin stores, `/auth/callback`, the `/api/revalidate` endpoint (secret-protected), Reddit fetched and cached on the server | `web-design`, steps 9–11b | ❌ |
| Hosting | Vercel deploy with `noindex`, `robots.txt` and the environment variables in §1.5 | `web-design`, step 12 | ❌ |
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
| `ANTHROPIC_API_KEY` (optional) | Match previews |

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
| Match previews, round recaps, the weekly review | A step in the pipeline (Python, GitHub Actions, the Claude API with `ANTHROPIC_API_KEY`) after predict or results | The round's predictions, team lists, odds, Elo and graded results | `summaries` (with the Claude model and prompt version), shown by the site |
| Results-and-formulas reviewer | A scheduled GitHub Actions job working in the repo (for example Claude Code or the Agent SDK, headless), since it needs the code in `src/`, the history and the Python environment to run backtests | `data/pipeline/live/` (graded games, predictions), `models/<season>/meta.json`, the backtest reports, IMPROVEMENTS.md | A pull request with the change and its backtest, judged by the adoption rule (only a meaningful backtest gain is adopted; small gains go to "Already tried"). It never changes the live models or the database: you merge, then refreeze a new model version, which `model_versions` records |
| "Ask the model" chat | A website route on Vercel calling Claude with read-only SQL as its tool | The model's tables and views, through the `analyst` role | Nothing |

Rules for all of them: agents read through the `analyst` role or the repo, never the service key; nothing about the tippers goes into a prompt; and anything that changes the model goes through a pull request and a backtest.
