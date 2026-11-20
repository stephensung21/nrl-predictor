// The players page (/players): each player's season (pipeline/players.py → player_seasons) with the
// Model's rating of him (player_ratings), the power rankings built from them, and the stat groups the
// stats tab shows. Stat keys are the database's column names, so rows pass straight through.

import type { TeamName } from "./teams";

export const POSITIONS = ["Fullback", "Winger", "Centre", "Five-Eighth", "Halfback", "Hooker", "Prop", "2nd Row", "Lock"] as const;
export type Position = (typeof POSITIONS)[number];

/** Short codes for the rankings table. */
export const POSITION_CODE: Record<Position | "Interchange", string> = {
  Fullback: "FB", Winger: "WG", Centre: "CE", "Five-Eighth": "5/8", Halfback: "HB", Hooker: "HK", Prop: "PR",
  "2nd Row": "2R", Lock: "LK", Interchange: "INT",
};

export const STAT_KEYS = [
  "minutes", "tries", "points", "goals", "conversions", "conversion_attempts", "penalty_goals", "field_goals",
  "run_metres", "runs", "post_contact_metres", "line_breaks", "line_break_assists", "try_assists", "tackle_breaks",
  "offloads", "kick_return_metres", "kicks", "kick_metres", "forty_twenty", "forced_drop_outs", "bomb_kicks",
  "grubber_kicks", "tackles", "missed_tackles", "ineffective_tackles", "intercepts", "one_on_one_steals", "errors",
  "penalties", "sin_bins", "send_offs", "fantasy_points",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type PlayerSeason = {
  season: number;
  id: number;
  name: string;
  team: TeamName;
  position: Position | "Interchange";
  games: number;
  /** The Model's rating: points of margin he adds over a full game. Null if he has none. */
  rating: number | null;
  attack: number | null;
  defence: number | null;
  stats: Record<StatKey, number>;
};

/** Players need this many games in the season to be ranked. */
export const MIN_GAMES = 5;
export const TOP_OVERALL = 25;
export const TOP_POSITION = 15;

export type Ranked = { rank: number; tied: boolean; player: PlayerSeason; fantasyPerGame: number };

/** The power rankings: by the Model's rating, overall or at one position; equal ratings (to the
 *  hundredth, as shown) share a rank. */
export function powerRankings(players: PlayerSeason[], position: Position | null): Ranked[] {
  const pool = players
    .filter((p) => p.rating != null && p.games >= MIN_GAMES && (position == null || p.position === position))
    .sort((a, b) => b.rating! - a.rating! || b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, position == null ? TOP_OVERALL : TOP_POSITION);
  const shown = (p: PlayerSeason) => Math.round(p.rating! * 100);
  return pool.map((player, i) => {
    const first = pool.findIndex((q) => shown(q) === shown(player));
    const tied = pool.filter((q) => shown(q) === shown(player)).length > 1;
    return { rank: first + 1, tied, player, fantasyPerGame: player.stats.fantasy_points / Math.max(1, player.games) };
  });
}

export type StatLine = { label: string; value: string; perGame?: string };
export type StatGroup = { title: string; lines: StatLine[] };

const n = (v: number) => Math.round(v).toLocaleString("en-AU");
const per = (v: number, games: number) => (games ? (v / games).toLocaleString("en-AU", { maximumFractionDigits: 1 }) : "0");

/** The stats tab's groups for one player's season. */
export function statGroups(p: PlayerSeason): StatGroup[] {
  const s = p.stats;
  const g = p.games;
  const tackleRate = s.tackles + s.missed_tackles ? Math.round((100 * s.tackles) / (s.tackles + s.missed_tackles)) : null;
  return [
    {
      title: "Scoring",
      lines: [
        { label: "Tries", value: n(s.tries) },
        { label: "Points", value: n(s.points), perGame: per(s.points, g) },
        { label: "Conversions", value: `${n(s.conversions)}/${n(s.conversion_attempts)}` },
        { label: "Penalty goals", value: n(s.penalty_goals) },
        { label: "Field goals", value: n(s.field_goals) },
      ],
    },
    {
      title: "Attack",
      lines: [
        { label: "Run metres", value: n(s.run_metres), perGame: per(s.run_metres, g) },
        { label: "Post-contact metres", value: n(s.post_contact_metres), perGame: per(s.post_contact_metres, g) },
        { label: "Line breaks", value: n(s.line_breaks) },
        { label: "Line-break assists", value: n(s.line_break_assists) },
        { label: "Try assists", value: n(s.try_assists) },
        { label: "Tackle breaks", value: n(s.tackle_breaks), perGame: per(s.tackle_breaks, g) },
        { label: "Offloads", value: n(s.offloads) },
      ],
    },
    {
      title: "Kicking",
      lines: [
        { label: "Kick metres", value: n(s.kick_metres), perGame: per(s.kick_metres, g) },
        { label: "Kicks", value: n(s.kicks) },
        { label: "40/20s", value: n(s.forty_twenty) },
        { label: "Forced drop-outs", value: n(s.forced_drop_outs) },
        { label: "Bombs", value: n(s.bomb_kicks) },
        { label: "Grubbers", value: n(s.grubber_kicks) },
      ],
    },
    {
      title: "Defence",
      lines: [
        { label: "Tackles", value: n(s.tackles), perGame: per(s.tackles, g) },
        { label: "Tackle efficiency", value: tackleRate == null ? "–" : `${tackleRate}%` },
        { label: "Missed tackles", value: n(s.missed_tackles) },
        { label: "Intercepts", value: n(s.intercepts) },
        { label: "One-on-one steals", value: n(s.one_on_one_steals) },
      ],
    },
    {
      title: "Discipline",
      lines: [
        { label: "Errors", value: n(s.errors) },
        { label: "Penalties", value: n(s.penalties) },
        { label: "Sin bins", value: n(s.sin_bins) },
        { label: "Send-offs", value: n(s.send_offs) },
      ],
    },
  ];
}

/** A rating as the page shows it: signed, two decimals, a real minus sign. */
export const formatRating = (r: number) => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}`;
