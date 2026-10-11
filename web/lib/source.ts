// Where each page's data comes from: the database when SITE_DATABASE_URL is set (lib/data.ts), the
// sample modules otherwise. Pages ask here, so they work the same either way and say which they show.
// Server code only.

import {
  currentRound, eloSeason, eloTeamView, matchDetail, modelRecord, oddsRounds, roundData, seasonBets, seasonGames, summary,
  upcomingEdges,
} from "./data";
import { siteDb } from "./db";
import { LATEST, matchEloFrom, SEASONS, seasonOf, teamView, type MatchElo } from "./elo";
import { ODDS_ROUNDS, SEASON_BETS, SEASON_GAMES } from "./sample-odds";
import type { TeamName } from "./teams";
import type { Edge, EloSeason, EloTeamView, MatchDetail, ModelRecord, OddsRound, RoundData, SeasonBet, SeasonGame } from "./types";

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
  /** Games still to kick off, with the Model's fair odds and Betr's price; live only. */
  upcoming: Edge[];
};

export async function oddsSource(): Promise<OddsSource> {
  const sql = siteDb();
  if (!sql) return { live: false, season: 2026, rounds: ODDS_ROUNDS, games: SEASON_GAMES, bets: SEASON_BETS, upcoming: [] };
  const [latest] = await sql`select max(m.season) as season from graded_games g join matches m on m.id = g.match_id`;
  const season = latest?.season ?? new Date().getFullYear();
  const [rounds, games, bets, upcoming] = await Promise.all([
    oddsRounds(sql, season), seasonGames(sql, season), seasonBets(sql, season), upcomingEdges(sql),
  ]);
  return { live: true, season, rounds, games, bets, upcoming };
}

/** A game's Claude-written preview; `stale` when the prediction changed after it was written. */
export type Preview = { body: string; writtenAt: string; stale: boolean };

export type LiveMatch = { round: RoundData; detail: MatchDetail; elo: MatchElo | undefined; preview: Preview | null };

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
  const written = await summary(sql, "match_preview", m.season, m.round, id);
  const [p] = await sql`select created_at from prediction_of_record where match_id = ${id}`;
  const preview = written && {
    body: written.body, writtenAt: written.writtenAt,
    stale: p != null && new Date(p.created_at) > new Date(written.writtenAt),
  };
  return { round, detail, elo, preview };
}

export type LiveRound = { round: RoundData; rounds: { round: number; title: string | null }[]; recap: string | null };

/** A round from the database with the season's predicted rounds (for the steppers) and its recap,
 * if one was written: null for a round with no predictions, undefined when there's no database. */
export async function liveRound(season: number, round: number): Promise<LiveRound | null | undefined> {
  const sql = siteDb();
  if (!sql) return undefined;
  const data = await roundData(sql, season, round);
  if (!data) return null;
  const rounds = (await sql`
    select m.round, min(m.round_title) as title from matches m join prediction_of_record p on p.match_id = m.id
    where m.season = ${season} group by m.round order by m.round`)
    .map((r) => ({ round: r.round as number, title: r.title as string | null }));
  const recap = await summary(sql, "round_recap", season, round);
  return { round: data, rounds, recap: recap?.body ?? null };
}

export type LiveHome =
  | { kind: "offseason"; record: ModelRecord | null; lastRound: { season: number; round: number } | null }
  | { kind: "round"; round: RoundData; record: ModelRecord | null; recap: string | null };

/** A round's name from the database ("Grand Final"): null if it has no games, undefined when
 * there's no database. */
export async function liveRoundTitle(season: number, round: number): Promise<string | null | undefined> {
  const sql = siteDb();
  if (!sql) return undefined;
  const [r] = await sql`select min(round_title) as title from matches where season = ${season} and round = ${round}`;
  return r?.title ?? null;
}

/** What the home page shows from the database: the round in play, or the off-season once the
 * latest season's last game is a week gone. Undefined when there's no database. */
export async function liveHome(now: Date): Promise<LiveHome | undefined> {
  const sql = siteDb();
  if (!sql) return undefined;
  const [latest] = await sql`
    select max(m.season) as season from matches m join prediction_of_record p on p.match_id = m.id`;
  const season: number | null = latest?.season ?? null;
  if (season == null) return { kind: "offseason", record: null, lastRound: null };
  const record = await modelRecord(sql, season);
  const [last] = await sql`
    select max(m.round) as round from matches m join prediction_of_record p on p.match_id = m.id where m.season = ${season}`;
  const lastRound = last?.round != null ? { season, round: last.round as number } : null;
  const [state] = await sql`
    select count(*) filter (where status not in ('final', 'cancelled'))::int as open, max(kickoff) as last
    from matches where season = ${season}`;
  const week = 7 * 24 * 3600 * 1000;
  if (state.open === 0 && now.getTime() - new Date(state.last).getTime() > week) return { kind: "offseason", record, lastRound };
  const round = await currentRound(sql, season);
  const data = round == null ? null : await roundData(sql, season, round);
  if (!data) return { kind: "offseason", record, lastRound };
  const recap = await summary(sql, "round_recap", season, data.round);
  return { kind: "round", round: data, record, recap: recap?.body ?? null };
}

/** The round open for tipping (or being played): the home page's round. Null in the off-season,
 * undefined when there's no database (the page uses the sample). */
export async function liveTipRound(now: Date): Promise<RoundData | null | undefined> {
  const home = await liveHome(now);
  if (!home) return undefined;
  return home.kind === "round" ? home.round : null;
}
