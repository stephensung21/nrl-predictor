// Official NRL Tipping rules as the comp plays them (PLAN_WEB.md §3.5).
// The database enforces these in production; the sample mirrors them.

/** Margin used for the featured game when a tipper doesn't enter one. */
export const DEFAULT_MARGIN = 12;

/** A perfect round earns a bonus point only in rounds of at least this many games. */
export const BONUS_MIN_GAMES = 8;

/** What fills an untipped game at lockout. Ties and gaps fall back to the home team. */
export type AutoTip = "home" | "crowd" | "ladder";

type Fixture = { matchId: string; home: string; away: string };

/**
 * The featured (margin) game for a round: drawn at random from the games that don't
 * involve either team in the previous round's featured game, or from every game if
 * none qualify (PLAN_WEB.md §3.5). The pipeline draws it once when predictions publish
 * and stores it; `seed` makes the draw reproducible.
 */
export function drawFeatured<T extends Fixture>(games: T[], previous: { home: string; away: string } | null, seed: number) {
  const banned = new Set(previous ? [previous.home, previous.away] : []);
  const eligible = games.filter((g) => !banned.has(g.home) && !banned.has(g.away));
  const pool = eligible.length ? eligible : games;
  // A small deterministic generator (mulberry32), so the same seed always draws the same game.
  let t = seed >>> 0;
  t += 0x6d2b79f5;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const u = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { pick: pool[Math.floor(u * pool.length)], eligible: pool, excluded: games.filter((g) => !pool.includes(g)) };
}
