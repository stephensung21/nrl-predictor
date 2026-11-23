// Where each page's data comes from: the database when SITE_DATABASE_URL is set (lib/data.ts), the
// sample modules otherwise. Pages ask here, so they work the same either way and say which they show.
// Server code only.

import {
  currentRound, eloSeason, eloTeamView, gradedGames, latestGradedSeason, matchDetail, matchDrivers, modelRecord, oddsHistory,
  oddsRounds, playerSeasonList, playerSeasons, roundData, seasonBets, seasonGames, summary, upcomingEdges,
  dallyMRounds, dallyMSeasons, lmsMatches, lmsSeason, roundPlayers,
} from "./data";
import { tallyVotes, type DallyMRound, type RoundPlayer, type Tally } from "./dally-m";
import { readVotes, type DallyMVotes } from "./dally-m-store";
import type { LmsMatch, LmsPick } from "./lms";
import { readPicks, type LmsTipper } from "./lms-store";
import { COMP_FIRST_SEASON, readRoundComp, type RoundComp } from "./comp";
import { siteDb } from "./db";
import { LATEST, matchEloFrom, SEASONS, seasonOf, teamView, type MatchElo } from "./elo";
import { buildRecord, type SeasonRecord } from "./model-record";
import type { PlayerSeason } from "./players";
import { SAMPLE_NOW, tippers as sampleTippers, YOU_ID } from "./sample";
import {
  SAMPLE_DALLY_M_OPEN, SAMPLE_DALLY_M_OPEN_VOTERS, SAMPLE_DALLY_M_RAW, SAMPLE_DALLY_M_SEASON,
} from "./sample-dally-m";
import { SAMPLE_LMS_MATCHES, SAMPLE_LMS_PICKS, SAMPLE_LMS_SEASON, SAMPLE_LMS_TIPPERS } from "./sample-lms";
import { SAMPLE_PLAYER_SEASONS, SAMPLE_PLAYERS } from "./sample-players";
import { ODDS_ROUNDS, SEASON_BETS, SEASON_GAMES } from "./sample-odds";
import { serverClient } from "./supabase-server";
import type { TeamName } from "./teams";
import type {
  Drivers, Edge, EloSeason, EloTeamView, MatchDetail, ModelRecord, OddsHistory, OddsRound, RoundData, SeasonBet, SeasonGame,
} from "./types";

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

export type LiveMatch = {
  round: RoundData; detail: MatchDetail; elo: MatchElo | undefined; preview: Preview | null;
  drivers: Drivers | null; odds: OddsHistory | null;
};

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
  const [drivers, odds] = await Promise.all([matchDrivers(sql, id), oddsHistory(sql, id)]);
  return { round, detail, elo, preview, drivers, odds };
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

/** The Model's record over the latest graded season, for /model: null before any game is graded,
 * undefined when there's no database (the page uses the sample). */
export async function liveModelRecord(): Promise<{ season: number; record: SeasonRecord } | null | undefined> {
  const sql = siteDb();
  if (!sql) return undefined;
  const season = await latestGradedSeason(sql);
  if (season == null) return null;
  return { season, record: buildRecord(await gradedGames(sql, season)) };
}

/** A round's tipping comp as the signed-in tipper sees it: their tips, everyone's once locked, and the
 * standings going in. Null when Supabase isn't set up, nobody is signed in, they haven't joined, or
 * the round is before the comp's first season (the pages then show the round without the comp). */
export async function viewerRoundComp(round: RoundData): Promise<RoundComp | null> {
  if (round.season < COMP_FIRST_SEASON) return null;
  const sb = await serverClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: me } = await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!me) return null;
  return readRoundComp(sb, data.user.id, round);
}

export type PlayersSource = {
  live: boolean;
  /** Seasons with player data, newest first. */
  seasons: number[];
  season: (n: number) => Promise<PlayerSeason[]>;
};

/** The players page's data: the database when the site has one (and its players tables exist), the
 *  sample otherwise. `missing` says the database is connected but the players tables aren't there yet. */
export async function playersSource(): Promise<PlayersSource & { missing?: boolean }> {
  const sql = siteDb();
  const sample: PlayersSource = {
    live: false, seasons: SAMPLE_PLAYER_SEASONS, season: async (n) => SAMPLE_PLAYERS.filter((p) => p.season === n),
  };
  if (!sql) return sample;
  try {
    return { live: true, seasons: await playerSeasonList(sql), season: (n) => playerSeasons(sql, n) };
  } catch {
    return { live: true, seasons: [], season: async () => [], missing: true };
  }
}

export type DallyMSource = {
  live: boolean;
  /** The database is connected but the Dally M tables aren't there yet. */
  missing?: boolean;
  /** Seasons with rounds opened for votes, newest first. */
  seasons: number[];
  /** The instant the page is viewed at (the sample's tips-open moment, or now). */
  now: string;
  rounds: (season: number) => Promise<DallyMRound[]>;
  players: (season: number, round: number) => Promise<RoundPlayer[]>;
  /** The votes the viewer may see; null when they aren't a signed-in tipper. */
  votes: (season: number, open: number | null) => Promise<DallyMVotes | null>;
};

function sampleDallyM(): DallyMSource {
  const raw = SAMPLE_DALLY_M_RAW;
  const now = Date.parse(SAMPLE_NOW.open);
  const person = (id: number, position: string, matchId: string): RoundPlayer => {
    const p = raw.people[String(id)];
    return { id, name: p.name, team: p.team as TeamName, position, image: p.image, matchId };
  };
  const players = (round: number) => (raw.rounds.find((r) => r.round === round)?.players ?? []).map(([id, pos, m]) => person(id, pos, m));
  const all = new Map<number, RoundPlayer>();
  for (const r of raw.rounds) for (const p of players(r.round)) all.set(p.id, p);
  const results: Record<number, Tally[]> = {};
  for (const r of raw.rounds) results[r.round] = tallyVotes(raw.votes.filter((v) => v.round === r.round), all);
  return {
    live: false,
    seasons: [SAMPLE_DALLY_M_SEASON],
    now: SAMPLE_NOW.open,
    rounds: async (season) =>
      season !== SAMPLE_DALLY_M_SEASON
        ? []
        : raw.rounds.map((r) => ({ round: r.round, closes: r.closes, isOpen: r.round === SAMPLE_DALLY_M_OPEN, isClosed: Date.parse(r.closes) <= now })),
    players: async (season, round) => (season === SAMPLE_DALLY_M_SEASON ? players(round) : []),
    votes: async (season) =>
      season !== SAMPLE_DALLY_M_SEASON
        ? null
        : {
            you: YOU_ID,
            tippers: sampleTippers.filter((t) => !t.isModel).map((t) => ({ id: t.id, name: t.name, favTeam: t.favTeam })),
            rows: raw.votes,
            results,
            leaderboard: tallyVotes(raw.votes, all),
            voters: SAMPLE_DALLY_M_OPEN_VOTERS,
          },
  };
}

/** The Dally M page's data: the database when the site has one (and the Dally M tables exist), the
 *  sample otherwise. Votes are read as the signed-in tipper, so row-level security decides what shows. */
export async function dallyMSource(): Promise<DallyMSource> {
  const sql = siteDb();
  if (!sql) return sampleDallyM();
  try {
    const seasons = await dallyMSeasons(sql);
    return {
      live: true,
      seasons,
      now: new Date().toISOString(),
      rounds: (season) => dallyMRounds(sql, season),
      players: (season, round) => roundPlayers(sql, season, round),
      votes: async (season, open) => {
        const sb = await serverClient();
        if (!sb) return null;
        const { data } = await sb.auth.getUser();
        if (!data.user) return null;
        const { data: me } = await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
        if (!me) return null;
        return readVotes(sb, data.user.id, season, open);
      },
    };
  } catch {
    return { live: true, missing: true, seasons: [], now: new Date().toISOString(), rounds: async () => [], players: async () => [], votes: async () => null };
  }
}

export type LmsSource = {
  live: boolean;
  /** The database is connected but the last man standing table isn't there yet. */
  missing?: boolean;
  /** The season being played; null before the comp's first season has a draw. */
  season: number | null;
  /** The instant the page is viewed at (the sample's tips-open moment, or now). */
  now: string;
  matches: LmsMatch[];
  seasonOver: boolean;
  /** The tippers and the picks the viewer may see; null when they aren't a signed-in tipper. */
  view: { you: string; tippers: LmsTipper[]; picks: LmsPick[] } | null;
};

/** Last man standing's data: the database when the site has one, the sample otherwise. Picks are
 *  read as the signed-in tipper, so row-level security decides which show. */
export async function lmsSource(): Promise<LmsSource> {
  const sql = siteDb();
  if (!sql) {
    return {
      live: false, season: SAMPLE_LMS_SEASON, now: SAMPLE_NOW.open, matches: SAMPLE_LMS_MATCHES, seasonOver: false,
      view: {
        you: YOU_ID,
        tippers: SAMPLE_LMS_TIPPERS.map((t) => ({ id: t.id, name: t.name, favTeam: t.favTeam })),
        picks: SAMPLE_LMS_PICKS,
      },
    };
  }
  const now = new Date().toISOString();
  const season = await lmsSeason(sql, COMP_FIRST_SEASON);
  const { matches, seasonOver } = season == null ? { matches: [], seasonOver: false } : await lmsMatches(sql, season);
  const base = { live: true, season, now, matches, seasonOver };
  try {
    const sb = await serverClient();
    if (!sb) return { ...base, view: null };
    const { data } = await sb.auth.getUser();
    const { data: me } = data.user ? await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle() : { data: null };
    if (!data.user || !me) return { ...base, view: null };
    if (season == null) return { ...base, view: null };
    return { ...base, view: { you: data.user.id, ...(await readPicks(sb, season)) } };
  } catch {
    return { ...base, missing: true, view: null };
  }
}
