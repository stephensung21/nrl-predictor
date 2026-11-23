-- Tipping groups (docs/superpowers/specs/2026-11-24-tipping-groups-design.md). Everyone who signs
-- up is in the global comp; a group is a friend circle's view of the same tippers: its own ladder,
-- last man standing and Dally M, over the one set of tips, picks and votes. Global isn't stored: it
-- is every profile.
--
-- Sign-up no longer needs an invite: `create_profile()` makes the profile and, given a group's code,
-- joins it, in one transaction. The admin's invites (`join_comp()`) still work for old links.
--
-- Groups are written only through the security-definer functions below; members can read their own
-- groups and those groups' members, and nobody else can.

-- ---------------------------------------------------------------- tables

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 30),
  code text not null unique,
  owner uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on group_members (user_id);

-- A tipper can be in at most this many groups.
create function max_groups() returns int language sql immutable as $$ select 10 $$;

-- ---------------------------------------------------------------- helpers

-- Security definer, so policies on group_members can use it without recursing into themselves.
create function is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid())
$$;

-- An 8-character joining code without lookalike characters (no I, L, O, 0 or 1).
create function new_group_code() returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into c from generate_series(1, 8);
    exit when not exists (select 1 from groups where code = c);
  end loop;
  return c;
end $$;

create function clean_group_name(p_name text) returns text language plpgsql immutable as $$
declare
  n text := btrim(coalesce(p_name, ''));
begin
  if length(n) < 1 or length(n) > 30 then
    raise exception 'a group name is 1 to 30 characters';
  end if;
  return n;
end $$;

create function require_profile() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'join the comp first';
  end if;
  return auth.uid();
end $$;

create function require_owner(p_group uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and owner = auth.uid()) then
    raise exception 'only the group''s owner can do that';
  end if;
end $$;

-- Adds the caller to a group, keeping to the cap. Joining a group you're already in does nothing.
create function add_member(p_group uuid, p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    return;
  end if;
  if (select count(*) from group_members where user_id = p_user) >= max_groups() then
    raise exception 'you can be in at most % groups', max_groups();
  end if;
  insert into group_members (group_id, user_id) values (p_group, p_user);
end $$;

-- ---------------------------------------------------------------- what tippers call

create function create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
  g uuid;
begin
  if (select count(*) from group_members where user_id = me) >= max_groups() then
    raise exception 'you can be in at most % groups', max_groups();
  end if;
  insert into groups (name, code, owner) values (clean_group_name(p_name), new_group_code(), me) returning id into g;
  perform add_member(g, me);
  return g;
end $$;

-- What the joining page shows before you join: the name and how many are in it, nothing else.
create function check_group(p_code text) returns table (name text, members int)
language sql stable security definer set search_path = public as $$
  select g.name, (select count(*)::int from group_members m where m.group_id = g.id)
  from groups g where g.code = upper(btrim(p_code))
$$;

create function join_group(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
  g uuid;
begin
  select id into g from groups where code = upper(btrim(p_code));
  if g is null then
    raise exception 'unknown group';
  end if;
  perform add_member(g, me);
  return g;
end $$;

-- Leaving, or being removed, or deleting your account: an owner's group passes to the member who
-- has been in it longest, and the last one out deletes it (settle_group below).
create function leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
begin
  delete from group_members where group_id = p_group and user_id = me;
  if not found then
    raise exception 'you''re not in that group';
  end if;
end $$;

create function settle_group() returns trigger language plpgsql security definer set search_path = public as $$
declare
  heir uuid;
begin
  select user_id into heir from group_members where group_id = old.group_id order by joined_at, user_id limit 1;
  if heir is null then
    delete from groups where id = old.group_id;
  else
    update groups set owner = heir where id = old.group_id and (owner = old.user_id or owner is null);
  end if;
  return null;
end $$;
create trigger group_members_settle after delete on group_members for each row execute function settle_group();

create function remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_owner(p_group);
  if p_user = auth.uid() then
    raise exception 'leave the group instead';
  end if;
  delete from group_members where group_id = p_group and user_id = p_user;
end $$;

create function rename_group(p_group uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_owner(p_group);
  update groups set name = clean_group_name(p_name) where id = p_group;
end $$;

-- A fresh code: the old link stops working.
create function reset_group_code(p_group uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text := new_group_code();
begin
  perform require_owner(p_group);
  update groups set code = c where id = p_group;
  return c;
end $$;

create function delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_owner(p_group);
  delete from groups where id = p_group;
end $$;

-- Sign-up: anyone signed in can make their profile, and join a group on the way with its code.
create function create_profile(p_display_name text, p_fav_team text, p_auto_tip text, p_group_code text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  g uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'already in the comp';
  end if;
  if p_group_code is not null and btrim(p_group_code) <> '' then
    select id into g from groups where code = upper(btrim(p_group_code));
    if g is null then
      raise exception 'unknown group';
    end if;
  end if;
  insert into profiles (id, display_name, fav_team, auto_tip)
  values (auth.uid(), btrim(p_display_name), p_fav_team, coalesce(p_auto_tip, 'home'));
  if g is not null then
    perform add_member(g, auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------- the ladder, by group

-- As before, plus an optional group: null is the global comp (everyone); a group keeps its members
-- and the Model, ranked among themselves. Someone who isn't in the group gets nothing. Dropped and
-- made again, since an overload would make `ladder(2027)` ambiguous.
drop function ladder(int);
create function ladder(p_season int, p_group uuid default null)
returns table (user_id uuid, display_name text, is_model boolean, points int, margin_score int,
               "position" int, tied boolean, movement int)
language sql stable as $$
  with field as (
    select p.* from profiles p
    where p_group is null
       or (is_member(p_group) and (p.is_model or exists (
             select 1 from group_members m where m.group_id = p_group and m.user_id = p.id)))
  ),
  scored as (
    select s.* from round_scores s join field f on f.id = s.user_id where s.season = p_season
  ),
  latest as (
    select max(round) as round, count(distinct round) as rounds from round_scores where season = p_season
  ),
  totals as (
    select p.id as user_id, p.display_name, p.is_model,
           coalesce(sum(s.correct + s.bonus), 0)::int as points,
           coalesce(sum(s.margin_score), 0)::int as margin_score,
           coalesce(sum(s.correct + s.bonus) filter (where s.round < (select round from latest)), 0)::int as points_before,
           coalesce(sum(s.margin_score) filter (where s.round < (select round from latest)), 0)::int as margin_before
    from field p
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

alter table groups enable row level security;
alter table group_members enable row level security;

create policy "members read their groups" on groups for select to authenticated using (is_member(id));
create policy "members read their groups' members" on group_members for select to authenticated using (is_member(group_id));

-- ---------------------------------------------------------------- grants

revoke all on groups, group_members from anon, authenticated, analyst;
grant select on groups, group_members to authenticated;

revoke all on function max_groups(), is_member(uuid), new_group_code(), clean_group_name(text), require_profile(),
  require_owner(uuid), add_member(uuid, uuid), settle_group(), create_group(text), check_group(text), join_group(text),
  leave_group(uuid), remove_member(uuid, uuid), rename_group(uuid, text), reset_group_code(uuid),
  delete_group(uuid), create_profile(text, text, text, text), ladder(int, uuid)
  from public, anon, authenticated;
grant execute on function is_member(uuid), create_group(text), check_group(text), join_group(text), leave_group(uuid),
  remove_member(uuid, uuid), rename_group(uuid, text), reset_group_code(uuid), delete_group(uuid),
  create_profile(text, text, text, text), ladder(int, uuid)
  to authenticated;
grant execute on function check_group(text) to anon;
