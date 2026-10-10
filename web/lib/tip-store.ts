// Where the viewer's tips are saved. Pages talk only to the TipStore interface,
// so the browser store used for the sample can be swapped for the Supabase one
// (tips table, row-level security, lockout enforced by the database; PLAN_WEB.md
// §2 and §3.5) by changing `tipStore` below.

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

  async setMargin(season: number, round: number, margin: number | null) {
    await this.write(season, round, (r) => ({ ...r, margin }));
  }
}

/** The store the site uses. Replace with a Supabase-backed TipStore when the backend exists. */
export function createTipStore(isLocked: (matchId: string) => boolean): TipStore {
  return new BrowserTipStore(isLocked);
}
