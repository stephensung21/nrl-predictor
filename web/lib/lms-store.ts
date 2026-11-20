// Where the viewer's last man standing picks are saved. The picker talks only to the PickStore
// interface: this browser for the sample, or Supabase when it's configured (lms_picks, where
// row-level security locks a pick at its game's kickoff and hides it from others until then). The
// page reads the season's picks the viewer may see through `readPicks`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LmsPick } from "./lms";
import { browserClient, RLS_DENIED, tippingLive } from "./supabase";
import type { TeamName } from "./teams";
import { LockedError } from "./tip-store";

export type SavedPick = { matchId: string; team: TeamName };

export interface PickStore {
  /** The viewer's pick for a round, or null. */
  load(season: number, round: number): Promise<SavedPick | null>;
  /** Saves (or replaces) the viewer's pick. Rejects with LockedError once either game has kicked off. */
  save(season: number, round: number, pick: SavedPick): Promise<void>;
}

/** Sample store: the viewer's own browser. Nothing leaves the device. */
export class BrowserPickStore implements PickStore {
  constructor(private readonly isLocked: (matchId: string) => boolean = () => false) {}

  private key(season: number, round: number) {
    return `rlt:lms:${season}:${round}`;
  }

  async load(season: number, round: number): Promise<SavedPick | null> {
    try {
      const raw = window.localStorage.getItem(this.key(season, round));
      return raw ? (JSON.parse(raw) as SavedPick) : null;
    } catch {
      return null;
    }
  }

  async save(season: number, round: number, pick: SavedPick) {
    const old = await this.load(season, round);
    if (this.isLocked(pick.matchId) || (old && this.isLocked(old.matchId))) throw new LockedError();
    window.localStorage.setItem(this.key(season, round), JSON.stringify(pick));
  }
}

/** Live store: the `lms_picks` table. */
export class SupabasePickStore implements PickStore {
  constructor(private readonly sb: SupabaseClient = browserClient()) {}

  private async userId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async load(season: number, round: number): Promise<SavedPick | null> {
    const user = await this.userId();
    if (!user) return null;
    const { data, error } = await this.sb
      .from("lms_picks").select("match_id, team").eq("user_id", user).eq("season", season).eq("round", round).maybeSingle();
    if (error) throw error;
    return data ? { matchId: String(data.match_id), team: data.team as TeamName } : null;
  }

  async save(season: number, round: number, pick: SavedPick) {
    const user_id = await this.userId();
    if (!user_id) throw new Error("Sign in to pick.");
    const { error } = await this.sb
      .from("lms_picks")
      .upsert({ user_id, season, round, match_id: Number(pick.matchId), team: pick.team }, { onConflict: "user_id,season,round" });
    if (error?.code === RLS_DENIED) throw new LockedError();
    if (error) throw error;
  }
}

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createPickStore(isLocked: (matchId: string) => boolean): PickStore {
  return tippingLive ? new SupabasePickStore() : new BrowserPickStore(isLocked);
}

export type LmsTipper = { id: string; name: string; favTeam?: TeamName };

/** The tippers (not the Model) and the season's picks the signed-in tipper may see. */
export async function readPicks(sb: SupabaseClient, season: number): Promise<{ tippers: LmsTipper[]; picks: LmsPick[] }> {
  const [profiles, picks] = await Promise.all([
    sb.from("profiles").select("id, display_name, fav_team, is_model").order("created_at"),
    sb.from("lms_picks").select("user_id, round, match_id, team").eq("season", season),
  ]);
  if (profiles.error) throw profiles.error;
  if (picks.error) throw picks.error;
  return {
    tippers: (profiles.data ?? [])
      .filter((p) => !p.is_model)
      .map((p) => ({ id: p.id as string, name: p.display_name as string, favTeam: (p.fav_team ?? undefined) as TeamName | undefined })),
    picks: (picks.data ?? []).map((r) => ({ userId: r.user_id as string, round: r.round as number, matchId: String(r.match_id), team: r.team as TeamName })),
  };
}
