// Row shapes mirror the planned Supabase tables and views (PLAN_WEB.md §2),
// so the sample data can be swapped for real queries without touching pages.

import type { AutoTip } from "./rules";
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
  /** Chosen when joining; shown as a badge on the ladder. */
  favTeam?: TeamName;
  /** Fills untipped games at lockout. The Model never needs one. */
  autoTip?: AutoTip;
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

/** A past round with its tips and the ladder going into it (sample archive). */
export type ArchivedRound = {
  data: RoundData;
  tips: Tip[];
};

export type ListedPlayer = {
  n: number;
  name: string;
  position: string;
  /** Not in Tuesday's 1-17. */
  isIn?: boolean;
};

/** Everything the match page shows beyond the round row. */
export type MatchDetail = {
  matchId: string;
  /** The independent model, trained without betting odds. */
  noOddsHomeProb: number | null;
  /** Bookies' opening price, overround removed. */
  marketHomeProb: number | null;
  eloHomeProb: number | null;
  /** Tuesday's 1-17, then the players who took the field (ins marked) and who dropped out. */
  lists: Record<"home" | "away", { tuesday: ListedPlayer[]; players: ListedPlayer[]; out: string[] }>;
  headToHead: {
    matchId: string;
    season: number;
    roundTitle: string;
    home: TeamName;
    away: TeamName;
    venue: string;
    homeScore: number;
    awayScore: number;
  }[];
};

/** A completed round for the ladder: games with results, everyone's tips and featured-game margins. */
export type SeasonRound = {
  round: number;
  featuredMatchId: string;
  games: {
    matchId: string;
    kickoff: string;
    home: TeamName;
    away: TeamName;
    homeScore: number;
    awayScore: number;
    modelHomeProb: number;
    modelMargin: number;
  }[];
  tips: Tip[];
  /** Each tipper's predicted winning margin for the featured game. */
  margins: { tipperId: string; team: TeamName; margin: number }[];
};

/** One game on the Model vs market page: the no-odds Model against the bookies' prices. */
export type OddsGame = {
  matchId: string;
  kickoff: string;
  home: TeamName;
  away: TeamName;
  venue: string;
  homeScore: number;
  awayScore: number;
  /** The no-odds Model: independent of the bookies. */
  modelHomeProb: number;
  modelMargin: number | null;
  modelTotal: number | null;
  /** Bookies' prices with the margin removed; closing is null where the sheet's closing figures are unreliable. */
  openHomeProb: number | null;
  closeHomeProb: number | null;
  /** Handicap on the home team (negative = home favoured). */
  openLine: number | null;
  closeLine: number | null;
  openTotal: number | null;
  closeTotal: number | null;
  bookmaker: string | null;
};

export type OddsRound = { round: number; games: OddsGame[] };

/** A 2026 test-season game for the season scoreboard. homeWin: 1, 0, or 0.5 for a draw. */
export type SeasonGame = {
  matchId: string;
  round: string;
  kickoff: string;
  home: TeamName;
  away: TeamName;
  homeWin: number | null;
  model: number;
  market: number | null;
  elo: number | null;
};

export type SeasonBet = { matchId: string; side: "home" | "away"; odds: number; won: boolean; profit: number };
