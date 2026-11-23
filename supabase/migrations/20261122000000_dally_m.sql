-- The community Dally M (/dally-m; docs/superpowers/specs/2026-11-21-dally-m-design.md): each round,
-- every tipper gives 3, 2 and 1 votes to the best players of the round. Votes stay hidden until the
-- round's voting closes (the next round's first kickoff), then everyone sees who voted for whom.
--
-- `round_players` is model data, written by pipeline/players.py through publish.py: everyone who took
-- the field in a regular-season round. A round opens for votes once its players are published.

-- ---------------------------------------------------------------- tables

create table round_players (
  season int not null,
  round int not null,
  player_id bigint not null,
  match_id bigint not null references matches (id),
  player_name text not null,
  team text not null references teams (name),
  position text not null,
  head_image text,                         -- nrl.com's headshot link (only the link is stored)
  primary key (season, round, player_id)
);

create table dally_m_votes (
  user_id uuid not null references profiles (id) on delete cascade,
  season int not null,
  round int not null,
  votes int not null check (votes in (1, 2, 3)),
  player_id bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, season, round, votes),
  -- Three different players. Deferred, so a ballot can swap two players between slots in one go.
  constraint dally_m_votes_one_slot_each unique (user_id, season, round, player_id) deferrable initially deferred
);

-- ---------------------------------------------------------------- the voting window

-- Voting closes at the first kickoff after the round's last regular-season game: the next round's
-- first game, or for the last regular round the first final. With no later game, a week after.
create function dally_m_closes(p_season int, p_round int) returns timestamptz language sql stable as $$
  with last as (
    select max(kickoff) as k from matches where season = p_season and round = p_round and not is_final
  )
  select coalesce((select min(m.kickoff) from matches m, last where m.season = p_season and m.kickoff > last.k),
                  (select k + interval '7 days' from last))
$$;

-- Open: the round's players are published and voting hasn't closed.
create function dally_m_open(p_season int, p_round int) returns boolean language sql stable as $$
  select exists (select 1 from round_players where season = p_season and round = p_round)
     and now() < dally_m_closes(p_season, p_round)
$$;

-- Every round of a season that has opened, with when it closes.
create function dally_m_rounds(p_season int)
returns table (round int, closes timestamptz, is_open boolean, is_closed boolean) language sql stable as $$
  select r.round, c.closes, now() < c.closes, now() >= c.closes
  from (select distinct round from round_players where season = p_season) r
  cross join lateral (select dally_m_closes(p_season, r.round) as closes) c
  order by r.round
$$;

-- A vote names a player who played that round, and the Model doesn't vote.
create function check_dally_m_vote() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from round_players r
                 where r.season = new.season and r.round = new.round and r.player_id = new.player_id) then
    raise exception 'player % did not play in round % of %', new.player_id, new.round, new.season;
  end if;
  if exists (select 1 from profiles p where p.id = new.user_id and p.is_model) then
    raise exception 'the Model does not vote in the Dally M';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger dally_m_votes_check before insert or update on dally_m_votes
  for each row execute function check_dally_m_vote();

-- How many tippers have voted in a round, without what they voted (votes stay hidden until close).
create function dally_m_voters(p_season int, p_round int) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int from dally_m_votes where season = p_season and round = p_round
$$;

-- ---------------------------------------------------------------- results (closed rounds only)

-- Security invoker: they see only the votes the reader's policies allow, and they keep to closed
-- rounds, so a tipper's own votes on an open round never show up in a total.
create view dally_m_round_results with (security_invoker = true) as
select v.season, v.round, v.player_id, r.player_name, r.team, r.head_image,
       sum(v.votes)::int as votes,
       count(*) filter (where v.votes = 3)::int as threes,
       count(*) filter (where v.votes = 2)::int as twos,
       count(*) filter (where v.votes = 1)::int as ones
from dally_m_votes v
join round_players r using (season, round, player_id)
where now() >= dally_m_closes(v.season, v.round)
group by v.season, v.round, v.player_id, r.player_name, r.team, r.head_image;

-- The season so far, named as the player's latest round has him (a mid-season move shows his new team).
create view dally_m_leaderboard with (security_invoker = true) as
select t.season, t.player_id, l.player_name, l.team, l.head_image,
       sum(t.votes)::int as votes, sum(t.threes)::int as threes, sum(t.twos)::int as twos,
       sum(t.ones)::int as ones, count(*)::int as rounds
from dally_m_round_results t
join lateral (
  select player_name, team, head_image from round_players r
  where r.season = t.season and r.player_id = t.player_id order by r.round desc limit 1
) l on true
group by t.season, t.player_id, l.player_name, l.team, l.head_image;

-- ---------------------------------------------------------------- row-level security

alter table round_players enable row level security;
alter table dally_m_votes enable row level security;

create policy "anyone reads round players" on round_players for select to anon, authenticated, analyst using (true);

-- Your own votes any time; everyone's once the round's voting has closed (so nobody copies).
create policy "read own dally m votes" on dally_m_votes for select to authenticated using (user_id = auth.uid());
create policy "read dally m votes after close" on dally_m_votes for select to authenticated
  using (now() >= dally_m_closes(season, round));

-- Votes are cast, changed or removed only while the round is open.
create policy "vote while open" on dally_m_votes for insert to authenticated
  with check (user_id = auth.uid() and dally_m_open(season, round));
create policy "change a vote while open" on dally_m_votes for update to authenticated
  using (user_id = auth.uid() and dally_m_open(season, round))
  with check (user_id = auth.uid() and dally_m_open(season, round));
create policy "remove a vote while open" on dally_m_votes for delete to authenticated
  using (user_id = auth.uid() and dally_m_open(season, round));

-- ---------------------------------------------------------------- grants

revoke all on round_players, dally_m_votes, dally_m_round_results, dally_m_leaderboard from anon, authenticated;
grant select on round_players to anon, authenticated, analyst;
grant select, insert, update, delete on dally_m_votes to authenticated;
grant select on dally_m_round_results, dally_m_leaderboard to authenticated;

revoke all on function dally_m_voters(int, int) from public, anon, authenticated;
grant execute on function dally_m_voters(int, int) to authenticated;
