# Players Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/players` page with Model power rankings (overall and per position) and per-player season stats, fed by two new published tables.

**Architecture:** `src/features.py` gains `player_ratings()` sharing the RAPM design-matrix code with `rapm_features`; `pipeline/players.py` builds `player_seasons` and `player_ratings` frames; `publish.py` upserts them (live season every run, `--players-backfill` for 2020–2026); a migration creates the tables; the web page reads them via `lib/source.ts` with a generated sample fallback.

**Tech Stack:** Python 3.12 (pandas, numpy, scipy), Postgres/Supabase, Next.js 15, Tailwind 4, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-11-21-players-page-design.md`

## Global Constraints

- `rapm_features` output must stay bit-for-bit identical (frozen models, leakage test).
- DESIGN.md tokens only; text ≥ 11px; AA contrast both themes; main tables fit 390px.
- Owner is unavailable: no merge to `main`, no migration applied to Supabase; push the branch only.

## Review Focus

- A season with no games (2027 now): page shows "No games yet in 2027." and the season picker still works.
- A player traded mid-season: team = most recent game's team; stats summed across both clubs.
- Bench-only players: in overall ranking, absent from every position list.
- Goals with zero attempts: show "0/0", no NaN %.
- Database without the new tables (site deployed before migration): page must show a clear message, not crash.

---

### Task 1: `player_ratings` in `src/features.py`
- Extract the design-matrix block of `rapm_features` into `_rapm_design(matches, players, bench_weight, stats_prior, alpha)`; `rapm_features` uses it unchanged.
- Add `player_ratings(matches, players, as_of) -> DataFrame[player_id, rating, attack, defence]` fitting on games before `as_of` with the same weights as `rapm_features`' last refit.
- Tests `tests/test_players.py`: (a) `rapm_features` identical before/after on 2025–2026 (checked once against a saved frame, then by the consistency test); (b) for the last round of a season, summing `player_ratings` × the role shares reproduces `rapm_total` for each team.

### Task 2: `pipeline/players.py` and publishing
- `season_rows(players_df, season) -> DataFrame` (player_seasons columns per spec), `rating_rows(matches, players, season) -> DataFrame`.
- Migration `supabase/migrations/20261121000000_players.sql`.
- `publish.py`: KEYS for both tables, included in `live_tables`, `--players-backfill` flag.
- Tests: aggregation cases in `tests/test_players.py`; `tests/test_publish.py` round-trip includes both tables.

### Task 3: Web data layer
- `lib/types.ts` `PlayerSeason`, `PlayerRating`; `lib/data.ts` `playerSeasons(sql, season)`, `playerSeasonsList(sql)`; `lib/source.ts` `playersSource()`; `web/scripts/build_players_sample.py` → `lib/sample-players.ts`.
- Test `web/tests/players.test.ts` against PGlite with migrations applied.

### Task 4: The page
- `web/app/players/page.tsx`, nav link under More; rankings tab, stats tab, season and position pickers via query params; searchable player select.
- Verify: lint, tsc, `npm test`, screenshots 1440/768/390, impeccable detect zero.
