-- Guy rep portal setup.
-- Creates/updates the GUY60 rep record and links it to a rep-role profile when Guy's Auth user exists.

create extension if not exists pgcrypto;

alter table public.reps
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists payout_method text,
  add column if not exists attribution_window_days integer not null default 60,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null;

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
     or (lower(coalesce(full_name, '')) = 'guy' and role = 'rep')
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
      'rep'
    );
  elsif guy_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, guy_auth_id),
      full_name = coalesce(nullif(full_name, ''), 'Guy'),
      email = coalesce(nullif(email, ''), guy_email),
      role = 'rep'
    where id = guy_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_name,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    rep_tier,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    active
  )
  values (
    guy_profile_id,
    'Guy',
    'REP006',
    'GUY60',
    'net_profit_share',
    0.60,
    'rx_plus_distributor',
    'GUY60',
    10,
    '/guy',
    true,
    60,
    'Email: guy@aactivated.com',
    guy_email,
    'company_direct',
    null,
    null,
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    rep_channel = excluded.rep_channel,
    parent_rep_id = null,
    managed_by_profile_id = null,
    active = true;
end $$;
