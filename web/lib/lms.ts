// Last man standing's rules (docs/superpowers/specs/2026-11-21-last-man-standing-design.md). Each
// regular-season round, every tipper still in picks one team to win, never one they've already used
// in this game. A loss, a draw, a missed pick or a repeat puts them out. The last one left wins;
// if everyone still in goes out together, they share it; then a new game starts the next round with
// everyone back. The database only guards the picks (lockout, hiding, ownership): the rules are all
// here, played from the season's results and picks, for the sample and the live site alike.

import type { TeamName } from "./teams";

/** A regular-season game. `result` is set once it's decided. */
export type LmsMatch = {
  id: string;
  round: number;
  kickoff: string;
  home: TeamName;
  away: TeamName;
  result?: "home" | "away" | "draw" | "cancelled";
};

export type LmsPick = { userId: string; round: number; matchId: string; team: TeamName };

/**
 * survived: the team won, or its game was cancelled. out: a loss or a draw. repeat: a team already
 * used this game (out). missed: no pick once the round was decided (out). pending: the game is
 * still to be decided. waiting: no pick seen yet, and the round isn't decided.
 */
export type Outcome = "survived" | "out" | "repeat" | "missed" | "pending" | "waiting";
export const OUT: Outcome[] = ["out", "repeat", "missed"];

export type LmsEntry = { userId: string; outcome: Outcome; team?: TeamName; matchId?: string };

export type LmsRound = {
  round: number;
  /** Every game of the round is decided. */
  graded: boolean;
  /** Nobody still in made a pick, so the round didn't count. */
  void: boolean;
  /** One entry per tipper still in at the start of the round. */
  entries: LmsEntry[];
};

export type LmsGame = {
  number: number;
  startRound: number;
  /** The round it was decided in; null while it's going. */
  endRound: number | null;
  rounds: LmsRound[];
  /** Still in: the whole field until the game's first round is decided. */
  alive: string[];
  winners: string[];
};

export type LmsSeason = { tippers: string[]; games: LmsGame[]; tally: { userId: string; wins: number }[] };

function outcome(m: LmsMatch | undefined, team: TeamName): Outcome {
  if (!m?.result) return "pending";
  if (m.result === "cancelled") return "survived";
  if (m.result === "draw") return "out";
  return (m.result === "home" ? m.home : m.away) === team ? "survived" : "out";
}

/**
 * Plays a season's games from its regular-season matches and the picks the viewer can see.
 * `seasonOver`: the regular season is finished (its finals have been drawn), so a game still going
 * after its last round is shared by everyone still in.
 */
export function playSeason(tippers: string[], matches: LmsMatch[], picks: LmsPick[], seasonOver: boolean): LmsSeason {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const pickOf = new Map(picks.map((p) => [`${p.userId}:${p.round}`, p]));
  const games: LmsGame[] = [];
  let game: LmsGame | null = null;
  let used = new Map<string, Set<TeamName>>();

  for (const r of rounds) {
    if (!game) {
      game = { number: games.length + 1, startRound: r, endRound: null, rounds: [], alive: [...tippers], winners: [] };
      games.push(game);
      used = new Map(tippers.map((t) => [t, new Set<TeamName>()]));
    }
    const graded = matches.filter((m) => m.round === r).every((m) => m.result);
    const entries: LmsEntry[] = game.alive.map((userId) => {
      const p = pickOf.get(`${userId}:${r}`);
      if (!p) return { userId, outcome: graded ? "missed" : "waiting" };
      const o = used.get(userId)!.has(p.team) ? "repeat" : outcome(byId.get(p.matchId), p.team);
      return { userId, outcome: o, team: p.team, matchId: p.matchId };
    });
    const valid = entries.filter((e) => e.outcome === "survived" || e.outcome === "out");
    const round: LmsRound = { round: r, graded, void: graded && valid.length === 0, entries };
    game.rounds.push(round);
    if (!graded) break;
    if (round.void) continue;
    for (const e of valid) used.get(e.userId)!.add(e.team!);
    const survivors = valid.filter((e) => e.outcome === "survived").map((e) => e.userId);
    if (survivors.length > 1) {
      game.alive = survivors;
      continue;
    }
    game.winners = survivors.length === 1 ? survivors : valid.map((e) => e.userId);
    game.alive = game.winners;
    game.endRound = r;
    game = null;
  }

  const last = games.at(-1);
  if (seasonOver && last && last.endRound == null && last.rounds.every((r) => r.graded)) {
    last.winners = last.alive;
    last.endRound = last.rounds.at(-1)!.round;
  }
  const tally = tippers.map((userId) => ({ userId, wins: games.filter((g) => g.winners.includes(userId)).length }));
  return { tippers, games, tally };
}

/** The game still going (or the last one), its round still to be decided, and the teams the viewer has used in it. */
export type Turn = { round: number; game: number; alive: boolean; used: TeamName[]; pick?: LmsPick };

export function yourTurn(season: LmsSeason, you: string): Turn | null {
  const game = season.games.at(-1);
  const open = game?.rounds.at(-1);
  if (!game || !open || open.graded) return null;
  const mine = open.entries.find((e) => e.userId === you);
  const used = game.rounds
    .filter((r) => r !== open && !r.void)
    .flatMap((r) => r.entries.filter((e) => e.userId === you && e.team && e.outcome !== "repeat").map((e) => e.team!));
  const pick = mine?.team ? { userId: you, round: open.round, matchId: mine.matchId!, team: mine.team } : undefined;
  return { round: open.round, game: game.number, alive: !!mine, used, ...(pick ? { pick } : {}) };
}
