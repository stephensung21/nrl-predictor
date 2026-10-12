// The Model's record as a tipper this season, for /model: tips right per round against the bookies'
// opening favourite and Elo on the same games, and its best calls and worst misses. `buildRecord`
// works from graded games; the sample feeds it the same sample season as the ladder (seasonAt), so
// every page agrees, and the live site feeds it `graded_games` (lib/data.ts).

import { ladder, seasonAt, type SampleState } from "./ladder";
import { roundName } from "./round";
import { SEASON_GAMES } from "./sample-odds";
import type { LadderEntry } from "./scoring";
import type { TeamName } from "./teams";

const ref = new Map(SEASON_GAMES.map((g) => [g.matchId, g]));

export type ModelCall = {
  round: number;
  /** "Round 12", "Finals Week 1", "Grand Final". */
  roundName: string;
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

export type RoundRecord = {
  round: number;
  /** "R12", or a final's short name: "FW1" (Finals Week 1), "GF". */
  label: string;
  games: number;
  model: number;
  market: number;
  elo: number;
  results: boolean[];
};

/** A round's short name for a narrow column: "R12", "FW1", "GF". */
export function roundLabel(round: number, title?: string | null): string {
  if (!title || /^Round \d+$/.test(title)) return `R${round}`;
  if (title === "Grand Final") return "GF";
  const week = /^Finals Week (\d+)$/.exec(title);
  return week ? `FW${week[1]}` : `R${round}`;
}

/** A finished game with the Model's prediction of record and the yardsticks' home chances. */
export type GradedGame = {
  round: number;
  /** nrl.com's name for the round, when known ("Finals Week 1"). */
  roundTitle?: string | null;
  matchId: string;
  home: TeamName;
  away: TeamName;
  homeScore: number;
  awayScore: number;
  modelHomeProb: number;
  market: number | null;
  elo: number | null;
};

/** Its place among the comp's tippers on points. */
export type CompPlace = { points: number; ahead: number; level: number; behind: number; tippers: number };

export type SeasonRecord = {
  lastRound: number;
  games: number;
  model: number;
  market: number;
  elo: number;
  perRound: RoundRecord[];
  best: ModelCall[];
  worst: ModelCall[];
};

/** The record over graded games in kickoff order. Tips as the reports count them (pipeline/grade.py):
 * a chance of 50% or more tips the home team, and a draw is right for everyone. */
export function buildRecord(games: GradedGame[]): SeasonRecord {
  const calls: ModelCall[] = [];
  const byRound = new Map<number, RoundRecord>();
  for (const g of games) {
    const homeWon = g.homeScore > g.awayScore;
    const draw = g.homeScore === g.awayScore;
    const tipped = (p: number) => draw || p >= 0.5 === homeWon;
    const pickHome = g.modelHomeProb >= 0.5;
    const right = tipped(g.modelHomeProb);
    const r = byRound.get(g.round) ?? { round: g.round, label: roundLabel(g.round, g.roundTitle), games: 0, model: 0, market: 0, elo: 0, results: [] };
    byRound.set(g.round, r);
    r.games += 1;
    r.model += right ? 1 : 0;
    if (g.market != null) r.market += tipped(g.market) ? 1 : 0;
    if (g.elo != null) r.elo += tipped(g.elo) ? 1 : 0;
    r.results.push(right);
    calls.push({
      round: g.round,
      roundName: roundName(g.round, g.roundTitle ?? undefined),
      matchId: g.matchId,
      pick: pickHome ? g.home : g.away,
      opponent: pickHome ? g.away : g.home,
      chance: pickHome ? g.modelHomeProb : 1 - g.modelHomeProb,
      right,
      // An exact 50-50 price has no favourite, so it's never against the Model.
      againstMarket: g.market != null && g.market !== 0.5 && g.market > 0.5 !== pickHome,
      marketChance: g.market == null ? null : pickHome ? g.market : 1 - g.market,
      result: (() => {
        const [us, them] = pickHome ? [g.homeScore, g.awayScore] : [g.awayScore, g.homeScore];
        return `${us > them ? "won" : us < them ? "lost" : "drew"} ${us}–${them}`;
      })(),
    });
  }
  const perRound = [...byRound.values()].sort((a, b) => a.round - b.round);
  const total = (k: "model" | "market" | "elo") => perRound.reduce((n, r) => n + r[k], 0);
  return {
    lastRound: perRound.at(-1)?.round ?? 0,
    games: games.length,
    model: total("model"),
    market: total("market"),
    elo: total("elo"),
    perRound,
    // Best calls: right when the bookies' favourite was the other team, biggest disagreement first.
    best: calls
      .filter((c) => c.right && c.againstMarket)
      .sort((a, b) => b.chance - (b.marketChance ?? 0) - (a.chance - (a.marketChance ?? 0)))
      .slice(0, 3),
    // Worst misses: wrong when it was most sure.
    worst: calls.filter((c) => !c.right).sort((a, b) => b.chance - a.chance).slice(0, 3),
  };
}

/** Where the Model sits among the tippers on a ladder. */
export function compPlace(table: LadderEntry[]): CompPlace | null {
  const model = table.find((e) => e.tipper.isModel);
  if (!model) return null;
  const humans = table.filter((e) => !e.tipper.isModel);
  return {
    points: model.points,
    ahead: humans.filter((e) => e.points < model.points).length,
    level: humans.filter((e) => e.points === model.points).length,
    behind: humans.filter((e) => e.points > model.points).length,
    tippers: humans.length,
  };
}

/** The sample's record, from the same finished rounds as the sample ladder. */
export function modelRecord(state: SampleState = "open"): SeasonRecord & { comp: CompPlace } {
  const rounds = seasonAt(state).filter((r) => !r.partial);
  const games: GradedGame[] = rounds.flatMap((r) =>
    r.games.map((g) => ({
      round: r.round, matchId: g.matchId, home: g.home, away: g.away, homeScore: g.homeScore, awayScore: g.awayScore,
      modelHomeProb: g.modelHomeProb, market: ref.get(g.matchId)?.market ?? null, elo: ref.get(g.matchId)?.elo ?? null,
    })),
  );
  return { ...buildRecord(games), comp: compPlace(ladder(rounds))! };
}
