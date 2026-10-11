-- Google sends a tipper's name and photo with every sign-in, and Supabase keeps them in the
-- sign-in's metadata (auth.users) and in the Google identity (auth.identities). The comp keeps only
-- what PRODUCT.md lists: an email, the name you choose, your team and your tips. So these are
-- dropped as they arrive, on the first sign-in and on every one after (Supabase refreshes them each
-- time). The email and Google's account id stay: Supabase needs them to sign you in.

create function public.strip_sign_in_profile() returns trigger
language plpgsql set search_path = '' as $$
declare
  personal constant text[] := array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'picture', 'avatar_url'];
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := new.raw_user_meta_data - personal;
  else
    new.identity_data := new.identity_data - personal;
  end if;
  return new;
end $$;

-- Only ever run as a trigger, never called through the API.
revoke all on function public.strip_sign_in_profile() from public, anon, authenticated;

create trigger strip_sign_in_profile before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_sign_in_profile();
create trigger strip_sign_in_profile before insert or update of identity_data on auth.identities
  for each row execute function public.strip_sign_in_profile();

-- Anyone who signed in before this: strip what's already there (the triggers do the work).
update auth.users set raw_user_meta_data = raw_user_meta_data
  where raw_user_meta_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'picture', 'avatar_url'];
update auth.identities set identity_data = identity_data
  where identity_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'picture', 'avatar_url'];
