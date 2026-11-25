// Which group a page shows (lib/groups.ts): the cookie that holds the choice and the switcher's shape.
// Kept apart from lib/groups.ts so the group switcher, on the home page, doesn't bring Supabase's
// client into the page's download with it (docs/PLAN_PERF.md, Phase 1). lib/groups.ts re-exports these.

export const GROUP_COOKIE = "fc-group";

/** What a page's switcher needs: the viewer's groups and the one shown (null: the global comp). */
export type GroupChoice = { options: { id: string; name: string }[]; current: { id: string; name: string } | null };
export const GLOBAL = "global";

/** A year, so the choice outlives the session. */
export const groupCookie = (value: string) => `${GROUP_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
/** No choice saved: pages show the group joined most recently. */
export const CLEAR_GROUP_COOKIE = `${GROUP_COOKIE}=; path=/; max-age=0; samesite=lax`;
