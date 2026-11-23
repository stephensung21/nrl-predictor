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

/**
 * A group's ladder: the same scores (the crowd auto-tip stays the whole comp's), kept to its members
 * and the Model and placed among themselves, as ladder() does in the database for a group.
 */
export function groupLadder(rounds: ScoredRound[], members: Set<string>): LadderEntry[] {
  const keep = (rows: LadderEntry[]) => place(rows.filter((e) => e.tipper.isModel || members.has(e.tipper.id)));
  const now = keep(ladder(rounds));
  if (rounds.length <= 1) return now;
  const before = keep(ladder(rounds.slice(0, -1)));
  return now.map((row) => {
    const was = before.find((b) => b.tipper.id === row.tipper.id);
    return { ...row, movement: row.position != null && was?.position != null ? was.position - row.position : null };
  });
}

/** Places among the tippers (not the Model): ahead on points, then the lower margin score; level ones share. */
function place(rows: LadderEntry[]): LadderEntry[] {
  const field = rows.filter((e) => !e.tipper.isModel);
  const ahead = (a: LadderEntry, b: LadderEntry) => a.points > b.points || (a.points === b.points && a.marginScore < b.marginScore);
  const level = (a: LadderEntry, b: LadderEntry) => a.points === b.points && a.marginScore === b.marginScore;
  return rows.map((e) =>
    e.tipper.isModel
      ? e
      : { ...e, position: 1 + field.filter((o) => ahead(o, e)).length, tied: field.some((o) => o !== e && level(o, e)) },
  );
}

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
export function statGames(rounds: ScoredRound[], members?: Set<string> | null): StatGame[] {
  const field = members ? tippers.filter((t) => t.isModel || members.has(t.id)) : tippers;
  return rounds.flatMap((r) =>
    r.games.map((g) => ({
      round: r.round,
      home: g.home,
      away: g.away,
      winners: winners(g),
      modelHomeProb: g.modelHomeProb,
      tips: Object.fromEntries(field.map((t) => [t.id, tipFor(r, g, t)])),
    })),
  );
}
