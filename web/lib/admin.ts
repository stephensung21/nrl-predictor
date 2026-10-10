// The comp owner's tools: invites, tippers, the margin game and the pipeline's run
// log. Pages talk only to the AdminStore interface; the browser mock used for the
// sample can be swapped for Supabase (the `invites`, `profiles` (admin flag),
// `rounds` and `pipeline_runs` tables, admin-only under row-level security;
// PLAN_WEB.md §2) by changing `createAdminStore()`. The store also owns the clock,
// so statuses like "expired" are judged against real time once it's live.

import { round10, SAMPLE_NOW, tippers, tips, YOU_ID, YOUR_EARLY_TIP_COUNT } from "./sample";
import { NEXT_ROUND, SEASON_ROUNDS } from "./sample-archive";
import { INVITE_DAYS, readInvites, SAMPLE_ADMIN, sampleDays, writeInvites, type AdminInvite } from "./invites";
import type { TeamName } from "./teams";

export { INVITE_DAYS, inviteStatus, type AdminInvite, type InviteStatus } from "./invites";

export type AdminTipper = { id: string; name: string; favTeam?: TeamName; joined: string; missing: number; isYou: boolean };

export type PipelineRun = {
  job: "results" | "predict" | "refresh";
  startedAt: string;
  status: "ok" | "failed" | "running";
  round: number;
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
  margin(): Promise<MarginInfo>;
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

export function createAdminStore(): AdminStore {
  return new BrowserAdminStore();
}
