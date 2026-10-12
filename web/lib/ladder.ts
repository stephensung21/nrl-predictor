// The tipping ladder for the sample comp. The rules themselves are in ./scoring
// (shared with the database's scoring and checked against the same cases);
// this file binds them to the sample tippers and season.

import { gameStatus } from "./round";
import * as rules from "./scoring";
import { winners, type LadderEntry, type RoundScore, type ScoredRound } from "./scoring";
import { margins as margins10, round10, SAMPLE_NOW, tips as tips10, tippers } from "./sample";
import { SEASON_ROUNDS } from "./sample-archive";
import type { StatGame } from "./comp-stats";
import type { LadderRow, SeasonRound, Tipper } from "./types";

export type { LadderEntry, RoundScore, ScoredRound };

/** The sample comp: its tippers, and the finished rounds the ladder auto-tip reads. */
const comp: rules.Comp = { tippers, season: SEASON_ROUNDS };

/** Round 10 in the same shape as the generated rounds. */
const round10Season: SeasonRound = {
  round: round10.round,
  featuredMatchId: round10.featuredMatchId,
  games: [...round10.matches]
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => {
      const p = round10.predictions.find((x) => x.matchId === m.id)!;
      return {
        matchId: m.id, kickoff: m.kickoff, home: m.home, away: m.away,
        homeScore: m.homeScore!, awayScore: m.awayScore!, modelHomeProb: p.homeWinProb, modelMargin: p.margin,
      };
    }),
  tips: tips10,
  margins: margins10,
};

export type SampleState = "open" | "live" | "recap";

/**
 * The season as each sample state sees it, matching the home and tips pages:
 * Round 10 doesn't count while tipping is open, counts its finished games while
 * it's in progress, and counts in full once it's over.
 */
export function seasonAt(state: SampleState): ScoredRound[] {
  if (state === "open") return SEASON_ROUNDS;
  if (state === "recap") return [...SEASON_ROUNDS, round10Season];
  const now = new Date(SAMPLE_NOW.live);
  const finished = round10.matches.filter((m) => gameStatus(m, now) === "final").map((m) => m.id);
  return [...SEASON_ROUNDS, { ...round10Season, partial: true, games: round10Season.games.filter((g) => finished.includes(g.matchId)) }];
}

type Game = SeasonRound["games"][number];

export const tipFor = (r: SeasonRound, g: Game, tipper: Tipper) => rules.tipFor(comp, r, g, tipper);
export const scoreRound = (r: ScoredRound, tipper: Tipper) => rules.scoreRound(comp, r, tipper);
export const ladder = (rounds: ScoredRound[]) => rules.ladder(comp, rounds);
const standings = (rounds: ScoredRound[]) => rules.standings(comp, rounds);

/** The ladder going into a round, in the shape the round view expects. */
export function ladderBefore(round: number): LadderRow[] {
  return standings(seasonAt("recap").filter((r) => r.round < round)).map((r) => ({
    tipperId: r.tipper.id,
    points: r.points,
    marginScore: r.marginScore,
  }));
}

/* ---------- The ladder page's extras ---------- */

/** Every game in the sample rounds with each tipper's tip, for bragging rights (./comp-stats). */
export function statGames(rounds: ScoredRound[]): StatGame[] {
  return rounds.flatMap((r) =>
    r.games.map((g) => ({
      round: r.round,
      home: g.home,
      away: g.away,
      winners: winners(g),
      modelHomeProb: g.modelHomeProb,
      tips: Object.fromEntries(tippers.map((t) => [t.id, tipFor(r, g, t)])),
    })),
  );
}
