// The community Dally M in the database (supabase/migrations/20261122000000_dally_m.sql): the voting
// window, three different players who played, the Model sitting out, and votes hidden until close,
// run in PGlite under Supabase's roles.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDatabase, uuid } from "./db";

const AMY = uuid(1);
const BEN = uuid(2);
const MODEL = uuid(3);

let db: PGlite;

/** Round 1 is closed (round 2 has kicked off), round 2 is open (round 3 is in two days), round 3
 *  hasn't been published, and round 4 is a final. Players 101-104 played round 1, 201-204 round 2. */
beforeAll(async () => {
  db = await freshDatabase();
  await db.exec(`
    insert into auth.users (id) values ('${AMY}'), ('${BEN}'), ('${MODEL}');
    insert into profiles (id, display_name, is_model) values ('${AMY}', 'Amy', false), ('${BEN}', 'Ben', false), ('${MODEL}', 'Model', true);
    insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score, is_final) values
      (11, 2027, 1, now() - interval '14 days', 'Storm', 'Broncos', 'final', 24, 16, false),
      (12, 2027, 1, now() - interval '14 days' + interval '3 hours', 'Eels', 'Panthers', 'final', 10, 30, false),
      (21, 2027, 2, now() - interval '7 days', 'Broncos', 'Storm', 'final', 18, 12, false),
      (22, 2027, 2, now() - interval '7 days' + interval '3 hours', 'Panthers', 'Eels', 'final', 20, 20, false),
      (31, 2027, 3, now() + interval '2 days', 'Storm', 'Eels', 'scheduled', null, null, false),
      (32, 2027, 3, now() + interval '2 days' + interval '3 hours', 'Broncos', 'Panthers', 'scheduled', null, null, false),
      (41, 2027, 4, now() + interval '9 days', 'Storm', 'Panthers', 'scheduled', null, null, true),
      (81, 2028, 1, now() - interval '1 day', 'Storm', 'Eels', 'final', 6, 4, false);
    insert into round_players (season, round, player_id, match_id, player_name, team, position) values
      (2027, 1, 101, 11, 'Alpha', 'Storm', 'Halfback'), (2027, 1, 102, 11, 'Bravo', 'Broncos', 'Prop'),
      (2027, 1, 103, 12, 'Charlie', 'Eels', 'Hooker'), (2027, 1, 104, 12, 'Delta', 'Panthers', 'Lock'),
      (2027, 2, 201, 21, 'Echo', 'Broncos', 'Fullback'), (2027, 2, 202, 21, 'Foxtrot', 'Storm', 'Centre'),
      (2027, 2, 203, 22, 'Golf', 'Panthers', 'Winger'), (2027, 2, 204, 22, 'Hotel', 'Eels', '2nd Row'),
      (2027, 2, 101, 21, 'Alpha', 'Broncos', 'Halfback');
  `);
  // Round 1's votes were cast while it was open: the service role (as the pipeline's key) back-fills them.
  await db.exec(`
    insert into dally_m_votes (user_id, season, round, votes, player_id) values
      ('${AMY}', 2027, 1, 3, 101), ('${AMY}', 2027, 1, 2, 102), ('${AMY}', 2027, 1, 1, 103),
      ('${BEN}', 2027, 1, 3, 102), ('${BEN}', 2027, 1, 2, 101), ('${BEN}', 2027, 1, 1, 104);
  `);
});

const ts = async (sql: string) => (await db.query<{ t: Date }>(sql)).rows[0].t?.getTime();
const vote = (who: string, round: number, votes: number, player: number) =>
  as(db, who, () => db.query("insert into dally_m_votes (user_id, season, round, votes, player_id) values ($1, 2027, $2, $3, $4)", [who, round, votes, player]));

describe("the voting window", () => {
  it("opens only once the round's players are published", async () => {
    const r = await as(db, null, () => db.query<{ round: number; is_open: boolean; is_closed: boolean }>("select round, is_open, is_closed from dally_m_rounds(2027)"));
    expect(r.rows).toEqual([{ round: 1, is_open: false, is_closed: true }, { round: 2, is_open: true, is_closed: false }]);
  });

  it("closes at the next round's first kickoff, the first final after the last regular round, or a week on", async () => {
    expect(await ts("select dally_m_closes(2027, 2) as t")).toBe(await ts("select kickoff as t from matches where id = 31"));
    expect(await ts("select dally_m_closes(2027, 3) as t")).toBe(await ts("select kickoff as t from matches where id = 41"));
    expect(await ts("select dally_m_closes(2028, 1) as t")).toBe(await ts("select kickoff + interval '7 days' as t from matches where id = 81"));
  });
});

describe("casting votes", () => {
  it("takes three different players, and swaps two players between vote slots", async () => {
    await vote(AMY, 2, 3, 201);
    await vote(AMY, 2, 2, 202);
    await vote(AMY, 2, 1, 203);
    await as(db, AMY, () =>
      db.transaction(async (tx) => {
        await tx.query("update dally_m_votes set player_id = 202 where user_id = $1 and round = 2 and votes = 3", [AMY]);
        await tx.query("update dally_m_votes set player_id = 201 where user_id = $1 and round = 2 and votes = 2", [AMY]);
      }),
    );
    const mine = await as(db, AMY, () => db.query<{ votes: number; player_id: number }>("select votes, player_id from dally_m_votes where user_id = $1 and round = 2 order by votes desc", [AMY]));
    expect(mine.rows.map((r) => [r.votes, Number(r.player_id)])).toEqual([[3, 202], [2, 201], [1, 203]]);
    await expect(vote(AMY, 2, 1, 204)).rejects.toThrow(/duplicate key/);
    await expect(as(db, AMY, () => db.query("update dally_m_votes set player_id = 202 where user_id = $1 and round = 2 and votes = 1", [AMY]))).rejects.toThrow(/dally_m_votes_one_slot_each/);
  });

  it("refuses a player who didn't play that round", async () => {
    await expect(vote(BEN, 2, 3, 103)).rejects.toThrow(/did not play/);
  });

  it("the Model can't vote", async () => {
    await expect(vote(MODEL, 2, 3, 201)).rejects.toThrow(/Model does not vote/);
  });

  it("refuses votes for someone else", async () => {
    await expect(as(db, BEN, () => db.query("insert into dally_m_votes (user_id, season, round, votes, player_id) values ($1, 2027, 2, 3, 204)", [AMY]))).rejects.toThrow(/row-level security|duplicate key/);
  });

  it("a closed round refuses new votes, changes and removals", async () => {
    await expect(vote(AMY, 1, 3, 104)).rejects.toThrow(/row-level security|duplicate key/);
    await as(db, AMY, () => db.query("update dally_m_votes set player_id = 104 where user_id = $1 and round = 1 and votes = 1", [AMY]));
    await as(db, AMY, () => db.query("delete from dally_m_votes where user_id = $1 and round = 1", [AMY]));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from dally_m_votes where user_id = '${AMY}' and round = 1`);
    expect(left.rows[0].n).toBe(3);
    const third = await db.query<{ p: number }>(`select player_id as p from dally_m_votes where user_id = '${AMY}' and round = 1 and votes = 1`);
    expect(Number(third.rows[0].p)).toBe(103);
  });
});

describe("hidden until close", () => {
  it("hides an open round's votes from everyone else, in the table and both views", async () => {
    const theirs = await as(db, BEN, () => db.query("select * from dally_m_votes where user_id = $1 and round = 2", [AMY]));
    expect(theirs.rows).toEqual([]);
    const results = await as(db, BEN, () => db.query("select * from dally_m_round_results where round = 2"));
    expect(results.rows).toEqual([]);
    // Amy's own open-round votes don't count towards the leaderboard yet either.
    const board = await as(db, AMY, () => db.query<{ player_id: number; votes: number }>("select player_id, votes from dally_m_leaderboard where season = 2027"));
    expect(board.rows.find((r) => Number(r.player_id) === 201)).toBeUndefined();
  });

  it("reveals a closed round's votes, and adds them up", async () => {
    const amys = await as(db, BEN, () => db.query("select * from dally_m_votes where user_id = $1 and round = 1", [AMY]));
    expect(amys.rows).toHaveLength(3);
    const results = await as(db, BEN, () =>
      db.query<{ player_id: number; votes: number; threes: number; twos: number; ones: number }>(
        "select player_id, votes, threes, twos, ones from dally_m_round_results where round = 1 order by votes desc, player_id"));
    expect(results.rows.map((r) => [Number(r.player_id), r.votes, r.threes, r.twos, r.ones])).toEqual([
      [101, 5, 1, 1, 0], [102, 5, 1, 1, 0], [103, 1, 0, 0, 1], [104, 1, 0, 0, 1],
    ]);
  });

  it("names a leaderboard player as his latest round has him", async () => {
    const board = await as(db, BEN, () => db.query<{ player_id: number; team: string; rounds: number }>("select player_id, team, rounds from dally_m_leaderboard where player_id = 101"));
    expect(board.rows[0]).toMatchObject({ team: "Broncos", rounds: 1 });
  });

  it("counts an open round's voters without showing their votes", async () => {
    const n = await as(db, BEN, () => db.query<{ n: number }>("select dally_m_voters(2027, 2) as n"));
    expect(n.rows[0].n).toBe(1);
    await expect(as(db, null, () => db.query("select dally_m_voters(2027, 2)"))).rejects.toThrow(/permission denied/);
  });

  it("visitors and the analyst can't read votes, but can read who played", async () => {
    for (const who of [null, { role: "analyst" }] as const) {
      await expect(as(db, who, () => db.query("select * from dally_m_votes"))).rejects.toThrow(/permission denied/);
      await expect(as(db, who, () => db.query("select * from dally_m_leaderboard"))).rejects.toThrow(/permission denied/);
      const played = await as(db, who, () => db.query("select * from round_players where season = 2027"));
      expect(played.rows).toHaveLength(9);
    }
  });
});
