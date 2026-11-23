// Last man standing in the database (supabase/migrations/20261123000000_last_man_standing.sql): a
// pick names a team in that round's game, locks at kickoff, stays hidden until then, and belongs to
// its tipper. The game rules themselves are graded in web/lib/lms.ts.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDatabase, uuid } from "./db";

const AMY = uuid(1);
const BEN = uuid(2);
const MODEL = uuid(3);

let db: PGlite;

/** Round 1 is played; round 2's first game (21) has kicked off, its second (22) is in two days;
 *  round 3 is a final. */
beforeAll(async () => {
  db = await freshDatabase();
  await db.exec(`
    insert into auth.users (id) values ('${AMY}'), ('${BEN}'), ('${MODEL}');
    insert into profiles (id, display_name, is_model) values ('${AMY}', 'Amy', false), ('${BEN}', 'Ben', false), ('${MODEL}', 'Model', true);
    insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score, is_final) values
      (11, 2027, 1, now() - interval '7 days', 'Storm', 'Broncos', 'final', 24, 16, false),
      (21, 2027, 2, now() - interval '1 hour', 'Broncos', 'Storm', 'live', null, null, false),
      (22, 2027, 2, now() + interval '2 days', 'Panthers', 'Eels', 'scheduled', null, null, false),
      (31, 2027, 3, now() + interval '9 days', 'Storm', 'Panthers', 'scheduled', null, null, true);
    insert into lms_picks (user_id, season, round, match_id, team) values
      ('${AMY}', 2027, 1, 11, 'Storm'), ('${BEN}', 2027, 1, 11, 'Broncos'), ('${BEN}', 2027, 2, 21, 'Storm');
  `);
});

const pick = (who: string, round: number, match: number, team: string) =>
  as(db, who, () =>
    db.query(
      "insert into lms_picks (user_id, season, round, match_id, team) values ($1, 2027, $2, $3, $4) on conflict (user_id, season, round) do update set match_id = excluded.match_id, team = excluded.team",
      [who, round, match, team],
    ),
  );

describe("making a pick", () => {
  it("takes a team in a game that hasn't kicked off, and lets it change until then", async () => {
    await pick(AMY, 2, 22, "Eels");
    await pick(AMY, 2, 22, "Panthers");
    const r = await as(db, AMY, () => db.query<{ team: string }>("select team from lms_picks where user_id = $1 and round = 2", [AMY]));
    expect(r.rows).toEqual([{ team: "Panthers" }]);
  });

  it("refuses a team not in the game, a game from another round, and a final", async () => {
    await expect(pick(AMY, 2, 22, "Storm")).rejects.toThrow(/Storm is not playing in match 22/);
    await expect(pick(AMY, 1, 22, "Eels")).rejects.toThrow(/match 22 is not in round 1 of 2027/);
    await expect(pick(AMY, 3, 31, "Storm")).rejects.toThrow(/finals/);
  });

  it("refuses the Model, and a pick for someone else", async () => {
    await expect(pick(MODEL, 2, 22, "Eels")).rejects.toThrow(/the Model does not play/);
    await expect(
      as(db, AMY, () => db.query("insert into lms_picks (user_id, season, round, match_id, team) values ($1, 2027, 2, 22, 'Eels')", [BEN])),
    ).rejects.toThrow(/row-level security/);
  });

  it("locks at kickoff: no new pick, no move to a started game, no change or removal of a started one", async () => {
    await expect(pick(AMY, 2, 21, "Storm")).rejects.toThrow(/row-level security/);
    const moved = await as(db, BEN, () => db.query("update lms_picks set match_id = 22, team = 'Eels' where user_id = $1 and round = 2", [BEN]));
    expect(moved.affectedRows).toBe(0);
    const removed = await as(db, BEN, () => db.query("delete from lms_picks where user_id = $1 and round = 2", [BEN]));
    expect(removed.affectedRows).toBe(0);
  });
});

describe("seeing picks", () => {
  it("shows your own picks, and others' only once their game has kicked off", async () => {
    const seen = await as(db, BEN, () => db.query<{ user_id: string; round: number }>("select user_id, round from lms_picks order by user_id, round"));
    // Amy's round 2 pick (game 22) is still hidden from Ben.
    expect(seen.rows).toEqual([{ user_id: AMY, round: 1 }, { user_id: BEN, round: 1 }, { user_id: BEN, round: 2 }]);
  });

  it("is for signed-in tippers only", async () => {
    await expect(as(db, null, () => db.query("select * from lms_picks"))).rejects.toThrow(/permission denied/);
    await expect(as(db, { role: "analyst" }, () => db.query("select * from lms_picks"))).rejects.toThrow(/permission denied/);
  });
});
