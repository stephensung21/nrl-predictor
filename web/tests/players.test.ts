// The players page's rankings and stat groups (lib/players.ts).

import { describe, expect, it } from "vitest";
import { MIN_GAMES, powerRankings, statGroups, STAT_KEYS, TOP_OVERALL, type PlayerSeason } from "../lib/players";
import { SAMPLE_PLAYERS } from "../lib/sample-players";

const zero = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as PlayerSeason["stats"];
const p = (id: number, rating: number | null, position: PlayerSeason["position"], games = 10, stats = {}): PlayerSeason => ({
  season: 2026, id, name: `P${id}`, team: "Storm", position, games, rating, attack: null, defence: null,
  stats: { ...zero, ...stats },
});

describe("powerRankings", () => {
  const field = [
    p(1, 0.2, "Halfback"), p(2, 0.3, "Prop"), p(3, 0.3, "Halfback"), p(4, 0.5, "Interchange"),
    p(5, 0.9, "Prop", MIN_GAMES - 1), p(6, null, "Prop"),
  ];

  it("ranks by rating, shares a rank on equal ratings, skips short seasons and unrated players", () => {
    const r = powerRankings(field, null);
    expect(r.map((x) => [x.player.id, x.rank, x.tied])).toEqual([[4, 1, false], [2, 2, true], [3, 2, true], [1, 4, false]]);
  });

  it("filters to a position; bench-only players are in no position list", () => {
    expect(powerRankings(field, "Halfback").map((x) => x.player.id)).toEqual([3, 1]);
    expect(powerRankings(field, "Prop").map((x) => x.player.id)).toEqual([2]);
  });

  it("gives fantasy points per game and caps the list", () => {
    expect(powerRankings([p(1, 0.1, "Lock", 8, { fantasy_points: 400 })], null)[0].fantasyPerGame).toBe(50);
    expect(powerRankings(SAMPLE_PLAYERS.filter((x) => x.season === 2026), null)).toHaveLength(TOP_OVERALL);
  });
});

describe("statGroups", () => {
  it("shows goals as made/attempted and no tackle rate without tackles", () => {
    const groups = statGroups(p(1, 0.1, "Halfback", 0, { conversions: 0, conversion_attempts: 0 }));
    const line = (label: string) => groups.flatMap((g) => g.lines).find((l) => l.label === label)!;
    expect(line("Conversions").value).toBe("0/0");
    expect(line("Tackle efficiency").value).toBe("–");
    expect(line("Points").perGame).toBe("0");
  });
});
