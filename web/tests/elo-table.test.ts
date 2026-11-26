// The Teams page's ratings table and hot and cold (lib/elo.ts): wins against Elo's expectation, points
// difference, movement over the last five, and when a season has enough rounds for hot and cold.

import { describe, expect, it } from "vitest";
import { formReady, hotAndCold, resultOf, seasonOf, tableOf } from "../lib/elo";
import type { EloFormGame, EloRecord, EloSeason } from "../lib/types";

const game = (change: number, scored = 20, conceded = 10): EloFormGame => ({ label: "Round 1", opponent: "Storm", scored, conceded, change });
const record = (r: Partial<EloRecord>): EloRecord => ({
  won: 0, lost: 0, drawn: 0, scored: 0, conceded: 0, expectedWins: 0, closeWon: 0, closeLost: 0, form: [], ...r,
});

/** A season of four teams after `rounds` rounds; ratings only matter for the order. */
function season(rounds: string[]): EloSeason {
  return {
    season: 2027, rounds, lastRound: rounds.at(-1)!,
    start: { Storm: 1500, Eels: 1500, Broncos: 1500, Panthers: 1500 },
    ratings: { Storm: [1560], Eels: [1540], Broncos: [1480], Panthers: [1520] },
    records: {
      Storm: record({ won: 4, lost: 1, scored: 120, conceded: 80, expectedWins: 3.25, form: [game(12), game(-4), game(8)] }),
      Eels: record({ won: 2, lost: 2, drawn: 1, scored: 90, conceded: 95, expectedWins: 3, form: [game(-10), game(-6)] }),
      Broncos: record({ won: 1, lost: 4, scored: 70, conceded: 130, expectedWins: 1.5, form: [game(0.3), game(-0.6)] }),
      Panthers: record({ won: 3, lost: 2, scored: 100, conceded: 90, expectedWins: 3, form: [game(5), game(2)] }),
    },
  };
}

describe("the ratings table", () => {
  it("adds each team's wins against Elo, points difference and movement over its last five", () => {
    const rows = tableOf(season(["R1", "R2", "R3", "R4", "R5"]));
    expect(rows.map((r) => r.team)).toEqual(["Storm", "Eels", "Panthers", "Broncos"]);
    const storm = rows[0];
    expect(storm.vsElo).toBeCloseTo(0.7, 10); // 4 wins against 3.3 expected (3.25, printed to one decimal)
    expect(storm.pointsDiff).toBe(40);
    expect(storm.formChange).toBe(16);
    // A draw counts half a win: 2.5 against the 3 Elo expected.
    expect(rows[1].vsElo).toBeCloseTo(-0.5, 10);
  });

  it("measures against expected wins as printed, to one decimal", () => {
    const s = season(["R1"]);
    s.records.Storm = record({ won: 3, expectedWins: 2.46 });
    const storm = tableOf(s)[0];
    expect(storm.expectedWins).toBe(2.5);
    expect(storm.vsElo).toBeCloseTo(0.5, 10); // 3 − 2.5, as the reader would work it out
  });

  it("gives a team missing from the records an empty season instead of failing", () => {
    const s = season(["R1"]);
    delete (s.records as Record<string, EloRecord>).Broncos;
    const broncos = tableOf(s).find((r) => r.team === "Broncos")!;
    expect(broncos).toMatchObject({ vsElo: 0, pointsDiff: 0, formChange: 0 });
  });
});

describe("hot and cold", () => {
  it("lists the biggest gains and the biggest losses, leaving out teams that barely moved", () => {
    const { hot, cold } = hotAndCold(tableOf(season(["R1", "R2", "R3", "R4", "R5"])));
    expect(hot.map((r) => [r.team, r.formChange])).toEqual([["Storm", 16], ["Panthers", 7]]);
    expect(cold.map((r) => [r.team, r.formChange])).toEqual([["Eels", -16]]); // Broncos moved −0.3: rounds to 0
  });

  it("keeps at most n of each", () => {
    const { hot } = hotAndCold(tableOf(season(["R1"])), 1);
    expect(hot.map((r) => r.team)).toEqual(["Storm"]);
  });

  it("waits for five regular-season rounds; finals don't count toward them", () => {
    expect(formReady(season(["R1", "R2", "R3", "R4"]))).toBe(false);
    expect(formReady(season(["R1", "R2", "R3", "R4", "F"]))).toBe(false);
    expect(formReady(season(["R1", "R2", "R3", "R4", "R5"]))).toBe(true);
  });

  it("reads a result from the team's side", () => {
    expect([resultOf(game(0, 20, 10)), resultOf(game(0, 10, 20)), resultOf(game(0, 18, 18))]).toEqual(["W", "L", "D"]);
  });
});

describe("the sample's records", () => {
  it("agree with its ratings: every team that has a rating has a season record", () => {
    const s = seasonOf(2025)!;
    expect(Object.keys(s.records).sort()).toEqual(Object.keys(s.ratings).sort());
    const panthers = s.records.Panthers;
    expect(panthers.won + panthers.lost + panthers.drawn).toBeGreaterThan(20);
    expect(panthers.form).toHaveLength(5);
    expect(panthers.form.every((g) => /^(Round \d+|Finals)$/.test(g.label))).toBe(true);
  });
});
