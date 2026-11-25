# Site performance plan

Why the site is slow and hangs on a phone, and what to change, in order. Written 25 November 2026 from a code review and measurements of a local production build. **Phases 0–2 are built** (25 November 2026; see [Progress](#progress)); Phases 3–6 are still to do.

## Progress

### Phases 0–2: built 25 November 2026

What changed:

- **Phase 0, measuring.** `web/scripts/perf.mjs` times a phone loading each page and tapping between tabs (`node web/scripts/perf.mjs <url> [--latency 150]`). `web/lib/perf.ts` logs one `perf <read> <ms>` line per data read to Vercel's runtime logs, marked `cold` on a fresh instance. Vercel Speed Insights' script is in the layout, on Vercel only. It's the plain script, because the `@vercel/speed-insights` package's optional peer dependencies clash with vitest's Vite. `vercel.json` turns on Fluid compute explicitly.
- **Phase 1, instant taps.**
  - Loading skeletons (`web/components/skeleton.tsx`, one `loading.tsx` per section). The Tips page moved into a route group, `app/tipping/(tips)/`, so its skeleton doesn't also cover the Ladder and Admin pages (same URL).
  - The nav asks whether you're the admin only when More opens, once for both menus, and loads the auth code only then. The group switcher's cookie helpers moved to `lib/group-choice.ts`. Together these take Supabase's client off every page that doesn't tip.
  - The middleware skips visitors with no session and router prefetches, and uses `getClaims()`. The DB pool went from 1 connection to 4.
- **Phase 2, caching.**
  - `web/lib/cache.ts` wraps every model-data read in `lib/source.ts` in Next.js's data cache, under one tag (`model-data`), keyed by deployment.
  - Clock-dependent parts are applied per request from the cached rows. A game's paper bet switches from the latest to the opening price at kickoff (`withBets` in `lib/data.ts`, with a test). `/odds`' coming games drop out at kickoff. The Dally M round opens and closes by the clock. The off-season starts a week after the last game.
  - `app/api/revalidate` expires the tag. `publish.py` (and now `publish.py --players` and `trial.py publish`) already calls it after each publish.
  - Cached data lasts an hour, or 5 minutes while the site has no `REVALIDATE_SECRET`.
  - `/players` looks up your favourite team alongside the data rather than after it.

Measured against a local Postgres holding the trial's Round 1 in play plus every game since 2021 and Elo since 2009, with the old build (`main`) and the new side by side. The figures are SQL statements per request and server time on this machine, three requests in a row:

| Page | Before | After |
|---|---|---|
| `/` | 12, 11, 11 queries | 0, 0, 0 (already cached) |
| `/round/2026/1` | 8, 8, 8 | 12 (first read), then 0, 0 |
| `/match/<id>` | 38, 38, 38 | 19 (first read, now in parallel), then 0, 0 |
| `/elo`, `/odds` | 3 and 5 every time | 3 and 5 once, then 0 |

As a phone (Pixel 7, CPU 4x slower, 150 ms added round trip):

| | Before | After |
|---|---|---|
| JS downloaded per page (gzip) | 184–195 kB | 111–122 kB |
| Tap Home → Tips / Ladder / Dally M, until the screen changes | 509 / 464 / 367 ms | 154 / 178 / 161 ms; 83 ms when the skeleton was already prefetched (traced separately, without the CPU slowdown) |
| …until the new page is in | 532 / 476 / 376 ms | 556 / 562 / 276 ms (no faster: the server still answers once) |

The live site's baseline, measured from a US machine before deploying (`perf.mjs https://nrl-predictor.vercel.app`): 2.3 s to the first byte on a cold start, about 0.45 s warm, and 650–760 ms from a tap to any change on screen. Re-run it after deploying to compare like with like.

Checks: web tests 180 passed (new: the revalidate route, the middleware's fast path, bets across kickoff); Python 99 passed; lint and types clean; every page renders on sample data and on the database; revalidation checked end to end. The pages read the old value from cache after a change in the database, and the new value after `publish.revalidate()` called the endpoint (a wrong secret gets 401). Skeletons were checked at 390 px and 1440 px in both themes. The impeccable check wasn't run: the design skills aren't installed in this environment.

**Set up after deploying:**

1. Make a secret (`openssl rand -hex 32`). In Vercel: Settings → Environment Variables → `REVALIDATE_SECRET` (Production), then redeploy.
2. In GitHub: Settings → Secrets and variables → Actions → `REVALIDATE_URL` = `https://nrl-predictor.vercel.app/api/revalidate` and `REVALIDATE_SECRET` = the same secret. Until both are set, cached data refreshes every 5 minutes on its own.
3. In Vercel: Speed Insights → Enable. Until then the script's request gets a 404, which does no harm.
4. Optional, to make signed-in requests skip a call to Supabase: in Supabase, Project Settings → JWT Keys → migrate to asymmetric signing keys. `getClaims()` then checks tokens locally. Until then it costs the same as before.
5. Watch `perf` lines in Vercel's runtime logs. For the slowest queries, run this in Supabase's SQL editor: `select calls, round(mean_exec_time::numeric, 1) as ms, query from pg_stat_statements order by total_exec_time desc limit 20;`

**Changed from the plan:**

- One cache tag, not one per kind of data: every publish writes all of them.
- 2.4: `/players` keeps its favourite-team lookup on the server, run in parallel. Moving it to the browser would bring Supabase's client back to that page.
- 2.5, streaming the viewer's comp separately, isn't done. With the round cached, the comp read is the only wait left, and the skeleton covers it. Splitting the home page would show the games first and then shift them as tips and the ladder arrive, and the signed-in dashboard is a different layout altogether. Better judged in Phase 3, with Phase 0's real numbers.
- A side effect of the skeletons: an unknown `/match/<id>` now answers HTTP 200 instead of 404. It still shows the "Knocked on." not-found page, marked noindex, because the page decides "not found" after the response has started streaming.

## What was measured

A production build (`next build && next start`) loaded in headless Chromium as a Pixel 7, with the CPU slowed 4–6x to stand in for a mid-range phone. These are **sample-data** numbers. The local server has no database or Supabase Auth delay, so the server-side costs below are estimated by counting round trips in the code. Phase 0 measures them on the live site.

| Page | JS (gzip) | HTML | Inline RSC payload | DOM nodes | Images | Main thread blocked* |
|---|---|---|---|---|---|---|
| `/about` (static text) | 185 kB | 69 kB | 40 kB | 343 | – | 170 ms |
| `/` | 192 kB | 62 kB | 36 kB | 299 | 65 kB | 130 ms |
| `/tipping` | 198 kB | 46 kB | 15 kB | 317 | – | 210 ms |
| `/elo` | 194 kB | **199 kB** | 85 kB | **1,685** | – | 240 ms |
| `/dally-m` | 197 kB | **218 kB** | **154 kB** | 860 | **348 kB** (31 photos) | 170 ms |
| `/players` | 187 kB | 93 kB | 51 kB | 415 | 283 kB | 210 ms |
| `/round/2026/10` | 191 kB | 106 kB | 59 kB | 523 | – | 270 ms |

\*Total blocking time at 6x CPU slowdown. Every page also loads **88 kB of fonts** (5 files). Layout shift was 0 on every page.

The build's "First Load JS" column reports about 106 kB for `/about`, but the browser actually downloads about 185 kB. The difference is the Supabase client, which the shared layout pulls in (finding 4).

## Why it feels slow

Ordered by how much each one probably contributes to the hanging on a phone.

### 1. Taps freeze: no loading states and nothing prerendered

`web/app` has no `loading.tsx` anywhere, and almost every page is dynamic (`force-dynamic`, `cookies()` or `searchParams`). In the App Router, tapping a link to a dynamic page with no loading boundary leaves the old page on screen, unresponsive-looking, until the server has finished the *whole* new page. Link prefetching can't help, because it only fetches up to the nearest loading boundary and there isn't one. On the Hobby plan with a handful of users, many taps also land on a cold function: it boots, parses its bundle (finding 6) and opens a new TLS connection to the pooler. That is the "hanging".

### 2. Nothing is cached, though the model data changes a few times a week

Rounds, predictions, Elo, odds, the model record and recaps change only when `pipeline/publish.py` runs. Even so, every request re-runs every query. `PLAN_WEB.md` already plans for a revalidation hook (`REVALIDATE_URL`) but notes it "isn't needed while pages aren't cached". Caching was never switched on.

### 3. Many round trips, run one after another

- **One DB connection per instance.** `web/lib/db.ts` sets `max: 1`, so every `Promise.all` of SQL queries actually runs one query at a time. Under Fluid compute, one instance serves several requests at once, so concurrent page renders also queue behind each other.
- **Serial queries.** `liveHome` (`lib/source.ts`) makes about 11 dependent round trips: latest season → model record → last round → open count → current round → `roundData` (rows → featured game → weather + bets) → recap. `liveMatch` makes about 17: `matchDetail` alone is 6 serial queries, then Elo by season and two team views, one after the other. The tipping page calls the full `liveHome` (model record and recap included) just to find the round.
- **The same viewer looked up over and over.** On the signed-in home dashboard, Supabase Auth's `getUser()` (a network call each time) runs 4 times per request: in the middleware, `viewerRoundComp`, `lmsSource` and `dallyMSource`. The `profiles` row is read 3 times and `readGroups` (2 requests) runs 3 times. `/tipping` also fires one `auto_tip` RPC per locked game.
- **The middleware runs on every request, prefetches included**, and calls `getUser()` for anyone with a session cookie.

This hits hardest once the 2027 comp starts, because `viewerRoundComp` returns early for seasons before `COMP_FIRST_SEASON`.

### 4. Every page ships the Supabase client, and checks "admin" twice

`components/app-nav.tsx` imports `createAuthStore` to decide whether to show the Admin menu item. That pulls `@supabase/supabase-js` (about 260 kB raw, about 80 kB gzip, roughly 40% of each page's JS) into the shared layout, so even `/about` downloads, parses and runs it. `MoreMenu` is mounted twice, once in the desktop header (hidden by CSS but still mounted) and once in the bottom bar. So on every page load the phone runs `getSession()` twice and sends **two `is_admin` RPCs** to Supabase. They also contend for supabase-js's auth lock, which is a known source of multi-second stalls when a mobile tab is resumed.

### 5. The browser re-fetches what the server just rendered

`TipList`, the Dally M ballot and the LMS picker each call their store's `load()` on mount. Live, that's `getSession` plus a tips query plus a `rounds` query, repeating what the server already read under RLS and passed in as props.

### 6. Live functions carry about 1 MB of sample data

`lib/source.ts`, `lib/elo.ts` and several pages statically import `sample-*.ts` (archive 290 kB, Elo 381 kB, players 334 kB, Dally M 213 kB source). In the server build, the home page's function loads an 864 kB chunk of sample data it never uses when the database is connected. That makes every cold start slower. `lib/news.ts` already shows the fix: `await import("./sample-news")` only on the sample path.

### 7. The scoring SQL grows with the season (fix before 2027 Round 1)

`effective_tips` cross-joins `profiles × matches` and calls the plpgsql `auto_tip()` for every untipped pair. For the "ladder" choice, `auto_tip()` recomputes `nrl_ladder_before()` from scratch each time. `readLadder` and `readRoundComp` page through `tip_results`/`round_scores` with `.range()`, which re-evaluates the whole view for every 1,000-row page. The ladder page evaluates it at least 3 times (`ladder()`, `round_scores`, `tip_results`). This is cheap now, in the off-season and before the comp's first season, but it grows as tippers × games × rounds.

### 8. Smaller front-end costs

- Fonts: 8 weights across two families (88 kB). `font-extrabold` is used 4 times and `font-normal` 12; trim to what headings and body actually use.
- Two `backdrop-blur-md` bars (the sticky header and the fixed bottom nav) are re-blurred on every scroll frame. That is a common cause of scroll jank on mid-range Android.
- The win-probability bar animates `width` (`pitch-fill` in `globals.css`), which forces layout for every bar on the page. `transform: scaleX()` runs on the compositor instead.
- `/elo`: 1,685 DOM nodes and 199 kB of HTML (charts, ladder and table view all rendered at once).
- `/dally-m`: 154 kB of inline RSC payload (each round's players are serialised into the client ballot) and 31 headshots.
- Player headshots are PNGs from nrl.com at 112 px. Check whether `remote.axd` serves WebP (`&format=webp`).

## The plan

### Phase 0: measure the live site first (half a day)

1. Turn on Vercel Speed Insights (or `useReportWebVitals` posting to a log) to get real phone LCP and INP numbers.
2. Add timing around each `lib/source.ts` entry point (a `Server-Timing` header or `console.time` into Vercel logs) to record the server time per page, warm and cold.
3. Run Lighthouse in mobile mode against `nrl-predictor.vercel.app` for `/`, `/tipping`, `/elo` and `/match/<id>`, and keep the numbers as the baseline.
4. Confirm Fluid compute is on for the Vercel project, and check the function logs for cold-start frequency.
5. Turn on `pg_stat_statements` or Supabase's Query Performance view to find the slowest queries.

### Phase 1: make taps respond instantly (about 1 day, biggest felt change)

1. **Loading boundaries.** Add `app/loading.tsx` and section skeletons for `/`, `/tipping`, `/round/[season]/[round]`, `/match/[id]` and `/elo`, so a tap shows the new page's frame straight away and prefetch can fetch it ahead. Skeletons follow `DESIGN.md` and go through the CLAUDE.md design checks.
2. **Nav without Supabase.** In `app-nav.tsx`, check admin once (lift the state to `AppNav`, not per `MoreMenu`), and only when the More menu opens, by `import("@/lib/auth")` inside the handler. Pages that don't use tipping then stop shipping supabase-js at all.
3. **Middleware fast path.** Return straight away when there's no `sb-` auth cookie or the request is a prefetch. For signed-in requests, use `supabase.auth.getClaims()` (local JWT check against the project's published keys, after switching to asymmetric JWT signing keys) instead of the `getUser()` network call.
4. **DB pool.** Raise `max` in `lib/db.ts` to about 4, so `Promise.all` really runs in parallel. The transaction pooler is built for this.

### Phase 2: cache the model data (2–3 days, biggest server win)

1. Wrap the readers in `lib/data.ts` (or the `lib/source.ts` builders) in `unstable_cache` with tags (`model`, `elo`, `odds`, `players`, `dally-m`) and a 1-hour safety `revalidate`.
2. Add `app/api/revalidate/route.ts`, guarded by a secret, that calls `revalidateTag`. Set `REVALIDATE_URL` in the pipeline workflows: `publish.py` already calls it after each publish.
3. Keep clock-dependent logic outside the cache. Cache the rows, and decide "off-season after a week", locked games and `match_edges`' `now()` per request. `match_edges` changes with Betr prices, so give it its own short TTL or tag, refreshed by the odds and refresh jobs.
4. Then the public data pages (`/elo`, `/odds`, `/model`, `/news`, `/about`, `/players`) render from cache in milliseconds. The one per-user touch, `/players`' favourite-team tint, moves to a small client component (or is dropped), so the page itself needs no auth call.
5. On `/` and `/round`, render the round (cached, the same for everyone) first, and stream the viewer's comp in a `<Suspense>` boundary, so the games show before the tips and ladder arrive.

### Phase 3: cut the remaining round trips (about 2 days)

1. **One viewer per request.** A `viewer()` helper wrapped in React `cache()` returns `{ sb, user, profile, groups }`. Use it in `viewerRoundComp`, `lmsSource`, `dallyMSource`, the tipping page and `/players`. That turns 4 `getUser`, 3 `profiles` and 3 `readGroups` calls into one of each.
2. **Fewer, wider queries.** Collapse `liveHome`'s lookups into one or two SQL statements. Fold `roundData`'s featured game, weather and bets into the main query (lateral joins or `json_agg`). Run `matchDetail`'s six independent queries, and `liveMatch`'s Elo, preview, drivers and odds, in parallel once the pool allows it.
3. **Tipping page.** Use a light `liveTipRound` that skips the model record and recap. Replace the per-game `auto_tip` RPCs with one `auto_tips(p_user, p_matches bigint[])` (a new migration).
4. **No client re-fetch when live.** `TipList`, `DallyMBallot` and `LmsPicker` trust the server's props when Supabase is live, and keep `load()` only for the browser (sample) store.

### Phase 4: the database, before the 2027 season (1–2 days)

1. Compute the NRL ladder once per (season, round) in the scoring views, not per `auto_tip()` call. Alternatively, keep a small `auto_tips` table that `publish.py` (and a tips trigger, for "crowd") keeps up to date, so `effective_tips` is a plain join.
2. Replace `.range()` paging over the scoring views with one RPC per page (`round_comp(season, round, group)`, `ladder_view(season, group)`) that evaluates the views once and returns everything the page needs.
3. Load a full simulated season into the trial database (`pipeline/trial.py`) with 20–30 tippers, run `EXPLAIN ANALYZE` on the ladder, home and tipping queries, and add a PGlite test with a row-count-scaled timing sanity check.

### Phase 5: lighter pages (1–2 days)

1. Load the sample modules lazily on the server (`await import(...)` on the sample path only, as `lib/news.ts` does), so live functions don't parse about 1 MB of unused data on a cold start.
2. Trim the font weights to those actually used.
3. Make the bottom nav (and the header on mobile) opaque, without `backdrop-blur`, keeping the blur on desktop. This is a visual change, so it goes through the `DESIGN.md` / impeccable checks.
4. Animate the pitch bar with `transform: scaleX()` from the halfway line instead of `width`.
5. `/elo`: render the table view only when it's opened (client-side), and keep the season chart's SVG lean.
6. `/dally-m`: send the ballot only what the picker needs (id, name, team, position), and load headshots only for the chosen players and the leaderboard.
7. Check `remote.axd` for WebP headshots.

### Phase 6: keep it fast

1. Add a perf smoke test to `web/scripts/` (Playwright as a phone, with JS bytes, DOM size and blocking time per page; the measurements above came from such a script), and a JS budget for the shared layout in CI.
2. Keep real-user Web Vitals on (Phase 0), and re-check after each phase against the baseline.

## Order of work and expected effect

| Phase | Effort | Expected effect (estimates until Phase 0 gives real numbers) |
|---|---|---|
| 1 Loading states, nav, middleware, pool | ~1 day | Taps respond at once. About 80 kB gzip less JS on non-tipping pages. Two fewer Supabase calls per page load |
| 2 Cache model data | 2–3 days | Public pages served from cache. The home and round pages stop querying model data per request |
| 3 Fewer round trips | ~2 days | Signed-in dashboard: about 10 fewer auth and profile calls per request. Match page from about 17 serial queries to a few parallel ones |
| 4 Scoring SQL | 1–2 days | Ladder and home stay fast as the 2027 season fills up |
| 5 Lighter pages | 1–2 days | Faster cold starts, smoother scrolling on Android, lighter `/elo` and `/dally-m` |
| 6 Guardrails | half a day | Regressions caught in CI |

Phases 1 and 2 address most of what you notice on a phone. Phase 4 should be in place before 2027 Round 1, when the comp's queries start running for real.
