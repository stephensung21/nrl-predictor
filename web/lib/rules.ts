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
 * none qualify (PLAN_WEB.md §3.5). The pipeline draws it once, when the round's
 * predictions publish, from a fresh random source, and stores the pick in `rounds`
 * (featured match, drawn at); nobody can know it in advance. `seed` is for tests only.
 */
export function drawFeatured<T extends Fixture>(games: T[], previous: { home: string; away: string } | null, seed?: number) {
  const { eligible, excluded } = eligibleForDraw(games, previous);
  const u = seed == null ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : seeded(seed);
  return { pick: eligible[Math.floor(u * eligible.length)], eligible, excluded };
}

/** The games a round's margin game can be drawn from, and those left out. */
export function eligibleForDraw<T extends Fixture>(games: T[], previous: { home: string; away: string } | null) {
  const banned = new Set(previous ? [previous.home, previous.away] : []);
  const ok = games.filter((g) => !banned.has(g.home) && !banned.has(g.away));
  const eligible = ok.length ? ok : games;
  return { eligible, excluded: games.filter((g) => !eligible.includes(g)) };
}

/** A small deterministic generator (mulberry32), for reproducible tests. */
function seeded(seed: number) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
