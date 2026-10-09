# NRL Predictor: Weekly Automation and Website Plan

This plan extends [PLAN.md](PLAN.md). It covers two things:

1. **Weekly automation:** run the model on a fixed schedule each week. Fetch team lists, stats, results and odds, rebuild the features, and publish new predicted scores, winners and margins.
2. **A public website** with five sections:
   - **Predictions:** model scores, predicted winner and margin for each game
   - **Model vs market:** model probabilities and margins compared with betting odds
   - **Elo:** current ratings and how they change over a season
   - **Tipping comp:** people sign in and tip each week, with a ladder
   - **News:** a feed from Reddit's r/nrl

---

## Overview

- **The model stays in Python.** The weekly pipeline is plain, deterministic code (see PLAN.md §7.5). It writes its results to a database and never talks to the website directly.
- **The database is the contract between the model and the website.** The pipeline writes matches, Elo, predictions and odds. The website reads them, and writes only tipping data.
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
                                tips, comps, users   │                 │  matches, predictions,
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
| Website | **Next.js** (App Router, TypeScript) on **Vercel** | Server rendering with caching suits pages that change a few times a week. Free tier is enough. |
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
| **Main prediction** | Tuesday 5:15pm | Pull the draw and the new team lists. Rebuild features. Refit the model. Publish predicted scores, winners and margins for the coming round. |
| **Refresh** | Wednesday to Sunday, 9am and 3pm | Re-fetch odds and team-list changes. Re-predict only the games whose inputs changed. |
| **Prediction of record** | Each game's kickoff | The last prediction made before kickoff is frozen as the official one. This is what accuracy and "beat the model" are measured against. |

GitHub Actions cron uses **UTC only** and doesn't follow daylight saving. Pick UTC times that work in both AEST and AEDT. For example, `15 7 * * 2` (07:15 UTC Tuesday) is 5:15pm AEST or 6:15pm AEDT, both after team lists. Use an off-the-hour minute, because GitHub delays jobs that start on the hour when it's busy.

Freezing the prediction of record doesn't need a job at kickoff. It is a database view: "the latest prediction with `created_at < kickoff`".

### 1.2 Pipeline steps

`pipeline/run.py --job {results|predict|refresh}` runs these steps. Each one is a plain function, can be run on its own, and is safe to re-run (writes are upserts keyed on match and run).

1. **Fetch the draw:** fixtures, kickoff times, venues and match status for the season. NRL.com's draw page is backed by a JSON endpoint, which is far more stable than scraping HTML.
2. **Fetch results and match stats** for completed games (the same scraper as the core model).
3. **Fetch team lists:** the 17 named players plus reserves for each team, with an `announced_at` timestamp. Keep every version, so changes between Tuesday and kickoff are visible and features can be rebuilt as they were at any point.
4. **Fetch odds:** head-to-head, line and total from [The Odds API](https://the-odds-api.com) (NRL is `rugbyleague_nrl`). Store each fetch as a timestamped snapshot. The free tier (500 requests a month) covers about 10 fetches a week.
5. **Update Elo** from all completed results, and write each team's pre-match and post-match rating per game.
6. **Build features** for the upcoming round. Use the same leakage-safe code as training (PLAN.md §2), including team-list features such as key players out and number of changes.
7. **Refit and predict.** Refit the model on all completed games with fixed settings (tuning stays a manual, pre-season job), then predict win probability, margin and total points.
8. **Validate** before publishing (see §1.4). If a check fails, stop and alert. Never publish a half-finished round.
9. **Publish** to Supabase, then call the website's revalidation hook so cached pages refresh straight away.
10. **Optional:** write a short LLM match preview for each game (PLAN.md §7).

### 1.3 Predicted scores

The website shows a predicted score for each team, for example "Storm 24 – Broncos 16". That needs a **total points** model as well as the margin model. Total points was optional in PLAN.md §3; it is now required.

- Home score = (total + margin) / 2
- Away score = (total − margin) / 2
- Round to whole numbers for display only. Store the unrounded values.
- The predicted winner comes from the **win probability**, not from the rounded scores. In a close game, the two can disagree after rounding, so make sure the displayed scores never contradict the tip (nudge the rounding when they would).

### 1.4 Reliability

- **Validation checks before publishing:** every game in the round has a prediction; probabilities are between 0 and 1; each team has 17 named players; all odds timestamps are before kickoff; no team appears twice in a round; the predicted margin and win probability point the same way.
- **Run log table:** start time, job, status, rows written, model version and git commit for each run, so every number on the site can be traced back to the run that made it.
- **Alerts:** GitHub emails on a failed workflow by default. Add a Discord or Slack webhook message for failures and for big changes (e.g. a favourite flipping after a late team change).
- **Manual override:** every workflow has `workflow_dispatch`, so a run can be started by hand (e.g. for a Thursday game or a postponed match).
- **Scraper breakage** is the most likely failure. The scraper-maintenance agent (PLAN.md §7.4) fits here later.
- **Model versioning:** tag each published prediction with a model version. A model change mid-season starts a new version, so the accuracy record stays honest.
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
| `profiles` | user id (from Supabase auth), display name, favourite team |
| `comps` | id, name, season, owner, join code, scoring rules |
| `comp_members` | comp, user, joined |
| `tips` | user, match, team picked, margin (only used for the tiebreak game), updated |

Views: `tip_results` (each tip marked correct or not once the game is final) and `comp_ladder` (points per user per comp, per round and season total).

### Row-level security

This is where the rules are enforced, not just in the website code:

- Anyone can read model data. Only the pipeline's service key can write it.
- A user can insert or change their **own** tips only while `now() < kickoff` for that match. A tip can't be sneaked in after kickoff, even by calling the API directly.
- A user can see **other people's tips** for a game only after it kicks off. Before then, tips stay hidden so nobody copies.
- Only comp members can see a comp's ladder; only the owner can rename it or remove members.

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
| `/tipping` | My tips for this round, my comps, ladders |
| `/tipping/comp/[id]` | One comp's ladder and round-by-round results |
| `/news` | r/nrl feed |
| `/about` | How the model works, in plain words, and its limits |

### 3.2 Predictions

One card per game, ordered by kickoff:

- Teams with logos, kickoff time in the viewer's local time, venue
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
| Model win % | From Model B (the model without odds, PLAN.md §6), so the comparison is independent |
| Market win % | From the latest odds, with the bookmaker margin removed |
| Difference | Model minus market, highlighted when large |
| Model margin vs line | Model margin next to the bookmaker line (e.g. model "Storm by 8", line "Storm −4.5") |
| Model total vs market total | For over/under comparison |
| Odds movement | A small chart of the market probability since odds opened |

A season tab shows how the model and the market have done over time: cumulative tips correct, log loss by round, and a calibration chart for each. This is the honest scoreboard: most weeks the market will be hard to beat, and the page should show that plainly.

Notes:

- Present it as analysis, not betting advice. No bookmaker affiliate links, a responsible gambling message with the national helpline, and a note that odds are delayed. Check Australian gambling advertising rules before adding anything that looks like a promotion.
- Odds data has terms of use. The Odds API allows display, but check the plan's terms, and credit the source.

### 3.4 Elo

- **Ratings table:** all 17 teams, current rating, change from last round (with an up/down arrow), rank, and rating at the start of the season.
- **Season chart:** one line per team, rating after each round. Every line is shown faint, and the user picks teams to highlight (defaulting to their favourite team if signed in). Team colours for lines, with names labelled at the end of each line instead of a legend.
- **Season picker,** back to the earliest season with results (about 2009, per PLAN.md).
- **Team view:** a single team's rating over several seasons, with the big rises and falls labelled by the match that caused them.
- A short explanation of what Elo is and what a rating gap means as a win probability (e.g. "+100 points ≈ 64% before home advantage").

The data comes straight from `elo_ratings`; no calculation happens in the website.

### 3.5 Tipping comp

**How it works:**

1. Sign in with an email magic link or Google. Choose a display name and favourite team.
2. Create a comp (you get a join code or link to share) or join one. A user can be in several comps; one set of tips counts for all of them.
3. Each round, pick a winner for every game. For the tiebreak game (the first game of the round), also pick a margin.
4. Each tip locks **at that game's kickoff**, not at the start of the round, so a Sunday game can be tipped on Sunday morning after late team changes.
5. After each game, tips are scored and ladders update (the Monday results job does the final scoring; a live update can come later).

**Scoring rules** (the comp owner can choose, with these defaults):

| Rule | Default |
|---|---|
| Correct tip | 1 point |
| Draw | Everyone who tipped the game gets 1 point |
| Missed tip | Automatically given the away team (a common comp rule; the alternative is zero) |
| Tiebreak | Closest margin on the first game of the round, then total margin error over the season |
| Finals | Included, same scoring (owner can switch to double points) |

**Extras that make it more fun:**

- **The model is a tipper.** A "Model" user enters every comp automatically and tips its prediction of record. Everyone can see whether they're beating it.
- **Tip page shows the model's pick and probability** as a hint. Make this switchable per comp, for comps that want to tip blind.
- After lockout, show how the comp tipped each game (e.g. "80% tipped Storm").
- **Reminder emails** before the first game of the round to anyone with missing tips (Supabase can send them through a scheduled function).
- Round winner and season stats: perfect rounds, longest streak, biggest upset tipped.

**Testing:** tipping is where bugs upset people. Write tests for lockout (tip before kickoff succeeds, after fails, at the database level), hidden tips, scoring of draws and missed tips, postponed games (tips stay open until the new kickoff) and the ladder totals.

### 3.6 News feed (r/nrl)

- **Source:** Reddit's API, using a registered "script" app with OAuth (client ID and secret). Unauthenticated requests from cloud servers such as Vercel are often blocked or rate limited, so authenticate.
- **Fetch on the server, not in the browser,** and cache for about 10 minutes. However many people view the page, Reddit gets a handful of requests an hour, which keeps well inside the free rate limit.
- **Show:** post title, flair (e.g. "Team News", "Match Thread"), score, comment count, age, thumbnail, linked domain. Every item links to the Reddit thread. Clicking through, rather than copying post bodies or comments onto the site, keeps within Reddit's terms and avoids moderation problems.
- **Filters:** Hot / New / Top today, and flair chips (Team News, Discussion, Match Thread, Highlights). Hide NSFW and removed posts.
- **Useful links:** on each match page, link to the r/nrl match thread for that game when one exists.
- **Later:** add other sources (NRL.com news RSS, club news) into the same feed, each marked with its source. The team-news agent (PLAN.md §7.1) can also use the "Team News" flair as one of its inputs.
- Check Reddit's current Data API terms before launch; free, non-commercial use with attribution is the expected case.

### 3.7 General

- **Phone first:** most tipping happens on a phone. Design every page for a narrow screen first.
- **Dark mode** and team colours, with enough contrast to read.
- **Caching:** prediction, odds and Elo pages are cached and refreshed when the pipeline calls the revalidation hook. Tipping pages are rendered per user and never cached.
- **Times:** store everything in UTC; show times in the viewer's time zone.
- **Analytics:** a privacy-friendly option such as Vercel Analytics or Plausible.
- **Privacy:** a short privacy page, since the site stores emails. Let users delete their account and tips.

---

## 4. Repository layout

The repo becomes a monorepo: the Python model, the website and the database schema live together, so a schema change and the code that uses it land in one commit.

```
nrl-predictor/
  src/                         # core model (PLAN.md §8)
  pipeline/
    run.py                     # entry point: --job results|predict|refresh
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

The core model (PLAN.md §9) doesn't exist yet, so the site shouldn't wait for it. **Start publishing Elo-only predictions,** and swap in the ML model when it beats Elo in walk-forward testing. The website doesn't change when the model does.

| # | Milestone | Depends on | Done when |
|---|---|---|---|
| 1 | **Database schema** and row-level security in Supabase | — | Migrations apply cleanly; security tests pass |
| 2 | **Pipeline skeleton:** draw, results, Elo, publish | PLAN.md milestones 1–2 | Running it by hand fills `matches` and `elo_ratings` for past seasons |
| 3 | **Elo-only predictions** with a simple total-points estimate, published to the database | 2 | Predicted scores, winners and margins appear for a round |
| 4 | **Scheduled workflows** (results, predict, refresh) with validation, run log and alerts | 3 | A full week runs on its own, including a deliberately broken run that alerts and doesn't publish |
| 5 | **Website, read-only:** predictions, round and match pages, Elo tab | 3 | Deployed on Vercel; pages refresh after a pipeline run |
| 6 | **News feed** | — (independent) | r/nrl posts show with filters and caching |
| 7 | **Odds:** odds fetching plus the model vs market page | 4, 5 | Round and season comparisons show, with odds history |
| 8 | **Tipping comp:** sign-in, comps, tips, lockout, scoring, ladder, model as a tipper | 1, 5 | Lockout and scoring tests pass; a test comp runs through a mock round |
| 9 | **Team lists** in the pipeline and team-list features in the model | 4, PLAN.md milestone 3 | Late changes trigger a re-prediction and an "Updated" badge |
| 10 | **Swap in the ML model** (PLAN.md milestones 3–5) | 3 | It beats Elo-only in walk-forward testing; new model version tagged |
| 11 | **Dry run on 2027 pre-season trials** (February) | 4–8 | A week of trials runs end to end with friends tipping |
| 12 | **Launch for Round 1, 2027** (early March) | 11 | — |

**Later:** live score updates during games, tip reminders by push notification, SHAP explanations on match pages, LLM previews, the MCP chat interface (PLAN.md §7.2) as a "Ask the model" box on the site, and the monitoring agent's weekly report (PLAN.md §7.7) as a public page.

---

## 6. Decisions to confirm

These have sensible defaults above, but are worth a quick check:

1. **Who is the tipping comp for:** friends and family only, or open to the public? Public means more work on moderation, abuse limits and privacy.
2. **Budget:** the plan fits inside free tiers (GitHub Actions, Supabase, Vercel, The Odds API, Reddit). A paid odds plan is the first thing likely to be needed, for more frequent snapshots or more bookmakers.
3. **Domain name** for the site.
4. **How prominent the odds page should be,** given the gambling-advertising points in §3.3.
5. **Missed-tip rule:** away team (default) or zero.
