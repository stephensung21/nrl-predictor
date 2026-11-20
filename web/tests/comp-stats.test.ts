// Hot and Cold on the ladder (formFor): form over the last three finished rounds.

import { describe, expect, it } from "vitest";
import { formFor } from "../lib/comp-stats";
import type { LadderEntry } from "../lib/scoring";

function entry(id: string, perRound: number[], opts: { model?: boolean; partialLast?: boolean } = {}): LadderEntry {
  return {
    tipper: { id, name: id, ...(opts.model ? { isModel: true } : {}) },
    points: perRound.reduce((a, b) => a + b, 0),
    marginScore: 0,
    position: opts.model ? null : 1,
    tied: false,
    movement: null,
    rounds: perRound.map((correct, i) => ({
      round: i + 1, correct, games: 8, bonus: 0, autoTips: 0, marginScore: 0,
      partial: !!opts.partialLast && i === perRound.length - 1,
    })),
  };
}

const asObject = (m: Map<string, string>) => Object.fromEntries(m);

describe("formFor", () => {
  it("hot and cold from the last three finished rounds", () => {
    const form = formFor([entry("B", [8, 8, 4, 4, 4]), entry("C", [8, 8, 1, 1, 1]), entry("A", [0, 0, 8, 8, 8])]);
    expect(asObject(form)).toEqual({ A: "hot", C: "cold" });
  });

  it("no call-out before three finished rounds", () => {
    const form = formFor([
      entry("A", [8, 8, 8], { partialLast: true }),
      entry("B", [4, 4, 4], { partialLast: true }),
      entry("C", [1, 1, 1], { partialLast: true }),
    ]);
    expect(form.size).toBe(0);
  });

  it("a tie means no call-out", () => {
    const form = formFor([entry("A", [5, 5, 5]), entry("B", [5, 5, 5]), entry("C", [1, 1, 1])]);
    expect(asObject(form)).toEqual({ C: "cold" });
  });

  it("the Model is never hot or cold", () => {
    const form = formFor([
      entry("M", [8, 8, 8], { model: true }), entry("A", [6, 6, 6]), entry("B", [4, 4, 4]), entry("C", [2, 2, 2]),
    ]);
    expect(asObject(form)).toEqual({ A: "hot", C: "cold" });
  });

  it("fewer than three tippers: none", () => {
    expect(formFor([entry("A", [8, 8, 8]), entry("B", [1, 1, 1])]).size).toBe(0);
  });
});
