// The live ladder (lib/comp.ts): the rows the ladder page reads through Supabase, read here with the
// same queries in PGlite as a signed-in tipper under row-level security, then shaped by ladderView.
// A hand-worked two-round comp: Cal joined after Round 1, so its games count as away-team tips.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ladderView, roundComp, type LadderRows, type RoundCompRows } from "../lib/comp";
import { buildRound } from "../lib/round";
import type { RoundData } from "../lib/types";
import { as, freshDatabase, uuid } from "./db";

const [AMY, BEN, CAL, MODEL] = [uuid(1), uuid(2), uuid(3), uuid(9)];

const SEED = `
  insert into auth.users (id) values ('${AMY}'), ('${BEN}'), ('${CAL}'), ('${MODEL}');
  insert into profiles (id, display_name, fav_team, auto_tip, is_model, created_at) values
    ('${AMY}', 'Amy', 'Storm', 'home', false, now() - interval '30 days'), ('${BEN}', 'Ben', null, 'home', false, now() - interval '30 days'),
    ('${CAL}', 'Cal', 'Eels', 'home', false, now() - interval '10 days'), ('${MODEL}', 'Model', null, 'home', true, now());
  insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score) values
    (11, 2027, 1, now() - interval '14 days', 'Storm', 'Broncos', 'final', 24, 16),
    (12, 2027, 1, now() - interval '14 days' + interval '3 hours', 'Eels', 'Panthers', 'final', 10, 30),
    (21, 2027, 2, now() - interval '7 days', 'Broncos', 'Storm', 'final', 18, 12),
    (22, 2027, 2, now() - interval '7 days' + interval '3 hours', 'Panthers', 'Eels', 'final', 20, 20),
    (31, 2027, 3, now() + interval '2 days', 'Storm', 'Eels', 'scheduled', null, null);
  insert into rounds (season, round, featured_match) values (2027, 1, 11), (2027, 2, 22);
  insert into model_versions (version, season, trained_on, commit, frozen_at) values ('2027.1', 2027, '{2021}', 'abc', '2026-10-10');
  insert into pipeline_runs (id, job, season, mode, as_of, started_at, status, model_version)
    values ('tue', 'predict', 2027, 'live', now(), now(), 'ok', '2027.1');
  insert into predictions (run_id, match_id, created_at, model_version, model, home_win_prob, margin, total, home_score, away_score)
    select 'tue', id, kickoff - interval '2 days', '2027.1', 'with odds', p, 0, 40, 20, 20
    from matches join (values (11, 0.70), (12, 0.60), (21, 0.30), (22, 0.65)) v(mid, p) on v.mid = matches.id;
  insert into tips (user_id, match_id, team, margin) values
    ('${AMY}', 11, 'Storm', 8), ('${AMY}', 12, 'Panthers', null), ('${AMY}', 21, 'Broncos', null), ('${AMY}', 22, 'Eels', 4),
    ('${BEN}', 11, 'Broncos', null), ('${BEN}', 12, 'Panthers', null), ('${BEN}', 21, 'Storm', null), ('${BEN}', 22, 'Panthers', null),
    ('${CAL}', 21, 'Storm', null), ('${CAL}', 22, 'Panthers', 3),
    ('${MODEL}', 11, 'Storm', 6), ('${MODEL}', 12, 'Eels', null), ('${MODEL}', 21, 'Storm', null), ('${MODEL}', 22, 'Panthers', 5),
    ('${AMY}', 31, 'Storm', null), ('${BEN}', 31, 'Eels', null);
`;

/** What readLadder fetches, as the same queries. */
async function rows(db: PGlite, season: number): Promise<LadderRows> {
  const q = async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  const games = await q<LadderRows["games"][number]>(
    `select id, round, round_title, to_char(kickoff at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as kickoff, home_team, away_team,
            home_score, away_score, status
     from matches where season = $1 and status in ('final', 'cancelled')`, [season]);
  return {
    ladder: await q(`select * from ladder($1)`, [season]),
    profiles: await q(`select id, fav_team from profiles`),
    scores: await q(`select user_id, round, correct, games, auto_tips, bonus, margin_score, partial from round_scores where season = $1`, [season]),
    tips: await q(`select user_id, match_id, team, is_auto from tip_results where season = $1`, [season]),
    games,
    probs: await q(`select match_id, home_win_prob from prediction_of_record where match_id = any($1)`, [games.map((g) => g.id)]),
  };
}

/** What readRoundComp fetches for a round, as the same queries. */
async function roundRows(db: PGlite, season: number, round: number): Promise<RoundCompRows> {
  const q = async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  const ids = (await q<{ id: number }>(`select id from matches where season = $1 and round = $2`, [season, round])).map((m) => m.id);
  return {
    profiles: await q(`select id, display_name, is_model, fav_team from profiles`),
    before: await q(`select user_id, correct, bonus, margin_score from round_scores where season = $1 and round < $2`, [season, round]),
    tips: await q(`select user_id, match_id, team, margin from tips where match_id = any($1)`, [ids]),
    results: await q(`select user_id, match_id, team from tip_results where match_id = any($1)`, [ids]),
  };
}

/** The round as the pages get it from lib/data.ts (only what buildRound reads). */
async function roundData(db: PGlite, season: number, round: number): Promise<RoundData> {
  const games = (await db.query<{ id: number; kickoff: Date; home_team: string; away_team: string; home_score: number | null; away_score: number | null }>(
    `select id, kickoff, home_team, away_team, home_score, away_score from matches where season = $1 and round = $2 order by kickoff`, [season, round])).rows;
  const [drawn] = (await db.query<{ featured_match: number }>(`select featured_match from rounds where season = $1 and round = $2`, [season, round])).rows;
  return {
    season, round, featuredMatchId: String(drawn?.featured_match ?? games[0].id),
    matches: games.map((g) => ({
      id: String(g.id), season, round, kickoff: new Date(g.kickoff).toISOString(), home: g.home_team, away: g.away_team, venue: "", city: "",
      ...(g.home_score != null ? { homeScore: g.home_score, awayScore: g.away_score! } : {}),
    })) as RoundData["matches"],
    predictions: games.map((g) => ({
      matchId: String(g.id), homeWinProb: 0.5, margin: 0, total: 40, homePred: 21, awayPred: 20, model: "with odds" as const, modelVersion: "2027.1",
    })),
  };
}

let db: PGlite;

beforeAll(async () => {
  db = await freshDatabase();
  await db.exec(SEED);
});

describe("the live ladder", () => {
  it("ranks the tippers on points then margin, with the Model unranked where its points put it", async () => {
    const view = (await as(db, AMY, () => rows(db, 2027).then((r) => ladderView(2027, r))))!;
    expect(view.ladder.map((e) => [e.tipper.name, e.points, e.marginScore, e.position, e.movement])).toEqual([
      ["Amy", 4, 4, 1, 0],
      ["Model", 2, 7, null, null],
      ["Cal", 2, 23, 2, 0],
      ["Ben", 2, 32, 3, -1],
    ]);
    expect(view.ladder[0].tipper).toEqual({ id: AMY, name: "Amy", favTeam: "Storm" });
    expect(view.ladder[1].tipper.isModel).toBe(true);
    expect(view.latest).toEqual({ round: 2, title: "Round 2", partial: false, games: 2 });
  });

  it("counts a late joiner's missed round as away-team tips, flagged as auto-tips in the round grid", async () => {
    const view = (await as(db, BEN, () => rows(db, 2027).then((r) => ladderView(2027, r))))!;
    const cal = view.ladder.find((e) => e.tipper.id === CAL)!;
    expect(cal.rounds.map((s) => [s.round, s.correct, s.games, s.autoTips, s.marginScore])).toEqual([
      [1, 1, 2, 2, 20],
      [2, 1, 2, 0, 3],
    ]);
  });

  it("works out bragging rights and tags from every tip", async () => {
    const view = (await as(db, CAL, () => rows(db, 2027).then((r) => ladderView(2027, r))))!;
    const { stats } = view;
    expect(stats.perfectRounds.map((p) => [p.tipper.name, p.rounds])).toEqual([["Amy", [1, 2]]]);
    expect(stats.longestStreak[0]).toMatchObject({ tipper: { name: "Amy" }, length: 4, endedRound: null });
    expect(stats.biggestUpset).toMatchObject({ tipper: { name: "Amy" }, team: "Broncos", opponent: "Storm", round: 2, modelChance: 0.3 });
    expect(Object.fromEntries([...view.tags].map(([id, tag]) => [id, tag]))).toEqual({
      [AMY]: "Top dog",
      [CAL]: "Wooden spoon watch",
      [BEN]: "Wooden spoon",
    });
  });

  it("has nothing to show before a game of the season is decided", async () => {
    expect(await as(db, AMY, () => rows(db, 2028).then((r) => ladderView(2028, r)))).toBeNull();
  });

  it("isn't readable without signing in", async () => {
    await expect(as(db, null, () => db.query("select * from ladder(2027)"))).rejects.toThrow(/permission denied/);
  });
});

describe("a round's comp on the home and round pages", () => {
  it("gives a decided round every tipper's scored tip, auto-tips included, and the standings going in", async () => {
    const data = await roundData(db, 2027, 2);
    const comp = roundComp(CAL, data.featuredMatchId, await as(db, CAL, () => roundRows(db, 2027, 2)));
    expect(comp.ladderBefore.sort((a, b) => a.tipperId.localeCompare(b.tipperId))).toEqual([
      { tipperId: AMY, points: 2, marginScore: 0 },
      { tipperId: BEN, points: 1, marginScore: 20 },
      { tipperId: CAL, points: 1, marginScore: 20 },
      { tipperId: MODEL, points: 1, marginScore: 2 },
    ]);
    expect(comp.tips).toHaveLength(8);
    expect(comp.yourMargin).toBe(3);
    expect(comp.tippers.find((t) => t.id === MODEL)?.isModel).toBe(true);

    // The pages' round view then agrees with the ladder on points (Amy 4; the rest 2). Its margin
    // scores are those going into the round, so Ben and Cal (both 20) share 2nd here, where the
    // ladder, with Round 2's margin game, has Cal ahead.
    const view = buildRound({ data, now: new Date(Date.now() + 864e5 * 30), ...comp });
    expect(view.phase).toBe("recap");
    expect(view.ladder.map((s) => [s.tipper.name, s.points, s.roundCorrect, s.position])).toEqual([
      ["Amy", 4, 2, 1], ["Model", 2, 1, 0], ["Ben", 2, 1, 2], ["Cal", 2, 1, 2],
    ]);
    expect(view.games.map((g) => [g.yourTip, g.yourCorrect])).toEqual([["Storm", false], ["Panthers", true]]);
  });

  it("gives a late joiner the away team for games before they joined, once decided", async () => {
    const comp = roundComp(CAL, "11", await as(db, CAL, () => roundRows(db, 2027, 1)));
    expect(comp.tips.filter((t) => t.tipperId === CAL).map((t) => [t.matchId, t.team])).toEqual([["11", "Broncos"], ["12", "Panthers"]]);
    expect(comp.yourMargin).toBeUndefined();
    expect(comp.ladderBefore.every((r) => r.points === 0)).toBe(true);
  });

  it("shows only the viewer's own tips before kickoff", async () => {
    const comp = roundComp(BEN, "31", await as(db, BEN, () => roundRows(db, 2027, 3)));
    expect(comp.tips).toEqual([{ tipperId: BEN, matchId: "31", team: "Eels" }]);
    const view = buildRound({ data: await roundData(db, 2027, 3), now: new Date(), ...comp });
    expect(view.phase).toBe("open");
    expect(view.games[0].yourTip).toBe("Eels");
    expect(view.ladder.find((s) => s.tipper.id === BEN)).toMatchObject({ points: 2, marginScore: 32, position: 3 }); // as on the ladder
  });
});
