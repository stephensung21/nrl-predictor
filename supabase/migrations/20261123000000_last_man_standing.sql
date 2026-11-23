-- Last man standing (docs/superpowers/specs/2026-11-21-last-man-standing-design.md): each round a
-- tipper picks one team to win; never the same team twice in a game; one wrong pick and they're out;
-- the last one left wins, and a new game starts the next round.
--
-- Only the picks live here, guarded like tips: a pick names a team in that round's game, locks at
-- the game's kickoff, stays hidden from others until then, and belongs to its tipper. The game rules
-- (who's out, repeats, when a game ends) are graded from the picks and results by web/lib/lms.ts, so
-- a pick that breaks one simply counts against its tipper.

create table lms_picks (
  user_id uuid not null references profiles (id) on delete cascade,
  season int not null,
  round int not null,
  match_id bigint not null references matches (id),
  team text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, season, round)
);
create index lms_picks_match on lms_picks (match_id);

-- A pick names a team playing in a regular-season game of that round. The Model sits out.
create function check_lms_pick() returns trigger language plpgsql as $$
declare
  m matches;
begin
  select * into m from matches where id = new.match_id;
  if m.season <> new.season or m.round <> new.round then
    raise exception 'match % is not in round % of %', new.match_id, new.round, new.season;
  end if;
  if m.is_final then
    raise exception 'last man standing is not played in the finals';
  end if;
  if new.team not in (m.home_team, m.away_team) then
    raise exception '% is not playing in match %', new.team, new.match_id;
  end if;
  if exists (select 1 from profiles p where p.id = new.user_id and p.is_model) then
    raise exception 'the Model does not play last man standing';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger lms_picks_check before insert or update on lms_picks for each row execute function check_lms_pick();

-- ---------------------------------------------------------------- row-level security

alter table lms_picks enable row level security;

-- Your own picks any time; everyone's once the picked game has kicked off (so nobody copies).
create policy "read own lms picks" on lms_picks for select to authenticated using (user_id = auth.uid());
create policy "read lms picks after kickoff" on lms_picks for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and m.kickoff <= now()));

-- Lockout: a pick is made, changed or removed only before its game's kickoff, and can't be moved
-- onto a game that has started.
create policy "pick before kickoff" on lms_picks for insert to authenticated
  with check (user_id = auth.uid() and before_kickoff(match_id));
create policy "change a pick before kickoff" on lms_picks for update to authenticated
  using (user_id = auth.uid() and before_kickoff(match_id))
  with check (user_id = auth.uid() and before_kickoff(match_id));
create policy "remove a pick before kickoff" on lms_picks for delete to authenticated
  using (user_id = auth.uid() and before_kickoff(match_id));

-- ---------------------------------------------------------------- grants

revoke all on lms_picks from anon, authenticated, analyst;
grant select, insert, update, delete on lms_picks to authenticated;
