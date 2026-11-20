# Players page: stats and power rankings

Date: 2026-11-21. New page `/players` on the website (`web/`).

## Why

The friends in the comp want to look players up: who's scoring tries, kicking goals, making tackles. The owner also wants player power rankings, overall and by position, that show the Model's view of who matters, next to a familiar stats measure so the ranking is easy to trust.

## Goals

- **Power rankings:** players ranked by the Model's rating, overall and within each position, with a fantasy-points-per-game figure beside each.
- **Player stats:** pick any player from a searchable dropdown and see their season's numbers, grouped and readable on a phone.
- Any season from 2020 to the latest, defaulting to the latest season with games.
- Works on sample data with no database, like every other page, and on real data once published.

## Non-goals

- No side-by-side player comparison (a possible later addition).
- No per-round or per-game filtering, game logs, or charts.
- No reserve grade, State of Origin or finals-only views. Finals games count in season totals as nrl.com counts them (all games played that season).
- No changes to the model, its features, or predictions.

## Anti-goals

- Not a second identity: it follows `DESIGN.md` and the site's existing pages (scoreboard tables, Saira figures, hairline rows, lime only for "you"/primary).
- The rating must not be presented as something it isn't: label it plainly as the Model's estimate of points a player adds per game.
- No player photos or club logos beyond the existing team badges (licensing).

## Approaches

1. **Pipeline publishes two small tables; the page reads them (chosen).** Matches every other page: `publish.py` upserts from the repo, the site reads via `lib/source.ts` with a sample fallback. Refreshed after the Monday results job.
2. Pipeline writes JSON into `web/`: no migration, but every refresh needs a commit and redeploy, and it breaks the repo → database pattern. Rejected.
3. Publish all ~51,000 player-game rows and aggregate in SQL: enables filters nobody asked for, ten times the data; the ratings still need Python. Rejected.

## Data

Source: `data/processed/player_match_stats.csv` (2020–2026, NRL regular season and finals, one row per player per game, 69 columns), built by `src/scrape.py`. Rows with position `Replacement` or `Reserve` and 0 minutes are not appearances and are excluded.

**Position.** A player's position for a season is the starting position (jersey 1–13 label: Fullback, Winger, Centre, Five-Eighth, Halfback, Hooker, Prop, 2nd Row, Lock) he started most often that season; ties go to his most recent start. A player who only came off the bench is "Interchange" and appears in the overall ranking but in no position list.

**Team.** The team of his most recent game that season.

### Table `player_seasons` (one row per player per season)

Keyed on `(season, player_id)`. Columns: `player_name`, `team`, `position`, `games` (appearances with minutes > 0), `minutes`, and season totals of:

- Scoring: `tries`, `points`, `goals`, `goal_attempts` (`conversionAttempts` + penalty-goal attempts if available, else conversion attempts), `field_goals`.
- Attack: `run_metres` (`allRunMetres`), `runs` (`allRuns`), `post_contact_metres`, `line_breaks`, `line_break_assists`, `try_assists`, `tackle_breaks`, `offloads`, `kick_return_metres`.
- Kicking: `kicks`, `kick_metres`, `forty_twenty` (`fortyTwentyKicks`), `forced_drop_outs` (`forcedDropOutKicks`), `bomb_kicks`, `grubber_kicks`.
- Defence: `tackles` (`tacklesMade`), `missed_tackles`, `ineffective_tackles`, `intercepts`, `one_on_one_steals`.
- Discipline: `errors`, `penalties`, `sin_bins`, `send_offs`.
- `fantasy_points` (sum of `fantasyPointsTotal`).

Per-game figures and tackle efficiency (`tackles / (tackles + missed_tackles)`) are computed on the page, not stored.

### Table `player_ratings` (one row per player per season)

Keyed on `(season, player_id)`. Columns: `rating` (the Model's margin rating: points of margin a player adds per full game, as the model would value him at the end of that season, or now for the season in play), `attack`, `defence` (the same split the model uses), `as_of` (date of the last game included).

**How it's computed.** A new function in `src/features.py`, `player_ratings(matches, players, as_of)`, fits the same regularised plus-minus regressions `rapm_features` fits before each round (same settings: `RAPM_ALPHA`, half-life, minutes weighting, stats prior), on every game before `as_of`, and returns each player's effective rating: his own coefficient plus the stats-prior term at his latest `rating_vs_group`, i.e. exactly what `rapm_total` adds for him as a full-game player. It must reuse the existing fitting code (refactor the fit into a shared helper rather than duplicating it), so the published ratings are the model's ratings. A test checks that, for a given round, the summed ratings of a named 17 reproduce that team's `rapm_total` (within floating-point tolerance) for starters playing full games.

## Pipeline

- New script `pipeline/players.py` builds both tables for a season from the processed tables (`player_seasons` straight from the CSV; `player_ratings` via `player_ratings(...)` as of the season's last decided game).
- `publish.py` upserts both tables for the live season after each run (cheap; ratings change only when results do), and `--backfill SEASON` publishes any past season. A one-off backfill publishes 2020–2026.
- Migration `supabase/migrations/<timestamp>_players.sql`: both tables, primary keys `(season, player_id)`, readable by the site's `analyst` role and `anon`/`authenticated` as the other model-data tables are (follow `20261011000000_model_data.sql`'s grants and RLS).
- Tests: `tests/test_players.py` (aggregation on a hand-made frame: positions, ties, excluded rows, totals) and the ratings consistency test above; `tests/test_publish.py` gains the two tables.

## Website

**Route** `web/app/players/page.tsx`, linked from the nav (under "More" with Elo-like pages). Server component; data via new functions in `lib/data.ts` (`playerSeasons`, `playerRatings`) chosen through `lib/source.ts` (`playersSource()`), with a sample module `lib/sample-players.ts` generated by `web/scripts/build_players_sample.py` from real 2026 data (top ~120 players by minutes, so the sample stays small).

**Layout** (DESIGN.md tokens and existing components only):

```
PLAYERS                                   2026 ▾
[ Power rankings ]  [ Player stats ]

POWER RANKINGS        All ▾  (Fullback … Lock)
 #  Player              Team   Rating   Fantasy/g
 1  N. Cleary   HLF     PEN    +4.1     62.3
 ...
Rating: points per game the Model credits him with.
Fantasy/g: NRL fantasy points per game.

PLAYER STATS
[ Search a player… ▾ ]
NATHAN CLEARY · Halfback · Panthers · 22 games
Scoring    Tries 6 · Points 182 · Goals 79/91 · Field goals 2
Attack     Run metres 1,204 (55/g) · Line-break assists 14 · Try assists 21
Kicking    Kick metres 11,340 · 40/20s 3 · Forced drop-outs 18
Defence    Tackles 412 (91%) · Missed 39 · Intercepts 1
Discipline Errors 17 · Penalties 9 · Sin bins 0
```

- **Tabs** are links (`?tab=rankings|stats`), so the page stays a server component and every view has a URL. Default tab: Power rankings.
- **Season** select: seasons with data, default the latest with games; `?season=`.
- **Position filter**: All plus the nine positions; `?pos=`. Ranked: players with at least 5 games that season. Overall shows the top 25; a position shows its top 15. Each row: rank, name, position code, team badge, rating (signed, 1 decimal), fantasy points per game (1 decimal). Ties on rating share a rank (`=4`).
- **Player stats**: a searchable select (native `<datalist>` or a small client component; the builder's call, keyboard and screen-reader accessible) listing that season's players by name with team; `?player=<id>`. Default: the top-ranked player. Ranking rows link to the player's stats.
- Numbers right-aligned in tabular figures; totals with per-game in brackets where useful (metres, tackles, kick metres); thousands separators.
- Empty states: a season with no games yet ("No games yet in 2027."), a player not found (falls back to the default player).
- The signed-in tipper's favourite team: rows of that team's players get the lime-wash tint, as "you" does on the ladder. (Only when signed in; nothing otherwise.)

## Constraints

- `CLAUDE.md`'s website steps apply: `design-system/MASTER.md`, checks at 1440, 768 and 390px, `/impeccable polish` with zero violations.
- Text ≥ 11px, WCAG AA contrast in both themes, the main tables fit 390px without horizontal scroll.
- Leakage is not a concern (nothing feeds the model), but `player_ratings` must use only games before `as_of`.
- `src/` module names must not change (frozen bundles).

## Left to the builder

- The searchable select's implementation.
- Exact stat labels and which per-game figures to show, within the groups above.
- Whether the publish step runs every job or only after `results` (either is acceptable; results-only is enough).
