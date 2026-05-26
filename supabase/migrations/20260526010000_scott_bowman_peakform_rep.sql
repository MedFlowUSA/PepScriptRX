-- Scott Bowman / Peak Form Peptides rep profile.
-- Scott is a sub-rep under Mark Ayala (MARK65).
-- commission_rate = 0.40 (40% of net profit per deal).
-- Mark's override_percent is handled by the existing commission_ledger hierarchy logic.

create extension if not exists pgcrypto;

do $$
declare
  scott_email       text := 'ScottyB727@gmail.com';
  mark_rep_id       uuid;
  scott_auth_id     uuid;
  scott_profile_id  uuid;
  scott_rep_id      uuid;
begin
  -- Resolve Mark's rep record so we can set parent_rep_id
  select id into mark_rep_id from public.reps where rep_slug = 'MARK65' limit 1;

  -- Look up Scott's auth user if it already exists
  select id into scott_auth_id
  from auth.users
  where lower(email) = lower(scott_email)
  order by created_at desc
  limit 1;

  -- Resolve or create Scott's profile
  select id into scott_profile_id
  from public.profiles
  where (scott_auth_id is not null and auth_user_id = scott_auth_id)
     or lower(coalesce(email, '')) = lower(scott_email)
     or (lower(coalesce(full_name, '')) = 'scott bowman' and role = 'rep')
  order by
    case when scott_auth_id is not null and auth_user_id = scott_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if scott_profile_id is null and scott_auth_id is not null then
    scott_profile_id := scott_auth_id;
    insert into public.profiles (id, auth_user_id, full_name, email, role)
    values (scott_profile_id, scott_auth_id, 'Scott Bowman', scott_email, 'rep');
  elsif scott_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, scott_auth_id),
      full_name    = coalesce(nullif(full_name, ''), 'Scott Bowman'),
      email        = coalesce(nullif(email, ''), scott_email),
      role         = 'rep'
    where id = scott_profile_id;
  end if;

  -- Upsert Scott's rep record
  insert into public.reps (
    profile_id,
    rep_name,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    rep_tier,
    rep_channel,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    parent_rep_id,
    active
  )
  values (
    scott_profile_id,
    'Scott Bowman',
    'REP006',
    'SCOTTB',
    'net_profit_share',
    0.40,
    'standard_rep',
    'sub_rep',
    'SCOTTB',
    10,
    '/peakform',
    true,
    60,
    'PayPal.Me',
    scott_email,
    mark_rep_id,
    true
  )
  on conflict (rep_slug) do update set
    profile_id             = excluded.profile_id,
    rep_name               = excluded.rep_name,
    commission_type        = excluded.commission_type,
    commission_rate        = excluded.commission_rate,
    rep_tier               = excluded.rep_tier,
    rep_channel            = excluded.rep_channel,
    discount_code          = excluded.discount_code,
    discount_amount        = excluded.discount_amount,
    referral_path          = excluded.referral_path,
    attribution_locked     = excluded.attribution_locked,
    payout_method          = excluded.payout_method,
    payout_email           = excluded.payout_email,
    parent_rep_id          = excluded.parent_rep_id,
    active                 = true;

  -- Return the rep id for logging
  select id into scott_rep_id from public.reps where rep_slug = 'SCOTTB';
  raise notice 'Scott Bowman rep id: %', scott_rep_id;
end $$;
