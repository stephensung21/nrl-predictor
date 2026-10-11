// Where each page's data comes from: the database when SITE_DATABASE_URL is set (lib/data.ts), the
// sample modules otherwise. Pages ask here, so they work the same either way and say which they show.
// Server code only.

import { eloSeason, eloTeamView, oddsRounds, seasonBets, seasonGames } from "./data";
import { siteDb } from "./db";
import { LATEST, SEASONS, seasonOf, teamView } from "./elo";
import { ODDS_ROUNDS, SEASON_BETS, SEASON_GAMES } from "./sample-odds";
import type { TeamName } from "./teams";
import type { EloSeason, EloTeamView, OddsRound, SeasonBet, SeasonGame } from "./types";

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
