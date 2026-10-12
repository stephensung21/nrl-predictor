// The season scoreboard for /odds: how the no-odds Model, the bookies' opening
// favourite and Elo did across the 2026 test season. Real data, no sampling.

import { SEASON_BETS, SEASON_GAMES } from "./sample-odds";
import type { Edge, SeasonBet, SeasonGame } from "./types";

/** Fixed series colours for this page, validated all-pairs on the ground (dataviz validator). */
export const SERIES = {
  model: { label: "The Model", colour: "#3987e5" },
  market: { label: "Bookies’ favourite", colour: "#199e70" },
  elo: { label: "Elo", colour: "#d95926" },
} as const;

/** Games every forecaster priced and that weren't drawn. */
const decidedOf = (games: SeasonGame[]) => games.filter((g) => g.homeWin != null && g.homeWin !== 0.5 && g.market != null && g.elo != null);
/** A forecaster's tip is right when it favoured the winner; an exact 50-50 is no tip (as the reports count it). */
const right = (p: number, homeWin: number) => (p === 0.5 ? false : p > 0.5 ? homeWin === 1 : homeWin === 0);

export function tipsCorrect(games: SeasonGame[] = SEASON_GAMES) {
  const decided = decidedOf(games);
  const count = (k: "model" | "market" | "elo") => decided.filter((g) => right(g[k]!, g.homeWin!)).length;
  return { games: decided.length, model: count("model"), market: count("market"), elo: count("elo") };
}

/**
 * Running correct tips relative to the bookies' favourite, game by game: indexing both to
 * the market keeps one axis and shows the gap, which is the whole story (the totals are close).
 */
export function tipsVsMarket(games: SeasonGame[] = SEASON_GAMES) {
  const decided = decidedOf(games);
  let model = 0;
  let elo = 0;
  return decided.map((g, i) => {
    const m = right(g.market!, g.homeWin!) ? 1 : 0;
    model += (right(g.model, g.homeWin!) ? 1 : 0) - m;
    elo += (right(g.elo!, g.homeWin!) ? 1 : 0) - m;
    return { x: i + 1, round: g.round, model, elo };
  });
}

export type CalibrationBin = { lo: number; hi: number; n: number; predicted: number; actual: number };

/**
 * Calibration from the favourite's side: each game counts once, at the chance given to
 * whichever team was favoured. A well-calibrated forecaster's 70% favourites win about 70%.
 */
export function calibration(k: "model" | "market", games: SeasonGame[] = SEASON_GAMES): CalibrationBin[] {
  const decided = decidedOf(games);
  // 70%+ is one group: split finer, its top bin held only 8-13 games, too few to read.
  const edges = [0.5, 0.6, 0.7, 1.0001];
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const games = decided
      .map((g) => {
        const p = g[k]!;
        return p >= 0.5 ? { p, won: g.homeWin === 1 } : { p: 1 - p, won: g.homeWin === 0 };
      })
      .filter((x) => x.p >= lo && x.p < hi);
    const n = games.length;
    return {
      lo,
      hi: Math.min(hi, 1),
      n,
      predicted: n ? games.reduce((s, x) => s + x.p, 0) / n : 0,
      actual: n ? games.filter((x) => x.won).length / n : 0,
    };
  });
}

export const STAKE = 10;

/** Running profit of flat $10 bets on the Model's 2%+ edges at the opening price. */
export function profitCurve(bets: SeasonBet[] = SEASON_BETS) {
  let total = 0;
  const points = bets.map((b, i) => {
    total += b.profit * STAKE;
    return { x: i + 1, profit: Math.round(total * 100) / 100 };
  });
  return {
    points,
    bets: bets.length,
    won: bets.filter((b) => b.won).length,
    staked: bets.length * STAKE,
    profit: Math.round(total * 100) / 100,
  };
}

/**
 * A value underdog: paper trading backs the team the Model tips to lose, because the price pays more
 * than its chance (chance x price - 1 is at least 2%). The tip doesn't change: it's still the
 * Model's favourite. Out of sample, these bets were where most of the head-to-head profit came from
 * (about +20% ROI 2023-25, +26% in 2026, at the opening price; small samples).
 */
export function valueUnderdog(e: Edge) {
  if (!e.bet) return null;
  const tipHome = e.homeProb >= 0.5;
  if ((e.bet.side === "home") === tipHome) return null;
  return {
    tip: { team: tipHome ? e.home : e.away, prob: tipHome ? e.homeProb : 1 - e.homeProb },
    team: e.bet.team,
    prob: e.bet.side === "home" ? e.homeProb : 1 - e.homeProb,
    price: (e.bet.side === "home" ? e.homeOdds : e.awayOdds)!,
    fair: e.bet.side === "home" ? e.fairHome : e.fairAway,
    edge: e.bet.edge,
  };
}

/** The season's bets on a team the same Model rated under 50%: its value underdogs. */
export function underdogBets(bets: SeasonBet[] = SEASON_BETS, games: SeasonGame[] = SEASON_GAMES) {
  const homeProb = new Map(games.map((g) => [g.matchId, g.model]));
  return bets.filter((b) => {
    const p = homeProb.get(b.matchId);
    return p != null && (b.side === "home" ? p : 1 - p) < 0.5;
  });
}
