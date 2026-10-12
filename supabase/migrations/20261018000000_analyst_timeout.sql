-- A stuck read fails in 15 seconds instead of the server's 2 minutes. The website reads the model's data
-- as the analyst role (SITE_DATABASE_URL), and a query waiting on a lock (a migration or a long publish)
-- held a page for the full 2 minutes, failing a Vercel build. The transaction pooler ignores a timeout
-- sent when connecting, so it's set on the role, where every new session picks it up. Agents use the
-- same role; their queries over the model's tables take milliseconds.
alter role analyst set statement_timeout = '15s';
