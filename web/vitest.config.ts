import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Each database test starts its own PGlite (Postgres in WebAssembly) and applies every migration,
// which can take longer than the default 10 seconds when the test files run in parallel.
export default defineConfig({
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
  // The app's "@/" import paths, so tests can load components too.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
