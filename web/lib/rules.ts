// Official NRL Tipping rules as the comp plays them (PLAN_WEB.md §3.5).
// The database enforces these in production; the sample mirrors them.

/** Margin used for the featured game when a tipper doesn't enter one. */
export const DEFAULT_MARGIN = 12;

/** A perfect round earns a bonus point only in rounds of at least this many games. */
export const BONUS_MIN_GAMES = 8;

/** What fills an untipped game at lockout. Ties and gaps fall back to the home team. */
export type AutoTip = "home" | "crowd" | "ladder";
