// A fresh database for the tests: PGlite (a real Postgres compiled to WebAssembly) with the parts
// of Supabase the migrations use, then every migration in supabase/migrations/, in order.

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, migrationsDir), "utf8"));

/** Supabase's roles, auth schema and default privileges, as far as the migrations rely on them.
 * Supabase grants everything in `public` to anon and authenticated by default; the migrations
 * revoke that and grant only what's needed, which these defaults make the tests check. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

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
