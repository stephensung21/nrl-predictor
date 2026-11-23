# Last man standing: design

A side comp for the same tippers: each round, pick one team to win. Never the same team twice in a
game. One wrong pick and you're out. Last one left wins that game, and a new game starts the next
round. Mostly for fun, like the Dally M.

## Decided by the user

- **Restart straight away.** When a game ends, a new one starts the next round, every team available
  again. Several games a season; a season tally of game wins.
- **A draw is a loss, and no pick is out** (confirmed 23 November 2026).
- **Everyone out together: nobody is.** If everyone still in goes out in the same round, the round
  doesn't count and they all stay in (23 November 2026; it replaced "they share the win").

## Rules (my calls, stated to the user)

- One pick per tipper per regular-season round: a team playing that round. It locks at that game's
  kickoff (the tips lockout). Finals don't count.
- A pick **survives** if its team wins, or its game is cancelled. A draw is a loss.
- **Out** on a loss, on no pick once the round is decided, or on picking a team already used in this
  game. An out tipper waits for the next game. Once a tipper has used every team, they start again.
- A round is graded once all its games are final or cancelled.
- After a graded round: one left → they win, game over. Nobody left (all out, or nobody picked) → the
  round doesn't count: everyone still in stays in, and its picks don't use up their teams.
- The regular season ends with a game still going: everyone still in shares it.
- Every tipper who isn't the Model is in every game from its first round. Someone who joins mid-game
  has no picks for its earlier rounds, so is out, and plays from the next game.

## Approaches

1. **Rules in the database** (a plpgsql function plays the season; a trigger refuses repeats and
   picks by out tippers). One source of truth, but the sample site has no database, so the rules
   would be written twice anyway, and the game state needs a loop over rounds in SQL.
2. **Rules in TypeScript, fairness in the database** (chosen). `web/lib/lms.ts` plays the season
   from the matches and picks, for the sample and live alike. The database only guards what can't be
   undone by grading: picks lock at kickoff, stay hidden until then, belong to their tipper, and name
   a team in that round's game. A pick that breaks a game rule (a repeat, a pick while out) is graded
   as out or ignored, so getting around the page gains nothing.
3. **Graded by the pipeline** into a games table. A third place for rules, and the page would lag the
   results job. Rejected.

## Data

- `lms_picks(user_id, season, round, match_id, team, updated_at)`, primary key
  `(user_id, season, round)`.
- Trigger: the match is in that season and round and not a final; the team plays in it; the Model
  can't pick.
- RLS mirrors tips: read your own; read everyone's once the picked game has kicked off; insert,
  update and delete your own only while `before_kickoff` holds for the old and new game.
- Grants revoked from anon and authenticated first; CRUD for authenticated.

## Page

`/last-man-standing`, in the More menu (the main menu is full: PLAN_WEB §3.1a).

- **This game:** game number, the round it started, who's still in and who's out (and how).
- **Your pick:** the open round's games as pairs of team buttons; teams used this game are disabled;
  "Save pick". Shown only while you're still in. Out: "You're out. A new game starts once this one
  ends."
- **Picks so far:** a grid of the current game's rounds by tipper: team badge, survived or out.
  Other tippers' picks for games not yet kicked off show as "picked" without the team.
- **Season tally:** game wins per tipper (shared wins count as a win each), and past games' winners.
- Tips page reminder while you're still in and haven't picked for the open round.
- Sample: 2026 Rounds 1–9 real results, picks made up by a fixed rule, Round 10 open; your pick saves
  in this browser.
