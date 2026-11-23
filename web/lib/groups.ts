// Tipping groups (docs/superpowers/specs/2026-11-24-tipping-groups-design.md): a friend circle's
// view of the comp. Everyone is in the global comp; a group keeps the ladder, last man standing and
// the Dally M to its members. The rules live in SQL (supabase/migrations/20261124000000_groups.sql);
// this is the browser's side: the store pages call, and which group a page shows.
//
// Which group a page shows is the `fc-group` cookie (a group's id, or "global"), so server pages can
// read it; `?group=` overrides it for a shared link. Server helpers are in lib/groups-server.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { browserClient, tippingLive } from "./supabase";
import { MODEL_ID, tippers as sampleTippers, YOU_ID } from "./sample";

export type GroupMember = { id: string; name: string; joinedAt: string };

export type Group = { id: string; name: string; code: string; owner: string | null; members: GroupMember[] };

export const GROUP_COOKIE = "fc-group";

/** What a page's switcher needs: the viewer's groups and the one shown (null: the global comp). */
export type GroupChoice = { options: { id: string; name: string }[]; current: { id: string; name: string } | null };
export const GLOBAL = "global";
export const MAX_GROUPS = 10;

/** A year, so the choice outlives the session. */
export const groupCookie = (value: string) => `${GROUP_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
/** No choice saved: pages show the group joined most recently. */
export const CLEAR_GROUP_COOKIE = `${GROUP_COOKIE}=; path=/; max-age=0; samesite=lax`;

/**
 * The group a page shows: the one asked for (null for "global"); with nothing asked for, the group
 * the viewer joined most recently; global otherwise. A group the viewer is no longer in (deleted, or
 * they were removed) falls back to global rather than failing.
 */
export function pickGroup(groups: Group[], wanted: string | undefined, you: string): Group | null {
  if (wanted === GLOBAL) return null;
  if (wanted) return groups.find((g) => g.id === wanted) ?? null;
  const joined = (g: Group) => g.members.find((m) => m.id === you)?.joinedAt ?? "";
  return [...groups].sort((a, b) => joined(b).localeCompare(joined(a)))[0] ?? null;
}

/** A group's name problem in the site's words, or null (the database checks it too). */
export function groupNameProblem(name: string): string | null {
  const n = name.trim();
  if (!n) return "Give it a name.";
  if (n.length > 30) return "30 letters at most.";
  return null;
}

export const joinLink = (origin: string, code: string) => `${origin}/groups/join/${code}`;

export interface GroupStore {
  /** The viewer's groups, with their members. */
  list(): Promise<Group[]>;
  create(name: string): Promise<string>;
  /** Joins by code and returns the group's id. Joining a group you're in does nothing. */
  join(code: string): Promise<string>;
  leave(id: string): Promise<void>;
  /** Owner only. */
  remove(id: string, userId: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  resetCode(id: string): Promise<string>;
  deleteGroup(id: string): Promise<void>;
  /** What the joining page shows: the name and member count, or null for a code that doesn't work. */
  check(code: string): Promise<{ name: string; members: number } | null>;
}

/** The database's refusals in the site's words. */
export function groupProblem(message: string): string {
  if (message.includes("1 to 30 characters")) return "A group name is 1 to 30 letters.";
  if (message.includes("at most")) return `You can be in ${MAX_GROUPS} groups at most. Leave one first.`;
  if (message.includes("unknown group")) return "That group link doesn’t work. Ask for a fresh one.";
  if (message.includes("join the comp first")) return "Make your profile first.";
  if (message.includes("sign in first")) return "Sign in first.";
  if (message.includes("owner")) return "Only the group’s owner can do that.";
  if (message.includes("leave the group instead")) return "That’s you: leave the group instead.";
  return "Couldn’t do that. Try again.";
}

// ---------- Live: Supabase ----------

type MemberRow = { group_id: string; user_id: string; joined_at: string; profiles: { display_name: string } | null };

/** The groups a signed-in tipper is in, with their members (row-level security shows only theirs). */
export async function readGroups(sb: SupabaseClient): Promise<Group[]> {
  const [groups, members] = await Promise.all([
    sb.from("groups").select("id, name, code, owner").order("created_at"),
    sb.from("group_members").select("group_id, user_id, joined_at, profiles(display_name)").order("joined_at"),
  ]);
  if (groups.error) throw groups.error;
  if (members.error) throw members.error;
  const rows = (members.data ?? []) as unknown as MemberRow[];
  return (groups.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    owner: g.owner,
    members: rows
      .filter((m) => m.group_id === g.id)
      .map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "?", joinedAt: m.joined_at })),
  }));
}

export class SupabaseGroupStore implements GroupStore {
  constructor(private readonly sb: SupabaseClient = browserClient()) {}

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(groupProblem(error.message));
    return data as T;
  }

  list() {
    return readGroups(this.sb);
  }
  create(name: string) {
    return this.call<string>("create_group", { p_name: name });
  }
  join(code: string) {
    return this.call<string>("join_group", { p_code: code });
  }
  async leave(id: string) {
    await this.call("leave_group", { p_group: id });
  }
  async remove(id: string, userId: string) {
    await this.call("remove_member", { p_group: id, p_user: userId });
  }
  async rename(id: string, name: string) {
    await this.call("rename_group", { p_group: id, p_name: name });
  }
  resetCode(id: string) {
    return this.call<string>("reset_group_code", { p_group: id });
  }
  async deleteGroup(id: string) {
    await this.call("delete_group", { p_group: id });
  }
  async check(code: string) {
    const rows = await this.call<{ name: string; members: number }[]>("check_group", { p_code: code });
    return rows[0] ?? null;
  }
}

// ---------- Sample: two made-up groups over the sample tippers, kept in this browser ----------

const nameOf = (id: string) => sampleTippers.find((t) => t.id === id)?.name ?? id;
const member = (id: string, joinedAt: string): GroupMember => ({ id, name: nameOf(id), joinedAt });

/** The sample's groups: what the sample ladder and last man standing filter by (fixed, server side). */
export const SAMPLE_GROUPS: Group[] = [
  {
    id: "sample-boys", name: "The boys", code: "BOYS2026", owner: YOU_ID,
    members: [member(YOU_ID, "2026-02-01T00:00:00Z"), member("mick", "2026-02-02T00:00:00Z"), member("dazza", "2026-02-03T00:00:00Z")],
  },
  {
    id: "sample-work", name: "Work", code: "WORK2026", owner: "tom",
    members: [member("tom", "2026-01-20T00:00:00Z"), member("jacko", "2026-01-21T00:00:00Z"), member(YOU_ID, "2026-01-25T00:00:00Z")],
  },
];
export const SAMPLE_MODEL_ID = MODEL_ID;

const KEY = "rlt:groups";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The sample's store: changes stay in this browser (the sample pages keep to SAMPLE_GROUPS). */
export class BrowserGroupStore implements GroupStore {
  constructor(private readonly given?: Pick<Storage, "getItem" | "setItem">) {}

  /** Looked up when used, not when made: pages make the store while rendering on the server too. */
  private get storage() {
    return this.given ?? window.localStorage;
  }

  private read(): Group[] {
    try {
      const raw = this.storage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Group[]) : SAMPLE_GROUPS;
    } catch {
      return SAMPLE_GROUPS;
    }
  }
  private write(groups: Group[]) {
    this.storage.setItem(KEY, JSON.stringify(groups));
  }
  private mine() {
    return this.read().filter((g) => g.members.some((m) => m.id === YOU_ID));
  }
  private owned(id: string) {
    const all = this.read();
    const g = all.find((x) => x.id === id);
    if (!g || g.owner !== YOU_ID) throw new Error("Only the group’s owner can do that.");
    return { all, g };
  }

  async list() {
    return this.mine();
  }
  async create(name: string) {
    const problem = groupNameProblem(name);
    if (problem) throw new Error(problem);
    if (this.mine().length >= MAX_GROUPS) throw new Error(groupProblem("at most"));
    const id = `sample-${Date.now().toString(36)}`;
    const code = Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    this.write([...this.read(), { id, name: name.trim(), code, owner: YOU_ID, members: [member(YOU_ID, new Date().toISOString())] }]);
    return id;
  }
  async join(code: string) {
    const all = this.read();
    const g = all.find((x) => x.code === code.trim().toUpperCase());
    if (!g) throw new Error(groupProblem("unknown group"));
    if (!g.members.some((m) => m.id === YOU_ID)) {
      if (this.mine().length >= MAX_GROUPS) throw new Error(groupProblem("at most"));
      g.members.push(member(YOU_ID, new Date().toISOString()));
      this.write(all);
    }
    return g.id;
  }
  async leave(id: string) {
    const all = this.read();
    const g = all.find((x) => x.id === id);
    if (!g) return;
    g.members = g.members.filter((m) => m.id !== YOU_ID);
    if (g.owner === YOU_ID) g.owner = [...g.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]?.id ?? null;
    this.write(g.members.length ? all : all.filter((x) => x.id !== id));
  }
  async remove(id: string, userId: string) {
    const { all, g } = this.owned(id);
    if (userId === YOU_ID) throw new Error(groupProblem("leave the group instead"));
    g.members = g.members.filter((m) => m.id !== userId);
    this.write(all);
  }
  async rename(id: string, name: string) {
    const problem = groupNameProblem(name);
    if (problem) throw new Error(problem);
    const { all, g } = this.owned(id);
    g.name = name.trim();
    this.write(all);
  }
  async resetCode(id: string) {
    const { all, g } = this.owned(id);
    g.code = Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    this.write(all);
    return g.code;
  }
  async deleteGroup(id: string) {
    const { all } = this.owned(id);
    this.write(all.filter((x) => x.id !== id));
  }
  async check(code: string) {
    const g = this.read().find((x) => x.code === code.trim().toUpperCase());
    return g ? { name: g.name, members: g.members.length } : null;
  }
}

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createGroupStore(): GroupStore {
  return tippingLive ? new SupabaseGroupStore() : new BrowserGroupStore();
}
