// The home dashboard's comps beyond the round (lib/dashboard.ts): last man standing and the Dally M,
// for the shown group, from the same sources their pages use (database or sample). Server code only.

import { openRound, rankTallies, type RankedTally } from "./dally-m";
import { lmsGlance, type LmsGlance } from "./dashboard";
import { dallyMSource, lmsSource } from "./source";

export type DallyMGlance = {
  /** The round open for votes and whether you've voted, for the to-do. */
  todo: { round: number; closes: string; voted: boolean } | null;
  /** The season's top three so far, for the shown group. */
  top: RankedTally[];
};

export async function dashboardComps(group?: string): Promise<{ lms: LmsGlance | null; dallyM: DallyMGlance | null }> {
  const [lms, dallyM] = await Promise.all([lmsPart(group), dallyMPart(group)]);
  return { lms, dallyM };
}

async function lmsPart(group?: string): Promise<LmsGlance | null> {
  try {
    const src = await lmsSource(group);
    if (src.missing || src.season == null || !src.view) return null;
    const { you, tippers, picks, fields } = src.view;
    return lmsGlance(you, tippers.map((t) => t.id), fields, src.matches, picks, src.seasonOver);
  } catch {
    return null; // a comp that can't load leaves its panel out; the rest of the page still works
  }
}

async function dallyMPart(group?: string): Promise<DallyMGlance | null> {
  try {
    const src = await dallyMSource(group);
    const season = src.seasons[0];
    if (src.missing || season == null) return null;
    const open = openRound(await src.rounds(season));
    const votes = await src.votes(season, open?.round ?? null);
    if (!votes) return null;
    return {
      todo: open ? { round: open.round, closes: open.closes, voted: votes.rows.some((r) => r.userId === votes.you && r.round === open.round) } : null,
      top: rankTallies(votes.leaderboard).slice(0, 3),
    };
  } catch {
    return null;
  }
}
