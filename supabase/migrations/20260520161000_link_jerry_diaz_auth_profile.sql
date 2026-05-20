-- Link Jerry Diaz's Auth user/profile to his JERRY45 rep record.

do $$
declare
  jerry_email text := 'JDiaz@OAISINC.COM';
  jerry_auth_id uuid;
  jerry_profile_id uuid;
begin
  select id
    into jerry_auth_id
  from auth.users
  where lower(email) = lower(jerry_email)
  order by created_at desc
  limit 1;

  if jerry_auth_id is null then
    return;
  end if;

  select id
    into jerry_profile_id
  from public.profiles
  where auth_user_id = jerry_auth_id
     or lower(coalesce(email, '')) = lower(jerry_email)
  order by
    case when auth_user_id = jerry_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if jerry_profile_id is null then
    jerry_profile_id := jerry_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      jerry_profile_id,
      jerry_auth_id,
      'Jerry Diaz',
      jerry_email,
      'rep'
    );
  else
    update public.profiles
    set
      auth_user_id = jerry_auth_id,
      full_name = coalesce(nullif(full_name, ''), 'Jerry Diaz'),
      email = coalesce(nullif(email, ''), jerry_email),
      role = 'rep'
    where id = jerry_profile_id;
  end if;

  update public.reps
  set
    profile_id = jerry_profile_id,
    rep_name = 'Jerry Diaz',
    handle = '@jerrydee1',
    rep_identifier = 'REP005',
    commission_rate = 0.45,
    rep_tier = 'company_direct',
    rep_channel = 'company_direct',
    parent_rep_id = null,
    managed_by_profile_id = null,
    payout_email = jerry_email,
    active = true
  where rep_slug = 'JERRY45';
end $$;
