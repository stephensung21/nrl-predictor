// Turns table rows into what the home page shows: which part of the NRL week
// we're in, each game's status, and the viewer's standing.

import type { LadderRow, Match, Prediction, RoundData, Tip, Tipper } from "./types";
import type { TeamName } from "./teams";

const MIN = 60_000;
const HOUR = 60 * MIN;
/** A game runs about 100 minutes; allow for stoppages and extra time. */
const GAME_LENGTH = 115 * MIN;
/** Results land at the next pipeline run: refresh 9am and 3pm Sydney (23:00 and 05:00 UTC). */
const REFRESH_HOURS_UTC = [5, 23];

export type GameStatus = "upcoming" | "live" | "awaiting" | "final" | "postponed";
export type Phase = "open" | "live" | "recap";

/** First pipeline run that can grade a game: the next refresh after full time. */
export function gradedAt(kickoff: string): Date {
  const fullTime = new Date(new Date(kickoff).getTime() + 2 * HOUR);
  const t = new Date(fullTime);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 48; i++) {
    if (t > fullTime && REFRESH_HOURS_UTC.includes(t.getUTCHours())) return t;
    t.setUTCHours(t.getUTCHours() + 1);
  }
  return t;
}

export function gameStatus(m: Match, now: Date): GameStatus {
  if (m.postponed) return "postponed";
  const k = new Date(m.kickoff).getTime();
  if (now.getTime() < k) return "upcoming";
  if (m.homeScore != null && gradedAt(m.kickoff) <= now) return "final";
  if (now.getTime() < k + GAME_LENGTH) return "live";
  return "awaiting";
}

export type Game = {
  match: Match;
  prediction: Prediction;
  status: GameStatus;
  featured: boolean;
  /** The Model's tip comes from the win probability, never the rounded scores. */
  modelTip: TeamName;
  modelProb: number;
  /** Rounded margin for the tipped team, at least 1. */
  callMargin: number;
  /** Winners once final. A draw counts as a win for both teams. */
  winners?: TeamName[];
  modelCorrect?: boolean;
  yourTip?: TeamName;
  yourCorrect?: boolean;
};

export type Standing = {
  tipper: Tipper;
  points: number;
  marginScore: number;
  position: number;
  roundCorrect: number;
  roundGraded: number;
};

export type RoundView = {
  season: number;
  round: number;
  phase: Phase;
  games: Game[];
  featured: Game;
  firstKickoff: string;
  lastKickoff: string;
  ladder: Standing[];
};

function winnersOf(m: Match): TeamName[] {
  if (m.homeScore == null || m.awayScore == null) return [];
  if (m.homeScore === m.awayScore) return [m.home, m.away];
  return [m.homeScore > m.awayScore ? m.home : m.away];
}

export function buildRound(opts: {
  data: RoundData;
  now: Date;
  tips: Tip[];
  tippers: Tipper[];
  ladderBefore: LadderRow[];
  youId?: string;
  /** Tips the viewer has actually entered so far (sample: the open state has fewer). */
  yourTipLimit?: number;
}): RoundView {
  const { data, now, tips, tippers, ladderBefore, youId } = opts;

  const yourTips = tips
    .filter((t) => t.tipperId === youId)
    .slice(0, opts.yourTipLimit ?? Infinity);

  const games: Game[] = [...data.matches]
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((match) => {
      const prediction = data.predictions.find((p) => p.matchId === match.id)!;
      const status = gameStatus(match, now);
      const homeTipped = prediction.homeWinProb >= 0.5;
      const modelTip = homeTipped ? match.home : match.away;
      const winners = status === "final" ? winnersOf(match) : undefined;
      const yourTip = yourTips.find((t) => t.matchId === match.id)?.team;
      return {
        match,
        prediction,
        status,
        featured: match.id === data.featuredMatchId,
        modelTip,
        modelProb: homeTipped ? prediction.homeWinProb : 1 - prediction.homeWinProb,
        callMargin: Math.max(1, Math.round(Math.abs(prediction.margin))),
        winners,
        modelCorrect: winners ? winners.includes(modelTip) : undefined,
        yourTip,
        yourCorrect: winners && yourTip ? winners.includes(yourTip) : undefined,
      };
    });

  const final = games.filter((g) => g.status === "final");
  const ladder: Standing[] = ladderBefore
    .map((row) => {
      const tipper = tippers.find((t) => t.id === row.tipperId)!;
      const roundCorrect = final.filter((g) => {
        const tip = tips.find((t) => t.tipperId === row.tipperId && t.matchId === g.match.id);
        return tip && g.winners!.includes(tip.team);
      }).length;
      return {
        tipper,
        points: row.points + roundCorrect,
        marginScore: row.marginScore,
        position: 0,
        roundCorrect,
        roundGraded: final.length,
      };
    })
    // Most points, then the lowest accumulated margin score.
    .sort((a, b) => b.points - a.points || a.marginScore - b.marginScore);
  ladder.forEach((s, i) => {
    const prev = ladder[i - 1];
    s.position = prev && prev.points === s.points && prev.marginScore === s.marginScore ? prev.position : i + 1;
  });

  const kickoffs = games.map((g) => g.match.kickoff);
  const allFinal = games.every((g) => g.status === "final" || g.status === "postponed");
  const phase: Phase = now < new Date(kickoffs[0]) ? "open" : allFinal ? "recap" : "live";

  return {
    season: data.season,
    round: data.round,
    phase,
    games,
    featured: games.find((g) => g.featured) ?? games[0],
    firstKickoff: kickoffs[0],
    lastKickoff: kickoffs[kickoffs.length - 1],
    ladder,
  };
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
