// Row shapes mirror the planned Supabase tables and views (PLAN_WEB.md §2),
// so the sample data can be swapped for real queries without touching pages.

import type { TeamName } from "./teams";

/** `matches` */
export type Match = {
  id: string;
  season: number;
  round: number;
  kickoff: string; // UTC ISO
  home: TeamName;
  away: TeamName;
  venue: string;
  city: string;
  postponed?: boolean;
  /** Set once the results or refresh job has graded the game. */
  homeScore?: number;
  awayScore?: number;
};

/** `prediction_of_record` (the latest prediction before kickoff) */
export type Prediction = {
  matchId: string;
  homeWinProb: number;
  margin: number; // home minus away, unrounded
  total: number;
  /** Display scores from predict.display_scores: never contradict the tip. */
  homePred: number;
  awayPred: number;
  model: "with odds" | "no odds";
  modelVersion: string;
  /** Reason shown when the prediction changed since Tuesday. */
  updated?: string;
};

/** `profiles`, `tips`, `round_scores`, `ladder` for the signed-in viewer */
export type Tipper = {
  id: string;
  name: string;
  isModel?: boolean;
};

export type Tip = { tipperId: string; matchId: string; team: TeamName };

export type LadderRow = { tipperId: string; points: number; marginScore: number };

/** Model's graded season record (`model_accuracy`). */
export type ModelRecord = {
  label: string;
  games: number;
  correct: number;
  marginError: number;
  favouriteCorrect: number;
};

export type RoundData = {
  season: number;
  round: number;
  featuredMatchId: string;
  matches: Match[];
  predictions: Prediction[];
};
