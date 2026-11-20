// The community Dally M (/dally-m; docs/superpowers/specs/2026-11-21-dally-m-design.md): each round's
// players, a tipper's 3-2-1 ballot, and the tallies and ranks the page shows. The database keeps the
// votes hidden until a round closes; these helpers only shape what it has already let through.

import type { TeamName } from "./teams";

export const VOTE_SLOTS = [3, 2, 1] as const;
export type VoteSlot = (typeof VOTE_SLOTS)[number];

/** A player who took the field in a round: the candidates for that round's votes. */
export type RoundPlayer = { id: number; name: string; team: TeamName; position: string; image: string | null; matchId: string };

/** A tipper's votes for one round: a player id per slot, or null while unpicked. */
export type Ballot = Record<VoteSlot, number | null>;
export const EMPTY_BALLOT: Ballot = { 3: null, 2: null, 1: null };

export type VoteRow = { userId: string; round: number; votes: VoteSlot; playerId: number };

export type Tally = {
  playerId: number;
  name: string;
  team: TeamName;
  image: string | null;
  votes: number;
  threes: number;
  twos: number;
  ones: number;
};
export type RankedTally = Tally & { rank: number; tied: boolean };

/** A round that has opened for votes, with when it closes (ISO). */
export type DallyMRound = { round: number; closes: string; isOpen: boolean; isClosed: boolean };

const order = (a: Tally, b: Tally) => b.votes - a.votes || b.threes - a.threes || b.twos - a.twos;

/** Most votes first, then most 3s, then most 2s; level on all three share a rank. */
export function rankTallies(tallies: Tally[]): RankedTally[] {
  const sorted = [...tallies].sort((a, b) => order(a, b) || a.name.localeCompare(b.name));
  return sorted.map((t) => {
    const level = sorted.filter((u) => order(t, u) === 0);
    return { ...t, rank: sorted.findIndex((u) => order(t, u) === 0) + 1, tied: level.length > 1 };
  });
}

/** Why a ballot can't be saved, or null. A part-filled ballot is fine. */
export function ballotProblem(b: Ballot): string | null {
  const picked = VOTE_SLOTS.map((s) => b[s]).filter((p) => p != null);
  return new Set(picked).size < picked.length ? "Pick three different players." : null;
}

/** The ballot's filled slots, as rows to save. */
export function ballotRows(b: Ballot): { votes: VoteSlot; playerId: number }[] {
  return VOTE_SLOTS.filter((s) => b[s] != null).map((s) => ({ votes: s, playerId: b[s]! }));
}

/** A tipper's ballot for a round, from their vote rows. */
export function ballotOf(rows: VoteRow[], userId: string, round: number): Ballot {
  const b: Ballot = { ...EMPTY_BALLOT };
  for (const r of rows) if (r.userId === userId && r.round === round) b[r.votes] = r.playerId;
  return b;
}

/** Each player's votes over the given rows (the sample adds up its own; the database has views). */
export function tallyVotes(rows: VoteRow[], players: Map<number, RoundPlayer>): Tally[] {
  const out = new Map<number, Tally>();
  for (const r of rows) {
    const p = players.get(r.playerId);
    if (!p) continue;
    const t = out.get(r.playerId) ?? { playerId: p.id, name: p.name, team: p.team, image: p.image, votes: 0, threes: 0, twos: 0, ones: 0 };
    t.votes += r.votes;
    if (r.votes === 3) t.threes += 1;
    else if (r.votes === 2) t.twos += 1;
    else t.ones += 1;
    out.set(r.playerId, t);
  }
  return [...out.values()];
}

/** The round open for votes, if any (at most one is: a round closes as the next one starts). */
export const openRound = (rounds: DallyMRound[]) => rounds.find((r) => r.isOpen);

/** The most recently closed round. */
export const lastClosed = (rounds: DallyMRound[]) => rounds.filter((r) => r.isClosed).at(-1);
