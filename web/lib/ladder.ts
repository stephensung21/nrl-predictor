// The tipping ladder under the official NRL Tipping rules (PLAN_WEB.md §3.5):
// 1 point per correct tip (a draw counts for both teams); untipped games filled
// at lockout by each tipper's auto-tip; 1 bonus point for tipping every winner in
// a completed round of 8 or more games with no auto-tips; and a margin score on
// each round's featured game that breaks ties on points (lowest wins).
// In production the database scores tips; this mirrors it for the sample.

import { gameStatus } from "./round";
import { BONUS_MIN_GAMES, DEFAULT_MARGIN } from "./rules";
import { margins as margins10, round10, SAMPLE_NOW, tips as tips10, tippers } from "./sample";
import { SEASON_ROUNDS } from "./sample-archive";
import type { LadderRow, SeasonRound, Tipper } from "./types";
import type { TeamName } from "./teams";

/** A round as scored: possibly only its finished games while it's in progress. */
export type ScoredRound = SeasonRound & { partial?: boolean };

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
const winners = (g: Game): TeamName[] =>
  g.homeScore === g.awayScore ? [g.home, g.away] : [g.homeScore > g.awayScore ? g.home : g.away];

/* ---------- Auto-tips ---------- */

/** NRL ladder from the games before a round: 2 points a win, 1 a draw, then points difference. */
function nrlLadderBefore(rounds: SeasonRound[], round: number) {
  const table = new Map<TeamName, { pts: number; diff: number }>();
  const row = (t: TeamName) => table.get(t) ?? (table.set(t, { pts: 0, diff: 0 }), table.get(t)!);
  for (const g of rounds.filter((r) => r.round < round).flatMap((r) => r.games)) {
    const [h, a] = [row(g.home), row(g.away)];
    h.diff += g.homeScore - g.awayScore;
    a.diff += g.awayScore - g.homeScore;
    if (g.homeScore === g.awayScore) (h.pts += 1), (a.pts += 1);
    else if (g.homeScore > g.awayScore) h.pts += 2;
    else a.pts += 2;
  }
  return (t: TeamName) => table.get(t) ?? { pts: 0, diff: 0 };
}

/** The tipper's tip for a game: their own, or their auto-tip filled at lockout. */
export function tipFor(r: SeasonRound, g: Game, tipper: Tipper): { team: TeamName; auto: boolean } {
  const own = r.tips.find((t) => t.tipperId === tipper.id && t.matchId === g.matchId);
  if (own) return { team: own.team, auto: false };
  let team: TeamName = g.home; // "home", and the fallback for every tie
  if (tipper.autoTip === "crowd") {
    const others = r.tips.filter((t) => t.matchId === g.matchId && t.tipperId !== tipper.id && !tippers.find((x) => x.id === t.tipperId)?.isModel);
    const [h, a] = [g.home, g.away].map((t) => others.filter((x) => x.team === t).length);
    if (a > h) team = g.away;
  } else if (tipper.autoTip === "ladder") {
    const nrl = nrlLadderBefore(SEASON_ROUNDS, r.round);
    const [h, a] = [nrl(g.home), nrl(g.away)];
    if (a.pts > h.pts || (a.pts === h.pts && a.diff > h.diff)) team = g.away;
  }
  return { team, auto: true };
}

/* ---------- Scoring ---------- */

export type RoundScore = {
  round: number;
  correct: number;
  games: number;
  bonus: number;
  autoTips: number;
  /** Gap between the predicted and real margin on the featured game (0 until it's played). */
  marginScore: number;
  partial: boolean;
};

export function scoreRound(r: ScoredRound, tipper: Tipper): RoundScore {
  const tips = r.games.map((g) => ({ g, ...tipFor(r, g, tipper) }));
  const correct = tips.filter((t) => winners(t.g).includes(t.team)).length;
  const autoTips = tips.filter((t) => t.auto).length;
  const featured = r.games.find((g) => g.matchId === r.featuredMatchId);
  let marginScore = 0;
  if (featured) {
    // Margins are signed from the home side, so tipping the wrong team counts against you:
    // Storm by 6 when the Broncos win by 4 is a margin score of 10. No margin entered: the default.
    const entered = r.margins.find((x) => x.tipperId === tipper.id);
    const team = entered?.team ?? tipFor(r, featured, tipper).team;
    const margin = entered?.margin ?? DEFAULT_MARGIN;
    const predicted = team === featured.home ? margin : -margin;
    marginScore = Math.abs(predicted - (featured.homeScore - featured.awayScore));
  }
  const complete = !r.partial;
  return {
    round: r.round,
    correct,
    games: r.games.length,
    bonus: complete && r.games.length >= BONUS_MIN_GAMES && correct === r.games.length && autoTips === 0 ? 1 : 0,
    autoTips,
    marginScore,
    partial: !complete,
  };
}

/* ---------- The ladder ---------- */

export type LadderEntry = {
  tipper: Tipper;
  points: number;
  marginScore: number;
  /** Place among the tippers. The Model is a yardstick, not a competitor: null. */
  position: number | null;
  tied: boolean;
  /** Places gained since the previous round (negative when dropped); null for the Model or round 1. */
  movement: number | null;
  rounds: RoundScore[];
};

function standings(rounds: ScoredRound[]): LadderEntry[] {
  const rows: LadderEntry[] = tippers.map((tipper) => {
    const scored = rounds.map((r) => scoreRound(r, tipper));
    return {
      tipper,
      rounds: scored,
      points: scored.reduce((n, r) => n + r.correct + r.bonus, 0),
      marginScore: scored.reduce((n, r) => n + r.marginScore, 0),
      position: null,
      tied: false,
      movement: null,
    };
  });
  // Everyone sorted together so the Model sits where its points put it; only tippers get places.
  rows.sort((a, b) => b.points - a.points || a.marginScore - b.marginScore || Number(!!b.tipper.isModel) - Number(!!a.tipper.isModel));
  const humans = rows.filter((r) => !r.tipper.isModel);
  humans.forEach((row, i) => {
    const same = (x?: LadderEntry) => !!x && x.points === row.points && x.marginScore === row.marginScore;
    row.position = same(humans[i - 1]) ? humans[i - 1].position : i + 1;
    row.tied = same(humans[i - 1]) || same(humans[i + 1]);
  });
  return rows;
}

/** The ladder over some rounds, with movement since the last completed round before them. */
export function ladder(rounds: ScoredRound[]): LadderEntry[] {
  const now = standings(rounds);
  if (rounds.length <= 1) return now;
  const before = standings(rounds.slice(0, -1));
  return now.map((row) => {
    const was = before.find((b) => b.tipper.id === row.tipper.id)!;
    return { ...row, movement: row.position != null && was.position != null ? was.position - row.position : null };
  });
}

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
