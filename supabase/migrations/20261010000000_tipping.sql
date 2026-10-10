-- The tipping comp: its tables, the scoring, and the row-level security that enforces lockout
-- (PLAN_WEB.md §2 and §3.5).
--
-- The scoring mirrors web/lib/scoring.ts. Both are checked against the same cases in
-- tests/tipping/cases.json (run with `npm test` in web/), so change them together.
--
-- `matches` here has the columns the rules need; the model-data migration (Next steps C6) adds
-- the rest of the model tables and any further match columns. `auth.users` and `auth.uid()` are
-- Supabase's.

-- ---------------------------------------------------------------- tables

create table matches (
  id bigint primary key,                 -- nrl.com match id
  season int not null,
  round int not null,                    -- a postponed game keeps its round
  round_title text,
  is_final boolean not null default false,
  kickoff timestamptz not null,          -- moved when a game is postponed; tips lock at this time
  home_team text not null,
  away_team text not null,
  venue text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
  home_score int,
  away_score int,
  check (status <> 'final' or (home_score is not null and away_score is not null))
);
create index matches_season_round on matches (season, round);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 30),
  fav_team text,
  auto_tip text not null default 'home' check (auto_tip in ('home', 'crowd', 'ladder')),
  is_admin boolean not null default false,
  is_model boolean not null default false,   -- the Model tips too, but isn't ranked
  created_at timestamptz not null default now()
);

create table rounds (
  season int not null,
  round int not null,
  featured_match bigint references matches (id),  -- the margin game, drawn by the predict job
  drawn_at timestamptz,
  primary key (season, round)
);

-- A tipper's own tips only. Auto-tips aren't stored: `effective_tips` fills them in once a game
-- locks, from each tipper's auto-tip choice, so they can never be missed by a job that didn't run.
create table tips (
  user_id uuid not null references profiles (id) on delete cascade,
  match_id bigint not null references matches (id),
  team text not null,
  margin int check (margin between 1 and 200),  -- the featured game's predicted winning margin
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

-- A tip names one of the game's two teams.
create function check_tip() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from matches m where m.id = new.match_id and new.team in (m.home_team, m.away_team)) then
    raise exception 'team % is not playing in match %', new.team, new.match_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger tips_check before insert or update on tips for each row execute function check_tip();

-- ---------------------------------------------------------------- the rules (web/lib/rules.ts)

-- Margin used for the featured game when a tipper doesn't enter one.
create function default_margin() returns int language sql immutable as $$ select 12 $$;
-- A perfect round earns a bonus point only in rounds of at least this many games.
create function bonus_min_games() returns int language sql immutable as $$ select 8 $$;

-- The NRL ladder going into a round: 2 points a win, 1 a draw, then points difference.
create function nrl_ladder_before(p_season int, p_round int)
returns table (team text, pts int, diff int) language sql stable as $$
  select team, sum(pts)::int, sum(diff)::int
  from (
    select home_team as team,
           case when home_score > away_score then 2 when home_score = away_score then 1 else 0 end as pts,
           home_score - away_score as diff
    from matches where season = p_season and round < p_round and status = 'final'
    union all
    select away_team,
           case when away_score > home_score then 2 when home_score = away_score then 1 else 0 end,
           away_score - home_score
    from matches where season = p_season and round < p_round and status = 'final'
  ) g
  group by team
$$;

-- The auto-tip for a game a tipper didn't tip: the home team; the team most other tippers picked
-- (the Model's tips don't count); or the team higher on the NRL ladder. Ties fall back to home.
create function auto_tip(p_user uuid, p_match bigint) returns text language plpgsql stable as $$
declare
  m matches;
  choice text;
  h int;
  a int;
  hd int;
  ad int;
begin
  select * into m from matches where id = p_match;
  select auto_tip into choice from profiles where id = p_user;
  if choice = 'crowd' then
    select count(*) filter (where t.team = m.home_team), count(*) filter (where t.team = m.away_team)
      into h, a
      from tips t join profiles p on p.id = t.user_id
      where t.match_id = p_match and t.user_id <> p_user and not p.is_model;
    if a > h then return m.away_team; end if;
  elsif choice = 'ladder' then
    select coalesce(max(l.pts) filter (where l.team = m.home_team), 0),
           coalesce(max(l.diff) filter (where l.team = m.home_team), 0),
           coalesce(max(l.pts) filter (where l.team = m.away_team), 0),
           coalesce(max(l.diff) filter (where l.team = m.away_team), 0)
      into h, hd, a, ad
      from nrl_ladder_before(m.season, m.round) l;
    if a > h or (a = h and ad > hd) then return m.away_team; end if;
  end if;
  return m.home_team;
end $$;

-- ---------------------------------------------------------------- scoring

-- Every tipper's tip for every game that has locked: their own, or their auto-tip.
create view effective_tips with (security_invoker = true) as
select p.id as user_id, m.id as match_id, m.season, m.round,
       coalesce(t.team, auto_tip(p.id, m.id)) as team,
       t.team is null as is_auto,
       t.margin
from profiles p
cross join matches m
left join tips t on t.user_id = p.id and t.match_id = m.id
where m.kickoff <= now() and m.status <> 'postponed';

-- Each tip marked correct once its game is decided. A draw, or a cancelled game, counts for both teams.
create view tip_results with (security_invoker = true) as
select e.*, m.status,
       m.status = 'cancelled'
         or m.home_score = m.away_score
         or e.team = case when m.home_score > m.away_score then m.home_team else m.away_team end as correct
from effective_tips e
join matches m on m.id = e.match_id
where m.status in ('final', 'cancelled');

-- Points, bonus point and margin score per tipper per round. `partial` while any of the round's
-- games is still to be decided; the bonus waits for the whole round.
create view round_scores with (security_invoker = true) as
with tallies as (
  select user_id, season, round,
         count(*)::int as games,
         (count(*) filter (where correct))::int as correct,
         (count(*) filter (where is_auto))::int as auto_tips
  from tip_results
  group by user_id, season, round
),
undecided as (
  select season, round, count(*) as n
  from matches where status not in ('final', 'cancelled')
  group by season, round
),
-- Margins are signed from the home side, so tipping the wrong team counts against you:
-- Storm by 6 when the Broncos win by 4 is a margin score of 10.
featured as (
  select e.user_id, r.season, r.round,
         abs(case when e.team = m.home_team then 1 else -1 end * coalesce(e.margin, default_margin())
             - (m.home_score - m.away_score))::int as margin_score
  from rounds r
  join matches m on m.id = r.featured_match and m.status = 'final'
  join effective_tips e on e.match_id = m.id
)
select t.user_id, t.season, t.round, t.correct, t.games, t.auto_tips,
       (u.n is null and t.games >= bonus_min_games() and t.correct = t.games and t.auto_tips = 0)::int as bonus,
       coalesce(f.margin_score, 0) as margin_score,
       u.n is not null as partial
from tallies t
left join undecided u using (season, round)
left join featured f using (user_id, season, round);

-- The season ladder: most points (tips plus bonus points), then the lowest margin score. Tied
-- tippers share a place. The Model is listed where its points put it but has no place. Movement is
-- places gained since the ladder before the latest scored round (null in the first round).
create function ladder(p_season int)
returns table (user_id uuid, display_name text, is_model boolean, points int, margin_score int,
               "position" int, tied boolean, movement int)
language sql stable as $$
  with scored as (
    select * from round_scores where season = p_season
  ),
  latest as (
    select max(round) as round, count(distinct round) as rounds from scored
  ),
  totals as (
    select p.id as user_id, p.display_name, p.is_model,
           coalesce(sum(s.correct + s.bonus), 0)::int as points,
           coalesce(sum(s.margin_score), 0)::int as margin_score,
           coalesce(sum(s.correct + s.bonus) filter (where s.round < (select round from latest)), 0)::int as points_before,
           coalesce(sum(s.margin_score) filter (where s.round < (select round from latest)), 0)::int as margin_before
    from profiles p
    left join scored s on s.user_id = p.id
    group by p.id, p.display_name, p.is_model
  ),
  ranked as (
    select t.*,
           rank() over (partition by is_model order by points desc, margin_score) as place,
           rank() over (partition by is_model order by points_before desc, margin_before) as place_before,
           count(*) over (partition by is_model, points, margin_score) as same
    from totals t
  )
  select user_id, display_name, is_model, points, margin_score,
         case when not is_model then place::int end,
         not is_model and same > 1,
         case when not is_model and (select rounds from latest) > 1 then (place_before - place)::int end
  from ranked
  order by points desc, margin_score, is_model desc, display_name
$$;

-- ---------------------------------------------------------------- row-level security

alter table matches enable row level security;
alter table rounds enable row level security;
alter table profiles enable row level security;
alter table tips enable row level security;

-- Model data: anyone can read; only the pipeline's service key (which bypasses RLS) writes.
create policy "anyone reads matches" on matches for select to anon, authenticated using (true);
create policy "anyone reads rounds" on rounds for select to anon, authenticated using (true);

-- Tippers see each other's names; each edits only their own profile, and only some columns.
create policy "tippers read profiles" on profiles for select to authenticated using (true);
create policy "tippers edit their own profile" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- The auto-tip choice is fixed once the season's first game locks.
create function lock_auto_tip() returns trigger language plpgsql as $$
begin
  if new.auto_tip is distinct from old.auto_tip and current_user = 'authenticated' and exists (
       select 1 from matches where season = extract(year from now())::int and kickoff <= now()) then
    raise exception 'the auto-tip choice is locked for the season';
  end if;
  return new;
end $$;
create trigger profiles_lock_auto_tip before update on profiles for each row execute function lock_auto_tip();

-- Tips: your own any time; everyone's once the game has kicked off (so nobody copies).
create policy "read own tips" on tips for select to authenticated using (user_id = auth.uid());
create policy "read tips after kickoff" on tips for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and m.kickoff <= now()));

-- Lockout: a tip can be made, changed or removed only before its game's kickoff. A postponed game
-- reopens when the pipeline moves its kickoff.
create function before_kickoff(p_match bigint) returns boolean language sql stable as $$
  select exists (select 1 from matches m where m.id = p_match and now() < m.kickoff
                 and m.status in ('scheduled', 'postponed'))
$$;
create policy "tip before kickoff" on tips for insert to authenticated
  with check (user_id = auth.uid() and before_kickoff(match_id));
create policy "change a tip before kickoff" on tips for update to authenticated
  using (user_id = auth.uid() and before_kickoff(match_id))
  with check (user_id = auth.uid() and before_kickoff(match_id));
create policy "remove a tip before kickoff" on tips for delete to authenticated
  using (user_id = auth.uid() and before_kickoff(match_id));

grant select on matches, rounds to anon, authenticated;
grant select on profiles to authenticated;
revoke update on profiles from authenticated;
grant update (display_name, fav_team, auto_tip) on profiles to authenticated;
grant select, insert, update, delete on tips to authenticated;
grant select on effective_tips, tip_results, round_scores to authenticated;
revoke execute on function ladder(int) from public, anon;
grant execute on function ladder(int) to authenticated;
