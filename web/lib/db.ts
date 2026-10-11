// The server's read-only connection to the model's data (PLAN_WEB.md step 9). Server code only:
// it holds a database password, so never import it from a client component.
//
// SITE_DATABASE_URL is the Supabase transaction pooler's connection string for the read-only
// `analyst` role, which reads the model's tables and views and nothing about the tippers. Tips and
// sign-in go through Supabase's client instead (step 10), so row-level security applies per tipper.
// Without it the pages keep showing the sample data.

import postgres from "postgres";

export type Sql = postgres.Sql;

let client: Sql | null | undefined;

/** The connection, or null when SITE_DATABASE_URL isn't set (the pages use the sample data). */
export function siteDb(): Sql | null {
  if (client === undefined) {
    const url = process.env.SITE_DATABASE_URL;
    // The transaction pooler can't keep prepared statements; one connection is plenty per instance.
    client = url ? postgres(url, { prepare: false, max: 1, idle_timeout: 20 }) : null;
  }
  return client;
}
