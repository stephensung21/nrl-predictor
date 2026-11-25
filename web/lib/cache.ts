// The model's data, cached between requests (docs/PLAN_PERF.md, Phase 2). Rounds, predictions, Elo,
// odds, players and recaps change only when the pipeline publishes, a few times a week, so the pages
// read them from Next.js's data cache instead of the database on every request. Server code only.
//
// - Every cached read carries one tag, MODEL_TAG. pipeline/publish.py calls /api/revalidate after each
//   publish (REVALIDATE_URL, with REVALIDATE_SECRET), which expires the tag, so the next request reads
//   the database again. The hour's `revalidate` is only a safety net for a missed call; until the site
//   has REVALIDATE_SECRET (so a publish can't expire anything), cached data lasts five minutes instead.
// - Nothing per viewer is cached (tips, the comp, votes, picks: those go through Supabase as the viewer).
// - Nothing that moves with the clock is cached as such: a cached read returns rows, and the caller
//   applies the time (which games have kicked off, whether the Dally M round is open, the off-season).
// - The deployment is part of every key, so a new deployment never reads data shaped by an older one.
// - Results go through JSON, so a cached read returns plain data: no Dates, Maps or undefined.

import { unstable_cache } from "next/cache";

export const MODEL_TAG = "model-data";

/** Seconds a cached read lasts if no publish expires it first: an hour, or five minutes while publishing
 * can't expire it (no REVALIDATE_SECRET), so new predictions and results never wait long. */
export const MODEL_TTL = process.env.REVALIDATE_SECRET ? 3600 : 300;

const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

/** `read`, cached under `name` and its arguments until the next publish (or an hour). */
export function cachedRead<A extends (string | number)[], R>(name: string, read: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return unstable_cache(read, [MODEL_TAG, DEPLOYMENT, name], { tags: [MODEL_TAG], revalidate: MODEL_TTL });
}
