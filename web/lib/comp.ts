// The live tipping comp's ladder, for /tipping/ladder and /model, and one round's tips and standings
// for the home and round pages. The scoring is the database's
// (`ladder()`, `round_scores` and `tip_results`, supabase/migrations/20261010000000_tipping.sql),
// read through Supabase as the signed-in tipper, so row-level security applies; `ladderView` shapes
// the rows into what the pages already show for the sample. Server code only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { seasonStats, tagsFor, type SeasonStats } from "./comp-stats";
import { roundName } from "./round";
import type { LadderEntry, RoundScore } from "./scoring";
import type { TeamName } from "./teams";
import type { LadderRow, RoundData, Tip, Tipper } from "./types";

/** The comp's first season: the scoring auto-tips every game since a season began, so earlier
 * seasons (before anyone tipped) would only show auto-tips. Decided October 2026. The trial site
 * (pipeline/trial.py) sets NEXT_PUBLIC_COMP_FIRST_SEASON=2026 for its replayed rounds. */
export const COMP_FIRST_SEASON = Number(process.env.NEXT_PUBLIC_COMP_FIRST_SEASON) || 2027;

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

/* ---------- One round, for the home and round pages ---------- */

export type RoundCompRows = {
  profiles: { id: string; display_name: string; is_model: boolean; fav_team: string | null }[];
  /** `round_scores` for the season's earlier rounds. */
  before: { user_id: string; correct: number; bonus: number; margin_score: number }[];
  /** The round's tips the viewer may see: their own, and everyone's once a game kicks off. */
  tips: { user_id: string; match_id: number | string; team: string; margin: number | null }[];
  /** `tip_results` for the round's decided games: every tipper's tip, their own or their auto-tip. */
  results: { user_id: string; match_id: number | string; team: string }[];
};

/** What lib/round.ts's buildRound needs for the comp's part of a round, as the signed-in tipper. */
export type RoundComp = {
  youId: string;
  tippers: Tipper[];
  /** Decided games carry every tipper's scored tip (auto-tips included), so the round's tallies match the ladder's. */
  tips: Tip[];
  ladderBefore: LadderRow[];
  /** The viewer's margin for the round's margin game, if they entered one. */
  yourMargin?: number;
};

export function roundComp(youId: string, featuredMatchId: string, rows: RoundCompRows): RoundComp {
  const tippers: Tipper[] = rows.profiles.map((p) => ({
    id: p.id, name: p.display_name, ...(p.is_model ? { isModel: true } : {}), ...(p.fav_team ? { favTeam: p.fav_team as TeamName } : {}),
  }));
  const ladderBefore: LadderRow[] = rows.profiles.map((p) => {
    const mine = rows.before.filter((s) => s.user_id === p.id);
    return {
      tipperId: p.id,
      points: mine.reduce((n, s) => n + s.correct + s.bonus, 0),
      marginScore: mine.reduce((n, s) => n + s.margin_score, 0),
    };
  });
  const tips = new Map<string, Tip>();
  const put = (t: { user_id: string; match_id: number | string; team: string }) =>
    tips.set(`${t.user_id}:${t.match_id}`, { tipperId: t.user_id, matchId: String(t.match_id), team: t.team as TeamName });
  rows.tips.forEach(put);
  rows.results.forEach(put);
  const margin = rows.tips.find((t) => t.user_id === youId && String(t.match_id) === featuredMatchId)?.margin;
  return { youId, tippers, tips: [...tips.values()], ladderBefore, ...(margin != null ? { yourMargin: margin } : {}) };
}

/** A round's comp as the signed-in tipper sees it (row-level security decides which tips). */
export async function readRoundComp(sb: SupabaseClient, youId: string, round: RoundData): Promise<RoundComp> {
  const ids = round.matches.map((m) => Number(m.id));
  const [profiles, before, tips, results] = await Promise.all([
    every<RoundCompRows["profiles"][number]>((a, b) =>
      sb.from("profiles").select("id, display_name, is_model, fav_team").order("id").range(a, b)),
    every<RoundCompRows["before"][number]>((a, b) =>
      sb.from("round_scores").select("user_id, correct, bonus, margin_score")
        .eq("season", round.season).lt("round", round.round).order("round").order("user_id").range(a, b)),
    every<RoundCompRows["tips"][number]>((a, b) =>
      sb.from("tips").select("user_id, match_id, team, margin").in("match_id", ids).order("match_id").order("user_id").range(a, b)),
    every<RoundCompRows["results"][number]>((a, b) =>
      sb.from("tip_results").select("user_id, match_id, team").in("match_id", ids).order("match_id").order("user_id").range(a, b)),
  ]);
  return roundComp(youId, round.featuredMatchId, { profiles, before, tips, results });
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
