// Tipping groups in the database (supabase/migrations/20261124000000_groups.sql): making, joining,
// leaving and running a group, open sign-up, and the ladder for one group.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDatabase, uuid } from "./db";

const AMY = uuid(1);
const BEN = uuid(2);
const CAL = uuid(3);
const MODEL = uuid(4);
const DEE = uuid(5); // signed up, no profile yet
const EVE = uuid(6); // for the cap

let db: PGlite;

const one = async <T>(who: string | null, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows[0]);
const rows = async <T>(who: string | null, sql: string, params: unknown[] = []) => as(db, who, async () => (await db.query<T>(sql, params)).rows);
const create = async (who: string, name: string) => (await one<{ id: string }>(who, "select create_group($1) as id", [name])).id;
const codeOf = async (g: string) => (await db.query<{ code: string }>("select code from groups where id = $1", [g])).rows[0].code;

/** Round 1 of 2027 is played: Storm beat Broncos, Eels beat Panthers. Amy tipped both right, Ben
 *  one, Cal none, the Model both. */
beforeAll(async () => {
  db = await freshDatabase();
  await db.exec(`
    insert into auth.users (id) values ('${AMY}'), ('${BEN}'), ('${CAL}'), ('${MODEL}'), ('${DEE}'), ('${EVE}');
    insert into profiles (id, display_name, is_model, created_at) values
      ('${AMY}', 'Amy', false, now() - interval '30 days'), ('${BEN}', 'Ben', false, now() - interval '30 days'),
      ('${CAL}', 'Cal', false, now() - interval '30 days'), ('${MODEL}', 'Model', true, now() - interval '30 days'),
      ('${EVE}', 'Eve', false, now() - interval '30 days');
    insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score) values
      (11, 2027, 1, now() - interval '7 days', 'Storm', 'Broncos', 'final', 24, 16),
      (12, 2027, 1, now() - interval '7 days', 'Panthers', 'Eels', 'final', 10, 20);
    insert into tips (user_id, match_id, team) values
      ('${AMY}', 11, 'Storm'), ('${AMY}', 12, 'Eels'), ('${BEN}', 11, 'Storm'), ('${BEN}', 12, 'Panthers'),
      ('${CAL}', 11, 'Broncos'), ('${CAL}', 12, 'Panthers'), ('${MODEL}', 11, 'Storm'), ('${MODEL}', 12, 'Eels');
  `);
});

describe("making and joining a group", () => {
  it("makes the creator its owner and first member, with a trimmed name and an 8-character code", async () => {
    const g = await create(AMY, "  The boys  ");
    const row = await one<{ name: string; code: string; owner: string }>(AMY, "select name, code, owner from groups where id = $1", [g]);
    expect(row).toMatchObject({ name: "The boys", owner: AMY });
    expect(row.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    expect(await rows(AMY, "select user_id from group_members where group_id = $1", [g])).toEqual([{ user_id: AMY }]);
  });

  it("refuses an empty or too-long name, and anyone without a profile", async () => {
    await expect(create(AMY, "   ")).rejects.toThrow(/1 to 30 characters/);
    await expect(create(AMY, "x".repeat(31))).rejects.toThrow(/1 to 30 characters/);
    await expect(create(DEE, "Mine")).rejects.toThrow(/join the comp first/);
    await expect(as(db, null, () => db.query("select create_group('Mine')"))).rejects.toThrow(/permission denied/);
  });

  it("joins by code in any case; joining again does nothing; a bad code is refused", async () => {
    const g = await create(AMY, "Work");
    const code = await codeOf(g);
    expect((await one<{ id: string }>(BEN, "select join_group($1) as id", [code.toLowerCase()])).id).toBe(g);
    await one(BEN, "select join_group($1)", [code]);
    expect(await rows(AMY, "select user_id from group_members where group_id = $1 order by user_id", [g])).toEqual([{ user_id: AMY }, { user_id: BEN }]);
    await expect(one(BEN, "select join_group('NOPE2345')")).rejects.toThrow(/unknown group/);
  });

  it("shows the joining page only the name and member count, even signed out", async () => {
    const g = await create(CAL, "Family");
    expect(await rows(null, "select * from check_group($1)", [(await codeOf(g)).toLowerCase()])).toEqual([{ name: "Family", members: 1 }]);
    expect(await rows(null, "select * from check_group('NOPE2345')")).toEqual([]);
  });

  it("keeps a tipper to 10 groups", async () => {
    for (let i = 1; i <= 10; i++) await create(EVE, `Eve ${i}`);
    await expect(create(EVE, "Eve 11")).rejects.toThrow(/at most 10 groups/);
    const g = await create(AMY, "One more");
    await expect(one(EVE, "select join_group($1)", [await codeOf(g)])).rejects.toThrow(/at most 10 groups/);
  });
});

describe("who sees a group", () => {
  it("lets members read their group and its members, and nobody else", async () => {
    const g = await create(AMY, "Private");
    expect(await rows(AMY, "select name from groups where id = $1", [g])).toEqual([{ name: "Private" }]);
    expect(await rows(CAL, "select name from groups where id = $1", [g])).toEqual([]);
    expect(await rows(CAL, "select user_id from group_members where group_id = $1", [g])).toEqual([]);
    await expect(as(db, AMY, () => db.query("insert into group_members (group_id, user_id) values ($1, $2)", [g, CAL]))).rejects.toThrow(/permission denied/);
    await expect(as(db, AMY, () => db.query("update groups set owner = $2 where id = $1", [g, CAL]))).rejects.toThrow(/permission denied/);
  });
});

describe("running a group", () => {
  it("lets only the owner rename it, reset its code, remove a member and delete it", async () => {
    const g = await create(AMY, "Run");
    const old = await codeOf(g);
    await one(BEN, "select join_group($1)", [old]);
    await expect(one(BEN, "select rename_group($1, 'Mine now')", [g])).rejects.toThrow(/only the group's owner/);
    await expect(one(BEN, "select reset_group_code($1)", [g])).rejects.toThrow(/only the group's owner/);
    await expect(one(BEN, "select remove_member($1, $2)", [g, AMY])).rejects.toThrow(/only the group's owner/);
    await expect(one(BEN, "select delete_group($1)", [g])).rejects.toThrow(/only the group's owner/);

    await one(AMY, "select rename_group($1, 'Renamed')", [g]);
    const fresh = (await one<{ code: string }>(AMY, "select reset_group_code($1) as code", [g])).code;
    expect(fresh).not.toBe(old);
    await expect(one(CAL, "select join_group($1)", [old])).rejects.toThrow(/unknown group/);
    await expect(one(AMY, "select remove_member($1, $2)", [g, AMY])).rejects.toThrow(/leave the group instead/);
    await one(AMY, "select remove_member($1, $2)", [g, BEN]);
    expect(await rows(AMY, "select name from groups where id = $1", [g])).toEqual([{ name: "Renamed" }]);
    expect(await rows(BEN, "select name from groups where id = $1", [g])).toEqual([]);
    await one(AMY, "select delete_group($1)", [g]);
    expect((await db.query("select 1 from groups where id = $1", [g])).rows).toEqual([]);
  });

  it("hands an owner's group to the longest-standing member, and deletes it when the last one leaves", async () => {
    const g = await create(AMY, "Hand on");
    const code = await codeOf(g);
    await one(BEN, "select join_group($1)", [code]);
    await one(CAL, "select join_group($1)", [code]);
    await one(AMY, "select leave_group($1)", [g]);
    expect((await db.query<{ owner: string }>("select owner from groups where id = $1", [g])).rows[0].owner).toBe(BEN);
    await one(CAL, "select leave_group($1)", [g]);
    expect((await db.query<{ owner: string }>("select owner from groups where id = $1", [g])).rows[0].owner).toBe(BEN);
    await one(BEN, "select leave_group($1)", [g]);
    expect((await db.query("select 1 from groups where id = $1", [g])).rows).toEqual([]);
    await expect(one(BEN, "select leave_group($1)", [g])).rejects.toThrow(/not in that group/);
  });

  it("hands the group on when its owner deletes their account", async () => {
    await db.exec(`insert into auth.users (id) values ('${uuid(9)}'); insert into profiles (id, display_name) values ('${uuid(9)}', 'Gone')`);
    const g = await create(uuid(9), "Orphan");
    await one(CAL, "select join_group($1)", [await codeOf(g)]);
    await db.exec(`delete from auth.users where id = '${uuid(9)}'`);
    expect((await db.query<{ owner: string }>("select owner from groups where id = $1", [g])).rows[0].owner).toBe(CAL);
  });
});

describe("signing up", () => {
  it("makes a profile without an invite, joins a group given its code, and refuses a second profile", async () => {
    const g = await create(AMY, "Sign-ups");
    await expect(one(DEE, "select create_profile('Dee', 'Storm', 'home', 'NOPE2345')")).rejects.toThrow(/unknown group/);
    expect((await db.query("select 1 from profiles where id = $1", [DEE])).rows).toEqual([]);
    await one(DEE, "select create_profile(' Dee ', 'Storm', 'home', $1)", [await codeOf(g)]);
    expect((await db.query("select display_name from profiles where id = $1", [DEE])).rows).toEqual([{ display_name: "Dee" }]);
    expect(await rows(DEE, "select user_id from group_members where group_id = $1 and user_id = $2", [g, DEE])).toEqual([{ user_id: DEE }]);
    await expect(one(DEE, "select create_profile('Dee', null, null)")).rejects.toThrow(/already in the comp/);
    await expect(as(db, null, () => db.query("select create_profile('Nobody', null, null)"))).rejects.toThrow(/permission denied/);
  });
});

describe("the ladder for a group", () => {
  type Row = { display_name: string; points: number; position: number | null };
  const ladder = (who: string, group?: string) =>
    rows<Row>(who, group ? "select display_name, points, position from ladder(2027, $1)" : "select display_name, points, position from ladder(2027)", group ? [group] : []);

  it("ranks everyone in the global comp, and only the group's members (and the Model) in a group", async () => {
    const global = await ladder(CAL);
    expect(global.map((r) => r.display_name)).toEqual(expect.arrayContaining(["Amy", "Ben", "Cal", "Model"]));
    expect(global.find((r) => r.display_name === "Cal")).toMatchObject({ points: 0 });

    const g = await create(BEN, "Ben and Cal");
    await one(CAL, "select join_group($1)", [await codeOf(g)]);
    expect(await ladder(CAL, g)).toEqual([
      { display_name: "Model", points: 2, position: null },
      { display_name: "Ben", points: 1, position: 1 },
      { display_name: "Cal", points: 0, position: 2 },
    ]);
  });

  it("gives nothing to someone who isn't in the group", async () => {
    const g = await create(BEN, "Not Amy's");
    expect(await ladder(AMY, g)).toEqual([]);
  });
});
