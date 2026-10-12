// "What drove this" on the match page (PLAN_WEB.md §7.1): a prediction's drivers (`record_drivers`,
// or the sample's from the same src/explain.py) as rows of points, each naming the side it favours.

import { SAMPLE_DRIVERS } from "./sample-drivers";
import type { TeamName } from "./teams";
import type { Drivers, StarOut } from "./types";

/** Plain names for src/explain.py's groups (its GROUP_LABELS, shortened to fit a row). */
const LABELS: Record<string, string> = {
  baseline: "Home side’s usual edge",
  market: "Bookies’ opening price",
  strength: "Team strength (Elo, team rating)",
  lineup: "Line-up strength",
  stars: "Star players out",
  form: "Recent form",
  context: "Rest, travel and venue",
  conditions: "Conditions",
  other: "Other",
};

/** Groups worth less than this (in points, either way) are left out of the list. */
const SMALL = 0.05;

export type DriverRow = {
  group: string; label: string; points: number; favours: TeamName | null;
  /** The missing stars behind "Star players out", by team, home side first. */
  players?: { team: TeamName; names: string[] }[];
};

export type DriverView = {
  /** The home side's average edge, where every prediction starts. */
  base: DriverRow | null;
  /** The rest, biggest first. */
  rows: DriverRow[];
  /** Whether any small group was left out. */
  trimmed: boolean;
  /** Everything added up: the predicted home margin. */
  total: number;
};

export function driverView(d: Drivers, home: TeamName, away: TeamName): DriverView {
  const row = (group: string, points: number, players?: StarOut[]): DriverRow => ({
    group, label: LABELS[group] ?? group, points,
    favours: Math.abs(points) < SMALL ? null : points > 0 ? home : away,
    ...(players?.length ? { players: byTeam(players, home, away) } : {}),
  });
  const base = d.groups.find((g) => g.group === "baseline");
  const rest = d.groups.filter((g) => g.group !== "baseline");
  return {
    base: base ? row(base.group, base.points) : null,
    // A group with players named stays even when small: stars out on both sides can cancel out.
    rows: rest.filter((g) => Math.abs(g.points) >= SMALL || g.players?.length)
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map((g) => row(g.group, g.points, g.players)),
    trimmed: rest.some((g) => Math.abs(g.points) < SMALL && !g.players?.length),
    total: d.groups.reduce((s, g) => s + g.points, 0),
  };
}

function byTeam(players: StarOut[], home: TeamName, away: TeamName) {
  return [home, away]
    .map((team) => ({ team, names: players.filter((p) => p.team === team).map((p) => p.name) }))
    .filter((t) => t.names.length);
}

/** A sample game's drivers (2026 replays), if it has them. */
export const sampleDrivers = (matchId: string): Drivers | null => SAMPLE_DRIVERS[matchId] ?? null;
