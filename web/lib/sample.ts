// SAMPLE DATA. Predictions and results are the real 2026 Round 10 replay
// (reports/predictions/2026_round10_replay.csv, model 2026.1, predicted as of
// Tuesday's team lists) joined to the real scores in data/processed/matches.csv.
// The replay has no prediction for the Thursday game (Dolphins v Bulldogs), so
// the sample round has 7 games.
//
// Tippers, their tips and the ladder are invented for the sample and labelled
// as such on the page. The Model's record is the real 2026 test season
// (reports/final_2026.md, with-odds ensemble, all 213 games).

import type { LadderRow, Match, ModelRecord, Prediction, RoundData, Tip, Tipper } from "./types";
import type { TeamName } from "./teams";

const matches: Match[] = [
  { id: "20261111020", season: 2026, round: 10, kickoff: "2026-05-08T08:00:00Z", home: "Roosters", away: "Titans", venue: "Polytec Stadium", city: "Gosford", homeScore: 28, awayScore: 12 },
  { id: "20261111030", season: 2026, round: 10, kickoff: "2026-05-08T10:00:00Z", home: "Cowboys", away: "Eels", venue: "Queensland Country Bank Stadium", city: "Townsville", homeScore: 30, awayScore: 33 },
  { id: "20261111040", season: 2026, round: 10, kickoff: "2026-05-09T05:00:00Z", home: "Dragons", away: "Knights", venue: "WIN Stadium", city: "Wollongong", homeScore: 10, awayScore: 44 },
  { id: "20261111050", season: 2026, round: 10, kickoff: "2026-05-09T07:30:00Z", home: "Rabbitohs", away: "Sharks", venue: "Accor Stadium", city: "Sydney", homeScore: 36, awayScore: 12 },
  { id: "20261111060", season: 2026, round: 10, kickoff: "2026-05-09T09:35:00Z", home: "Sea Eagles", away: "Broncos", venue: "4 Pines Park", city: "Sydney", homeScore: 32, awayScore: 4 },
  { id: "20261111070", season: 2026, round: 10, kickoff: "2026-05-10T04:00:00Z", home: "Storm", away: "Wests Tigers", venue: "AAMI Park", city: "Melbourne", homeScore: 44, awayScore: 16 },
  { id: "20261111080", season: 2026, round: 10, kickoff: "2026-05-10T06:05:00Z", home: "Raiders", away: "Panthers", venue: "GIO Stadium", city: "Canberra", homeScore: 18, awayScore: 30 },
];

const p = (
  matchId: string, homeWinProb: number, margin: number, total: number,
  homePred: number, awayPred: number, updated?: string,
): Prediction => ({
  matchId, homeWinProb, margin, total, homePred, awayPred,
  model: "with odds", modelVersion: "2026.1", updated,
});

const predictions: Prediction[] = [
  p("20261111020", 0.7416, 13.61, 50.19, 32, 18),
  p("20261111030", 0.7397, 10.74, 47.32, 29, 18),
  p("20261111040", 0.4285, -3.62, 50.57, 23, 27),
  p("20261111050", 0.5453, 1.69, 50.34, 26, 24, "Team list change"),
  p("20261111060", 0.6349, 4.92, 47.87, 26, 21),
  p("20261111070", 0.6564, 6.47, 49.11, 28, 21),
  p("20261111080", 0.2471, -11.42, 47.75, 18, 30),
];

export const round10: RoundData = {
  season: 2026,
  round: 10,
  featuredMatchId: "20261111020", // default: the first game of the round
  matches,
  predictions,
};

export const MODEL_ID = "model";
export const YOU_ID = "sully";

export const tippers: Tipper[] = [
  { id: MODEL_ID, name: "the Model", isModel: true },
  { id: "mick", name: "Mick" },
  { id: "dazza", name: "Dazza" },
  { id: YOU_ID, name: "Sully" },
  { id: "jacko", name: "Jacko" },
  { id: "tom", name: "Tom" },
];

/** Ladder after Round 9 (sample). */
export const ladderBefore: LadderRow[] = [
  { tipperId: "mick", points: 52, marginScore: 61 },
  { tipperId: MODEL_ID, points: 51, marginScore: 48 },
  { tipperId: "dazza", points: 50, marginScore: 74 },
  { tipperId: YOU_ID, points: 50, marginScore: 82 },
  { tipperId: "jacko", points: 47, marginScore: 66 },
  { tipperId: "tom", points: 44, marginScore: 90 },
];

const order = matches.map((m) => m.id);
const tipsFor = (tipperId: string, teams: TeamName[]): Tip[] =>
  teams.map((team, i) => ({ tipperId, matchId: order[i], team }));

/** Round 10 tips. Winners were SYD, PAR, NEW, SOU, MAN, MEL, PEN. */
export const tips: Tip[] = [
  ...tipsFor(MODEL_ID, ["Roosters", "Cowboys", "Knights", "Rabbitohs", "Sea Eagles", "Storm", "Panthers"]),
  ...tipsFor("mick", ["Roosters", "Eels", "Knights", "Rabbitohs", "Sea Eagles", "Storm", "Panthers"]),
  ...tipsFor("dazza", ["Roosters", "Cowboys", "Knights", "Sharks", "Sea Eagles", "Storm", "Panthers"]),
  ...tipsFor(YOU_ID, ["Roosters", "Cowboys", "Knights", "Rabbitohs", "Broncos", "Storm", "Panthers"]),
  ...tipsFor("jacko", ["Titans", "Cowboys", "Knights", "Rabbitohs", "Sea Eagles", "Wests Tigers", "Panthers"]),
  ...tipsFor("tom", ["Roosters", "Cowboys", "Dragons", "Sharks", "Broncos", "Storm", "Raiders"]),
];

/** Before lockout on Tuesday night, the viewer has only tipped the first three. */
export const YOUR_EARLY_TIP_COUNT = 3;

export const modelRecord: ModelRecord = {
  label: "2026 test season",
  games: 213,
  correct: 143,
  marginError: 15.3,
  favouriteCorrect: 133,
};

/** The instants each sample state is viewed at. */
export const SAMPLE_NOW = {
  recap: "2026-05-11T02:00:00Z", // Mon 11 May, noon Sydney
  open: "2026-05-05T09:30:00Z", // Tue 5 May, 7:30pm Sydney
  live: "2026-05-09T08:20:00Z", // Sat 9 May, 6:20pm Sydney
} as const;

export const NEXT_ROUND = { round: 11, predictionsDue: "2026-05-12T07:15:00Z" };
