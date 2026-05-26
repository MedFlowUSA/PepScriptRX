-- Robert Luevano / WarXlabz sub-rep under Mark Ayala / Empire Health & Wellness.

create extension if not exists pgcrypto;

alter table public.reps
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists override_percent numeric(5,4) not null default 0,
  add column if not exists platform_percent numeric(5,4) not null default 0.35,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists paypal_link text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb;

alter table public.commission_ledger
  add column if not exists commission_role text not null default 'rep_commission_owner'
    check (commission_role in ('rep_commission_owner', 'override_owner', 'platform_margin_owner')),
  add column if not exists owner_label text;

alter table public.payouts
  drop constraint if exists payouts_recipient_type_check;

alter table public.payouts
  add constraint payouts_recipient_type_check
  check (recipient_type in ('admin', 'rep', 'override'));

do $$
begin
  alter table public.commission_ledger
    drop constraint if exists commission_ledger_submission_id_key;
exception when undefined_object then
  null;
end $$;

create unique index if not exists commission_ledger_submission_rep_role_idx
  on public.commission_ledger(submission_id, rep_id, commission_role);

do $$
declare
  robert_email text := 'robertluevano623@gmail.com';
  robert_password text := 'Agent1!';
  robert_auth_id uuid;
  robert_profile_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
  warx_price_list jsonb := '[
    {"name":"Reta","strength":"10mg","price":95},
    {"name":"Reta","strength":"20mg","price":160},
    {"name":"Reta","strength":"30mg","price":220},
    {"name":"Reta","strength":"50mg","price":375},
    {"name":"Reta Oral","strength":"500mcg","price":175},
    {"name":"Tirzepatide","strength":"10mg","price":90},
    {"name":"Tirzepatide","strength":"20mg","price":145},
    {"name":"Tirzepatide","strength":"30mg","price":199},
    {"name":"Tirzepatide Oral","strength":"500mcg","price":125},
    {"name":"GHK-Cu","strength":"50mg","price":45},
    {"name":"GHK-Cu","strength":"100mg","price":85},
    {"name":"MOTS-c","strength":"10mg","price":65},
    {"name":"MOTS-c","strength":"40mg","price":150},
    {"name":"Tesamorelin","strength":"10mg","price":100},
    {"name":"Tesamorelin","strength":"20mg","price":185},
    {"name":"CJC + Ipamorelin","strength":"10mg","price":100},
    {"name":"IGF-1 LR3","strength":"1mg","price":150},
    {"name":"HGH Kit","strength":"100iu","price":220},
    {"name":"HGH Kit","strength":"240iu","price":360},
    {"name":"HGH Kit","strength":"360iu","price":500},
    {"name":"BPC-157","strength":"10mg","price":65},
    {"name":"TB-500","strength":"10mg","price":70},
    {"name":"Klow","strength":"80mg","price":125},
    {"name":"Wolverine Stack","strength":"10mg","price":100},
    {"name":"Wolverine Stack","strength":"20mg","price":140},
    {"name":"NAD+","strength":"1000mg","price":100},
    {"name":"Lipo-C B12","strength":"Standard","price":100},
    {"name":"HCG","strength":"10000iu","price":125},
    {"name":"Semax","strength":"10mg","price":55},
    {"name":"Selank","strength":"10mg","price":55},
    {"name":"MT-2","strength":"10mg","price":50},
    {"name":"PT-141","strength":"10mg","price":55},
    {"name":"Glutathione","strength":"Standard","price":90},
    {"name":"Bac Water","strength":"10ml","price":15},
    {"name":"Bac Water","strength":"30ml","price":25},
    {"name":"Needles 31g","strength":"10 pack","price":10}
  ]'::jsonb;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  limit 1;

  update public.profiles
  set role = 'rx_plus_admin'
  where id = mark_profile_id;

  update public.reps
  set
    brand_name = 'Empire Health & Wellness',
    custom_store_slug = 'EmpireHealth&Wellness',
    override_percent = coalesce(nullif(override_percent, 0), 0),
    platform_percent = 0.35
  where id = mark_rep_id;

  select id
    into robert_auth_id
  from auth.users
  where lower(email) = lower(robert_email)
  order by created_at desc
  limit 1;

  if robert_auth_id is null then
    robert_auth_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      robert_auth_id,
      'authenticated',
      'authenticated',
      robert_email,
      extensions.crypt(robert_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Robert Luevano"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      robert_auth_id,
      robert_auth_id::text,
      jsonb_build_object('sub', robert_auth_id::text, 'email', robert_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  select id
    into robert_profile_id
  from public.profiles
  where auth_user_id = robert_auth_id
     or lower(coalesce(email, '')) = lower(robert_email)
  order by created_at desc
  limit 1;

  if robert_profile_id is null then
    robert_profile_id := robert_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      robert_profile_id,
      robert_auth_id,
      'Robert Luevano',
      robert_email,
      'rep'
    );
  else
    update public.profiles
    set
      auth_user_id = robert_auth_id,
      full_name = 'Robert Luevano',
      email = robert_email,
      role = 'rep'
    where id = robert_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_name,
    handle,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    override_percent,
    platform_percent,
    rep_tier,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    paypal_link,
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    active
  )
  values (
    robert_profile_id,
    'Robert Luevano',
    'WarXlabz',
    'SUBREP-WARXLABZ',
    'ROBERT',
    'net_profit_share',
    0.40,
    0.25,
    0.35,
    'empire_sub_rep',
    'ROBERT',
    0,
    '/warxlabz',
    true,
    60,
    'PayPal.Me',
    robert_email,
    'https://www.paypal.com/paypalme/RobertLuevano745?locale.x=en_US&country.x=US',
    'empire_downline',
    mark_rep_id,
    mark_profile_id,
    'warxlabz',
    'WarXlabz',
    '{"palette":["#050505","#1f1f1b","#facc15","#3f3f46"],"style":"military gym tactical"}'::jsonb,
    warx_price_list,
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    override_percent = excluded.override_percent,
    platform_percent = excluded.platform_percent,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    paypal_link = excluded.paypal_link,
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
    active = true;
end $$;
