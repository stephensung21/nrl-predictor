# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NRL match predictor (win probability, margin, total, score) benchmarked against bookmaker odds, plus a weekly GitHub Actions pipeline that publishes to Supabase, plus a Next.js tipping-comp site (`web/`, deployed on Vercel from `main`). See README.md for results and the full command table.

## Commands

Python 3.12, run everything from the repo root. Use the pinned `requirements.txt` exactly: the frozen bundles in `models/<season>/` (joblib) only load and predict identically with those library versions.

```bash
python -m pytest -m "not slow"                  # what CI runs
python -m pytest                                # also the slow leakage test (rebuilds all features)
python -m pytest tests/test_edges.py::test_name # single test
python src/predict.py --replay --season 2026 --round 10   # quick end-to-end smoke test (~1 min)
python pipeline/run.py --job predict            # one weekly job: results | predict | refresh | odds
python pipeline/run.py --job predict --season 2026 --as-of "2026-05-05 17:15"  # replay a job (Sydney time)
python pipeline/replay.py --season 2026 --rounds 1 10 --check  # replay the weekly schedule end to end
python pipeline/publish.py --dry-run            # count rows without connecting
```

`tests/test_publish.py` needs a Postgres: `TEST_DATABASE_URL` if set, otherwise PGlite via node, which needs `npm ci` in `web/` first. It skips if neither is available.

Website (`cd web`): `npm run dev` (runs on sample data with no env vars), `npm test` (vitest; DB tests start PGlite and apply every migration in `supabase/migrations/`), `npm run lint`, `npm run build`. Single test: `npx vitest run tests/tipping.test.ts`.

## Architecture

**`src/` and `pipeline/` are plain script folders, not a package.** Modules import each other by bare name (`import config`) and rely on `sys.path`: scripts run from their own directory, `pipeline/common.py` inserts `src/` onto the path, and `tests/conftest.py` inserts `pipeline/`. Do not rename modules in `src/`: the frozen joblib bundles reference classes such as `models.Platt` by module name.

**Model side (`src/`).** `scrape.py`/`ingest.py`/`teamlists.py` → `data/processed/` → `features.py` builds `features.csv` (Elo from `elo.py`, regularised plus-minus player ratings, named-17 vs usual side, star absences, context) → `models.py` (logistic + ridge, LightGBM, Platt calibration, 50/50 ensemble; two variants, with-odds and no-odds) → `train.py` / `evaluate.py` / `reports.py`. All settings live in `config.py` and are read at call time (`config.NAME`), so `train.py` flags and `experiments.py`'s `override()` change them in one place.
- Season roles in `config.py`: walk-forward CV on earlier seasons, 2023–2025 backtest (the main yardstick), 2026 the one-shot final test, `PREDICT_SEASON` the season served.
- `train.py --final` is guarded by `reports/final.lock` and refuses to run with uncommitted changes. Never pass `--force` or delete the lock without being asked.
- `train.py --freeze` fits on every past season and writes `models/<season>/`. Models are frozen for the season; live prediction only rebuilds features.
- **No leakage**: a game's features may use only what was known before kickoff. `tests/test_leakage.py` enforces this by truncating and scrambling inputs and checking features are unchanged. Any feature change must keep it passing.

**Weekly pipeline (`pipeline/`).** `run.py` jobs, each safe to re-run: `results` (Mon: scrape, grade, paper trading), `predict` (Tue: `draw.games_to_predict`, team lists, margin-game draw, predict with frozen models), `refresh` (Wed–Sun: re-predict only games whose team list or opening price changed), `odds` (Sun night). Live jobs also fetch odds (The Odds API, Betr), weather (site only, not a model input), explanations (`explain.py`), match briefs (`brief.py`) and edges. Those side steps fail as warnings in the run record, not as job failures.
- `common.Records` keeps every run, prediction, odds snapshot and forecast, append-only and never overwritten. A game's prediction of record is the latest one made before kickoff. Live records: `data/pipeline/live/<season>/` (committed by the workflows). Replays: `data/pipeline/replay/` (gitignored).
- `--as-of` replays hide results after the clock and use archived pre-kickoff team lists, so a past season stands in for a live one.
- `publish.py` upserts everything to Supabase in one transaction. The repo is the source of truth and the DB can always be rebuilt from it. It is skipped if `SUPABASE_DB_URL` is unset. API keys in `.env` (see `.env.example`) are all optional: a step whose key is missing is skipped.
- Workflows: `.github/workflows/{results,predict,refresh,odds}.yml` call the reusable `pipeline-job.yml`.

**Website (`web/`).** Next.js 15 App Router, React 19, Tailwind 4, Supabase auth. `lib/source.ts` chooses per page between the DB (`lib/data.ts`, when `SITE_DATABASE_URL` is set) and the sample modules (`lib/sample*.ts`, built by `web/scripts/build_*sample.py`). Tipping rules and row-level security live in SQL in `supabase/migrations/` and are tested through PGlite. Schema changes go in a new timestamped migration.

## Conventions

- Every modelling change is judged on the 2023–2025 backtest and logged as a numbered item in `docs/IMPROVEMENTS.md` (adopted or rejected, with its result). Experiments write reports to `reports/experiments/` via `python src/experiments.py --only <name>`.
- Design context for the site: `PRODUCT.md`, `DESIGN.md` and `docs/DESIGN_BRIEF.md`; `.impeccable/` holds the impeccable design skill's config and per-page surface notes. Plans and history: `docs/PLAN_WEB.md` (pipeline and site), `docs/MODELLING_PLAN.md`.
- Module docstrings explain each file's role and usage in detail. Read them before changing a script.

## Website Redesign Pipeline
When redesigning pages in this repo, follow this sequence:
1. Read `PRODUCT.md`, `DESIGN.md` and `design-system/MASTER.md` first. `DESIGN.md` is the design system of record (colours, type, components, used by impeccable and `.impeccable/`); where anything conflicts with it, `DESIGN.md` wins.
2. If `design-system/MASTER.md` does not exist, generate and persist it via `ui-ux-pro-max` (`--design-system --persist`), seeded from `DESIGN.md`'s tokens and `PRODUCT.md`. It adds `ui-ux-pro-max`'s UX, accessibility and stack guidance; it must not introduce a new palette, typeface or component style.
3. Use the `design-taste-frontend` skill (taste-skill) for visual direction, layout composition, and headless browser consistency checks (`1440px`, `768px`, `390px`) before moving to the next page.
4. Run `/impeccable polish` and verify zero violations against Impeccable's 62-rule check before completing a task.

The design skills are not in the repo (`.agents/`, `.claude/skills/` and `skills-lock.json` are gitignored). On a fresh machine, install them first, then restart Claude Code or run `/reload-plugins`:

```bash
claude plugin marketplace add pbakaus/impeccable
claude plugin install impeccable@impeccable
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend -y   # project-local
```
