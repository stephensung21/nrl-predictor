// Where each page's data comes from: the database when SITE_DATABASE_URL is set (lib/data.ts), the
// sample modules otherwise. Pages ask here, so they work the same either way and say which they show.
// Server code only.

import { cache } from "react";
import { cachedRead } from "./cache";
import {
  currentRound, eloSeason, eloTeamView, gradedGames, latestGradedSeason, matchDetail, matchDrivers, modelRecord, oddsHistory,
  oddsRounds, playerSeasonList, playerSeasons, roundParts, seasonBets, seasonGames, summary, upcomingEdges, withBets,
  dallyMRounds, dallyMSeasons, lmsMatches, lmsSeason, roundPlayers,
} from "./data";
import { tallyVotes, type DallyMRound, type RoundPlayer, type Tally } from "./dally-m";
import { forGroup, readVotes, type DallyMVotes } from "./dally-m-store";
import type { LmsMatch, LmsPick } from "./lms";
import { readPicks, type LmsTipper } from "./lms-store";
import { COMP_FIRST_SEASON, readRoundComp, type RoundComp } from "./comp";
import { choiceOf, sampleGroups, viewerGroups } from "./groups-server";
import type { GroupChoice } from "./groups";
import { siteDb } from "./db";
import { LATEST, matchEloFrom, SEASONS, seasonOf, teamView, type MatchElo } from "./elo";
import { buildRecord, type SeasonRecord } from "./model-record";
import { timed } from "./perf";
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

// The model's data, read through the cache (lib/cache.ts) and only on the server. Each read returns plain
// rows; the functions below apply the clock to them per request.
const db = () => siteDb()!;

const read = {
  eloSeasons: cachedRead("eloSeasons", async () =>
    (await db()`select distinct season from elo_ratings order by season`).map((r) => r.season as number)),
  eloSeason: cachedRead("eloSeason", (n: number) => eloSeason(db(), n)),
  eloTeamView: cachedRead("eloTeamView", (t: string) => eloTeamView(db(), t)),
  odds: cachedRead("odds", async () => {
    const sql = db();
    const [latest] = await sql`select max(m.season) as season from graded_games g join matches m on m.id = g.match_id`;
    const season: number = latest?.season ?? new Date().getFullYear();
    const [rounds, games, bets] = await Promise.all([oddsRounds(sql, season), seasonGames(sql, season), seasonBets(sql, season)]);
    return { season, rounds, games, bets };
  }),
  /** Games still to kick off when it was read: the caller drops those that have kicked off since. */
  edges: cachedRead("edges", () => upcomingEdges(db())),
  match: cachedRead("match", (id: string) => matchParts(id)),
  round: cachedRead("round", async (season: number, round: number) => {
    const sql = db();
    const parts = await roundParts(sql, season, round);
    if (!parts) return null;
    const [rounds, recap] = await Promise.all([
      sql`select m.round, min(m.round_title) as title from matches m join prediction_of_record p on p.match_id = m.id
          where m.season = ${season} group by m.round order by m.round`,
      summary(sql, "round_recap", season, round),
    ]);
    return {
      parts, rounds: rounds.map((r) => ({ round: r.round as number, title: r.title as string | null })), recap: recap?.body ?? null,
    };
  }),
  roundTitle: cachedRead("roundTitle", async (season: number, round: number) => {
    const [r] = await db()`select min(round_title) as title from matches where season = ${season} and round = ${round}`;
    return (r?.title as string | null) ?? null;
  }),
  home: cachedRead("home", () => homeRows()),
  graded: cachedRead("graded", async () => {
    const season = await latestGradedSeason(db());
    return season == null ? null : { season, games: await gradedGames(db(), season) };
  }),
  playerSeasons: cachedRead("playerSeasons", () => playerSeasonList(db())),
  players: cachedRead("players", (season: number) => playerSeasons(db(), season)),
  dallyMSeasons: cachedRead("dallyMSeasons", () => dallyMSeasons(db())),
  /** Each round's closing time; whether it's open is worked out per request. */
  dallyMRounds: cachedRead("dallyMRounds", (season: number) => dallyMRounds(db(), season)),
  roundPlayers: cachedRead("roundPlayers", (season: number, round: number) => roundPlayers(db(), season, round)),
  lms: cachedRead("lms", async () => {
    const season = await lmsSeason(db(), COMP_FIRST_SEASON);
    return { season, ...(season == null ? { matches: [], seasonOver: false } : await lmsMatches(db(), season)) };
  }),
};

export type EloSource = {
  live: boolean;
  seasons: number[];
  latest: number;
  season: (n: number) => Promise<EloSeason | undefined>;
  teamView: (t: TeamName) => Promise<EloTeamView>;
};

export async function eloSource(): Promise<EloSource> {
  if (!siteDb()) {
    return { live: false, seasons: SEASONS, latest: LATEST, season: async (n) => seasonOf(n), teamView: async (t) => teamView(t) };
  }
  const seasons = await timed("eloSeasons", () => read.eloSeasons());
  return {
    live: true, seasons, latest: seasons[seasons.length - 1],
    season: async (n) => (await timed("eloSeason", () => read.eloSeason(n))) ?? undefined,
    teamView: (t) => timed("eloTeamView", () => read.eloTeamView(t)),
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
  if (!siteDb()) return { live: false, season: 2026, rounds: ODDS_ROUNDS, games: SEASON_GAMES, bets: SEASON_BETS, upcoming: [] };
  return timed("oddsSource", async () => {
    const [odds, edges] = await Promise.all([read.odds(), read.edges()]);
    return { live: true, ...odds, upcoming: stillToCome(edges, new Date()) };
  });
}

/** The edges whose games haven't kicked off by `now` (a cached read may hold some that have since). */
const stillToCome = (edges: Edge[], now: Date) => edges.filter((e) => Date.parse(e.kickoff) > now.getTime());

/** A game's Claude-written preview; `stale` when the prediction changed after it was written. */
export type Preview = { body: string; writtenAt: string; stale: boolean };

export type LiveMatch = {
  round: RoundData; detail: MatchDetail; elo: MatchElo | undefined; preview: Preview | null;
  drivers: Drivers | null; odds: OddsHistory | null;
};

/** What the match page reads from the database, before the clock is applied (the round's bets). */
async function matchParts(id: string) {
  const sql = db();
  const [m] = await sql`select season, round, home_team, away_team, neutral from matches where id = ${id}`;
  if (!m) return null;
  const [round, detail, season, homeView, awayView, written, [p], drivers, odds] = await Promise.all([
    roundParts(sql, m.season, m.round),
    matchDetail(sql, id),
    eloSeason(sql, m.season),
    eloTeamView(sql, m.home_team),
    eloTeamView(sql, m.away_team),
    summary(sql, "match_preview", m.season, m.round, id),
    sql`select created_at from prediction_of_record where match_id = ${id}`,
    matchDrivers(sql, id),
    oddsHistory(sql, id),
  ]);
  if (!round || !detail || !round.round.matches.some((x) => x.id === id)) return null;
  const views = new Map<string, EloTeamView>([[m.home_team, homeView], [m.away_team, awayView]]);
  const elo = season
    ? matchEloFrom(season, (t) => views.get(t) ?? { points: [], swings: [] },
        { season: m.season, round: m.round, home: m.home_team, away: m.away_team }, m.neutral)
    : undefined;
  const preview: Preview | null = written && {
    body: written.body, writtenAt: written.writtenAt,
    stale: p != null && new Date(p.created_at) > new Date(written.writtenAt),
  };
  return { round, detail, elo: elo ?? null, preview, drivers, odds };
}

/** A game from the database with its round, detail and Elo: null for an unknown or unpredicted game,
 * undefined when there's no database (the page uses the sample). Once per request: the page's title
 * and the page itself both ask. */
export const liveMatch = cache(async (id: string): Promise<LiveMatch | null | undefined> => {
  if (!siteDb()) return undefined;
  if (!/^\d+$/.test(id)) return null;
  const parts = await timed("liveMatch", () => read.match(id));
  if (!parts) return null;
  return { ...parts, round: withBets(parts.round, new Date()), elo: parts.elo ?? undefined };
});

export type LiveRound = { round: RoundData; rounds: { round: number; title: string | null }[]; recap: string | null };

/** A round from the database with the season's predicted rounds (for the steppers) and its recap,
 * if one was written: null for a round with no predictions, undefined when there's no database. */
export async function liveRound(season: number, round: number): Promise<LiveRound | null | undefined> {
  if (!siteDb()) return undefined;
  const r = await timed("liveRound", () => read.round(season, round));
  return r && { round: withBets(r.parts, new Date()), rounds: r.rounds, recap: r.recap };
}

export type LiveHome =
  | { kind: "offseason"; record: ModelRecord | null; lastRound: { season: number; round: number } | null }
  | { kind: "round"; round: RoundData; record: ModelRecord | null; recap: string | null };

/** A round's name from the database ("Grand Final"): null if it has no games, undefined when
 * there's no database. */
export async function liveRoundTitle(season: number, round: number): Promise<string | null | undefined> {
  if (!siteDb()) return undefined;
  return timed("liveRoundTitle", () => read.roundTitle(season, round));
}

/** The home page's rows: the latest predicted season, its record, its last predicted round, how many of its
 * games are still to be decided and when its last one is, and the round in play with its recap. */
async function homeRows() {
  const sql = db();
  const [latest] = await sql`
    select max(m.season) as season from matches m join prediction_of_record p on p.match_id = m.id`;
  const season: number | null = latest?.season ?? null;
  if (season == null) return null;
  const [record, [last], [state], round] = await Promise.all([
    modelRecord(sql, season),
    sql`select max(m.round) as round from matches m join prediction_of_record p on p.match_id = m.id where m.season = ${season}`,
    sql`select count(*) filter (where status not in ('final', 'cancelled'))::int as open, max(kickoff) as last
        from matches where season = ${season}`,
    currentRound(sql, season),
  ]);
  const parts = round == null ? null : await roundParts(sql, season, round);
  const recap = parts ? await summary(sql, "round_recap", season, parts.round.round) : null;
  return {
    season, record, lastRound: (last?.round as number | null) ?? null,
    open: state.open as number, lastKickoff: state.last ? new Date(state.last).toISOString() : null,
    parts, recap: recap?.body ?? null,
  };
}

/** What the home page shows from the database: the round in play, or the off-season once the
 * latest season's last game is a week gone. Undefined when there's no database. */
export async function liveHome(now: Date): Promise<LiveHome | undefined> {
  if (!siteDb()) return undefined;
  const h = await timed("liveHome", () => read.home());
  if (!h) return { kind: "offseason", record: null, lastRound: null };
  const offseason = { kind: "offseason" as const, record: h.record, lastRound: h.lastRound != null ? { season: h.season, round: h.lastRound } : null };
  const week = 7 * 24 * 3600 * 1000;
  const last = h.lastKickoff ? Date.parse(h.lastKickoff) : NaN;
  if (h.open === 0 && now.getTime() - last > week) return offseason;
  if (!h.parts) return offseason;
  return { kind: "round", round: withBets(h.parts, now), record: h.record, recap: h.recap };
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
  if (!siteDb()) return undefined;
  const graded = await timed("liveModelRecord", () => read.graded());
  return graded && { season: graded.season, record: buildRecord(graded.games) };
}

/** A round's tipping comp as the signed-in tipper sees it: their tips, everyone's once locked, and the
 * standings going in. Null when Supabase isn't set up, nobody is signed in, they haven't joined, or
 * the round is before the comp's first season (the pages then show the round without the comp). */
export async function viewerRoundComp(round: RoundData): Promise<RoundComp | null> {
  if (round.season < COMP_FIRST_SEASON) return null;
  return timed("viewerRoundComp", () => readViewerRoundComp(round));
}

async function readViewerRoundComp(round: RoundData): Promise<RoundComp | null> {
  const sb = await serverClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: me } = await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!me) return null;
  const g = await viewerGroups(sb, data.user.id);
  return {
    ...(await readRoundComp(sb, data.user.id, round, g.memberIds)),
    groups: choiceOf(g),
  };
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
    return {
      live: true, seasons: await timed("playerSeasons", () => read.playerSeasons()),
      season: (n) => timed("players", () => read.players(n)),
    };
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

function sampleDallyM(group?: string): DallyMSource {
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
    votes: async (season) => {
      if (season !== SAMPLE_DALLY_M_SEASON) return null;
      const g = await sampleGroups(group);
      const votes: DallyMVotes = {
            you: YOU_ID,
            tippers: sampleTippers.filter((t) => !t.isModel).map((t) => ({ id: t.id, name: t.name, favTeam: t.favTeam })),
            rows: raw.votes,
            results,
            leaderboard: tallyVotes(raw.votes, all),
            voters: SAMPLE_DALLY_M_OPEN_VOTERS,
          };
      return { ...(g.memberIds ? forGroup(votes, g.memberIds) : votes), groups: choiceOf(g) };
    },
  };
}

/** The Dally M page's data: the database when the site has one (and the Dally M tables exist), the
 *  sample otherwise. Votes are read as the signed-in tipper, so row-level security decides what shows. */
export async function dallyMSource(group?: string): Promise<DallyMSource> {
  const sql = siteDb();
  if (!sql) return sampleDallyM(group);
  try {
    const seasons = await timed("dallyMSeasons", () => read.dallyMSeasons());
    const now = new Date();
    return {
      live: true,
      seasons,
      now: now.toISOString(),
      // As dally_m_rounds(): a round is open until it closes, by the clock now (the cached read may be older).
      rounds: async (season) =>
        (await timed("dallyMRounds", () => read.dallyMRounds(season))).map((r) => ({
          ...r, isOpen: now.getTime() < Date.parse(r.closes), isClosed: now.getTime() >= Date.parse(r.closes),
        })),
      players: (season, round) => timed("roundPlayers", () => read.roundPlayers(season, round)),
      votes: async (season, open) => {
        const sb = await serverClient();
        if (!sb) return null;
        const { data } = await sb.auth.getUser();
        if (!data.user) return null;
        const { data: me } = await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
        if (!me) return null;
        const [votes, g] = await Promise.all([readVotes(sb, data.user.id, season, open), viewerGroups(sb, data.user.id, group)]);
        return { ...(g.memberIds ? forGroup(votes, g.memberIds) : votes), groups: choiceOf(g) };
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
  /** The tippers (the shown group's, or everyone) and the picks the viewer may see; null when they aren't a signed-in tipper. */
  view: {
    you: string; tippers: LmsTipper[]; picks: LmsPick[]; groups: GroupChoice;
    /** Every game the viewer plays in (the global comp's and each group's): one pick counts in all of them. */
    fields: string[][];
  } | null;
};

/** The global comp's field, then each group's (in the comp's order, so the games play the same). */
const lmsFields = (everyone: string[], groups: { members: { id: string }[] }[]) => [
  everyone,
  ...groups.map((grp) => everyone.filter((id) => grp.members.some((m) => m.id === id))),
];

/** Last man standing's data: the database when the site has one, the sample otherwise. Picks are
 *  read as the signed-in tipper, so row-level security decides which show. */
export async function lmsSource(group?: string): Promise<LmsSource> {
  const sql = siteDb();
  if (!sql) {
    const g = await sampleGroups(group);
    return {
      live: false, season: SAMPLE_LMS_SEASON, now: SAMPLE_NOW.open, matches: SAMPLE_LMS_MATCHES, seasonOver: false,
      view: {
        you: YOU_ID,
        tippers: SAMPLE_LMS_TIPPERS.filter((t) => !g.memberIds || g.memberIds.has(t.id)).map((t) => ({ id: t.id, name: t.name, favTeam: t.favTeam })),
        picks: SAMPLE_LMS_PICKS,
        groups: choiceOf(g),
        fields: lmsFields(SAMPLE_LMS_TIPPERS.map((t) => t.id), g.groups),
      },
    };
  }
  const now = new Date().toISOString();
  const { season, matches, seasonOver } = await timed("lms", () => read.lms());
  const base = { live: true, season, now, matches, seasonOver };
  try {
    const sb = await serverClient();
    if (!sb) return { ...base, view: null };
    const { data } = await sb.auth.getUser();
    const { data: me } = data.user ? await sb.from("profiles").select("id").eq("id", data.user.id).maybeSingle() : { data: null };
    if (!data.user || !me) return { ...base, view: null };
    if (season == null) return { ...base, view: null };
    const [{ tippers, picks }, g] = await Promise.all([readPicks(sb, season), viewerGroups(sb, data.user.id, group)]);
    // A group plays its own games: only its members are in them (lib/lms.ts plays any field).
    const field = g.memberIds ? tippers.filter((t) => g.memberIds!.has(t.id)) : tippers;
    return { ...base, view: { you: data.user.id, tippers: field, picks, groups: choiceOf(g), fields: lmsFields(tippers.map((t) => t.id), g.groups) } };
  } catch {
    return { ...base, missing: true, view: null };
  }
}
