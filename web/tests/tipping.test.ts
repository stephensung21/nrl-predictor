// The tipping rules, checked twice against the same hand-worked cases (tests/tipping/cases.json):
// once in the website's code (lib/scoring.ts) and once in the database (supabase/migrations),
// run in PGlite, a real Postgres compiled to WebAssembly, with Supabase's auth roles stubbed.
// Then the rules only the database enforces: lockout, hidden tips and who can change what.

import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ladder, scoreRound, type Comp, type ScoredRound } from "../lib/scoring";
import type { TeamName } from "../lib/teams";
import type { AutoTip } from "../lib/rules";
import type { Tipper } from "../lib/types";
import { as, freshDatabase, uuid } from "./db";

type CaseGame = { id: string; home: TeamName; away: TeamName; score: [number, number] | null; status?: "cancelled" };
type CaseTip = { tipper: string; match: string; team: TeamName; margin?: number };
type CaseRound = { round: number; featured: string; games: CaseGame[]; tips: CaseTip[] };
type Expected = {
  rounds: Record<string, { round: number; correct: number; games: number; bonus: number; autoTips: number; marginScore: number; partial: boolean }[]>;
  ladder: Record<string, { points: number; marginScore: number; position: number | null; tied: boolean; movement: number | null }>;
};
type Case = {
  name: string;
  sqlOnly?: boolean;
  tippers: { id: string; autoTip?: AutoTip; isModel?: boolean }[];
  rounds: CaseRound[];
  expect: Expected;
};

const root = new URL("../../", import.meta.url);
const { season, cases } = JSON.parse(readFileSync(new URL("tests/tipping/cases.json", root), "utf8")) as { season: number; cases: Case[] };

/* ---------- the website's rules ---------- */

function inTypeScript(c: Case) {
  const tippers: Tipper[] = c.tippers.map((t) => ({ id: t.id, name: t.id, isModel: t.isModel, autoTip: t.autoTip }));
  const rounds: ScoredRound[] = c.rounds.map((r) => ({
    round: r.round,
    featuredMatchId: r.featured,
    games: r.games
      .filter((g) => g.score)
      .map((g) => ({ matchId: g.id, kickoff: "", home: g.home, away: g.away, homeScore: g.score![0], awayScore: g.score![1], modelHomeProb: 0.5, modelMargin: 0 })),
    tips: r.tips.map((t) => ({ tipperId: t.tipper, matchId: t.match, team: t.team })),
    margins: r.tips.filter((t) => t.margin != null).map((t) => ({ tipperId: t.tipper, team: t.team, margin: t.margin! })),
    partial: r.games.some((g) => !g.score),
  }));
  const comp: Comp = { tippers, season: rounds };
  const roundScores = Object.fromEntries(tippers.map((t) => [t.id, rounds.map((r) => scoreRound(comp, r, t))]));
  const table = Object.fromEntries(
    ladder(comp, rounds).map((e) => [e.tipper.id, { points: e.points, marginScore: e.marginScore, position: e.position, tied: e.tied, movement: e.movement }]),
  );
  return { rounds: roundScores, ladder: table };
}

describe("tipping rules in lib/scoring.ts", () => {
  for (const c of cases.filter((c) => !c.sqlOnly)) {
    it(c.name, () => {
      const got = inTypeScript(c);
      expect(got.rounds).toEqual(c.expect.rounds);
      expect(got.ladder).toEqual(c.expect.ladder);
    });
  }
});

/* ---------- the database's rules ---------- */

async function load(db: PGlite, c: Case) {
  await db.exec("truncate tips, rounds, profiles, matches cascade; delete from auth.users;");
  const ids = new Map(c.tippers.map((t, i) => [t.id, uuid(i + 1)]));
  for (const t of c.tippers) {
    await db.query("insert into auth.users (id) values ($1)", [ids.get(t.id)]);
    await db.query("insert into profiles (id, display_name, auto_tip, is_model) values ($1, $2, $3, $4)", [ids.get(t.id), t.id, t.autoTip ?? "home", !!t.isModel]);
  }
  for (const r of c.rounds) {
    for (const [i, g] of r.games.entries()) {
      const played = g.score || g.status === "cancelled";
      // Played games kicked off in the past, a round a week; unplayed ones are still to come.
      const kickoff = played ? `now() - interval '${(40 - r.round) * 7} days' + interval '${i} hours'` : "now() + interval '2 days'";
      await db.query(
        `insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score)
         values ($1, $2, $3, ${kickoff}, $4, $5, $6, $7, $8)`,
        [g.id, season, r.round, g.home, g.away, g.status ?? (g.score ? "final" : "scheduled"), g.score?.[0] ?? null, g.score?.[1] ?? null],
      );
    }
    await db.query("insert into rounds (season, round, featured_match) values ($1, $2, $3)", [season, r.round, r.featured]);
    for (const t of r.tips) {
      await db.query("insert into tips (user_id, match_id, team, margin) values ($1, $2, $3, $4)", [ids.get(t.tipper), t.match, t.team, t.margin ?? null]);
    }
  }
  return ids;
}

async function inDatabase(db: PGlite, c: Case) {
  const ids = await load(db, c);
  const viewer = ids.get(c.tippers[0].id)!;
  return as(db, viewer, async () => {
    const scores = await db.query<{ name: string; round: number; correct: number; games: number; bonus: number; auto_tips: number; margin_score: number; partial: boolean }>(
      `select p.display_name as name, s.round, s.correct, s.games, s.bonus, s.auto_tips, s.margin_score, s.partial
       from round_scores s join profiles p on p.id = s.user_id where s.season = $1 order by s.round`,
      [season],
    );
    const rows = await db.query<{ display_name: string; points: number; margin_score: number; position: number | null; tied: boolean; movement: number | null }>(
      "select * from ladder($1)",
      [season],
    );
    const rounds: Expected["rounds"] = {};
    for (const s of scores.rows) {
      (rounds[s.name] ??= []).push({ round: s.round, correct: s.correct, games: s.games, bonus: s.bonus, autoTips: s.auto_tips, marginScore: s.margin_score, partial: s.partial });
    }
    const table = Object.fromEntries(
      rows.rows.map((r) => [r.display_name, { points: r.points, marginScore: r.margin_score, position: r.position, tied: r.tied, movement: r.movement }]),
    );
    return { rounds, ladder: table };
  });
}

describe("tipping rules in the database", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
  });
  for (const c of cases) {
    it(c.name, async () => {
      const got = await inDatabase(db, c);
      expect(got.rounds).toEqual(c.expect.rounds);
      expect(got.ladder).toEqual(c.expect.ladder);
    });
  }
});

/* ---------- what only the database enforces ---------- */

describe("lockout, hidden tips and permissions (row-level security)", () => {
  let db: PGlite;
  const [amy, ben] = [uuid(1), uuid(2)];
  const thisSeason = new Date().getFullYear();

  beforeAll(async () => {
    db = await freshDatabase();
    await db.exec(`
      insert into auth.users (id) values ('${amy}'), ('${ben}');
      insert into profiles (id, display_name) values ('${amy}', 'amy'), ('${ben}', 'ben');
      insert into matches (id, season, round, kickoff, home_team, away_team, status) values
        (1, ${thisSeason}, 1, now() - interval '1 hour', 'Storm', 'Broncos', 'live'),
        (2, ${thisSeason}, 1, now() + interval '1 day', 'Eels', 'Panthers', 'scheduled'),
        (3, ${thisSeason}, 1, now() - interval '1 day', 'Titans', 'Dragons', 'postponed');
      insert into tips (user_id, match_id, team) values ('${amy}', 1, 'Storm'), ('${amy}', 2, 'Eels');
    `);
  });

  const tipsOf = async (user: string) => (await db.query<{ team: string }>("select team from tips where user_id = $1 order by match_id", [user])).rows.map((r) => r.team);

  it("takes a tip before kickoff, and lets it be changed", async () => {
    await as(db, ben, () => db.query("insert into tips (user_id, match_id, team) values ($1, 2, 'Panthers')", [ben]));
    await as(db, ben, () => db.query("update tips set team = 'Eels' where user_id = $1 and match_id = 2", [ben]));
    expect(await tipsOf(ben)).toEqual(["Eels"]);
  });

  it("refuses a tip after kickoff, even through the API", async () => {
    await expect(as(db, ben, () => db.query("insert into tips (user_id, match_id, team) values ($1, 1, 'Broncos')", [ben]))).rejects.toThrow(/row-level security/);
  });

  it("can't change or remove a tip once its game has kicked off", async () => {
    await as(db, amy, () => db.query("update tips set team = 'Broncos' where user_id = $1 and match_id = 1", [amy]));
    await as(db, amy, () => db.query("delete from tips where user_id = $1 and match_id = 1", [amy]));
    expect(await tipsOf(amy)).toEqual(["Storm", "Eels"]);
  });

  it("can't move a tip from an open game onto a locked one", async () => {
    await expect(as(db, amy, () => db.query("update tips set match_id = 1, team = 'Storm' where user_id = $1 and match_id = 2", [amy]))).rejects.toThrow(/row-level security|duplicate key/);
  });

  it("can't tip for someone else", async () => {
    await expect(as(db, ben, () => db.query("insert into tips (user_id, match_id, team) values ($1, 2, 'Eels')", [amy]))).rejects.toThrow(/row-level security|duplicate key/);
  });

  it("hides other tippers' tips until the game kicks off", async () => {
    const seen = await as(db, ben, () => db.query<{ match_id: number }>("select match_id from tips where user_id = $1 order by match_id", [amy]));
    expect(seen.rows.map((r) => Number(r.match_id))).toEqual([1]);
  });

  it("keeps a postponed game locked until its new kickoff, then reopens it", async () => {
    await expect(as(db, ben, () => db.query("insert into tips (user_id, match_id, team) values ($1, 3, 'Titans')", [ben]))).rejects.toThrow(/row-level security/);
    await db.exec("update matches set kickoff = now() + interval '6 days' where id = 3");
    await as(db, ben, () => db.query("insert into tips (user_id, match_id, team) values ($1, 3, 'Titans')", [ben]));
    expect(await tipsOf(ben)).toEqual(["Eels", "Titans"]);
  });

  it("only takes a team that's playing in the game", async () => {
    await expect(as(db, ben, () => db.query("update tips set team = 'Roosters' where user_id = $1 and match_id = 2", [ben]))).rejects.toThrow(/not playing/);
  });

  it("lets tippers edit only their own name, team and auto-tip", async () => {
    await expect(as(db, amy, () => db.query("update profiles set is_admin = true where id = $1", [amy]))).rejects.toThrow(/permission denied/);
    await as(db, amy, () => db.query("update profiles set display_name = 'hacked' where id = $1", [ben]));
    await as(db, amy, () => db.query("update profiles set display_name = 'Amy' where id = $1", [amy]));
    const names = await db.query<{ display_name: string }>("select display_name from profiles order by id");
    expect(names.rows.map((r) => r.display_name)).toEqual(["Amy", "ben"]);
  });

  it("locks the auto-tip choice once the season's first game has kicked off", async () => {
    await expect(as(db, amy, () => db.query("update profiles set auto_tip = 'crowd' where id = $1", [amy]))).rejects.toThrow(/auto-tip choice is locked/);
  });

  it("shows tips and the ladder only to signed-in tippers", async () => {
    await expect(as(db, null, () => db.query("select * from tips"))).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => db.query("select * from ladder($1)", [thisSeason]))).rejects.toThrow(/permission denied/);
    const fixtures = await as(db, null, () => db.query("select id from matches"));
    expect(fixtures.rows).toHaveLength(3);
  });
});
