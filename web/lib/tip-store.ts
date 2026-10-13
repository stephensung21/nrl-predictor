// Where the viewer's tips are saved. Pages talk only to the TipStore interface: the
// browser store for the sample, or Supabase when it's configured (the tips table, with
// lockout and hidden tips enforced by row-level security; PLAN_WEB.md §2 and §3.5).

import type { SupabaseClient } from "@supabase/supabase-js";
import { browserClient, RLS_DENIED, tippingLive } from "./supabase";
import type { TeamName } from "./teams";

export type RoundTips = {
  /** The viewer's tip per match id. */
  tips: Record<string, TeamName>;
  /** Predicted winning margin for the featured game; null when not entered (the default applies). */
  margin: number | null;
};

export interface TipStore {
  /** The viewer's saved tips for a round, or null if nothing has been saved yet. */
  load(season: number, round: number): Promise<RoundTips | null>;
  /** Saves one tip. Rejects if the game has locked or the save fails. */
  setTip(season: number, round: number, matchId: string, team: TeamName): Promise<void>;
  /** Saves several tips at once (Auto Pick), all or none. Rejects if any game has locked. */
  setTips(season: number, round: number, tips: Record<string, TeamName>): Promise<void>;
  setMargin(season: number, round: number, margin: number | null): Promise<void>;
}

export class LockedError extends Error {
  constructor() {
    super("This game has locked.");
  }
}

/** Sample store: the viewer's own browser. Nothing leaves the device. */
export class BrowserTipStore implements TipStore {
  constructor(private readonly isLocked: (matchId: string) => boolean = () => false) {}

  private key(season: number, round: number) {
    return `rlt:tips:${season}:${round}`;
  }

  async load(season: number, round: number): Promise<RoundTips | null> {
    try {
      const raw = window.localStorage.getItem(this.key(season, round));
      return raw ? (JSON.parse(raw) as RoundTips) : null;
    } catch {
      return null;
    }
  }

  private async write(season: number, round: number, change: (r: RoundTips) => RoundTips) {
    const current = (await this.load(season, round)) ?? { tips: {}, margin: null };
    // Throws in private windows or when storage is blocked; the page shows "Couldn't save".
    window.localStorage.setItem(this.key(season, round), JSON.stringify(change(current)));
  }

  async setTip(season: number, round: number, matchId: string, team: TeamName) {
    if (this.isLocked(matchId)) throw new LockedError();
    await this.write(season, round, (r) => ({ ...r, tips: { ...r.tips, [matchId]: team } }));
  }

  async setTips(season: number, round: number, tips: Record<string, TeamName>) {
    if (Object.keys(tips).some(this.isLocked)) throw new LockedError();
    await this.write(season, round, (r) => ({ ...r, tips: { ...r.tips, ...tips } }));
  }

  async setMargin(season: number, round: number, margin: number | null) {
    await this.write(season, round, (r) => ({ ...r, margin }));
  }
}

/**
 * Live store: the `tips` table. The margin game's margin is a column on that game's tip, so it
 * needs the tip first (the page asks for a team before a margin). The database decides lockout:
 * a write after kickoff is refused by row-level security and comes back as LockedError.
 */
export class SupabaseTipStore implements TipStore {
  constructor(
    private readonly isLocked: (matchId: string) => boolean = () => false,
    private readonly sb: SupabaseClient = browserClient(),
  ) {}

  private async userId() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Sign in to tip.");
    return id;
  }

  private async featured(season: number, round: number): Promise<number | null> {
    const { data, error } = await this.sb.from("rounds").select("featured_match").eq("season", season).eq("round", round).maybeSingle();
    if (error) throw error;
    return data?.featured_match ?? null;
  }

  async load(season: number, round: number): Promise<RoundTips | null> {
    const { data: s } = await this.sb.auth.getSession();
    const user = s.session?.user.id;
    if (!user) return null;
    // Only the viewer's own: everyone's tips become readable at kickoff, and those aren't "yours".
    const { data, error } = await this.sb
      .from("tips")
      .select("match_id, team, margin, matches!inner(season, round)")
      .eq("user_id", user)
      .eq("matches.season", season)
      .eq("matches.round", round);
    if (error) throw error;
    if (!data.length) return null;
    const featured = await this.featured(season, round);
    return {
      tips: Object.fromEntries(data.map((t) => [String(t.match_id), t.team as TeamName])),
      margin: data.find((t) => t.match_id === featured)?.margin ?? null,
    };
  }

  async setTip(_season: number, _round: number, matchId: string, team: TeamName) {
    if (this.isLocked(matchId)) throw new LockedError();
    const user_id = await this.userId();
    // An upsert sets only these columns, so a margin already on this tip stays.
    const { error } = await this.sb.from("tips").upsert({ user_id, match_id: Number(matchId), team }, { onConflict: "user_id,match_id" });
    if (error?.code === RLS_DENIED) throw new LockedError();
    if (error) throw error;
  }

  async setTips(_season: number, _round: number, tips: Record<string, TeamName>) {
    if (Object.keys(tips).some(this.isLocked)) throw new LockedError();
    const user_id = await this.userId();
    // One statement, so a game locking part-way refuses the lot rather than saving some.
    const rows = Object.entries(tips).map(([matchId, team]) => ({ user_id, match_id: Number(matchId), team }));
    const { error } = await this.sb.from("tips").upsert(rows, { onConflict: "user_id,match_id" });
    if (error?.code === RLS_DENIED) throw new LockedError();
    if (error) throw error;
  }

  async setMargin(season: number, round: number, margin: number | null) {
    const user = await this.userId();
    const featured = await this.featured(season, round);
    if (featured == null) throw new Error("No margin game this round.");
    if (this.isLocked(String(featured))) throw new LockedError();
    const { data, error } = await this.sb
      .from("tips").update({ margin }).eq("user_id", user).eq("match_id", featured).select("match_id");
    if (error?.code === RLS_DENIED) throw new LockedError();
    if (error) throw error;
    // Row-level security hides a locked row from an update rather than refusing it.
    if (!data.length) throw new Error("Tip the margin game before its margin.");
  }
}

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createTipStore(isLocked: (matchId: string) => boolean): TipStore {
  return tippingLive ? new SupabaseTipStore(isLocked) : new BrowserTipStore(isLocked);
}
