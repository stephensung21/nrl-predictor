// The official NRL Tipping rules as pure functions over a comp (PLAN_WEB.md §3.5):
// 1 point per correct tip (a draw counts for both teams); untipped games filled
// at lockout by each tipper's auto-tip; 1 bonus point for tipping every winner in
// a completed round of 8 or more games with no auto-tips; games that kicked off before a tipper
// joined count as away-team tips, worth at most 4 points a round; and a margin score on
// each round's featured game that breaks ties on points (lowest wins).
//
// The database scores the live comp with the same rules (supabase/migrations,
// the `effective_tips`, `round_scores` and `ladder` objects). Both are checked
// against the shared cases in tests/tipping/cases.json, so change them together.

import { BONUS_MIN_GAMES, DEFAULT_MARGIN, LATE_JOIN_MAX_POINTS } from "./rules";
import type { SeasonRound, Tipper } from "./types";
import type { TeamName } from "./teams";

/** A round as scored: possibly only its finished games while it's in progress. */
export type ScoredRound = SeasonRound & { partial?: boolean };

/** Who is in the comp, and the season's finished games (for the ladder auto-tip). */
export type Comp = { tippers: Tipper[]; season: SeasonRound[] };

type Game = SeasonRound["games"][number];
export const winners = (g: Game): TeamName[] =>
  g.homeScore === g.awayScore ? [g.home, g.away] : [g.homeScore > g.awayScore ? g.home : g.away];

/* ---------- Auto-tips ---------- */

type NrlRow = { pts: number; diff: number };

/**
 * NRL ladder from the games before a round: 2 points a win or a bye, 1 a draw, then points difference.
 * A bye is an earlier round with no game for the team. As the database's nrl_ladder_before, except
 * that `rounds` holds decided games only, so a postponed or cancelled earlier game counts as a bye here.
 */
export function nrlLadderBefore(rounds: SeasonRound[], round: number) {
  const table = new Map<TeamName, NrlRow>();
  const earlier = rounds.filter((r) => r.round < round);
  const played = (t: TeamName) => earlier.filter((r) => r.games.some((g) => g.home === t || g.away === t)).length;
  const row = (t: TeamName) => table.get(t) ?? (table.set(t, { pts: 2 * (earlier.length - played(t)), diff: 0 }), table.get(t)!);
  for (const g of earlier.flatMap((r) => r.games)) {
    const [h, a] = [row(g.home), row(g.away)];
    h.diff += g.homeScore - g.awayScore;
    a.diff += g.awayScore - g.homeScore;
    if (g.homeScore === g.awayScore) {
      h.pts += 1;
      a.pts += 1;
    } else if (g.homeScore > g.awayScore) h.pts += 2;
    else a.pts += 2;
  }
  return (t: TeamName): NrlRow => row(t);
}

/** The team higher on the NRL ladder: points, then points difference; level goes to the home team. */
export function higherOnLadder(nrl: (t: TeamName) => NrlRow, home: TeamName, away: TeamName): TeamName {
  const [h, a] = [nrl(home), nrl(away)];
  return a.pts > h.pts || (a.pts === h.pts && a.diff > h.diff) ? away : home;
}

/** A game that kicked off before the tipper joined (never the Model's). */
export const joinedAfter = (tipper: Tipper, kickoff: string) =>
  !tipper.isModel && !!tipper.joinedAt && Date.parse(kickoff) < Date.parse(tipper.joinedAt);

/** The tipper's tip for a game: their own; the away team if it kicked off before they joined; or their auto-tip filled at lockout. */
export function tipFor(comp: Comp, r: SeasonRound, g: Game, tipper: Tipper): { team: TeamName; auto: boolean; late?: boolean } {
  const own = r.tips.find((t) => t.tipperId === tipper.id && t.matchId === g.matchId);
  if (own) return { team: own.team, auto: false };
  if (joinedAfter(tipper, g.kickoff)) return { team: g.away, auto: true, late: true };
  let team: TeamName = g.home; // "home", and the fallback for every tie
  if (tipper.autoTip === "crowd") {
    const others = r.tips.filter((t) => t.matchId === g.matchId && t.tipperId !== tipper.id && !comp.tippers.find((x) => x.id === t.tipperId)?.isModel);
    const [h, a] = [g.home, g.away].map((t) => others.filter((x) => x.team === t).length);
    if (a > h) team = g.away;
  } else if (tipper.autoTip === "ladder") {
    team = higherOnLadder(nrlLadderBefore(comp.season, r.round), g.home, g.away);
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

export function scoreRound(comp: Comp, r: ScoredRound, tipper: Tipper): RoundScore {
  const tips = r.games.map((g) => ({ g, ...tipFor(comp, r, g, tipper) }));
  const right = tips.filter((t) => winners(t.g).includes(t.team));
  const correct = right.filter((t) => !t.late).length + Math.min(LATE_JOIN_MAX_POINTS, right.filter((t) => t.late).length);
  const autoTips = tips.filter((t) => t.auto).length;
  const featured = r.games.find((g) => g.matchId === r.featuredMatchId);
  let marginScore = 0;
  if (featured) {
    // Margins are signed from the home side, so tipping the wrong team counts against you:
    // Storm by 6 when the Broncos win by 4 is a margin score of 10. No margin entered: the default.
    const entered = r.margins.find((x) => x.tipperId === tipper.id);
    const team = entered?.team ?? tipFor(comp, r, featured, tipper).team;
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

export function standings(comp: Comp, rounds: ScoredRound[]): LadderEntry[] {
  const rows: LadderEntry[] = comp.tippers.map((tipper) => {
    const scored = rounds.map((r) => scoreRound(comp, r, tipper));
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
export function ladder(comp: Comp, rounds: ScoredRound[]): LadderEntry[] {
  const now = standings(comp, rounds);
  if (rounds.length <= 1) return now;
  const before = standings(comp, rounds.slice(0, -1));
  return now.map((row) => {
    const was = before.find((b) => b.tipper.id === row.tipper.id)!;
    return { ...row, movement: row.position != null && was.position != null ? was.position - row.position : null };
  });
}
