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
    // The transaction pooler can't keep prepared statements. A few connections, so a page's parallel
    // reads (Promise.all) and the requests one instance serves at once don't queue behind a single one
    // (docs/PLAN_PERF.md, Phase 1); the pooler is built for many clients.
    client = url
      ? postgres(url, {
          prepare: false, max: 4, idle_timeout: 20,
          onnotice: (n) => n.severity !== "DEBUG" && console.log(n), // a local PGlite server sends debug notices
        })
      : null;
  }
  return client;
}
