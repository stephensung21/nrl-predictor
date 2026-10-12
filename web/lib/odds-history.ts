// The match page's odds tab: how the bookies' head-to-head price moved before kickoff. Live, every Betr
// price the pipeline saw (lib/data.ts `oddsHistory`); in the sample, the odds sheet's opening and
// closing prices for the 2026 replays.

import { ODDS_ROUNDS } from "./sample-odds";
import type { TeamName } from "./teams";
import type { OddsHistory } from "./types";

/** A sample game's opening and closing price from the 2026 odds sheet (chances only, no prices). */
export function sampleOddsHistory(matchId: string): OddsHistory | null {
  const g = ODDS_ROUNDS.flatMap((r) => r.games).find((x) => x.matchId === matchId);
  if (!g || g.openHomeProb == null) return null;
  const points: OddsHistory["points"] = [{ at: null, homeOdds: null, awayOdds: null, homeProb: g.openHomeProb, line: g.openLine }];
  if (g.closeHomeProb != null) points.push({ at: null, homeOdds: null, awayOdds: null, homeProb: g.closeHomeProb, line: g.closeLine });
  return { bookmaker: g.bookmaker ?? "The bookies", source: "sheet", points };
}

export type OddsMove = {
  /** The side favoured by the latest price; its chances below. */
  team: TeamName;
  first: number;
  last: number;
  /** Percentage points towards `team` (negative: away from it). */
  move: number;
  /** The handicap on `team` (negative = favoured). */
  firstLine: number | null;
  lastLine: number | null;
};

/** The first and latest price, from the side the latest price favours. */
export function oddsMove(h: OddsHistory, home: TeamName, away: TeamName): OddsMove {
  const first = h.points[0];
  const last = h.points.at(-1)!;
  const forHome = last.homeProb >= 0.5;
  const pct = (p: number) => Math.round((forHome ? p : 1 - p) * 100);
  return {
    team: forHome ? home : away,
    first: pct(first.homeProb),
    last: pct(last.homeProb),
    move: pct(last.homeProb) - pct(first.homeProb),
    firstLine: first.line == null ? null : forHome ? first.line : -first.line,
    lastLine: last.line == null ? null : forHome ? last.line : -last.line,
  };
}
