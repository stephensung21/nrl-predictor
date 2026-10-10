// Elo for the /elo page: everything is precomputed by web/scripts/build_elo_sample.py
// from the project's own engine (src/elo.py); this only reads and arranges it.

import { ELO_PARAMS, ELO_SEASONS, ELO_TEAMS } from "./sample-elo";
import type { TeamName } from "./teams";

export const SEASONS = ELO_SEASONS.map((s) => s.season);
export const LATEST = ELO_SEASONS.at(-1)!.season;
export const seasonOf = (n: number) => ELO_SEASONS.find((s) => s.season === n);
export const teamView = (t: TeamName) => ELO_TEAMS[t];
export const HOME_ADVANTAGE = ELO_PARAMS.hfa;

/** Win chance for a rating gap, before home advantage. */
export const chanceForGap = (gap: number) => 1 / (1 + 10 ** (-gap / 400));

export type EloRow = { team: TeamName; rank: number; rating: number; change: number | null; start: number; bye: boolean };

/** The sample's current round (its results aren't in yet). */
export const CURRENT_ROUND = 10;

/** The ratings table after a season's latest round, best first. */
export function table(season: number): EloRow[] {
  const s = seasonOf(season)!;
  return (Object.keys(s.ratings) as TeamName[])
    .map((t) => {
      const r = s.ratings[t];
      // A rating that didn't move at all means the team didn't play (a result always shifts it).
      const bye = r.length > 1 && r.at(-1) === r.at(-2);
      const change = r.length > 1 ? Math.round(r.at(-1)!) - Math.round(r.at(-2)!) : null;
      return { team: t, rating: r.at(-1)!, change, start: s.start[t], rank: 0, bye };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export { lineColours } from "./line-colours";
