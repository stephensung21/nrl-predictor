// The comp owner's tools: invites, tippers, the margin game and the pipeline's run
// log. Pages talk only to the AdminStore interface: the browser mock for the sample, or
// Supabase when it's configured (the `invites`, `profiles` (admin flag), `rounds` and
// `pipeline_runs` tables, admin-only under row-level security; PLAN_WEB.md §2). The
// store also owns the clock, so statuses like "expired" are judged against real time live.

import { round10, SAMPLE_NOW, tippers, tips, YOU_ID, YOUR_EARLY_TIP_COUNT } from "./sample";
import { NEXT_ROUND, SEASON_ROUNDS } from "./sample-archive";
import { INVITE_DAYS, readInvites, SAMPLE_ADMIN, sampleDays, writeInvites, type AdminInvite } from "./invites";
import type { SupabaseClient } from "@supabase/supabase-js";
import { browserClient, tippingLive } from "./supabase";
import type { TeamName } from "./teams";

export { INVITE_DAYS, inviteStatus, type AdminInvite, type InviteStatus } from "./invites";

export type AdminTipper = { id: string; name: string; favTeam?: TeamName; joined: string; missing: number; isYou: boolean };

export type PipelineRun = {
  job: "results" | "predict" | "refresh" | "odds" | "backfill";
  startedAt: string;
  status: "ok" | "nothing to do" | "failed" | "running";
  round: number | null;
  modelVersion: string;
  commit: string;
  /** Games written, or the reason it stopped. */
  note: string;
};

type Fixture = { matchId: string; home: TeamName; away: TeamName; kickoff: string };

/** This round's margin game and the next round's draw, as stored in `rounds`. */
export type MarginInfo = {
  current: { round: number; game: Fixture; how: "drawn" | "first game" };
  previous: { round: number; game: Fixture } | null;
  next: {
    round: number;
    games: Fixture[];
    /** Set once the pipeline has drawn it (when the round's predictions publish). */
    drawn: Fixture | null;
    drawsAt: string;
  };
};

export interface AdminStore {
  /** The comp's clock: real time live, the sample's Tuesday in the sample. */
  now(): Date;
  isAdmin(): Promise<boolean>;
  invites(): Promise<AdminInvite[]>;
  createInvite(): Promise<AdminInvite>;
  cancelInvite(code: string): Promise<void>;
  tippers(): Promise<AdminTipper[]>;
  removeTipper(id: string): Promise<void>;
  /** Null when no round has a margin game yet (the off-season). */
  margin(): Promise<MarginInfo | null>;
  runs(): Promise<PipelineRun[]>;
}

// ---------- Sample: invented invites and runs, kept in this browser ----------

const NOW = new Date(SAMPLE_NOW.open);
const days = sampleDays;

const JOINED: Record<string, string> = { mick: days(-70), dazza: days(-69), [YOU_ID]: days(-72), jacko: days(-66), tom: days(-40) };

/** The run log for the sample week, in the shape predict.py's run records take. Newest first. */
const SAMPLE_RUNS: PipelineRun[] = [
  { job: "predict", startedAt: "2026-05-05T07:15:00Z", status: "ok", round: 10, modelVersion: "2026.1", commit: "5f02c2e", note: "7 games predicted, all with odds" },
  { job: "results", startedAt: "2026-05-04T00:05:00Z", status: "ok", round: 9, modelVersion: "2026.1", commit: "5f02c2e", note: "8 results, ladder scored" },
  { job: "refresh", startedAt: "2026-05-03T05:05:00Z", status: "failed", round: 9, modelVersion: "2026.1", commit: "5f02c2e", note: "Odds fetch timed out; nothing published, alert sent" },
  { job: "refresh", startedAt: "2026-05-02T23:05:00Z", status: "ok", round: 9, modelVersion: "2026.1", commit: "5f02c2e", note: "2 games re-predicted (team changes)" },
];

const KEY = { removed: "rlt:admin:removed" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Six characters without look-alikes (no 0/O, 1/I/L), so a code read aloud still works. */
function newCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export class BrowserAdminStore implements AdminStore {
  now() {
    return NOW;
  }

  async isAdmin() {
    return true; // the sample viewer runs the comp; live, `profiles.admin`
  }

  async invites() {
    return readInvites();
  }

  async createInvite() {
    const invite: AdminInvite = { code: newCode(), createdAt: NOW.toISOString(), expiresAt: days(INVITE_DAYS), createdBy: SAMPLE_ADMIN };
    writeInvites([invite, ...readInvites()]);
    return invite;
  }

  async cancelInvite(code: string) {
    writeInvites(readInvites().map((i) => (i.code === code ? { ...i, cancelled: true } : i)));
  }

  async tippers() {
    const removed = read<string[]>(KEY.removed, []);
    const ids = new Set(round10.matches.map((m) => m.id));
    return tippers
      .filter((t) => !t.isModel && !removed.includes(t.id))
      .map((t) => {
        // On Tuesday night the viewer has tipped only the first few games; the others are done.
        const made = tips.filter((x) => x.tipperId === t.id && ids.has(x.matchId)).length;
        const tipped = t.id === YOU_ID ? Math.min(made, YOUR_EARLY_TIP_COUNT) : made;
        return { id: t.id, name: t.name, favTeam: t.favTeam, joined: JOINED[t.id], missing: ids.size - tipped, isYou: t.id === YOU_ID };
      });
  }

  async removeTipper(id: string) {
    window.localStorage.setItem(KEY.removed, JSON.stringify([...read<string[]>(KEY.removed, []), id]));
  }

  async margin(): Promise<MarginInfo> {
    const m = round10.matches.find((x) => x.id === round10.featuredMatchId)!;
    const prevRound = SEASON_ROUNDS.at(-1)!;
    const p = prevRound.games.find((g) => g.matchId === prevRound.featuredMatchId)!;
    return {
      // The sample's Round 10 game is the round's first game: the random draw starts next round.
      current: { round: round10.round, game: { matchId: m.id, home: m.home, away: m.away, kickoff: m.kickoff }, how: "first game" },
      previous: { round: prevRound.round, game: { matchId: p.matchId, home: p.home, away: p.away, kickoff: p.kickoff } },
      // Round 11's predictions publish next Tuesday, 5:15pm Sydney: that's when its game is drawn.
      next: { round: NEXT_ROUND.round, games: NEXT_ROUND.games, drawn: null, drawsAt: "2026-05-12T07:15:00Z" },
    };
  }

  async runs() {
    return SAMPLE_RUNS;
  }
}

// ---------- Live: Supabase ----------

type FixtureRow = { id: number; home_team: TeamName; away_team: TeamName; kickoff: string };
const toFixture = (m: FixtureRow): Fixture => ({ matchId: String(m.id), home: m.home_team, away: m.away_team, kickoff: m.kickoff });

/** When the pipeline's predict job next runs (Tuesdays 07:15 UTC, .github/workflows/predict.yml). */
export function nextPredictRun(after: Date): string {
  const t = new Date(after);
  t.setUTCHours(7, 15, 0, 0);
  while (t.getUTCDay() !== 2 || t <= after) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString();
}

export class SupabaseAdminStore implements AdminStore {
  constructor(private readonly sb: SupabaseClient = browserClient()) {}

  now() {
    return new Date();
  }

  private async me() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Sign in first.");
    return id;
  }

  async isAdmin() {
    const { data: s } = await this.sb.auth.getSession();
    if (!s.session) return false;
    const { data, error } = await this.sb.rpc("is_admin");
    return !error && data === true;
  }

  private async names(): Promise<Map<string, string>> {
    const { data, error } = await this.sb.from("profiles").select("id, display_name");
    if (error) throw error;
    return new Map(data.map((p) => [p.id as string, p.display_name as string]));
  }

  async invites(): Promise<AdminInvite[]> {
    const [{ data, error }, names] = await Promise.all([
      this.sb.from("invites").select("code, created_at, expires_at, created_by, used_by, used_at, cancelled_at").order("created_at", { ascending: false }),
      this.names(),
    ]);
    if (error) throw error;
    return data.map((i) => ({
      code: i.code,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      createdBy: names.get(i.created_by) ?? "",
      // A used invite stays used after its tipper leaves the comp.
      ...(i.used_at ? { usedBy: (i.used_by && names.get(i.used_by)) || "someone who has since left" } : {}),
      ...(i.cancelled_at ? { cancelled: true } : {}),
    }));
  }

  async createInvite(): Promise<AdminInvite> {
    const created_by = await this.me();
    const { data, error } = await this.sb.from("invites").insert({ code: newCode(), created_by }).select("code, created_at, expires_at").single();
    if (error) throw error;
    const names = await this.names();
    return { code: data.code, createdAt: data.created_at, expiresAt: data.expires_at, createdBy: names.get(created_by) ?? "" };
  }

  async cancelInvite(code: string) {
    const { error } = await this.sb.from("invites").update({ cancelled_at: new Date().toISOString() }).eq("code", code);
    if (error) throw error;
  }

  async tippers(): Promise<AdminTipper[]> {
    const me = await this.me();
    // The round in play: the next game still to be played, and its round.
    const { data: next } = await this.sb
      .from("matches").select("season, round").in("status", ["scheduled", "live"]).order("kickoff").limit(1).maybeSingle();
    const [{ data: people, error }, games, counts] = await Promise.all([
      this.sb.from("profiles").select("id, display_name, fav_team, created_at").eq("is_model", false).order("display_name"),
      next
        ? this.sb.from("matches").select("id", { count: "exact", head: true }).eq("season", next.season).eq("round", next.round).neq("status", "postponed")
        : Promise.resolve({ count: 0 }),
      next ? this.sb.rpc("admin_tip_counts", { p_season: next.season, p_round: next.round }) : Promise.resolve({ data: [] }),
    ]);
    if (error) throw error;
    const tipped = new Map(((counts.data ?? []) as { user_id: string; tipped: number }[]).map((c) => [c.user_id, c.tipped]));
    return people.map((p) => ({
      id: p.id,
      name: p.display_name,
      favTeam: (p.fav_team ?? undefined) as TeamName | undefined,
      joined: p.created_at,
      missing: Math.max(0, (games.count ?? 0) - (tipped.get(p.id) ?? 0)),
      isYou: p.id === me,
    }));
  }

  async removeTipper(id: string) {
    const res = await fetch("/api/admin/tipper", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (!res.ok) throw new Error("Couldn’t remove them. Try again.");
  }

  async margin(): Promise<MarginInfo | null> {
    const { data: drawn, error } = await this.sb
      .from("rounds").select("season, round, featured_match")
      .not("featured_match", "is", null)
      .order("season", { ascending: false }).order("round", { ascending: false }).limit(2);
    if (error) throw error;
    const [cur, prev] = drawn;
    if (!cur) return null;
    const ids = [cur.featured_match, ...(prev && prev.season === cur.season && prev.round === cur.round - 1 ? [prev.featured_match] : [])];
    const cols = "id, home_team, away_team, kickoff";
    const [{ data: featured }, { data: upcoming }] = await Promise.all([
      this.sb.from("matches").select(cols).in("id", ids),
      this.sb.from("matches").select(cols).eq("season", cur.season).eq("round", cur.round + 1).order("kickoff"),
    ]);
    const game = (id: number) => toFixture((featured as FixtureRow[]).find((m) => m.id === id)!);
    return {
      current: { round: cur.round, game: game(cur.featured_match), how: "drawn" },
      previous: ids.length > 1 ? { round: prev!.round, game: game(prev!.featured_match) } : null,
      // The latest drawn round is the current one, so the next round isn't drawn yet.
      next: { round: cur.round + 1, games: ((upcoming ?? []) as FixtureRow[]).map(toFixture), drawn: null, drawsAt: nextPredictRun(new Date()) },
    };
  }

  async runs(): Promise<PipelineRun[]> {
    const { data, error } = await this.sb
      .from("pipeline_runs").select("job, started_at, status, round, games, model_version, commit, notes")
      .order("started_at", { ascending: false }).limit(4);
    if (error) throw error;
    return data.map((r) => ({
      job: r.job,
      startedAt: r.started_at,
      status: r.status,
      round: r.round,
      modelVersion: r.model_version ?? "–",
      commit: (r.commit ?? "").slice(0, 7),
      note: r.notes ?? (r.games != null ? `${r.games} games` : r.status),
    }));
  }
}

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createAdminStore(): AdminStore {
  return tippingLive ? new SupabaseAdminStore() : new BrowserAdminStore();
}
