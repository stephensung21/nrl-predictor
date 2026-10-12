// The live ladder (lib/comp.ts): the rows the ladder page reads through Supabase, read here with the
// same queries in PGlite as a signed-in tipper under row-level security, then shaped by ladderView.
// A hand-worked two-round comp: Cal joined late and has Round 1 filled by auto-tips.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ladderView, type LadderRows } from "../lib/comp";
import { as, freshDatabase, uuid } from "./db";

const [AMY, BEN, CAL, MODEL] = [uuid(1), uuid(2), uuid(3), uuid(9)];

const SEED = `
  insert into auth.users (id) values ('${AMY}'), ('${BEN}'), ('${CAL}'), ('${MODEL}');
  insert into profiles (id, display_name, fav_team, auto_tip, is_model) values
    ('${AMY}', 'Amy', 'Storm', 'home', false), ('${BEN}', 'Ben', null, 'home', false),
    ('${CAL}', 'Cal', 'Eels', 'home', false), ('${MODEL}', 'Model', null, 'home', true);
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
    ('${MODEL}', 11, 'Storm', 6), ('${MODEL}', 12, 'Eels', null), ('${MODEL}', 21, 'Storm', null), ('${MODEL}', 22, 'Panthers', 5);
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
      ["Cal", 2, 7, 2, 0],
      ["Ben", 2, 32, 3, 0],
    ]);
    expect(view.ladder[0].tipper).toEqual({ id: AMY, name: "Amy", favTeam: "Storm" });
    expect(view.ladder[1].tipper.isModel).toBe(true);
    expect(view.latest).toEqual({ round: 2, title: "Round 2", partial: false, games: 2 });
  });

  it("fills a late joiner's missed round with auto-tips, flagged in the round grid", async () => {
    const view = (await as(db, BEN, () => rows(db, 2027).then((r) => ladderView(2027, r))))!;
    const cal = view.ladder.find((e) => e.tipper.id === CAL)!;
    expect(cal.rounds.map((s) => [s.round, s.correct, s.games, s.autoTips, s.marginScore])).toEqual([
      [1, 1, 2, 2, 4],
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
