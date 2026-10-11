// A fresh database for the tests: PGlite (a real Postgres compiled to WebAssembly) with the parts
// of Supabase the migrations use, then every migration in supabase/migrations/, in order.

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, migrationsDir), "utf8"));

/** Supabase's roles, auth schema and default privileges (see the file). */
const SUPABASE_STUB = readFileSync(new URL("supabase_stub.sql", import.meta.url), "utf8");

export const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

export async function freshDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const sql of migrations) await db.exec(sql);
  return db;
}

/** Run as a signed-in user (a uuid), as a visitor who isn't signed in (null), or as another role
 * (the agents' read-only `analyst`), under row-level security. */
export async function as<T>(db: PGlite, who: string | null | { role: string }, fn: () => Promise<T>): Promise<T> {
  const setup =
    who === null
      ? "set role anon; reset request.jwt.claim.sub;"
      : typeof who === "string"
        ? `set role authenticated; set request.jwt.claim.sub = '${who}';`
        : `set role ${who.role}; reset request.jwt.claim.sub;`;
  await db.exec(setup);
  try {
    return await fn();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub;");
  }
}
