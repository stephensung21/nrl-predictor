# The website trial

2026's Rounds 1–3 played again over nine days on a separate copy of the site, so friends can try
tipping, lockout, auto-tips, the margin game, the ladder, what drove each prediction, the price
history and the value underdog flag before 2027. The real site, database and comp are untouched.

How it works: `pipeline/trial.py` (its docstring has the details). Each round opens at 9am Sydney with
the real predictions, its eight games kick off over the next two days at noon, 3pm, 6pm and 9pm, and
results appear at the next scheduled refresh after full time (10am or 4pm Sydney), as they will
in-season. Round 2 opens three days after Round 1, Round 3 three days after that.

| Day | What happens |
|---|---|
| 0, 9am | Round 1 open: predictions, team lists, margin game, opening prices |
| 1–2 | Round 1's games; results the same afternoon or next morning |
| 3, 9am | Round 2 open |
| 4–5 | Round 2's games |
| 6, 9am | Round 3 open |
| 7–8 | Round 3's games; the last results on day 9 at 10am |

Not in the trial: Claude's previews and recaps (no API credit yet), live scores and email reminders
(not built), and Betr's prices between opening and closing (2026 only has the sheet's two).

## Setting it up (steps only you can do)

Like the real project's set-up (PLAN_WEB.md), with `-trial` names. About 30 minutes.

1. **Supabase project.** supabase.com → *New project* in the same organisation (the free plan allows
   two): name `nrl-predictor-trial`, region Sydney, a new database password (letters, digits and
   `! - _ . ~` only). Note its **ref** (in the dashboard's address).
2. **Migrations.** In a separate PowerShell window at the repo root:
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
4. **Load the history and start** (from your computer): pick the first day, then
   ```
   .venv/Scripts/python pipeline/trial.py reschedule --start 2026-10-16
   .venv/Scripts/python pipeline/trial.py publish --history
   ```
   `reschedule` only moves the timetable (no models run); commit `data/pipeline/trial/` afterwards so
   the hourly job uses the same dates. Before the first day, publish writes only the history.
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
7. **The first tipper (you).** `.venv/Scripts/python pipeline/trial.py invite` prints a code; open
   `https://nrl-predictor-trial.vercel.app/join/<code>`, sign in with Google and pick a name. Then
   `.venv/Scripts/python pipeline/trial.py admin "<that name>"`, and invite friends from the trial's
   `/tipping/admin` page.
8. **The hourly job** runs from `main` once the secret is in (`.github/workflows/trial.yml`, at :35
   past each hour). Run it once by hand from the Actions tab to check it's green.

## After the trial

Turn off the workflow (Actions → trial → ⋯ → *Disable workflow*), then pause or delete the trial
Supabase project and the Vercel project, and remove the `TRIAL_DB_URL` secret. Nothing in the real
project changes either way.

## Running it again

`trial.py reschedule --start <new day>` moves the timetable, but games already published keep their
old times (publishing never deletes). For a clean rerun, reset the trial database first: in the trial
project, `npx supabase db reset --linked` (it wipes everything, sign-ins included: check `npx supabase projects list` shows the **trial** project as linked first, never the real one), then repeat
steps 4 and 7.
