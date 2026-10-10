// The Model's record as a tipper this season, for /model. Built from the same
// sample season as the ladder (seasonAt), so every page agrees, with the bookies'
// opening favourite and Elo on the same games from the odds sample.

import { ladder, seasonAt, type SampleState } from "./ladder";
import { SEASON_GAMES } from "./sample-odds";
import type { TeamName } from "./teams";

const ref = new Map(SEASON_GAMES.map((g) => [g.matchId, g]));

export type ModelCall = {
  round: number;
  matchId: string;
  pick: TeamName;
  opponent: TeamName;
  chance: number;
  right: boolean;
  /** The bookies' opening favourite was the other team. */
  againstMarket: boolean;
  /** The bookies' opening chance for the Model's pick, when there was a price. */
  marketChance: number | null;
  /** From the pick's side: "won 22–14", "lost 14–32". */
  result: string;
};

export type RoundRecord = { round: number; games: number; model: number; market: number; elo: number; results: boolean[] };

export function modelRecord(state: SampleState = "open") {
  const rounds = seasonAt(state).filter((r) => !r.partial);
  const calls: ModelCall[] = [];
  const perRound: RoundRecord[] = rounds.map((r) => {
    let model = 0;
    let market = 0;
    let elo = 0;
    const results = r.games.map((g) => {
      const homeWon = g.homeScore > g.awayScore;
      const draw = g.homeScore === g.awayScore;
      const pickHome = g.modelHomeProb >= 0.5;
      const right = draw || pickHome === homeWon;
      model += right ? 1 : 0;
      const x = ref.get(g.matchId);
      // An exact 50-50 is no favourite, so not a right tip (as the reports count it).
      const tipped = (p: number) => draw || (p !== 0.5 && p > 0.5 === homeWon);
      if (x?.market != null) market += tipped(x.market) ? 1 : 0;
      if (x?.elo != null) elo += tipped(x.elo) ? 1 : 0;
      calls.push({
        round: r.round,
        matchId: g.matchId,
        pick: pickHome ? g.home : g.away,
        opponent: pickHome ? g.away : g.home,
        chance: pickHome ? g.modelHomeProb : 1 - g.modelHomeProb,
        right,
        againstMarket: x?.market != null && x.market !== 0.5 && x.market > 0.5 !== pickHome,
        marketChance: x?.market == null ? null : pickHome ? x.market : 1 - x.market,
        result: (() => {
          const [us, them] = pickHome ? [g.homeScore, g.awayScore] : [g.awayScore, g.homeScore];
          return `${us > them ? "won" : us < them ? "lost" : "drew"} ${us}–${them}`;
        })(),
      });
      return right;
    });
    return { round: r.round, games: r.games.length, model, market, elo, results };
  });

  const total = (k: "model" | "market" | "elo") => perRound.reduce((n, r) => n + r[k], 0);
  const games = perRound.reduce((n, r) => n + r.games, 0);

  // Its place among the tippers: how many it's ahead of, level with and behind on points.
  const table = ladder(rounds);
  const model = table.find((e) => e.tipper.isModel)!;
  const humans = table.filter((e) => !e.tipper.isModel);

  return {
    lastRound: rounds.at(-1)?.round ?? 0,
    games,
    model: total("model"),
    market: total("market"),
    elo: total("elo"),
    perRound,
    comp: {
      points: model.points,
      ahead: humans.filter((e) => e.points < model.points).length,
      level: humans.filter((e) => e.points === model.points).length,
      behind: humans.filter((e) => e.points > model.points).length,
      tippers: humans.length,
    },
    // Best calls: right when the bookies' favourite was the other team, biggest disagreement first.
    best: calls
      .filter((c) => c.right && c.againstMarket)
      .sort((a, b) => b.chance - (b.marketChance ?? 0) - (a.chance - (a.marketChance ?? 0)))
      .slice(0, 3),
    // Worst misses: wrong when it was most sure.
    worst: calls.filter((c) => !c.right).sort((a, b) => b.chance - a.chance).slice(0, 3),
  };
}
