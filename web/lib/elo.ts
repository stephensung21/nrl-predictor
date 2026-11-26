// Elo for the /elo page: everything is precomputed by web/scripts/build_elo_sample.py
// from the project's own engine (src/elo.py); this only reads and arranges it.

import { ELO_PARAMS, ELO_SEASONS, ELO_TEAMS } from "./sample-elo";
import type { TeamName } from "./teams";
import type { EloFormGame, EloRecord, EloSeason, EloTeamView } from "./types";

export const SEASONS = ELO_SEASONS.map((s) => s.season);
export const LATEST = ELO_SEASONS.at(-1)!.season;
export const seasonOf = (n: number) => ELO_SEASONS.find((s) => s.season === n);
export const teamView = (t: TeamName): EloTeamView => ELO_TEAMS[t] ?? { points: [], swings: [] };
export const HOME_ADVANTAGE = ELO_PARAMS.hfa;

/** Win chance for a rating gap, before home advantage. */
export const chanceForGap = (gap: number) => 1 / (1 + 10 ** (-gap / 400));

export type EloRow = {
  team: TeamName; rank: number; rating: number; change: number | null; start: number; bye: boolean;
  record: EloRecord;
  /** The wins Elo expected, to one decimal as the page prints it. */
  expectedWins: number;
  /** Wins (a draw counts half) above `expectedWins`, so it equals the printed figures (DESIGN.md, The Printed Figures Rule). */
  vsElo: number;
  pointsDiff: number;
  /** Rating gained or lost over the last five games. */
  formChange: number;
};

const NO_GAMES: EloRecord = { won: 0, lost: 0, drawn: 0, scored: 0, conceded: 0, expectedWins: 0, closeWon: 0, closeLost: 0, form: [] };

/** The sample's current round (its results aren't in yet). */
export const CURRENT_ROUND = 10;

/** The ratings table after a season's latest round, best first. */
export function table(season: number): EloRow[] {
  return tableOf(seasonOf(season)!);
}

/** The ratings table after a season's latest round, best first, from that season's data. */
export function tableOf(s: EloSeason): EloRow[] {
  return (Object.keys(s.ratings) as TeamName[])
    .map((t) => {
      const r = s.ratings[t];
      // A rating that didn't move at all means the team didn't play (a result always shifts it).
      const bye = r.length > 1 && r.at(-1) === r.at(-2);
      const change = r.length > 1 ? Math.round(r.at(-1)!) - Math.round(r.at(-2)!) : null;
      const record = s.records[t] ?? NO_GAMES;
      const expectedWins = Math.round(record.expectedWins * 10) / 10;
      return {
        team: t, rating: r.at(-1)!, change, start: s.start[t], rank: 0, bye, record, expectedWins,
        vsElo: record.won + record.drawn / 2 - expectedWins,
        pointsDiff: record.scored - record.conceded,
        formChange: record.form.reduce((n, g) => n + g.change, 0),
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/* ---------- Hot and cold: who moved most over their last five ---------- */

/** Regular-season rounds before hot and cold shows: five games is the smallest sample it means anything on. */
export const FORM_FROM_ROUND = 5;

/** Whether a season has enough rounds rated for hot and cold. */
export const formReady = (s: EloSeason) => s.rounds.filter((r) => r.startsWith("R")).length >= FORM_FROM_ROUND;

/** The teams that gained most over their last five games, and the ones that lost most, `n` of each, biggest first. */
export function hotAndCold(rows: EloRow[], n = 4): { hot: EloRow[]; cold: EloRow[] } {
  const moved = [...rows].sort((a, b) => b.formChange - a.formChange);
  return {
    hot: moved.filter((r) => Math.round(r.formChange) > 0).slice(0, n),
    cold: moved.filter((r) => Math.round(r.formChange) < 0).reverse().slice(0, n),
  };
}

/** "W", "L" or "D" for a game, from the team's side. */
export const resultOf = (g: Pick<EloFormGame, "scored" | "conceded">) => (g.scored > g.conceded ? "W" : g.scored < g.conceded ? "L" : "D");

/* ---------- One game: both teams going in, and what the game did to them ---------- */

export type MatchEloSide = {
  team: TeamName;
  /** Going into the game. */
  rating: number;
  /** Among every team at that point, best first. */
  rank: number;
  /** This season so far: the start, then after each round before this one. */
  path: number[];
  /** Last five games before this one, most recent first. */
  form: { season: number; label: string; change: number; text: string }[];
  /** What the game itself did, once it's in the ratings. */
  after?: { rating: number; change: number };
};

export type MatchElo = {
  season: number;
  /** Labels for `path`: "Start", then "R1", "R2", ... */
  labels: string[];
  home: MatchEloSide;
  away: MatchEloSide;
  homeAdvantage: number;
  /** Home team's chance from the ratings alone (equals the game's stored Elo chance). */
  homeProb: number;
  teamCount: number;
};

/** Both teams' Elo around a game, from the same ratings the /elo page shows. */
export function matchElo(m: { season: number; round: number; home: TeamName; away: TeamName }, neutral: boolean): MatchElo | undefined {
  const s = seasonOf(m.season);
  return s ? matchEloFrom(s, teamView, m, neutral) : undefined;
}

/** The same, from a season's ratings and the teams' game-by-game views (the database's or the sample's). */
export function matchEloFrom(
  s: EloSeason,
  views: (t: TeamName) => EloTeamView,
  m: { season: number; round: number; home: TeamName; away: TeamName },
  neutral: boolean,
): MatchElo | undefined {
  if (!s || !(m.home in s.ratings) || !(m.away in s.ratings)) return undefined;
  // Ratings after each round before this one (round 1 goes in on the season-start rating).
  const before = s.rounds.findIndex((r) => r === `R${m.round}`);
  const upTo = before === -1 ? s.rounds.filter((r) => r.startsWith("R") && Number(r.slice(1)) < m.round).length : before;
  const at = (t: string) => (upTo === 0 ? s.start[t] : s.ratings[t][upTo - 1]);
  const teams = Object.keys(s.ratings);
  const rankOf = (t: string) => teams.filter((x) => at(x) > at(t)).length + 1;
  const homeAdvantage = neutral ? ELO_PARAMS.neutral_hfa : ELO_PARAMS.hfa;

  const side = (t: TeamName): MatchEloSide => {
    const rating = at(t);
    const played = before !== -1 && s.ratings[t][before] !== rating ? s.ratings[t][before] : undefined;
    const form = views(t)
      .points.filter((p) => p.season < m.season || (p.season === m.season && p.label.startsWith("Round ") && Number(p.label.slice(6)) < m.round))
      .slice(-5)
      .reverse()
      .map(({ season, label, change, text }) => ({ season, label, change, text }));
    return {
      team: t,
      rating,
      rank: rankOf(t),
      path: [s.start[t], ...s.ratings[t].slice(0, upTo)],
      form,
      after: played == null ? undefined : { rating: played, change: played - rating },
    };
  };

  const home = side(m.home);
  const away = side(m.away);
  return {
    season: m.season,
    labels: ["Start", ...s.rounds.slice(0, upTo)],
    home,
    away,
    homeAdvantage,
    homeProb: chanceForGap(home.rating - away.rating + homeAdvantage),
    teamCount: teams.length,
  };
}

export { lineColours } from "./line-colours";
