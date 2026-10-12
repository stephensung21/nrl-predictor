// The live tipping comp's ladder, for /tipping/ladder and /model. The scoring is the database's
// (`ladder()`, `round_scores` and `tip_results`, supabase/migrations/20261010000000_tipping.sql),
// read through Supabase as the signed-in tipper, so row-level security applies; `ladderView` shapes
// the rows into what the pages already show for the sample. Server code only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { seasonStats, tagsFor, type SeasonStats } from "./comp-stats";
import { roundName } from "./round";
import type { LadderEntry, RoundScore } from "./scoring";
import type { TeamName } from "./teams";

/** The comp's first season: the scoring auto-tips every game since a season began, so earlier
 * seasons (before anyone tipped) would only show auto-tips. Decided October 2026. */
export const COMP_FIRST_SEASON = 2027;

export type LadderRows = {
  ladder: {
    user_id: string; display_name: string; is_model: boolean; points: number; margin_score: number;
    position: number | null; tied: boolean; movement: number | null;
  }[];
  profiles: { id: string; fav_team: string | null }[];
  scores: {
    user_id: string; round: number; correct: number; games: number; auto_tips: number; bonus: number;
    margin_score: number; partial: boolean;
  }[];
  /** Every tipper's tip (their own or their auto-tip) on every decided game. */
  tips: { user_id: string; match_id: number | string; team: string; is_auto: boolean }[];
  /** The season's decided games. */
  games: {
    id: number | string; round: number; round_title: string | null; kickoff: string; home_team: string; away_team: string;
    home_score: number | null; away_score: number | null; status: string;
  }[];
  /** The Model's home chance for each game (its prediction of record). */
  probs: { match_id: number | string; home_win_prob: number }[];
};

export type LadderView = {
  season: number;
  ladder: LadderEntry[];
  tags: Map<string, string>;
  stats: SeasonStats;
  /** The latest round with a decided game: its name ("Finals Week 1"), still in progress, and how many games are in. */
  latest: { round: number; title: string; partial: boolean; games: number };
};

/** The rows as the ladder page shows them. Null before any game of the season is decided. */
export function ladderView(season: number, rows: LadderRows): LadderView | null {
  const rounds = [...new Set(rows.scores.map((s) => s.round))].sort((a, b) => a - b);
  if (!rounds.length) return null;
  const partial = new Set(rows.scores.filter((s) => s.partial).map((s) => s.round));
  const favs = new Map(rows.profiles.map((p) => [p.id, p.fav_team]));

  const ladder: LadderEntry[] = rows.ladder.map((l) => {
    const mine = new Map(rows.scores.filter((s) => s.user_id === l.user_id).map((s) => [s.round, s]));
    return {
      tipper: {
        id: l.user_id,
        name: l.display_name,
        ...(l.is_model ? { isModel: true } : {}),
        ...(favs.get(l.user_id) ? { favTeam: favs.get(l.user_id) as TeamName } : {}),
      },
      points: l.points,
      marginScore: l.margin_score,
      position: l.position,
      tied: l.tied,
      movement: l.movement,
      // Every tipper has a score for every round (missed games are auto-tips); zeros keep the grid square regardless.
      rounds: rounds.map((round): RoundScore => {
        const s = mine.get(round);
        return {
          round, correct: s?.correct ?? 0, games: s?.games ?? 0, bonus: s?.bonus ?? 0, autoTips: s?.auto_tips ?? 0,
          marginScore: s?.margin_score ?? 0, partial: partial.has(round),
        };
      }),
    };
  });

  const prob = new Map(rows.probs.map((p) => [String(p.match_id), p.home_win_prob]));
  const tipsByGame = new Map<string, Record<string, { team: TeamName; auto: boolean }>>();
  for (const t of rows.tips) {
    const k = String(t.match_id);
    const tips = tipsByGame.get(k) ?? {};
    tips[t.user_id] = { team: t.team as TeamName, auto: t.is_auto };
    tipsByGame.set(k, tips);
  }
  const games = [...rows.games]
    .filter((g) => g.status === "final" || g.status === "cancelled")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || String(a.id).localeCompare(String(b.id)))
    .map((g) => {
      const home = g.home_team as TeamName;
      const away = g.away_team as TeamName;
      // As the scoring: a draw or a cancelled game is a win for both teams.
      const both = g.status === "cancelled" || g.home_score === g.away_score;
      return {
        round: g.round, home, away,
        winners: both ? [home, away] : [g.home_score! > g.away_score! ? home : away],
        modelHomeProb: prob.get(String(g.id)) ?? 0.5,
        tips: tipsByGame.get(String(g.id)) ?? {},
      };
    });

  const last = rounds.at(-1)!;
  return {
    season,
    ladder,
    tags: tagsFor(ladder),
    stats: seasonStats(ladder, games),
    latest: {
      round: last,
      title: roundName(last, rows.games.find((g) => g.round === last)?.round_title ?? undefined),
      partial: partial.has(last),
      games: Math.max(0, ...rows.scores.filter((s) => s.round === last).map((s) => s.games)),
    },
  };
}

/** The season the ladder shows: the latest comp season with a decided game, or null before the
 * comp's first. Model data, so anyone may read it. */
export async function compSeason(sb: SupabaseClient): Promise<number | null> {
  const { data, error } = await sb
    .from("matches").select("season").gte("season", COMP_FIRST_SEASON).in("status", ["final", "cancelled"])
    .order("season", { ascending: false }).limit(1);
  if (error) throw new Error(`compSeason: ${error.message}`);
  return data?.[0]?.season ?? null;
}

/** Supabase returns at most 1,000 rows a request: fetch a query a page at a time. */
async function every<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** The season's ladder as the signed-in tipper sees it. */
export async function readLadder(sb: SupabaseClient, season: number): Promise<LadderView | null> {
  const [ladder, profiles, scores, tips, games] = await Promise.all([
    sb.rpc("ladder", { p_season: season }).then(({ data, error }) => {
      if (error) throw new Error(`ladder: ${error.message}`);
      return (data ?? []) as LadderRows["ladder"];
    }),
    every<LadderRows["profiles"][number]>((a, b) => sb.from("profiles").select("id, fav_team").order("id").range(a, b)),
    every<LadderRows["scores"][number]>((a, b) =>
      sb.from("round_scores").select("user_id, round, correct, games, auto_tips, bonus, margin_score, partial")
        .eq("season", season).order("round").order("user_id").range(a, b)),
    every<LadderRows["tips"][number]>((a, b) =>
      sb.from("tip_results").select("user_id, match_id, team, is_auto")
        .eq("season", season).order("match_id").order("user_id").range(a, b)),
    every<LadderRows["games"][number]>((a, b) =>
      sb.from("matches").select("id, round, round_title, kickoff, home_team, away_team, home_score, away_score, status")
        .eq("season", season).in("status", ["final", "cancelled"]).order("id").range(a, b)),
  ]);
  const probs = games.length
    ? await every<LadderRows["probs"][number]>((a, b) =>
        sb.from("prediction_of_record").select("match_id, home_win_prob").in("match_id", games.map((g) => g.id)).order("match_id").range(a, b))
    : [];
  return ladderView(season, { ladder, profiles, scores, tips, games, probs });
}
