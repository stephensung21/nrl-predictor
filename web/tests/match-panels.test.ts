// The match page's "What drove this" panel and odds tab (lib/drivers.ts, lib/odds-history.ts).

import { describe, expect, it } from "vitest";
import { driverView, sampleDrivers } from "../lib/drivers";
import { oddsMove, sampleOddsHistory } from "../lib/odds-history";
import { SAMPLE_ROUNDS } from "../lib/match";
import { SAMPLE_DRIVERS } from "../lib/sample-drivers";
import type { OddsHistory } from "../lib/types";

describe("what drove the prediction", () => {
  const d = {
    variant: "with_odds" as const,
    groups: [
      { group: "baseline", points: 2.8 },
      { group: "market", points: -6.5 },
      { group: "lineup", points: 1.2 },
      { group: "conditions", points: 0.01 },
    ],
  };

  it("starts from the home side's edge, then lists the rest biggest first, naming the side each favours", () => {
    const v = driverView(d, "Broncos", "Storm");
    expect(v.base).toMatchObject({ label: "Home side’s usual edge", points: 2.8, favours: "Broncos" });
    expect(v.rows.map((r) => [r.group, r.favours])).toEqual([["market", "Storm"], ["lineup", "Broncos"]]);
    expect(v.trimmed).toBe(true); // conditions, under 0.1 points
    expect(v.total).toBeCloseTo(-2.49, 12);
  });

  it("names the star players out, home side first, even when both sides' cancel out", () => {
    const v = driverView({
      variant: "with_odds",
      groups: [{ group: "stars", points: 0.01, players: [
        { team: "Storm", name: "Harry Grant" }, { team: "Broncos", name: "Reece Walsh" }, { team: "Storm", name: "Eli Katoa" },
      ] }],
    }, "Broncos", "Storm");
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0]).toMatchObject({ label: "Star players out", favours: null });
    expect(v.rows[0].players).toEqual([
      { team: "Broncos", names: ["Reece Walsh"] }, { team: "Storm", names: ["Harry Grant", "Eli Katoa"] },
    ]);
    expect(v.trimmed).toBe(false);
  });

  it("adds up to every sample game's predicted margin", () => {
    const preds = SAMPLE_ROUNDS.flatMap((r) => r.data.predictions);
    expect(Object.keys(SAMPLE_DRIVERS).length).toBe(preds.length);
    for (const p of preds) {
      const v = driverView(sampleDrivers(p.matchId)!, "Broncos", "Storm");
      expect(v.total).toBeCloseTo(p.margin, 1); // both rounded; build_drivers_sample.py checks to 1e-6
    }
  });
});

describe("how the price moved", () => {
  const h = (probs: number[], lines: (number | null)[]): OddsHistory => ({
    bookmaker: "Betr", source: "live",
    points: probs.map((p, i) => ({ at: `2027-03-1${i}T08:00:00Z`, homeOdds: null, awayOdds: null, homeProb: p, line: lines[i] })),
  });

  it("tells it from the side the latest price favours, line included", () => {
    expect(oddsMove(h([0.62, 0.68], [-4.5, -6.5]), "Storm", "Broncos")).toEqual({
      team: "Storm", first: 62, last: 68, move: 6, firstLine: -4.5, lastLine: -6.5,
    });
    // The away side now favoured: its chances, and the handicap turned round.
    expect(oddsMove(h([0.52, 0.4], [-1.5, 3.5]), "Storm", "Broncos")).toEqual({
      team: "Broncos", first: 48, last: 60, move: 12, firstLine: 1.5, lastLine: -3.5,
    });
  });

  it("gives the sample games the odds sheet's opening and closing price", () => {
    const id = SAMPLE_ROUNDS[0].data.matches[0].id;
    const s = sampleOddsHistory(id)!;
    expect(s.source).toBe("sheet");
    expect(s.points[0].at).toBeNull();
    expect(s.points.length).toBeGreaterThanOrEqual(1);
    expect(sampleOddsHistory("nope")).toBeNull();
  });
});
