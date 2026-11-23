// The Dally M's tallies, ranks and ballots (lib/dally-m.ts).

import { describe, expect, it } from "vitest";
import {
  ballotOf, ballotProblem, ballotRows, lastClosed, openRound, rankTallies, tallyVotes,
  type DallyMRound, type RoundPlayer, type Tally,
} from "../lib/dally-m";

const t = (playerId: number, votes: number, threes: number, twos = 0): Tally => ({
  playerId, name: `P${playerId}`, team: "Storm", image: null, votes, threes, twos, ones: 0,
});

describe("rankTallies", () => {
  it("ranks by votes, then 3s, then 2s, and shares a rank only when level on all three", () => {
    const r = rankTallies([t(1, 9, 1), t(2, 9, 2), t(3, 9, 2), t(4, 12, 0), t(5, 9, 1, 1)]);
    expect(r.map((x) => [x.playerId, x.rank, x.tied])).toEqual([
      [4, 1, false], [2, 2, true], [3, 2, true], [5, 4, false], [1, 5, false],
    ]);
  });
});

describe("ballots", () => {
  it("allows a part-filled ballot but not the same player twice", () => {
    expect(ballotProblem({ 3: 7, 2: null, 1: null })).toBeNull();
    expect(ballotProblem({ 3: 7, 2: 8, 1: 7 })).toBe("Pick three different players.");
  });

  it("saves only the filled slots, and reads a tipper's ballot back from rows", () => {
    expect(ballotRows({ 3: 7, 2: null, 1: 9 })).toEqual([{ votes: 3, playerId: 7 }, { votes: 1, playerId: 9 }]);
    const rows = [
      { userId: "a", round: 2, votes: 3 as const, playerId: 7 }, { userId: "a", round: 2, votes: 1 as const, playerId: 9 },
      { userId: "b", round: 2, votes: 3 as const, playerId: 8 }, { userId: "a", round: 1, votes: 2 as const, playerId: 5 },
    ];
    expect(ballotOf(rows, "a", 2)).toEqual({ 3: 7, 2: null, 1: 9 });
  });
});

describe("tallyVotes", () => {
  it("adds up votes and counts 3s, 2s and 1s per player", () => {
    const players = new Map<number, RoundPlayer>([7, 8].map((id) => [id, { id, name: `P${id}`, team: "Eels", position: "Prop", image: null, matchId: "1" }]));
    const rows = [
      { userId: "a", round: 1, votes: 3 as const, playerId: 7 }, { userId: "b", round: 1, votes: 1 as const, playerId: 7 },
      { userId: "b", round: 1, votes: 2 as const, playerId: 8 },
    ];
    expect(tallyVotes(rows, players).find((x) => x.playerId === 7)).toMatchObject({ votes: 4, threes: 1, twos: 0, ones: 1 });
  });
});

describe("rounds", () => {
  const rounds: DallyMRound[] = [
    { round: 1, closes: "2026-03-08T00:00:00Z", isOpen: false, isClosed: true },
    { round: 2, closes: "2026-03-15T00:00:00Z", isOpen: false, isClosed: true },
    { round: 3, closes: "2026-03-22T00:00:00Z", isOpen: true, isClosed: false },
  ];
  it("finds the open round and the last closed one", () => {
    expect(openRound(rounds)?.round).toBe(3);
    expect(lastClosed(rounds)?.round).toBe(2);
    expect(openRound(rounds.slice(0, 2))).toBeUndefined();
  });
});

describe("the sample", async () => {
  const { SAMPLE_DALLY_M_RAW: raw, SAMPLE_DALLY_M_OPEN: open } = await import("../lib/sample-dally-m");
  const { SAMPLE_NOW } = await import("../lib/sample");

  it("votes only for players who played that round, three different ones per tipper", () => {
    for (const r of raw.rounds) {
      const played = new Set(r.players.map(([id]) => id));
      const votes = raw.votes.filter((v) => v.round === r.round);
      expect(votes.every((v) => played.has(v.playerId))).toBe(true);
      for (const who of new Set(votes.map((v) => v.userId))) {
        const mine = votes.filter((v) => v.userId === who);
        expect(new Set(mine.map((v) => v.playerId)).size).toBe(3);
        expect(mine.map((v) => v.votes).sort()).toEqual([1, 2, 3]);
      }
    }
  });

  it("has the open round still open at the sample's tips-open instant, and no votes in it", () => {
    const r = raw.rounds.find((x) => x.round === open)!;
    expect(Date.parse(r.closes)).toBeGreaterThan(Date.parse(SAMPLE_NOW.open));
    expect(raw.rounds.filter((x) => x.round < open).every((x) => Date.parse(x.closes) <= Date.parse(SAMPLE_NOW.open))).toBe(true);
    expect(raw.votes.some((v) => v.round === open)).toBe(false);
  });
});
