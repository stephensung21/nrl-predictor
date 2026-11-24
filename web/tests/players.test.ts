// The players page's rankings and stat groups (lib/players.ts).

import { describe, expect, it } from "vitest";
import {
  MIN_GAMES, powerRankings, statGroups, STAT_KEYS, TOP_OVERALL, withFantasyRatings, type PlayerSeason,
} from "../lib/players";
import { SAMPLE_PLAYERS } from "../lib/sample-players";

const zero = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as PlayerSeason["stats"];
const p = (id: number, fantasyRating: number | null, position: PlayerSeason["position"], games = 10, stats = {}): PlayerSeason => ({
  season: 2026, id, name: `P${id}`, team: "Storm", position, games, image: null, fantasyRating, impact: null, attack: null, defence: null,
  stats: { ...zero, ...stats },
});

describe("powerRankings", () => {
  const field = [
    p(1, 42, "Halfback"), p(2, 51.5, "Prop"), p(3, 51.5, "Halfback"), p(4, 60, "Interchange"),
    p(5, 90, "Prop", MIN_GAMES - 1), p(6, null, "Prop"),
  ];

  it("ranks by fantasy rating, shares a rank on equal ratings, skips short seasons and unrated players", () => {
    const r = powerRankings(field, null);
    expect(r.map((x) => [x.player.id, x.rank, x.tied])).toEqual([[4, 1, false], [2, 2, true], [3, 2, true], [1, 4, false]]);
  });

  it("filters to a position; bench-only players are in no position list", () => {
    expect(powerRankings(field, "Halfback").map((x) => x.player.id)).toEqual([3, 1]);
    expect(powerRankings(field, "Prop").map((x) => x.player.id)).toEqual([2]);
  });

  it("caps the list", () => {
    expect(powerRankings(SAMPLE_PLAYERS.filter((x) => x.season === 2026), null)).toHaveLength(TOP_OVERALL);
  });
});

describe("withFantasyRatings", () => {
  it("fills missing ratings as pipeline/players.py does: shrunk 4 games towards the position's average", () => {
    const rows = withFantasyRatings([
      p(1, null, "Centre", 4, { fantasy_points: 400 }), p(2, null, "Centre", 1, { fantasy_points: 20 }),
      p(3, null, "Prop", 1, { fantasy_points: 50 }), p(4, 77, "Prop", 2, { fantasy_points: 10 }),
    ]);
    const centreAvg = 420 / 5;
    expect(rows[0].fantasyRating).toBeCloseTo((400 + 4 * centreAvg) / 8);
    expect(rows[1].fantasyRating).toBeCloseTo((20 + 4 * centreAvg) / 5);
    expect(rows[2].fantasyRating).toBeCloseTo((50 + 4 * 60 / 3) / 5); // the prop average counts every prop's games
    expect(rows[3].fantasyRating).toBe(77); // a published rating is kept
  });
});

describe("statGroups", () => {
  it("shows goals as made/attempted and no tackle rate without tackles", () => {
    const groups = statGroups(p(1, 40, "Halfback", 0, { conversions: 0, conversion_attempts: 0 }));
    const line = (label: string) => groups.flatMap((g) => g.lines).find((l) => l.label === label)!;
    expect(line("Conversions").value).toBe("0/0");
    expect(line("Tackle efficiency").value).toBe("–");
    expect(line("Points").perGame).toBe("0");
  });
});
