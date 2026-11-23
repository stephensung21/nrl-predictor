# Community Dally M: design

Date: 2026-11-21. Status: draft for approval. Branch: `dally-m` (from `players-page`, which it builds on).

## Intent

A bit of fun for the tipping comp: each round, every tipper gives 3, 2 and 1 votes to the three best
players of the round, Dally M style, and the site keeps a season leaderboard of the players. The fun
is in the reveal: votes stay hidden until voting closes, then everyone sees the round's result and
who voted for whom. It is the first of the site features in `docs/NEXT_IDEAS.md` ("3-2-1 votes"),
widened from per game to the whole round, at the owner's request.

## Goals

- Every signed-in tipper can cast one set of 3-2-1 votes per regular-season round, for three
  different players who took the field that round.
- Votes are secret until the round's voting closes; the database enforces it, as it does for tips.
- After close: the round's community result (each player's votes) and every tipper's own 3-2-1.
- A season leaderboard of players by votes, from closed rounds only.
- Its own page and its own place in the main menu.

## Non-goals

- No points for tippers and no "best judge" table (possible later, if people get into it).
- No per-game votes, no finals voting, no medal night or end-of-season event.
- The Model doesn't vote.
- No comparison with the real Dally M.

## Anti-goals

- Anyone seeing other tippers' votes, or running totals, before a round closes.
- Voting on players who didn't play (late outs, unused reserves).
- A change that breaks or slows tipping, or a publish failure that takes the rest of the pipeline down.

## Approaches

1. **The pipeline publishes each round's players (chosen).** After the Monday results scrape,
   `pipeline/players.py` builds a `round_players` table: everyone who took the field, from
   `player_match_stats.csv`. Exact, uses data already scraped, follows the players tables' pattern.
2. **Use the published team lists** (`team_lists`). Voting could open before Monday, but team lists
   are who was named, not who played: late outs would be listed and late call-ups missing.

The owner picked 1: Monday is when the round gets talked over anyway, and the list is right.

## What the owner decided

- Mostly for fun. Votes hidden until close, then revealed with who voted for whom.
- Votes only rank players; no tipper scoring.
- One set of 3-2-1 votes for the whole round (not per game).
- Its own page and main-menu tab, **Dally M**. Elo moves from the main menu into More to make room;
  a later layout redesign should fit more tabs (noted in `docs/PLAN_WEB.md`).
- Candidates come from the pipeline (approach 1).

## Design

### Data (new migration `supabase/migrations/20261122000000_dally_m.sql`)

**`round_players`**, written by the pipeline:
`season, round, player_id, match_id, player_name, team, position, head_image`, primary key
`(season, round, player_id)`. One row per player who played (minutes > 0) in a regular-season game
of that round (`matches.is_final` false). `head_image` is the same nrl.com link as `player_seasons`
(links only). Readable by anon and authenticated, like `player_seasons`.

**`dally_m_votes`**, written by tippers:
`user_id uuid → profiles, season, round, votes int check (votes in (1,2,3)), player_id,
updated_at`. Primary key `(user_id, season, round, votes)`; unique `(user_id, season, round,
player_id)`, so the three votes go to three different players. A trigger checks the player is in
`round_players` for that round and that the voter isn't the Model (`profiles.is_model`).

**The voting window**, as SQL functions next to the tipping rules:
- `dally_m_opens(season, round)`: the round has rows in `round_players` (the results job has
  published it).
- `dally_m_closes(season, round)`: the earliest kickoff in the season after the round's last game,
  i.e. the next round's first game (for the last regular round, the first final). If there is none,
  the round's last kickoff plus 7 days. *(Builder's call, marked: the end-of-season fallback.)*
- `dally_m_open(season, round)`: opened and `now() < closes`.

**Row-level security**, mirroring tips:
- Read your own votes at any time; read everyone's for a round once `now() >= dally_m_closes`.
- Insert, update and delete only your own, only while `dally_m_open`.
- Votes on a round still open can't be read by anyone else through any table or view.

**Views** (`security_invoker`, so they only see what the reader's policies allow):
- `dally_m_round_results`: per closed round, each player's votes, 3s, 2s and 1s.
- `dally_m_leaderboard`: per season, each player's total over closed rounds, with counts of 3s,
  2s and 1s, and the rounds voted in. Ranked by total, then 3s, then 2s; equal on all three share
  a rank.

Grants: `round_players` select to anon, authenticated and analyst; `dally_m_votes` select, insert,
update, delete to authenticated; the views select to authenticated. The `analyst` role gets no
access to votes (agents never see tipper data, PLAN_WEB.md §7).

### Pipeline

- `pipeline/players.py`: `round_rows(players, matches, season)` builds `round_players` for every
  round of the season played so far; `tables(season)` returns it as a third table.
- `pipeline/publish.py`: `publish_players` already upserts every table `tables()` returns, in its
  own transaction where a failure is only a warning; add `round_players` to `KEYS`.
- A round's players are added once its games are scraped; a postponed game played later adds its
  players to that round when it is published (still voteable if the round is open).

### Website

**`/dally-m`**, server component like `/players`, everything in the address (`?season=&round=`):

1. **Header:** "Dally M", the season picker.
2. **Your votes (the open round):** if a round is open, "Round 12 · votes close Thu 7:50pm" (local
   time) and three pickers, 3, 2 and 1, each a search over that round's players like the players
   page's search, showing photo, name, team. Save; change until close; a cleared pick removes it.
   Three different players; a saved set shows as saved. No open round: when the next one opens
   ("after Round 13's results, usually Monday").
   Signed out: a sign-in prompt in place of the pickers.
3. **Last round revealed:** the most recently closed round (a round picker for earlier ones): the
   community result (top players by votes, with photo and team) and each tipper's 3-2-1, the
   viewer's own first, favourite-team tint as on the ladder.
4. **Season leaderboard:** rank, photo, player, team, votes, 3s. Top 25, then "Show all".

Hidden until close, so nothing about other tippers' votes on an open round appears anywhere; the
open round shows only how many tippers have voted (*builder's call: a count nudges without giving
anything away*), from a `security definer` function `dally_m_voters(season, round)` that returns
the count alone, as `admin_tip_counts` does for tips.

Rounds can't overlap: a round closes at the next round's first kickoff, and the next round opens
only after its own results, so at most one round is open at a time.

**Menu:** main menu becomes Round, Tips, Ladder, Dally M, More; Elo moves into More (first item).

**Tipping page nudge:** while a round is open and the viewer hasn't voted, a one-line link on
`/tipping`: "Dally M votes for Round 12 are open, close Thu 7:50pm".

**Sample mode:** `lib/sample-dally-m.ts` (built by a script, from real 2026 rounds' players) with
made-up votes by the sample tippers, labelled by the existing sample note, so the page can be seen
populated locally.

**Design:** follows `DESIGN.md` and the players and ladder pages: same tables, photo component,
pickers, figure tiles. Website Redesign Pipeline checks (390, 768, 1440; impeccable detector clean).

### Tests

- SQL (PGlite, `web/tests`): window opens only after `round_players` exist and closes at the next
  kickoff; three different players; player must have played; Model can't vote; no reading others'
  votes before close (direct and through both views); edits refused after close; leaderboard
  counts closed rounds only, tie ranking.
- Python: `round_rows` (only minutes > 0, regular season only, one row per player per round, the
  photo link), publish of the third table.
- Web: leaderboard and reveal helpers; the page's data functions against PGlite.

## Constraints

- Migrations are new timestamped files; RLS tested through PGlite; nothing about tippers reaches
  the `analyst` role.
- Doesn't touch the frozen models, features or the leakage test.
- The players page branch must be live first (same publish step, photos).

## Left to the builder

Component structure, exact copy (in the site's voice), the reveal's layout within DESIGN.md, and
the sample script's details.
