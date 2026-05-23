-- Link Guy's Supabase Auth user to an admin profile.
-- Keeps GUY60 attribution active while ensuring Guy can access the admin portal.

do $$
declare
  guy_email text := 'guy@aactivated.com';
  guy_auth_id uuid;
  guy_profile_id uuid;
begin
  select id
    into guy_auth_id
  from auth.users
  where lower(email) = lower(guy_email)
  order by created_at desc
  limit 1;

  if guy_auth_id is null then
    raise notice 'Guy auth user does not exist yet. Create auth user first, then re-run this migration logic.';
    return;
  end if;

  select id
    into guy_profile_id
  from public.profiles
  where auth_user_id = guy_auth_id
     or lower(coalesce(email, '')) = lower(guy_email)
  order by
    case when auth_user_id = guy_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if guy_profile_id is null then
    guy_profile_id := guy_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      guy_profile_id,
      guy_auth_id,
      'Guy',
      guy_email,
      'admin'
    );
  else
    update public.profiles
    set
      auth_user_id = guy_auth_id,
      full_name = coalesce(nullif(full_name, ''), 'Guy'),
      email = guy_email,
      role = 'admin'
    where id = guy_profile_id;
  end if;

  update public.reps
  set
    profile_id = guy_profile_id,
    rep_name = coalesce(rep_name, 'Guy'),
    commission_rate = 0.60,
    payout_email = guy_email,
    rep_tier = 'rx_plus_admin_distributor',
    rep_channel = 'company_direct',
    parent_rep_id = null,
    managed_by_profile_id = null,
    active = true
  where rep_slug = 'GUY60';
end $$;
