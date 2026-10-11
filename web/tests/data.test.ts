// The site's data layer (lib/data.ts) against a real Postgres: PGlite with the migrations, served
// over the Postgres protocol so postgres.js can connect as it will in production, reading as the
// read-only `analyst` role. A small hand-made season checks each function's shapes and rules; with
// TEST_SITE_DATABASE_URL set (a database `publish.py --backfill 2026` has filled), the same
// functions are checked against the whole published season.

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  currentRound, eloSeason, eloTeamView, matchDetail, modelRecord, oddsRounds, roundData, seasonGames, summary,
  upcomingEdges,
} from "../lib/data";
import type { Sql } from "../lib/db";

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const SEED = `
  insert into matches (id, season, round, round_title, kickoff, home_team, away_team, venue, city, status, home_score, away_score, neutral) values
    (1, 2027, 1, 'Round 1', '2027-03-06 08:00+00', 'Storm', 'Broncos', 'AAMI Park', 'Melbourne', 'final', 24, 16, false),
    (2, 2027, 1, 'Round 1', '2027-03-07 06:00+00', 'Eels', 'Panthers', 'CommBank Stadium', 'Sydney', 'final', 18, 18, false),
    (3, 2027, 2, 'Round 2', '2027-03-13 08:00+00', 'Broncos', 'Storm', 'Suncorp Stadium', 'Brisbane', 'scheduled', null, null, false),
    (4, 2027, 2, 'Round 2', '2027-03-14 06:00+00', 'Panthers', 'Eels', 'BlueBet Stadium', 'Penrith', 'scheduled', null, null, true),
    (5, 2026, 9, 'Round 9', '2026-05-01 08:00+00', 'Broncos', 'Storm', 'Suncorp Stadium', 'Brisbane', 'final', 20, 22, false);
  insert into model_versions (version, season, trained_on, commit, frozen_at) values ('2027.1', 2027, '{2021}', 'abc', '2026-10-10');
  insert into pipeline_runs (id, job, season, mode, as_of, started_at, status, model_version)
    values ('tue', 'predict', 2027, 'live', now(), now(), 'ok', '2027.1'), ('wed', 'refresh', 2027, 'live', now(), now(), 'ok', '2027.1');
  insert into predictions (run_id, match_id, created_at, model_version, model, home_win_prob, margin, total, home_score, away_score, no_odds_home_win_prob, updated_reason) values
    ('tue', 1, '2027-03-03 07:15+00', '2027.1', 'with odds', 0.70, 8, 40, 24, 16, 0.66, null),
    ('tue', 2, '2027-03-03 07:15+00', '2027.1', 'with odds', 0.55, 2, 38, 20, 18, 0.52, null),
    ('tue', 3, '2027-03-10 07:15+00', '2027.1', 'with odds', 0.40, -4, 42, 19, 23, 0.45, null),
    ('wed', 3, '2027-03-11 23:15+00', '2027.1', 'with odds', 0.35, -6, 42, 18, 24, 0.42, 'Team list change'),
    ('tue', 4, '2027-03-10 07:15+00', '2027.1', 'no odds', 0.60, 3, 40, 22, 19, 0.60, null);
  insert into rounds (season, round, featured_match, drawn_at) values (2027, 2, 4, '2027-03-10 07:15+00');
  insert into graded_games (match_id, run_id, model_version, home_win_prob, margin, total, p_open, open_line, open_total, p_close, close_ok, elo_prob, margin_actual, total_actual, tip_correct) values
    (1, 'tue', '2027.1', 0.70, 8, 40, 0.62, -4.5, 42.5, 0.66, true, 0.58, 8, 40, true),
    (2, 'tue', '2027.1', 0.55, 2, 38, 0.48, 1.5, 40.5, 0.5, true, 0.51, 0, 36, true);
  insert into odds_sheet (match_id, bookmaker, home_odds_open, away_odds_open, home_line_open, total_open, home_odds_close, away_odds_close, close_ok)
    values (1, 'BlueBet', 1.5, 2.6, -4.5, 42.5, 1.45, 2.8, true);
  insert into elo_ratings (team, season, played_on, round_label, opponent, is_home, match_id, win_prob, points_for, points_against, rating_before, rating_after) values
    ('Storm', 2027, '2027-03-06', 'R1', 'Broncos', true, 1, 0.58, 24, 16, 1550, 1560),
    ('Broncos', 2027, '2027-03-06', 'R1', 'Storm', false, 1, 0.42, 16, 24, 1500, 1490),
    ('Eels', 2027, '2027-03-07', 'R1', 'Panthers', true, 2, 0.51, 18, 18, 1480, 1482),
    ('Panthers', 2027, '2027-03-07', 'R1', 'Eels', false, 2, 0.49, 18, 18, 1520, 1518),
    ('Storm', 2027, '2027-09-12', 'Finals Week 1', 'Eels', true, null, 0.6, 30, 10, 1600, 1615);
  insert into team_lists (match_id, team, fetched_at, player_id, player_name, jersey_number, position)
    select 3, 'Broncos', '2027-03-10 06:00+00', n, 'Player ' || n, n, case when n > 17 then 'Reserve' else 'Back' end
    from generate_series(1, 19) n;
  insert into team_lists (match_id, team, fetched_at, player_id, player_name, jersey_number, position)
    select 3, 'Broncos', '2027-03-12 06:00+00', n, case when n = 5 then 'Late Out' else 'Player ' || n end, n, 'Back'
    from generate_series(1, 17) n;
  insert into summaries (kind, season, round, match_id, body, llm_model, prompt_version)
    values ('match_preview', 2027, 2, 3, 'Storm by a bit.', 'claude-opus-5-5', 'v1'),
           ('round_recap', 2027, 1, null, 'Two from two.', 'claude-opus-5-5', 'v1');
  insert into weather (match_id, kind, fetched_at, source, roofed, temp_c, rain_mm, rain_chance, wind_kmh, gust_kmh, wind_dir, weather_code, conditions) values
    (1, 'forecast', '2027-03-05 06:00+00', 'forecast', false, 22, 0, 10, 12, 20, 180, 1, 'Mainly clear'),
    (1, 'observed', '2027-03-07 06:00+00', 'archive', false, 21.4, 3.2, null, 15, 30, 200, 61, 'Slight rain'),
    (3, 'forecast', '2027-03-11 06:00+00', 'forecast', false, 26, 0.4, 70, 9, 18, 90, 80, 'Rain showers');
  insert into odds_snapshots (match_id, bookmaker, captured_at, home_odds, away_odds) values
    (3, 'betr_au', '2027-03-10 08:00+00', 2.6, 1.5),
    (3, 'betr_au', '2027-03-11 08:00+00', 3.2, 1.36);
`;

let db: PGlite;
let server: PGLiteSocketServer;
let sql: Sql;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(new URL("supabase_stub.sql", import.meta.url), "utf8"));
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, migrationsDir), "utf8"));
  }
  await db.exec(SEED);
  const port = 54500 + Math.floor(Math.random() * 400);
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  sql = postgres(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres`, { prepare: false, max: 1, ssl: false });
  await sql`set role analyst`; // as the site will read: model data only
});

afterAll(async () => {
  await sql?.end();
  await server?.stop();
  await db?.close();
});

describe("the site's data layer", () => {
  it("reads a round's predicted games with their prediction of record and margin game", async () => {
    const r = (await roundData(sql, 2027, 2))!;
    expect(r.matches.map((m) => m.id)).toEqual(["3", "4"]);
    expect(r.featuredMatchId).toBe("4");
    expect(r.predictions[0]).toMatchObject({ matchId: "3", homeWinProb: 0.35, homePred: 18, awayPred: 24, updated: "Team list change" });
    expect(r.matches[0]).toMatchObject({ home: "Broncos", away: "Storm", venue: "Suncorp Stadium", kickoff: "2027-03-13T08:00:00.000Z" });
    expect(r.matches[0].homeScore).toBeUndefined();
    const done = (await roundData(sql, 2027, 1))!;
    expect(done.featuredMatchId).toBe("1"); // not drawn: the first game stands in
    expect(done.matches[0]).toMatchObject({ homeScore: 24, awayScore: 16 });
    expect(await roundData(sql, 2027, 9)).toBeNull();
  });

  it("shows the first round still to be decided", async () => {
    expect(await currentRound(sql, 2027)).toBe(2);
  });

  it("builds the match page's detail: prices, Elo, team list changes and head to head", async () => {
    const d = (await matchDetail(sql, "1"))!;
    expect(d).toMatchObject({ noOddsHomeProb: 0.66, eloHomeProb: 0.58, neutral: false });
    expect(d.marketHomeProb).toBeCloseTo(1 / 1.5 / (1 / 1.5 + 1 / 2.6), 12);
    const next = (await matchDetail(sql, "3"))!;
    expect(next.lists.home.tuesday).toHaveLength(17); // reserves left out
    expect(next.lists.home.out).toEqual(["Player 5"]);
    expect(next.lists.home.players.find((p) => p.name === "Late Out")).toMatchObject({ n: 5, isIn: true });
    expect(next.headToHead.map((h) => h.matchId)).toEqual(["1", "5"]); // newest first, either way round
    expect(await matchDetail(sql, "999")).toBeNull();
  });

  it("puts the no-odds model against the market for finished games", async () => {
    const rounds = await oddsRounds(sql, 2027);
    expect(rounds.map((r) => r.round)).toEqual([1]);
    expect(rounds[0].games[0]).toMatchObject({ matchId: "1", modelHomeProb: 0.66, openLine: -4.5, bookmaker: "BlueBet" });
    expect(rounds[0].games[1].openHomeProb).toBeNull(); // no prices for game 2
  });

  it("reads the season record and the scoreboard's games", async () => {
    expect(await modelRecord(sql, 2027)).toMatchObject({ games: 2, correct: 2, marginError: 1, favouriteCorrect: 2 });
    const games = await seasonGames(sql, 2027);
    expect(games.map((g) => [g.round, g.homeWin])).toEqual([["Round 1", 1], ["Round 1", 0.5]]);
  });

  it("reads Elo by round, finals as one point a week, and a team's swings", async () => {
    const s = (await eloSeason(sql, 2027))!;
    expect(s.rounds).toEqual(["R1", "F"]);
    expect(s.start).toMatchObject({ Storm: 1550, Broncos: 1500 });
    expect(s.ratings.Storm).toEqual([1560, 1615]);
    expect(s.ratings.Broncos).toEqual([1490, 1490]); // didn't play in the finals
    const v = await eloTeamView(sql, "Storm");
    expect(v.points.map((p) => [p.label, p.text])).toEqual([["Round 1", "Beat Broncos 24–16"], ["Finals", "Beat Eels 30–10"]]);
    expect(v.swings).toEqual([0, 1]);
  });

  it("puts each game's weather on it: observed once known, else the forecast", async () => {
    const [done] = (await roundData(sql, 2027, 1))!.matches;
    expect(done.weather).toMatchObject({ kind: "observed", rainMm: 3.2, conditions: "Slight rain", rainChance: null });
    const [next, unknown] = (await roundData(sql, 2027, 2))!.matches;
    expect(next.weather).toMatchObject({ kind: "forecast", rainChance: 70, windDir: 90, fetchedAt: "2027-03-11T06:00:00.000Z" });
    expect(unknown.weather).toBeUndefined();
  });

  it("gives coming games' fair odds against Betr's latest price, and paper trading's bet", async () => {
    const edges = await upcomingEdges(sql, new Date("2027-03-12T00:00:00Z"));
    expect(edges.map((e) => e.matchId)).toEqual(["3", "4"]);
    const [priced, unpriced] = edges;
    expect(priced).toMatchObject({ round: 2, home: "Broncos", homeProb: 0.35, homeOdds: 3.2, awayOdds: 1.36 });
    expect(priced.fairHome).toBeCloseTo(1 / 0.35, 12);
    expect(priced.homeEdge).toBeCloseTo(0.35 * 3.2 - 1, 12);
    expect(priced.bet).toMatchObject({ side: "home", team: "Broncos" });
    expect(priced.bet!.edge).toBeCloseTo(0.12, 12);
    expect(unpriced).toMatchObject({ priceAt: null, homeEdge: null, bet: null });
    // Before the second snapshot, the first price: no side 2% better, so no bet.
    const earlier = await upcomingEdges(sql, new Date("2027-03-10T12:00:00Z"));
    expect(earlier[0]).toMatchObject({ homeOdds: 2.6, bet: null });
  });

  it("finds a game's preview and a round's recap", async () => {
    expect((await summary(sql, "match_preview", 2027, 2, "3"))?.body).toBe("Storm by a bit.");
    expect((await summary(sql, "round_recap", 2027, 1))?.body).toBe("Two from two.");
    expect(await summary(sql, "round_recap", 2027, 2)).toBeNull();
  });

  it("can't see anything about the tippers", async () => {
    await expect(sql`select * from tips`).rejects.toThrow(/permission denied/);
    await expect(sql`select * from profiles`).rejects.toThrow(/permission denied/);
  });
});

describe.skipIf(!process.env.TEST_SITE_DATABASE_URL)("against a published season (TEST_SITE_DATABASE_URL)", () => {
  let live: Sql;
  beforeAll(async () => {
    live = postgres(process.env.TEST_SITE_DATABASE_URL!, { prepare: false, max: 1, ssl: false });
  });
  afterAll(async () => {
    await live?.end();
  });

  it("reads 2026 as publish.py --backfill wrote it", async () => {
    const r = (await roundData(live, 2026, 10))!;
    expect(r.matches.length).toBeGreaterThanOrEqual(7);
    expect(r.predictions).toHaveLength(r.matches.length);
    expect(await modelRecord(live, 2026)).toMatchObject({ games: 213 });
    const elo = (await eloSeason(live, 2026))!;
    expect(Object.keys(elo.ratings)).toHaveLength(17);
    expect(elo.rounds.filter((x) => x === "F").length).toBeGreaterThanOrEqual(4);
    const detail = (await matchDetail(live, r.matches[0].id))!;
    expect(detail.headToHead.length).toBeGreaterThan(0);
    expect(detail.eloHomeProb).toBeGreaterThan(0);
    expect((await oddsRounds(live, 2026)).length).toBeGreaterThan(25);
    expect((await seasonGames(live, 2026)).length).toBe(213);
    expect((await eloTeamView(live, "Storm")).swings.length).toBe(6);
  });
});
