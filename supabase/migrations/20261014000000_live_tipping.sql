-- What the live tipping comp needs beyond the first two migrations (PLAN_WEB.md step 10).

-- ---------------------------------------------------------------- the admin's "still to tip" list

-- How many of a round's games each tipper has tipped, without what they tipped, since everyone's
-- tips stay hidden until kickoff. Only the comp's admin gets any rows.
create function admin_tip_counts(p_season int, p_round int)
returns table (user_id uuid, tipped int)
language sql stable security definer set search_path = public as $$
  select t.user_id, count(*)::int
  from tips t join matches m on m.id = t.match_id
  where m.season = p_season and m.round = p_round and is_admin()
  group by t.user_id
$$;

-- Supabase's defaults let anyone run a new function; only signed-in tippers may (and only the
-- admin gets rows).
revoke all on function admin_tip_counts(int, int) from public, anon, authenticated;
grant execute on function admin_tip_counts(int, int) to authenticated;

-- ---------------------------------------------------------------- invites stay used

-- An invite's `used_by` is cleared when that tipper deletes their account, so "used" is judged
-- from `used_at`, which stays. Otherwise a departed tipper's invite would work again.
create or replace function check_invite(p_code text)
returns table (status text, invited_by text)
language sql stable security definer set search_path = public as $$
  select case when i.code is null or i.cancelled_at is not null then 'unknown'
              when i.used_at is not null then 'used'
              when i.expires_at <= now() then 'expired'
              else 'valid' end,
         case when i.code is not null and i.cancelled_at is null then p.display_name end
  from (select 1) one
  left join invites i on i.code = upper(trim(p_code))
  left join profiles p on p.id = i.created_by
$$;

create or replace function join_comp(p_code text, p_display_name text, p_fav_team text, p_auto_tip text)
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
  elsif inv.used_at is not null then
    raise exception 'invite already used';
  elsif inv.expires_at <= now() then
    raise exception 'invite expired';
  end if;
  insert into profiles (id, display_name, fav_team, auto_tip)
  values (auth.uid(), p_display_name, p_fav_team, coalesce(p_auto_tip, 'home'));
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
end $$;
