// The tipping ladder for the sample comp. The rules themselves are in ./scoring
// (shared with the database's scoring and checked against the same cases);
// this file binds them to the sample tippers and season.

import { gameStatus } from "./round";
import * as rules from "./scoring";
import { winners, type LadderEntry, type RoundScore, type ScoredRound } from "./scoring";
import { margins as margins10, round10, SAMPLE_NOW, tips as tips10, tippers } from "./sample";
import { SEASON_ROUNDS } from "./sample-archive";
import type { LadderRow, SeasonRound, Tipper } from "./types";
import type { TeamName } from "./teams";

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

/* ---------- Season stats ---------- */

export type SeasonStats = {
  perfectRounds: { tipper: Tipper; rounds: number[] }[];
  longestStreak: { tipper: Tipper; length: number; endedRound: number | null }[];
  biggestUpset?: { tipper: Tipper; team: TeamName; opponent: TeamName; round: number; modelChance: number };
};

/** Bragging rights among the tippers (the Model is left out: it tips the favourite). */
export function seasonStats(rounds: ScoredRound[]): SeasonStats {
  const humans = tippers.filter((t) => !t.isModel);

  const perfectRounds = humans
    .map((tipper) => ({
      tipper,
      rounds: rounds
        .filter((r) => !r.partial)
        .filter((r) => {
          const s = scoreRound(r, tipper);
          return s.correct === s.games && s.autoTips === 0;
        })
        .map((r) => r.round),
    }))
    .filter((x) => x.rounds.length > 0);

  const longestStreak = humans
    .map((tipper) => {
      let run = 0;
      let best = { length: 0, endedRound: null as number | null };
      for (const r of rounds) {
        for (const g of r.games) {
          if (winners(g).includes(tipFor(r, g, tipper).team)) {
            run += 1;
            if (run > best.length) best = { length: run, endedRound: null };
          } else {
            if (run > 0 && run === best.length && best.endedRound === null) best.endedRound = r.round;
            run = 0;
          }
        }
      }
      return { tipper, ...best };
    })
    .sort((a, b) => b.length - a.length);

  let biggestUpset: SeasonStats["biggestUpset"];
  for (const r of rounds) {
    for (const g of r.games) {
      if (winners(g).length > 1) continue;
      for (const tipper of humans) {
        const tip = tipFor(r, g, tipper);
        if (tip.auto || !winners(g).includes(tip.team)) continue;
        const chance = tip.team === g.home ? g.modelHomeProb : 1 - g.modelHomeProb;
        if (!biggestUpset || chance < biggestUpset.modelChance) {
          biggestUpset = { tipper, team: tip.team, opponent: tip.team === g.home ? g.away : g.home, round: r.round, modelChance: chance };
        }
      }
    }
  }
  return { perfectRounds, longestStreak, biggestUpset };
}

/* ---------- Trash-talk tags (the ladder is one of the four places banter is allowed) ---------- */

/**
 * At most one tag each, from the results. Each tipper takes their most specific
 * tag that nobody higher up already has, so the same line doesn't repeat down the table.
 */
export function tagsFor(entries: LadderEntry[]): Map<string, string> {
  const humans = entries.filter((e) => !e.tipper.isModel);
  const model = entries.find((e) => e.tipper.isModel)!;
  const last = humans.at(-1)!;
  const secondLast = humans.at(-2);
  const latest = humans[0]?.rounds.at(-1);
  const roundBest = (e: LadderEntry) => {
    const s = e.rounds.at(-1);
    return s ? s.correct + s.bonus : 0;
  };
  const best = Math.max(...humans.map(roundBest));
  const soleWinner = latest && !latest.partial && humans.filter((e) => roundBest(e) === best).length === 1;

  const candidates = (e: LadderEntry): string[] => {
    const tags: string[] = [];
    if (e === last) tags.push("Wooden spoon");
    if (e.position === 1 && !humans.some((x) => x !== e && x.position === 1)) tags.push("Top dog");
    if (soleWinner && roundBest(e) === best) tags.push(`Won round ${latest!.round}`);
    if (e === secondLast && e.points - last.points <= 3) tags.push("Wooden spoon watch");
    if ((e.movement ?? 0) >= 2) tags.push("Climbing");
    if ((e.movement ?? 0) <= -2) tags.push("Sliding");
    if (e.points > model.points) tags.push("Clear of the Model");
    if (e.points < model.points) tags.push("Behind a spreadsheet");
    return tags;
  };

  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const e of humans) {
    const tag = candidates(e).find((t) => !used.has(t));
    if (tag) {
      used.add(tag);
      out.set(e.tipper.id, tag);
    }
  }
  return out;
}
