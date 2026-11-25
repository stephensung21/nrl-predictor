// Server timings for docs/PLAN_PERF.md, Phase 0: how long each data read takes on the live site,
// and whether it ran on a cold instance (the first read since this server process started). One
// line per read in Vercel's runtime logs, e.g. `perf liveHome 84ms` or `perf liveHome 912ms cold
// (boot 1.3s ago)`. Set PERF_LOG=0 to silence it; it's always off in tests. Server code only.

const BOOT = Date.now();
let first = true;

const enabled = () => process.env.PERF_LOG !== "0" && !process.env.VITEST;

/** Runs `fn`, logging how long it took. Errors pass through (and are timed too). */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const cold = first;
  first = false;
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - t0);
    console.log(`perf ${label} ${ms}ms${cold ? ` cold (boot ${((Date.now() - BOOT) / 1000).toFixed(1)}s ago)` : ""}`);
  }
}
