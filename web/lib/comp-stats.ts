// The ladder page's extras, worked out from a scored ladder and every tip on every decided game:
// bragging rights and the trash-talk tags. The sample comp (./ladder) and the live one (./comp)
// both build these inputs, so the page reads the same either way.

import type { LadderEntry } from "./scoring";
import type { TeamName } from "./teams";
import type { Tipper } from "./types";

/** A decided game, in kickoff order, with each tipper's tip (their own, or their auto-tip). */
export type StatGame = {
  round: number;
  home: TeamName;
  away: TeamName;
  /** Both teams for a draw or a cancelled game. */
  winners: TeamName[];
  modelHomeProb: number;
  tips: Record<string, { team: TeamName; auto: boolean }>;
};

export type SeasonStats = {
  perfectRounds: { tipper: Tipper; rounds: number[] }[];
  longestStreak: { tipper: Tipper; length: number; endedRound: number | null }[];
  biggestUpset?: { tipper: Tipper; team: TeamName; opponent: TeamName; round: number; modelChance: number };
};

/** Bragging rights among the tippers (the Model is left out: it tips the favourite). */
export function seasonStats(entries: LadderEntry[], games: StatGame[]): SeasonStats {
  const humans = entries.filter((e) => !e.tipper.isModel).map((e) => e.tipper);

  const perfectRounds = entries
    .filter((e) => !e.tipper.isModel)
    .map((e) => ({
      tipper: e.tipper,
      rounds: e.rounds.filter((s) => !s.partial && s.games > 0 && s.correct === s.games && s.autoTips === 0).map((s) => s.round),
    }))
    .filter((x) => x.rounds.length > 0);

  const longestStreak = humans
    .map((tipper) => {
      let run = 0;
      let best = { length: 0, endedRound: null as number | null };
      for (const g of games) {
        const tip = g.tips[tipper.id];
        if (!tip) continue;
        if (g.winners.includes(tip.team)) {
          run += 1;
          if (run > best.length) best = { length: run, endedRound: null };
        } else {
          if (run > 0 && run === best.length && best.endedRound === null) best.endedRound = g.round;
          run = 0;
        }
      }
      return { tipper, ...best };
    })
    .sort((a, b) => b.length - a.length);

  let biggestUpset: SeasonStats["biggestUpset"];
  for (const g of games) {
    if (g.winners.length > 1) continue;
    for (const tipper of humans) {
      const tip = g.tips[tipper.id];
      if (!tip || tip.auto || !g.winners.includes(tip.team)) continue;
      const chance = tip.team === g.home ? g.modelHomeProb : 1 - g.modelHomeProb;
      if (!biggestUpset || chance < biggestUpset.modelChance) {
        biggestUpset = { tipper, team: tip.team, opponent: tip.team === g.home ? g.away : g.home, round: g.round, modelChance: chance };
      }
    }
  }
  return { perfectRounds, longestStreak, biggestUpset };
}

/* ---------- Trash-talk tags (the ladder is one of the four places banter is allowed) ---------- */

/**
 * At most one tag each, from the results. Each tipper takes their most specific
 * tag that nobody higher up already has, so the same line doesn't repeat down the table.
 * With fewer than three tippers there's no field to talk about, so no tags.
 */
export function tagsFor(entries: LadderEntry[]): Map<string, string> {
  const humans = entries.filter((e) => !e.tipper.isModel);
  const model = entries.find((e) => e.tipper.isModel);
  const out = new Map<string, string>();
  if (humans.length < 3) return out;
  const last = humans.at(-1)!;
  const secondLast = humans.at(-2);
  const latest = humans[0]?.rounds.at(-1);
  const roundBest = (e: LadderEntry) => {
    const s = e.rounds.at(-1);
    return s ? s.correct + s.bonus : 0;
  };
  const best = Math.max(...humans.map(roundBest));
  const soleWinner = latest && !latest.partial && humans.filter((e) => roundBest(e) === best).length === 1;

  const candidates = (e: LadderEntry): string[] => {
    const tags: string[] = [];
    if (e === last) tags.push("Wooden spoon");
    if (e.position === 1 && !humans.some((x) => x !== e && x.position === 1)) tags.push("Top dog");
    if (soleWinner && roundBest(e) === best) tags.push(`Won round ${latest!.round}`);
    if (e === secondLast && e.points - last.points <= 3) tags.push("Wooden spoon watch");
    if ((e.movement ?? 0) >= 2) tags.push("Climbing");
    if ((e.movement ?? 0) <= -2) tags.push("Sliding");
    if (model && e.points > model.points) tags.push("Clear of the Model");
    if (model && e.points < model.points) tags.push("Behind a spreadsheet");
    return tags;
  };

  const used = new Set<string>();
  for (const e of humans) {
    const tag = candidates(e).find((t) => !used.has(t));
    if (tag) {
      used.add(tag);
      out.set(e.tipper.id, tag);
    }
  }
  return out;
}
