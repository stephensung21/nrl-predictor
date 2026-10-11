// A throwaway Postgres for the pipeline's tests (tests/test_publish.py), with no Docker or local
// install: PGlite in memory, with the Supabase stub and every migration applied, served over the
// Postgres wire protocol so psycopg can connect. Prints "ready <port>" once it's listening.
//   node web/tests/pglite_server.mjs [port]

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.argv[2] ?? 54329);
const dir = new URL("../../supabase/migrations/", import.meta.url);
const db = new PGlite();
await db.exec(readFileSync(new URL("supabase_stub.sql", import.meta.url), "utf8"));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(new URL(f, dir), "utf8"));
}
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
await server.start();
console.log(`ready ${port}`);
const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
