// The match page's question: who backs whom, and by how much. Each "voice" is
// one estimate of the home team's chance: the Model, the Model without odds,
// the bookies' opening price and Elo.

import { buildRound, type Game, type RoundView } from "./round";
import { ARCHIVE, MATCH_DETAILS } from "./sample-archive";
import { ladderBefore, round10, SAMPLE_NOW, tippers, tips } from "./sample";
import type { LadderRow, MatchDetail, RoundData, Tip } from "./types";
import type { TeamName } from "./teams";

export type VoiceId = "model" | "noOdds" | "market" | "elo";

export type Voice = {
  id: VoiceId;
  label: string;
  homeProb: number;
  backs: TeamName;
  /** Chance for the team it backs. */
  prob: number;
  /** Once the game is graded. */
  correct?: boolean;
};

export function voicesFor(game: Game, detail: MatchDetail): Voice[] {
  const { home, away } = game.match;
  const raw: [VoiceId, string, number | null][] = [
    ["model", "The Model", game.prediction.homeWinProb],
    ["noOdds", "Model without odds", detail.noOddsHomeProb],
    ["market", "Bookies’ opening price", detail.marketHomeProb],
    ["elo", "Elo", detail.eloHomeProb],
  ];
  return raw
    .filter((v): v is [VoiceId, string, number] => v[2] != null)
    .map(([id, label, homeProb]) => {
      const backs = homeProb >= 0.5 ? home : away;
      return {
        id,
        label,
        homeProb,
        backs,
        prob: homeProb >= 0.5 ? homeProb : 1 - homeProb,
        correct: game.winners ? game.winners.includes(backs) : undefined,
      };
    });
}

export type Verdict = {
  /** The voices' consensus, in display type. */
  lead: string;
  /** The dissent, shown dimmed after the lead. Absent when everyone agrees. */
  dissent?: string;
  /** Points between the Model and the bookies when they split. */
  gap?: number;
};

const the = (t: TeamName) => `the ${t}`;

/** One plain sentence: the Model first, then whoever disagrees with it. */
export function verdictFor(voices: Voice[], past: boolean): Verdict {
  const verb = (plural: boolean) => (past ? "backed" : plural ? "back" : "backs");
  const clause = (subjects: string[], team: TeamName) =>
    `${subjects.join(" and ")} ${verb(subjects.length > 1 || subjects[0] === "the bookies")} ${the(team)}.`;
  const name: Record<VoiceId, string> = { model: "the Model", noOdds: "the Model without odds", market: "the bookies", elo: "Elo" };
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  const model = voices.find((v) => v.id === "model")!;
  const market = voices.find((v) => v.id === "market");
  if (voices.every((v) => v.backs === model.backs)) return { lead: `Everyone ${verb(false)} ${the(model.backs)}.` };

  // The Model and the bookies are the headline pair; Elo and the no-odds model join a side.
  const side = (agree: boolean) =>
    voices.filter((v) => (v.backs === model.backs) === agree).map((v) => name[v.id]);
  // The no-odds model is a variant of the Model: worth a mention only when it disagrees.
  const withModel = side(true).filter((n) => n !== name.noOdds);
  const against = side(false);
  return {
    lead: cap(clause(withModel, model.backs)),
    dissent: cap(clause(against, voices.find((v) => v.backs !== model.backs)!.backs)),
    gap: market && market.backs !== model.backs ? Math.abs(Math.round((model.homeProb - market.homeProb) * 100)) : undefined,
  };
}

/* ---------- Sample lookup (until Supabase) ---------- */

type SampleRound = { data: RoundData; tips: Tip[]; ladderBefore: LadderRow[] };

/** Round 10 comes from lib/sample.ts (it carries the "Updated" notes); the rest from the archive. */
export const SAMPLE_ROUNDS: SampleRound[] = [
  ...ARCHIVE.filter((r) => r.data.round !== round10.round),
  { data: round10, tips, ladderBefore },
].sort((a, b) => a.data.round - b.data.round);

/** The current round in the sample, and the first round with no predictions yet. */
export const CURRENT_ROUND = round10.round;

/** Graded view of a sample round, as seen after its last game. */
export function sampleRoundView(r: SampleRound, now: string = SAMPLE_NOW.recap): RoundView {
  return buildRound({ data: r.data, now: new Date(now), tips: r.tips, tippers, ladderBefore: r.ladderBefore, youId: "sully" });
}

export function findSampleMatch(id: string) {
  const round = SAMPLE_ROUNDS.find((r) => r.data.matches.some((m) => m.id === id));
  const detail = MATCH_DETAILS[id];
  if (!round || !detail) return undefined;
  return { round, detail };
}
