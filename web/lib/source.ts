// Where each page's data comes from: the database when SITE_DATABASE_URL is set (lib/data.ts), the
// sample modules otherwise. Pages ask here, so they work the same either way and say which they show.
// Server code only.

import { eloSeason, eloTeamView, matchDetail, oddsRounds, roundData, seasonBets, seasonGames } from "./data";
import { siteDb } from "./db";
import { LATEST, matchEloFrom, SEASONS, seasonOf, teamView, type MatchElo } from "./elo";
import { ODDS_ROUNDS, SEASON_BETS, SEASON_GAMES } from "./sample-odds";
import type { TeamName } from "./teams";
import type { EloSeason, EloTeamView, MatchDetail, OddsRound, RoundData, SeasonBet, SeasonGame } from "./types";

export type EloSource = {
  live: boolean;
  seasons: number[];
  latest: number;
  season: (n: number) => Promise<EloSeason | undefined>;
  teamView: (t: TeamName) => Promise<EloTeamView>;
};

export async function eloSource(): Promise<EloSource> {
  const sql = siteDb();
  if (!sql) {
    return { live: false, seasons: SEASONS, latest: LATEST, season: async (n) => seasonOf(n), teamView: async (t) => teamView(t) };
  }
  const seasons = (await sql`select distinct season from elo_ratings order by season`).map((r) => r.season as number);
  return {
    live: true, seasons, latest: seasons[seasons.length - 1],
    season: async (n) => (await eloSeason(sql, n)) ?? undefined,
    teamView: (t) => eloTeamView(sql, t),
  };
}

export type OddsSource = {
  live: boolean;
  season: number;
  /** Rounds with the Model and the market side by side; live, the season's finished rounds. */
  rounds: OddsRound[];
  games: SeasonGame[];
  bets: SeasonBet[];
};

export async function oddsSource(): Promise<OddsSource> {
  const sql = siteDb();
  if (!sql) return { live: false, season: 2026, rounds: ODDS_ROUNDS, games: SEASON_GAMES, bets: SEASON_BETS };
  const [latest] = await sql`select max(m.season) as season from graded_games g join matches m on m.id = g.match_id`;
  const season = latest?.season ?? new Date().getFullYear();
  const [rounds, games, bets] = await Promise.all([oddsRounds(sql, season), seasonGames(sql, season), seasonBets(sql, season)]);
  return { live: true, season, rounds, games, bets };
}

export type LiveMatch = { round: RoundData; detail: MatchDetail; elo: MatchElo | undefined };

/** A game from the database with its round, detail and Elo: null for an unknown or unpredicted game,
 * undefined when there's no database (the page uses the sample). */
export async function liveMatch(id: string): Promise<LiveMatch | null | undefined> {
  const sql = siteDb();
  if (!sql) return undefined;
  if (!/^\d+$/.test(id)) return null;
  const [m] = await sql`select season, round, home_team, away_team, neutral from matches where id = ${id}`;
  if (!m) return null;
  const round = await roundData(sql, m.season, m.round);
  const detail = await matchDetail(sql, id);
  if (!round || !detail || !round.matches.some((x) => x.id === id)) return null;
  const season = await eloSeason(sql, m.season);
  const views = new Map<string, EloTeamView>();
  for (const t of [m.home_team, m.away_team]) views.set(t, await eloTeamView(sql, t));
  const elo = season
    ? matchEloFrom(season, (t) => views.get(t) ?? { points: [], swings: [] },
        { season: m.season, round: m.round, home: m.home_team, away: m.away_team }, m.neutral)
    : undefined;
  return { round, detail, elo };
}
