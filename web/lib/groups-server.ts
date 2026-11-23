// Which group a server page shows (lib/groups.ts): the viewer's groups, the one chosen by `?group=`
// or the `fc-group` cookie, and its members. Server code only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { GROUP_COOKIE, pickGroup, readGroups, SAMPLE_GROUPS, type Group } from "./groups";
import { YOU_ID } from "./sample";

export type GroupView = {
  /** The viewer's groups (empty for someone in none). */
  groups: Group[];
  /** The group shown; null is the global comp. */
  current: Group | null;
  /** The shown group's members, or null for the global comp (everyone). */
  memberIds: Set<string> | null;
};

const view = (groups: Group[], current: Group | null): GroupView => ({
  groups,
  current,
  memberIds: current ? new Set(current.members.map((m) => m.id)) : null,
});

async function wanted(param?: string) {
  if (param) return param;
  return (await cookies()).get(GROUP_COOKIE)?.value;
}

/** The signed-in tipper's group view, live. */
export async function viewerGroups(sb: SupabaseClient, you: string, param?: string): Promise<GroupView> {
  const groups = await readGroups(sb);
  return view(groups, pickGroup(groups, await wanted(param), you));
}

/** The sample's group view, over its fixed groups. */
export async function sampleGroups(param?: string): Promise<GroupView> {
  return view(SAMPLE_GROUPS, pickGroup(SAMPLE_GROUPS, await wanted(param), YOU_ID));
}
