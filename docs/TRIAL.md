# The website trial

2026's Rounds 1 and 2 played again over two real weeks on a separate copy of the site, so friends can try
tipping, lockout, auto-tips, the margin game, the ladder, what drove each prediction (with the star
players out), the price history and the value underdog flag before 2027. The real site, database and
comp are untouched.

The trial site: https://nrl-predictor-trial.vercel.app (Supabase project `oekzakejprqqzxyiicvh`). Each
friend joins with their own invite link, `https://nrl-predictor-trial.vercel.app/join/<code>`, made on
the trial's `/tipping/admin` page: each code works once and lasts 7 days. Add their Gmail address as a
test user in Google Cloud (step 7) before sending it.

How it works: `pipeline/trial.py` (its docstring has the details). Each round opens on a Tuesday at
07:15 UTC (6:15pm Sydney in daylight saving), when the real predict job runs, with the real predictions
and Tuesday's team lists. Its games are played that week on their real weekdays at their real Sydney
kickoff times, and each result appears at the next scheduled refresh after full time (10am or 4pm
Sydney in daylight saving), as it will in-season. Round 1's Las Vegas games were played the Sunday
before the rest of the round; in the trial they're on its Sunday, except the 3:30pm one, which moves
to the Saturday so it doesn't clash with the 4:05pm game.

| When (from a Tuesday start, e.g. 20 October) | What happens |
|---|---|
| Tue 20 Oct, 6:15pm | Round 1 open: predictions, what drove them, Tuesday's team lists, margin game, opening prices |
| Thu 22 – Sun 25 Oct | Round 1's games (Thu 8pm, Fri 6pm and 8pm, Sat 3:30pm, 5:30pm and 7:35pm, Sun 1:15pm and 4:05pm); final team lists an hour before each |
| Tue 27 Oct, 6:15pm | Round 2 open |
| Thu 29 Oct – Sun 1 Nov | Round 2's games; the last result on Mon 2 Nov at 10am |

Not in the trial: Claude's previews and recaps (no API credit yet), email reminders (not built), the
"updated since Tuesday" reasons (not built, and each trial game is predicted once), and Betr's prices
between opening and closing (2026 only has the sheet's two).

## Setting it up (steps only you can do)

Like the real project's set-up (PLAN_WEB.md), with `-trial` names. About 30 minutes. Everything the
trial needs is on `main`, so start any time; finish by the Monday before Round 1 opens (Monday 19
October for the 20 October start) so friends have the invite before the round's predictions appear.

1. **Supabase project.** supabase.com → *New project* in the same organisation (the free plan allows
   two): name `nrl-predictor-trial`, region Sydney, a new database password (letters, digits and
   `! - _ . ~` only). Note its **ref** (in the dashboard's address).
2. **Migrations** (all of them, including `20261019000000_star_names.sql`, which the star players' names
   need). In a separate PowerShell window at the repo root:
   ```
   npx supabase link --project-ref <trial ref>
   npx supabase db push
   npx supabase link --project-ref szukyfanuvjajjezxuar    # back to the real project afterwards
   ```
3. **Connection strings** (Dashboard → *Connect*):
   - Session pooler URI, with the password filled in: add it to the repo's `.env` as `TRIAL_DB_URL=...`,
     and to GitHub as the secret **`TRIAL_DB_URL`** (Settings → Secrets and variables → Actions).
   - In the SQL editor: `alter role analyst login password '<another password>';` then the
     **transaction pooler** string (port 6543) with user `analyst.<trial ref>`: that's the trial site's
     `SITE_DATABASE_URL`.
4. **Load the history and start** (from your computer): the records are set up for Tuesday 20 October.
   For a different start, pick a Tuesday and run `reschedule` first:
   ```
   .venv/Scripts/python pipeline/trial.py reschedule --start 2026-10-27   # only if not 20 October
   .venv/Scripts/python pipeline/trial.py publish --history
   ```
   `reschedule` only moves the timetable (no models run); commit `data/pipeline/trial/` afterwards so
   the hourly job uses the same dates. Before Round 1 opens, publish writes only the history.
5. **Google sign-in.** Trial project → Authentication → Sign In / Providers → Google: paste the
   *same* client id and secret as the real project, then in Google Cloud (APIs & Services →
   Credentials → the OAuth client) add the trial project's callback URL
   (`https://<trial ref>.supabase.co/auth/v1/callback`) to the authorised redirect URIs.
6. **Vercel project.** vercel.com → *Add New → Project* → import the same repo again, name
   `nrl-predictor-trial`, Root Directory `web`. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the trial project's (Project Settings → API Keys)
   - `SUPABASE_SERVICE_ROLE_KEY`: the trial project's secret key
   - `SITE_DATABASE_URL`: the analyst string from step 3
   - `NEXT_PUBLIC_TRIAL=1` and `NEXT_PUBLIC_COMP_FIRST_SEASON=2026`

   Then in the trial Supabase project: Authentication → URL Configuration → Site URL
   `https://nrl-predictor-trial.vercel.app`, and the same with `/**` in the redirect URLs.
   Open the address: you should see the trial banner and, before Round 1 opens, "No round to tip".
7. **The first tipper (you).** `.venv/Scripts/python pipeline/trial.py invite` prints a code; open
   `https://nrl-predictor-trial.vercel.app/join/<code>`, sign in with Google and pick a name. Then
   `.venv/Scripts/python pipeline/trial.py admin "<that name>"`, and invite friends from the trial's
   `/tipping/admin` page. While the Google OAuth app is in "Testing", only Gmail addresses added as
   test users (Google Cloud → OAuth consent screen → Audience) can sign in: add each friend there first,
   or publish the app.
8. **The hourly job** runs from `main` once the secret is in (`.github/workflows/trial.yml`, at :35
   past each hour). Run it once by hand from the Actions tab to check it's green.
9. **Check Round 1 opened** (Tuesday after 7:35pm Sydney, the first hourly run after 6:15pm): the
   home page and `/tipping` show Round 1, and a match page shows "What drove this" with any star
   players out named under it.

## New migrations during the trial

When a change adds a migration under `supabase/migrations/` (for example `20261020000000_late_joiners.sql`),
the trial database needs it as well as the real one. In a separate PowerShell window at the repo root,
on a checkout that has the migration (`main` once it's merged):
```
npx supabase link --project-ref <trial ref>          # asks for the trial database password
npx supabase db push                                 # lists only the migrations the trial lacks; confirm with y
npx supabase link --project-ref szukyfanuvjajjezxuar # back to the real project afterwards
```
`supabase/.temp/project-ref` shows which project the CLI is linked to. Link back straight away, so a
later push doesn't go to the wrong project. The migration changes the trial database at once. The
site's own changes reach the trial when `main` is pushed and Vercel redeploys it.

A scoring change such as late joiners re-scores everyone straight away: a tipper whose profile was
created after a game kicked off now gets the away team for that game. Anyone who joined before Round
1's first game is unaffected.

## What to ask testers to try

- Join with the invite link and sign in with Google; pick a name, a favourite team and an auto-tip.
- Tip Round 1 before Thursday's game, change a tip, and enter a margin for the margin game.
- Leave a game untipped on purpose and check the auto-tip filled it at kickoff.
- Check you can't see anyone else's tips before a game starts, and can after.
- After each result (10am or 4pm the next day), check the round's scores and `/tipping/ladder`.
- Open a few match pages: what drove the prediction (and the star players out), team lists, the
  price before kickoff, Elo, head to head; and the value underdog flag on the round page.
- Tell us anything confusing or broken, on phone and computer.


Write down what testers report: after the trial, it goes into PLAN_WEB.md (step 12b) as what to fix
before 2027.

## After the trial

Turn off the workflow (Actions → trial → ⋯ → *Disable workflow*), then pause or delete the trial
Supabase project and the Vercel project, and remove the `TRIAL_DB_URL` secret. Nothing in the real
project changes either way.

## Running it again

`trial.py reschedule --start <new day>` moves the timetable, but games already published keep their
old times (publishing never deletes). For a clean rerun, reset the trial database first: in the trial
project, `npx supabase db reset --linked` (it wipes everything, sign-ins included: check `npx supabase projects list` shows the **trial** project as linked first, never the real one), then repeat
steps 4 and 7.
