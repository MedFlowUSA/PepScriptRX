-- Guy is an admin/distributor contact, not a rep portal user.
-- Keep GUY60 referral attribution active, but make the linked login profile an admin.

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

  select id
    into guy_profile_id
  from public.profiles
  where (guy_auth_id is not null and auth_user_id = guy_auth_id)
     or lower(coalesce(email, '')) = lower(guy_email)
  order by
    case when guy_auth_id is not null and auth_user_id = guy_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if guy_profile_id is null and guy_auth_id is not null then
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
  elsif guy_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, guy_auth_id),
      full_name = coalesce(nullif(full_name, ''), 'Guy'),
      email = coalesce(nullif(email, ''), guy_email),
      role = 'admin'
    where id = guy_profile_id;
  end if;

  update public.reps
  set
    profile_id = coalesce(guy_profile_id, profile_id),
    rep_tier = 'rx_plus_admin_distributor',
    rep_channel = 'company_direct',
    parent_rep_id = null,
    managed_by_profile_id = null,
    active = true
  where rep_slug = 'GUY60';
end $$;
