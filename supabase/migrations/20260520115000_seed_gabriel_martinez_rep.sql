-- Gabriel Martinez rep portal setup.
-- Creates/updates the GABE50 rep record and links it to a rep-role profile when Gabriel's Auth user exists.

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
  add column if not exists attribution_locked boolean not null default true;

do $$
declare
  gabriel_email text := 'gmart36@gmail.com';
  gabriel_auth_id uuid;
  gabriel_profile_id uuid;
begin
  select id
    into gabriel_auth_id
  from auth.users
  where lower(email) = lower(gabriel_email)
  order by created_at desc
  limit 1;

  select id
    into gabriel_profile_id
  from public.profiles
  where (gabriel_auth_id is not null and auth_user_id = gabriel_auth_id)
     or lower(coalesce(email, '')) = lower(gabriel_email)
     or (lower(coalesce(full_name, '')) = 'gabriel martinez' and role = 'rep')
  order by
    case when gabriel_auth_id is not null and auth_user_id = gabriel_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if gabriel_profile_id is null and gabriel_auth_id is not null then
    gabriel_profile_id := gabriel_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      gabriel_profile_id,
      gabriel_auth_id,
      'Gabriel Martinez',
      gabriel_email,
      'rep'
    );
  elsif gabriel_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, gabriel_auth_id),
      full_name = coalesce(nullif(full_name, ''), 'Gabriel Martinez'),
      email = coalesce(nullif(email, ''), gabriel_email),
      role = 'rep'
    where id = gabriel_profile_id;
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
    active
  )
  values (
    gabriel_profile_id,
    'Gabriel Martinez',
    '2ETQSVJGUNAEN',
    'GABE50',
    'net_profit_share',
    0.50,
    'standard_rep',
    'GABE50',
    10,
    '/gabriel',
    true,
    60,
    'Manual PayPal payout',
    gabriel_email,
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
    active = true;
end $$;
