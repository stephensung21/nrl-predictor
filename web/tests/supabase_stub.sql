-- Supabase's roles, auth schema and default privileges, as far as the migrations and the pipeline
-- rely on them. Applied before the migrations by the tests (web/tests/db.ts for vitest,
-- web/tests/pglite_server.mjs and tests/test_publish.py for the pipeline). Supabase grants
-- everything in `public` to anon and authenticated by default; the migrations revoke that and grant
-- only what's needed, which these defaults make the tests check.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text,
  raw_user_meta_data jsonb,               -- what the sign-in provider sends (Google: name, photo)
  created_at timestamptz default now()
);
create table auth.identities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_id text not null,
  identity_data jsonb not null
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
