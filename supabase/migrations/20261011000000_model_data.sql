-- The model's data (written by the pipeline, read by the website), invites, the agents' read-only
-- role, and the permissions for everything (PLAN_WEB.md §2, step 6).
--
-- The pipeline writes with the service key, which bypasses row-level security; nobody else can
-- write model data. The repo stays the source of truth for model data (data/pipeline/live/ is
-- committed and pipeline/publish.py upserts, so everything here can be rebuilt from it); only the
-- tipping data (profiles, tips, invites) lives only in this database.
--
-- Supabase grants every new table to anon and authenticated by default and relies on row-level
-- security. This migration revokes those defaults and grants exactly what each role needs, so the
-- permissions are the same whatever the project's defaults are. The tests (web/tests/) set up the
-- same defaults as Supabase before applying the migrations.

-- ---------------------------------------------------------------- teams

-- Team names as the pipeline and the website use them (nrl.com's nicknames). A new club (the Perth
-- Bears from 2027) is added here as well as in src/ingest.py and web/lib/teams.ts.
create table teams (
  name text primary key,
  full_name text not null,
  state text not null
);
insert into teams (name, full_name, state) values
  ('Broncos', 'Brisbane Broncos', 'QLD'),
  ('Raiders', 'Canberra Raiders', 'ACT'),
  ('Bulldogs', 'Canterbury-Bankstown Bulldogs', 'NSW'),
  ('Sharks', 'Cronulla-Sutherland Sharks', 'NSW'),
  ('Dolphins', 'Dolphins', 'QLD'),
  ('Titans', 'Gold Coast Titans', 'QLD'),
  ('Sea Eagles', 'Manly-Warringah Sea Eagles', 'NSW'),
  ('Storm', 'Melbourne Storm', 'VIC'),
  ('Knights', 'Newcastle Knights', 'NSW'),
  ('Cowboys', 'North Queensland Cowboys', 'QLD'),
  ('Eels', 'Parramatta Eels', 'NSW'),
  ('Panthers', 'Penrith Panthers', 'NSW'),
  ('Rabbitohs', 'South Sydney Rabbitohs', 'NSW'),
  ('Dragons', 'St. George Illawarra Dragons', 'NSW'),
  ('Roosters', 'Sydney Roosters', 'NSW'),
  ('Warriors', 'New Zealand Warriors', 'NZ'),
  ('Wests Tigers', 'Wests Tigers', 'NSW');

-- ---------------------------------------------------------------- matches (more columns)

alter table matches
  add column city text,
  add column neutral boolean not null default false,  -- neither team at home (draw.neutral_games)
  add column url text,                                 -- nrl.com match centre
  add column updated_at timestamptz not null default now(),
  add constraint matches_home_team_fkey foreign key (home_team) references teams (name),
  add constraint matches_away_team_fkey foreign key (away_team) references teams (name),
  add constraint matches_two_teams check (home_team <> away_team);

-- ---------------------------------------------------------------- the model and its runs

-- One row per frozen model bundle (models/<season>/meta.json), so every prediction names the
-- formulas that made it and versions can be compared (and reviewed by an agent) honestly.
create table model_versions (
  version text primary key,                -- e.g. '2027.1'
  season int not null,                     -- the season it predicts
  trained_on int[] not null,               -- seasons it was fitted on
  commit text not null,                    -- git commit the bundle was frozen at
  features_sha256 text,
  settings jsonb not null default '{}',    -- feature groups and model settings from meta.json
  backtest jsonb not null default '{}',    -- headline backtest figures, for comparing versions
  notes text,
  frozen_at timestamptz not null
);

-- The pipeline's run log (data/pipeline/live/<season>/runs.jsonl), one row per run.
create table pipeline_runs (
  id text primary key,                     -- the run id in runs.jsonl
  job text not null check (job in ('results', 'predict', 'refresh', 'odds', 'backfill')),
  season int not null,
  mode text not null check (mode in ('live', 'replay', 'backfill')),
  as_of timestamptz not null,              -- the job's clock (a replay's past time)
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('ok', 'nothing to do', 'failed', 'running')),
  round int,
  games int,
  model_version text references model_versions (version),
  commit text,
  notes text,
  record jsonb not null default '{}'       -- the whole runs.jsonl entry (warnings, errors, odds fetch)
);
create index pipeline_runs_started on pipeline_runs (started_at desc);

-- Every prediction the pipeline makes, kept (not overwritten): the prediction of record is the
-- latest one before kickoff. Scores are the display scores (predict.display_scores).
create table predictions (
  run_id text not null references pipeline_runs (id),
  match_id bigint not null references matches (id),
  created_at timestamptz not null,
  model_version text not null references model_versions (version),
  model text not null check (model in ('with odds', 'no odds')),
  home_win_prob double precision not null check (home_win_prob > 0 and home_win_prob < 1),
  margin double precision not null,        -- home minus away, unrounded
  total double precision not null,
  home_score int not null,
  away_score int not null,
  no_odds_home_win_prob double precision check (no_odds_home_win_prob > 0 and no_odds_home_win_prob < 1),
  market_open_home_prob double precision,  -- the opening price the with-odds model used
  inputs text,                             -- fingerprint of what the prediction depended on
  updated_reason text,                     -- shown when it changed since Tuesday ("Hughes out")
  primary key (run_id, match_id)
);
create index predictions_match on predictions (match_id, created_at desc);

-- Each finished game graded on its prediction of record (pipeline/grade.py, graded.csv), with the
-- market and Elo it is compared against. `model_accuracy` adds these up; the metric definitions
-- stay in Python, where they are checked against the final test's report.
create table graded_games (
  match_id bigint primary key references matches (id),
  run_id text not null references pipeline_runs (id),
  model_version text not null references model_versions (version),
  home_win_prob double precision not null,
  margin double precision not null,
  total double precision not null,
  p_open double precision,                 -- opening market, margin removed
  open_line double precision,
  open_total double precision,
  p_close double precision,                -- closing market; scored only where close_ok
  close_line double precision,
  close_total double precision,
  close_ok boolean not null default false,
  elo_prob double precision,
  margin_actual int not null,              -- home minus away
  total_actual int not null,
  tip_correct boolean not null,            -- tipping rules: a draw counts for both teams
  graded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- inputs: team lists, odds, Elo

-- Every version of every team list fetched (one row per player per fetch).
create table team_lists (
  match_id bigint not null references matches (id),
  team text not null references teams (name),
  fetched_at timestamptz not null,         -- when the pipeline fetched it
  list_updated_at timestamptz,             -- nrl.com's own "updated" time
  player_id bigint not null,
  player_name text not null,
  jersey_number int not null,
  position text not null,
  primary key (match_id, fetched_at, player_id)
);

-- Live prices (pipeline/fetch_odds.py): every snapshot, so the opening price and the market's
-- movement can both be shown. Impossible prices are blanked before they get here.
create table odds_snapshots (
  match_id bigint not null references matches (id),
  bookmaker text not null,                 -- 'betr_au' (BlueBet's platform since 2024)
  captured_at timestamptz not null,
  home_odds double precision check (home_odds > 1),
  away_odds double precision check (away_odds > 1),
  home_line double precision,              -- handicap on the home team (negative = favourite)
  home_line_odds double precision,
  away_line_odds double precision,
  total double precision,
  over_odds double precision,
  under_odds double precision,
  primary key (match_id, bookmaker, captured_at)
);

-- The aussportsbetting.com sheet's prices for a game: the opening prices the with-odds models were
-- trained on, and the closing prices grading uses. One row per game.
create table odds_sheet (
  match_id bigint primary key references matches (id),
  bookmaker text not null,                 -- 'bet365' or 'BlueBet', as ingest.load_odds names them
  home_odds_open double precision,
  away_odds_open double precision,
  home_line_open double precision,
  total_open double precision,
  home_odds_close double precision,
  away_odds_close double precision,
  home_line_close double precision,
  total_close double precision,
  close_ok boolean not null default false  -- the sheet's closing figures are reliable
);

-- Elo after every game since 2009 (src/elo.py, over the odds sheet's results). Games before 2021
-- have no nrl.com match id.
create table elo_ratings (
  team text not null references teams (name),
  season int not null,
  played_on date not null,
  round_label text not null,               -- 'R10', or a final's short name
  opponent text not null references teams (name),
  is_home boolean not null,
  match_id bigint references matches (id),
  win_prob double precision not null,      -- this team's chance from the ratings (home advantage in)
  points_for int not null,
  points_against int not null,
  rating_before double precision not null,
  rating_after double precision not null,
  primary key (team, played_on)
);
create index elo_ratings_season on elo_ratings (season, played_on);

-- ---------------------------------------------------------------- written by agents

-- LLM-written text the site shows: match previews, round recaps, the model's weekly review.
-- Written by the pipeline (Python, the Claude API), never by the website. One current text per
-- kind and subject; rewriting replaces it.
create table summaries (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('match_preview', 'round_recap', 'model_review')),
  season int not null,
  round int,
  match_id bigint references matches (id),
  body text not null,                      -- Markdown
  llm_model text not null,                 -- the Claude model that wrote it
  prompt_version text not null,            -- which prompt, so changes to it can be traced
  run_id text references pipeline_runs (id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (kind, season, round, match_id)
);

-- ---------------------------------------------------------------- invites

-- One invite per friend: one use, 7 days (web/lib/invites.ts). Joining is the only way to get a
-- profile, through join_comp(), which checks and redeems the invite in one transaction.
create table invites (
  code text primary key default upper(substr(md5(random()::text), 1, 8)),
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references profiles (id) on delete set null,
  used_at timestamptz,
  cancelled_at timestamptz
);

-- Whether the signed-in user runs the comp. Security definer so policies can call it without
-- reading profiles through their own row-level security.
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- What the join page may know about a code before anyone signs in: its status and who sent it.
-- Cancelled codes look unknown.
create function check_invite(p_code text)
returns table (status text, invited_by text)
language sql stable security definer set search_path = public as $$
  select case when i.code is null or i.cancelled_at is not null then 'unknown'
              when i.used_by is not null then 'used'
              when i.expires_at <= now() then 'expired'
              else 'valid' end,
         case when i.code is not null and i.cancelled_at is null then p.display_name end
  from (select 1) one
  left join invites i on i.code = upper(trim(p_code))
  left join profiles p on p.id = i.created_by
$$;

-- Join the comp: the signed-in user's profile is created and the invite used, together.
create function join_comp(p_code text, p_display_name text, p_fav_team text, p_auto_tip text)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'already in the comp';
  end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if inv.code is null or inv.cancelled_at is not null then
    raise exception 'unknown invite';
  elsif inv.used_by is not null then
    raise exception 'invite already used';
  elsif inv.expires_at <= now() then
    raise exception 'invite expired';
  end if;
  insert into profiles (id, display_name, fav_team, auto_tip)
  values (auth.uid(), p_display_name, p_fav_team, coalesce(p_auto_tip, 'home'));
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
end $$;

-- ---------------------------------------------------------------- views

-- The latest prediction made before each game's kickoff: the official one (as grade.py).
create view prediction_of_record with (security_invoker = true) as
select distinct on (p.match_id) p.*
from predictions p
join matches m on m.id = p.match_id
where p.created_at < m.kickoff
order by p.match_id, p.created_at desc;

-- Each game's opening and closing market, one row per game. Opening: the sheet's when it has the
-- game, else the first live snapshot (as predict.inputs_before). Closing: the sheet's when reliable,
-- else the latest live snapshot before kickoff. Probabilities have the margin removed proportionally.
create view match_odds with (security_invoker = true) as
with live as (
  select s.*, m.kickoff,
         row_number() over (partition by s.match_id order by s.captured_at) as first_n,
         row_number() over (partition by s.match_id order by s.captured_at desc) as last_n
  from odds_snapshots s
  join matches m on m.id = s.match_id
  where s.captured_at < m.kickoff and s.home_odds is not null and s.away_odds is not null
),
opening as (select * from live where first_n = 1),
closing as (select * from live where last_n = 1)
select m.id as match_id,
       coalesce(sh.bookmaker, o.bookmaker) as bookmaker,
       case when sh.home_odds_open is not null then 'sheet' when o.match_id is not null then 'live' end as open_source,
       coalesce(sh.home_odds_open, o.home_odds) as home_odds_open,
       coalesce(sh.away_odds_open, o.away_odds) as away_odds_open,
       coalesce(sh.home_line_open, o.home_line) as open_line,
       coalesce(sh.total_open, o.total) as open_total,
       o.captured_at as opened_at,
       case when sh.close_ok then 'sheet' when c.match_id is not null then 'live' end as close_source,
       case when sh.close_ok then sh.home_odds_close else c.home_odds end as home_odds_close,
       case when sh.close_ok then sh.away_odds_close else c.away_odds end as away_odds_close,
       case when sh.close_ok then sh.home_line_close else c.home_line end as close_line,
       case when sh.close_ok then sh.total_close else c.total end as close_total,
       c.captured_at as closed_at
from matches m
left join odds_sheet sh on sh.match_id = m.id
left join opening o on o.match_id = m.id
left join closing c on c.match_id = m.id
where sh.match_id is not null or o.match_id is not null;

create view match_odds_probs with (security_invoker = true) as
select o.*,
       (1 / home_odds_open) / (1 / home_odds_open + 1 / away_odds_open) as p_open,
       (1 / home_odds_close) / (1 / home_odds_close + 1 / away_odds_close) as p_close
from match_odds o;

-- The model's record per round and for each season (round is null), with the opening market,
-- closing market and Elo on the same games, each where it has a price. As grade.metrics: a draw
-- is a home loss for accuracy, log loss and Brier; tips count a draw for both teams.
create view model_accuracy with (security_invoker = true) as
with g as (
  select gg.*, m.season, m.round, (gg.margin_actual > 0)::int as y
  from graded_games gg join matches m on m.id = gg.match_id
),
scored as (
  select season, round, 'model' as source, home_win_prob as p, margin as pred_margin, total as pred_total,
         y, margin_actual, total_actual, tip_correct as tip_ok, model_version from g
  union all
  select season, round, 'market_open', p_open, -open_line, open_total, y, margin_actual, total_actual,
         margin_actual = 0 or (p_open >= 0.5) = (margin_actual > 0), model_version from g where p_open is not null
  union all
  select season, round, 'market_close', p_close, -close_line, close_total, y, margin_actual, total_actual,
         margin_actual = 0 or (p_close >= 0.5) = (margin_actual > 0), model_version from g where close_ok
  union all
  select season, round, 'elo', elo_prob, null, null, y, margin_actual, total_actual,
         margin_actual = 0 or (elo_prob >= 0.5) = (margin_actual > 0), model_version from g where elo_prob is not null
)
select season, round, source,
       count(*)::int as games,
       (count(*) filter (where tip_ok))::int as tips,
       avg(((p > 0.5)::int = y)::int) as accuracy,      -- as evaluate.evaluate
       -avg(y * ln(p) + (1 - y) * ln(1 - p)) as log_loss,
       avg((p - y) ^ 2) as brier,
       avg(abs(pred_margin - margin_actual)) as margin_mae,
       avg(abs(pred_total - total_actual)) as total_mae,
       array_agg(distinct model_version) as model_versions
from scored
group by grouping sets ((season, round, source), (season, source));

-- ---------------------------------------------------------------- row-level security

alter table teams enable row level security;
alter table model_versions enable row level security;
alter table pipeline_runs enable row level security;
alter table predictions enable row level security;
alter table graded_games enable row level security;
alter table team_lists enable row level security;
alter table odds_snapshots enable row level security;
alter table odds_sheet enable row level security;
alter table elo_ratings enable row level security;
alter table summaries enable row level security;
alter table invites enable row level security;

-- Agents (summaries, the results-and-formulas reviewer, an "Ask the model" chat) read the model's
-- data through this role and nothing else: no tips, profiles, invites or run log. It can't log in
-- until a password is set by hand in the dashboard's SQL editor, never in a migration:
--   alter role analyst login password '...';
-- Roles belong to the whole server, not one database, so this tolerates one left by an earlier reset.
do $$ begin create role analyst nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to analyst;

-- Model data: anyone (and the analyst) reads; only the service key writes.
create policy "anyone reads teams" on teams for select to anon, authenticated, analyst using (true);
create policy "anyone reads model versions" on model_versions for select to anon, authenticated, analyst using (true);
create policy "anyone reads predictions" on predictions for select to anon, authenticated, analyst using (true);
create policy "anyone reads graded games" on graded_games for select to anon, authenticated, analyst using (true);
create policy "anyone reads team lists" on team_lists for select to anon, authenticated, analyst using (true);
create policy "anyone reads odds snapshots" on odds_snapshots for select to anon, authenticated, analyst using (true);
create policy "anyone reads the odds sheet" on odds_sheet for select to anon, authenticated, analyst using (true);
create policy "anyone reads elo" on elo_ratings for select to anon, authenticated, analyst using (true);
create policy "anyone reads summaries" on summaries for select to anon, authenticated, analyst using (true);
create policy "analyst reads matches" on matches for select to analyst using (true);
create policy "analyst reads rounds" on rounds for select to analyst using (true);

-- The run log and invites: the comp's admin only.
create policy "admin reads runs" on pipeline_runs for select to authenticated using (is_admin());
create policy "admin reads invites" on invites for select to authenticated using (is_admin());
create policy "admin creates invites" on invites for insert to authenticated
  with check (is_admin() and created_by = auth.uid() and used_by is null);
create policy "admin cancels invites" on invites for update to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- grants

-- Start from nothing (Supabase's defaults grant everything), then grant what each role needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on teams, matches, rounds, model_versions, predictions, graded_games, team_lists,
  odds_snapshots, odds_sheet, elo_ratings, summaries,
  prediction_of_record, match_odds, match_odds_probs, model_accuracy to anon, authenticated, analyst;

-- The tipping comp (20261010000000_tipping.sql), signed-in tippers only.
grant select on profiles to authenticated;
grant update (display_name, fav_team, auto_tip) on profiles to authenticated;
grant select, insert, update, delete on tips to authenticated;
grant select on effective_tips, tip_results, round_scores to authenticated;
grant select on pipeline_runs to authenticated;
grant select, insert on invites to authenticated;
grant update (cancelled_at) on invites to authenticated;

-- Functions: the views and policies call these as the signed-in user.
grant execute on function auto_tip(uuid, bigint), nrl_ladder_before(int, int), default_margin(),
  bonus_min_games(), before_kickoff(bigint), is_admin(), ladder(int), join_comp(text, text, text, text)
  to authenticated;
grant execute on function check_invite(text) to anon, authenticated;
-- Trigger functions run as the table's owner, so they need no grants.
