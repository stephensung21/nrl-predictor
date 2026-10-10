// The model-data migration (supabase/migrations/20261011000000_model_data.sql) in PGlite: the views
// the website reads (prediction of record, the market, the model's record), invites and joining,
// who can read and write what (including the agents' read-only role), and postponed games in the
// tipping scores.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDatabase, uuid } from "./db";

const [admin, amy, ben, cat] = [uuid(1), uuid(2), uuid(3), uuid(4)];

/** A model version and a run for predictions and grades to point at. */
async function seedModel(db: PGlite) {
  await db.exec(`
    insert into model_versions (version, season, trained_on, commit, frozen_at)
      values ('2027.1', 2027, '{2021,2022,2023,2024,2025,2026}', 'abc123', '2026-10-10');
    insert into pipeline_runs (id, job, season, mode, as_of, started_at, status, round, model_version)
      values ('run-tue', 'predict', 2027, 'live', now(), now(), 'ok', 1, '2027.1'),
             ('run-wed', 'refresh', 2027, 'live', now(), now(), 'ok', 1, '2027.1'),
             ('run-sat', 'refresh', 2027, 'live', now(), now(), 'ok', 1, '2027.1');
  `);
}

async function rows<T>(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

describe("the views the website reads", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
    await seedModel(db);
    await db.exec(`
      insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score) values
        (1, 2027, 1, '2027-03-06 08:00+00', 'Storm', 'Broncos', 'final', 24, 16),
        (2, 2027, 1, '2027-03-07 06:00+00', 'Eels', 'Panthers', 'final', 18, 18),
        (3, 2027, 2, '2027-03-13 08:00+00', 'Roosters', 'Rabbitohs', 'final', 10, 30);
      -- Game 1: Tuesday's prediction, a Wednesday refresh, and one made after kickoff (ignored).
      insert into predictions (run_id, match_id, created_at, model_version, model, home_win_prob, margin, total, home_score, away_score) values
        ('run-tue', 1, '2027-03-02 07:15+00', '2027.1', 'with odds', 0.60, 4, 40, 22, 18),
        ('run-wed', 1, '2027-03-03 23:15+00', '2027.1', 'with odds', 0.65, 6, 42, 24, 18),
        ('run-sat', 1, '2027-03-06 09:00+00', '2027.1', 'with odds', 0.99, 30, 50, 40, 10),
        ('run-tue', 2, '2027-03-02 07:15+00', '2027.1', 'no odds', 0.45, -2, 38, 18, 20);

      -- Game 1 has the sheet (opening and reliable closing) and live snapshots: the sheet wins.
      insert into odds_sheet (match_id, bookmaker, home_odds_open, away_odds_open, home_line_open, total_open,
                              home_odds_close, away_odds_close, home_line_close, total_close, close_ok)
        values (1, 'BlueBet', 1.5, 2.6, -6.5, 44.5, 1.4, 2.9, -8.5, 42.5, true);
      -- Game 2: live only. The first snapshot opens, the last before kickoff closes; a snapshot
      -- without a head-to-head price and one after kickoff don't count.
      insert into odds_snapshots (match_id, bookmaker, captured_at, home_odds, away_odds, home_line, total) values
        (1, 'betr_au', '2027-03-01 11:15+00', 1.6, 2.4, -4.5, 46.5),
        (2, 'betr_au', '2027-03-01 11:15+00', null, null, 1.5, 40.5),
        (2, 'betr_au', '2027-03-02 00:15+00', 2.1, 1.8, 2.5, 41.5),
        (2, 'betr_au', '2027-03-05 05:15+00', 2.3, 1.65, 3.5, 40.5),
        (2, 'betr_au', '2027-03-07 06:30+00', 5.0, 1.15, 12.5, 38.5);
    `);
  });

  it("prediction_of_record is the latest prediction before kickoff", async () => {
    const got = await rows<{ match_id: number; run_id: string; home_win_prob: number }>(
      db,
      "select match_id, run_id, home_win_prob from prediction_of_record order by match_id",
    );
    expect(got.map((r) => [Number(r.match_id), r.run_id, r.home_win_prob])).toEqual([
      [1, "run-wed", 0.65],
      [2, "run-tue", 0.45],
    ]);
  });

  it("match_odds opens on the sheet's price when it has the game, else the first live snapshot", async () => {
    const got = await rows<Record<string, unknown>>(db, "select * from match_odds_probs order by match_id");
    const [one, two] = got;
    expect(one).toMatchObject({ bookmaker: "BlueBet", open_source: "sheet", home_odds_open: 1.5, open_line: -6.5, open_total: 44.5,
                                close_source: "sheet", home_odds_close: 1.4, close_line: -8.5, close_total: 42.5 });
    expect(two).toMatchObject({ bookmaker: "betr_au", open_source: "live", home_odds_open: 2.1, away_odds_open: 1.8, open_line: 2.5,
                                close_source: "live", home_odds_close: 2.3, close_line: 3.5, close_total: 40.5 });
    expect(two.p_open as number).toBeCloseTo(1 / 2.1 / (1 / 2.1 + 1 / 1.8), 12);
    expect(got).toHaveLength(2); // game 3 has no prices
  });

  it("model_accuracy adds up the graded games per round and per season, as grade.metrics", async () => {
    // Round 1: a home win (tipped) and a draw (a home loss for log loss, a correct tip for both
    // teams). Round 2: an away win the model got wrong.
    const games = [
      { id: 1, p: 0.65, margin: 6, total: 42, pOpen: 0.62, pClose: 0.66, closeOk: true, elo: 0.58, m: 8, t: 40 },
      { id: 2, p: 0.45, margin: -2, total: 38, pOpen: 0.47, pClose: 0.42, closeOk: false, elo: 0.51, m: 0, t: 36 },
      { id: 3, p: 0.7, margin: 8, total: 44, pOpen: null, pClose: null, closeOk: false, elo: 0.6, m: -20, t: 40 },
    ];
    for (const g of games) {
      await db.query(
        `insert into graded_games (match_id, run_id, model_version, home_win_prob, margin, total, p_open, open_line, open_total,
                                   p_close, close_ok, elo_prob, margin_actual, total_actual, tip_correct)
         values ($1, 'run-tue', '2027.1', $2, $3, $4, $5, -4.5, 44.5, $6, $7, $8, $9, $10, $11)`,
        [g.id, g.p, g.margin, g.total, g.pOpen, g.pClose, g.closeOk, g.elo, g.m, g.t, g.m === 0 || (g.p >= 0.5) === g.m > 0],
      );
    }
    const got = await rows<{ round: number | null; source: string; games: number; tips: number; accuracy: number; log_loss: number; brier: number; margin_mae: number | null; total_mae: number | null }>(
      db,
      "select * from model_accuracy where season = 2027",
    );
    const find = (round: number | null, source: string) => got.find((r) => r.round === round && r.source === source)!;
    const ll = (ps: [number, number][]) => -ps.reduce((s, [p, y]) => s + (y ? Math.log(p) : Math.log(1 - p)), 0) / ps.length;

    const r1 = find(1, "model");
    expect(r1).toMatchObject({ games: 2, tips: 2 });
    expect(r1.accuracy).toBeCloseTo(1, 12); // 0.65 home win: right; 0.45 on a draw (a home loss): right
    expect(r1.log_loss).toBeCloseTo(ll([[0.65, 1], [0.45, 0]]), 12);
    expect(r1.brier).toBeCloseTo((0.35 ** 2 + 0.45 ** 2) / 2, 12);
    expect(r1.margin_mae).toBeCloseTo((2 + 2) / 2, 12);
    expect(r1.total_mae).toBeCloseTo((2 + 2) / 2, 12);

    const season = find(null, "model");
    expect(season).toMatchObject({ games: 3, tips: 2 });
    expect(season.log_loss).toBeCloseTo(ll([[0.65, 1], [0.45, 0], [0.7, 0]]), 12);

    // The closing market only where its price is reliable; the opening market where it has one.
    expect(find(null, "market_close")).toMatchObject({ games: 1 });
    expect(find(null, "market_open")).toMatchObject({ games: 2 });
    expect(find(null, "market_open").margin_mae).toBeCloseTo((Math.abs(4.5 - 8) + Math.abs(4.5 - 0)) / 2, 12);
    expect(find(null, "elo")).toMatchObject({ games: 3, margin_mae: null });
  });

  it("only takes teams it knows", async () => {
    await expect(
      db.exec("insert into matches (id, season, round, kickoff, home_team, away_team) values (9, 2027, 1, now(), 'Bears', 'Storm')"),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("invites and joining", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
    await db.exec(`
      insert into auth.users (id) values ('${admin}'), ('${amy}'), ('${ben}'), ('${cat}');
      insert into profiles (id, display_name, is_admin) values ('${admin}', 'Sully', true);
      insert into invites (code, created_by, expires_at, cancelled_at) values
        ('MATES27', '${admin}', now() + interval '5 days', null),
        ('SECOND27', '${admin}', now() + interval '5 days', null),
        ('OLD26', '${admin}', now() - interval '1 day', null),
        ('NOPE27', '${admin}', now() + interval '5 days', now());
    `);
  });

  const check = (code: string) =>
    as(db, null, async () => (await db.query<{ status: string; invited_by: string | null }>("select * from check_invite($1)", [code])).rows[0]);

  it("tells the join page a code's status and who sent it, before sign-in", async () => {
    expect(await check("mates27")).toEqual({ status: "valid", invited_by: "Sully" });
    expect(await check("OLD26")).toEqual({ status: "expired", invited_by: "Sully" });
    expect(await check("NOPE27")).toEqual({ status: "unknown", invited_by: null });
    expect(await check("WHAT")).toEqual({ status: "unknown", invited_by: null });
  });

  it("joins with a valid invite: the profile is made and the invite used, together", async () => {
    await as(db, amy, () => db.query("select join_comp('MATES27', 'Amy', 'Storm', 'crowd')"));
    const [p] = await rows<{ display_name: string; fav_team: string; auto_tip: string; is_admin: boolean }>(db, "select * from profiles where id = $1", [amy]);
    expect(p).toMatchObject({ display_name: "Amy", fav_team: "Storm", auto_tip: "crowd", is_admin: false });
    expect(await check("MATES27")).toEqual({ status: "used", invited_by: "Sully" });
  });

  it("refuses a used, expired or cancelled invite, a second join, and anyone signed out", async () => {
    await expect(as(db, ben, () => db.query("select join_comp('MATES27', 'Ben', null, null)"))).rejects.toThrow(/already used/);
    await expect(as(db, ben, () => db.query("select join_comp('OLD26', 'Ben', null, null)"))).rejects.toThrow(/expired/);
    await expect(as(db, ben, () => db.query("select join_comp('NOPE27', 'Ben', null, null)"))).rejects.toThrow(/unknown invite/);
    await expect(as(db, amy, () => db.query("select join_comp('SECOND27', 'Amy again', null, null)"))).rejects.toThrow(/already in the comp/);
    await expect(as(db, null, () => db.query("select join_comp('SECOND27', 'Nobody', null, null)"))).rejects.toThrow(/permission denied/);
  });

  it("makes joining the only way in: nobody can insert their own profile", async () => {
    await expect(as(db, ben, () => db.query("insert into profiles (id, display_name) values ($1, 'Ben')", [ben]))).rejects.toThrow(/permission denied/);
  });

  it("lets only the admin see, make and cancel invites", async () => {
    expect(await as(db, amy, () => rows(db, "select code from invites"))).toEqual([]);
    await expect(as(db, amy, () => db.query("insert into invites (created_by) values ($1)", [amy]))).rejects.toThrow(/row-level security/);
    const [made] = await as(db, admin, () => rows<{ code: string; expires_at: Date }>(db, "insert into invites (created_by) values ($1) returning code, expires_at", [admin]));
    expect(made.code).toMatch(/^[0-9A-F]{8}$/);
    await as(db, admin, () => db.query("update invites set cancelled_at = now() where code = $1", [made.code]));
    expect(await check(made.code)).toEqual({ status: "unknown", invited_by: null });
    await expect(as(db, admin, () => db.query("update invites set used_by = $1 where code = 'SECOND27'", [admin]))).rejects.toThrow(/permission denied/);
  });
});

describe("who can read and write the model's data", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
    await seedModel(db);
    await db.exec(`
      insert into auth.users (id) values ('${admin}'), ('${amy}');
      insert into profiles (id, display_name, is_admin) values ('${admin}', 'Sully', true), ('${amy}', 'Amy', false);
      insert into matches (id, season, round, kickoff, home_team, away_team) values (1, 2027, 1, now() + interval '2 days', 'Storm', 'Broncos');
      insert into predictions (run_id, match_id, created_at, model_version, model, home_win_prob, margin, total, home_score, away_score)
        values ('run-tue', 1, now(), '2027.1', 'with odds', 0.6, 4, 40, 22, 18);
      insert into tips (user_id, match_id, team) values ('${amy}', 1, 'Storm');
      insert into summaries (kind, season, round, match_id, body, llm_model, prompt_version)
        values ('match_preview', 2027, 1, 1, 'Storm at home.', 'claude-sonnet-5-5', 'preview-v1');
    `);
  });

  it("lets anyone read predictions, the views and summaries, signed in or not", async () => {
    for (const who of [null, amy]) {
      await as(db, who, async () => {
        expect(await rows(db, "select * from prediction_of_record")).toHaveLength(1);
        expect(await rows(db, "select * from match_odds_probs")).toHaveLength(0);
        expect(await rows(db, "select * from model_accuracy")).toHaveLength(0);
        expect(await rows(db, "select body from summaries")).toEqual([{ body: "Storm at home." }]);
        expect(await rows(db, "select name from teams")).toHaveLength(17);
      });
    }
  });

  it("lets nobody but the pipeline write model data", async () => {
    for (const who of [null, amy, admin]) {
      await expect(
        as(db, who, () => db.query("update predictions set home_win_prob = 0.99")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(db, who, () => db.query("insert into summaries (kind, season, body, llm_model, prompt_version) values ('round_recap', 2027, 'x', 'm', 'v')")),
      ).rejects.toThrow(/permission denied/);
      await expect(as(db, who, () => db.query("update matches set home_score = 99"))).rejects.toThrow(/permission denied/);
    }
  });

  it("shows the run log only to the admin", async () => {
    await expect(as(db, null, () => db.query("select * from pipeline_runs"))).rejects.toThrow(/permission denied/);
    expect(await as(db, amy, () => rows(db, "select id from pipeline_runs"))).toEqual([]);
    expect(await as(db, admin, () => rows(db, "select id from pipeline_runs"))).toHaveLength(3);
  });

  it("gives the agents' analyst role the model's data and nothing about the tippers", async () => {
    const analyst = { role: "analyst" };
    await as(db, analyst, async () => {
      expect(await rows(db, "select * from prediction_of_record")).toHaveLength(1);
      expect(await rows(db, "select * from matches")).toHaveLength(1);
      expect(await rows(db, "select * from model_versions")).toHaveLength(1);
    });
    for (const table of ["tips", "profiles", "invites", "pipeline_runs", "effective_tips", "round_scores"]) {
      await expect(as(db, analyst, () => db.query(`select * from ${table}`))).rejects.toThrow(/permission denied/);
    }
    await expect(as(db, analyst, () => db.query("update predictions set margin = 0"))).rejects.toThrow(/permission denied/);
  });
});

describe("postponed games in the tipping scores", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
    await db.exec(`
      insert into auth.users (id) values ('${amy}');
      insert into profiles (id, display_name) values ('${amy}', 'Amy');
      insert into matches (id, season, round, kickoff, home_team, away_team, status, home_score, away_score) values
        (1, 2027, 3, now() - interval '3 days', 'Storm', 'Broncos', 'final', 24, 16),
        (2, 2027, 3, now() - interval '2 days', 'Eels', 'Panthers', 'postponed', null, null);
      insert into tips (user_id, match_id, team) values ('${amy}', 1, 'Storm'), ('${amy}', 2, 'Eels');
    `);
  });

  const round3 = () =>
    as(db, amy, () => rows<{ correct: number; games: number; partial: boolean }>(db, "select correct, games, partial from round_scores where round = 3"));

  it("leaves a postponed game out of the scores, and keeps the round open, until it's played", async () => {
    expect(await round3()).toEqual([{ correct: 1, games: 1, partial: true }]);
  });

  it("scores it in its own round once it's played at the new time", async () => {
    await db.exec("update matches set kickoff = now() - interval '1 hour', status = 'final', home_score = 20, away_score = 12 where id = 2");
    expect(await round3()).toEqual([{ correct: 2, games: 2, partial: false }]);
  });
});
