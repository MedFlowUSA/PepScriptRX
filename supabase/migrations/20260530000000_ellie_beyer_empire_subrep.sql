-- Ellie Beyer / Empire Health & Wellness sub-rep storefront.
-- Ellie is a sub-rep under Mark Ayala / Empire Health & Wellness (MARK65).
-- Split of net profit: Ellie 45%, Mark override 20%, PepScriptRX platform 35%.

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
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb;

do $$
declare
  ellie_email text := 'leebeyer21@gmail.com';
  ellie_password text := 'Agent1!';
  ellie_auth_id uuid;
  ellie_profile_id uuid;
  ellie_rep_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  limit 1;

  if mark_rep_id is null then
    raise exception 'Cannot create Ellie Beyer rep because MARK65 rep was not found.';
  end if;

  update public.profiles
  set role = 'rx_plus_admin'
  where id = mark_profile_id;

  update public.reps
  set
    brand_name = 'Empire Health & Wellness',
    custom_store_slug = 'EmpireHealth&Wellness',
    platform_percent = 0.35
  where id = mark_rep_id;

  select id
    into ellie_auth_id
  from auth.users
  where lower(email) = lower(ellie_email)
  order by created_at desc
  limit 1;

  if ellie_auth_id is null then
    ellie_auth_id := gen_random_uuid();

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
      ellie_auth_id,
      'authenticated',
      'authenticated',
      ellie_email,
      extensions.crypt(ellie_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Ellie Beyer","phone":"909-435-5414"}'::jsonb,
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
      ellie_auth_id,
      ellie_auth_id::text,
      jsonb_build_object('sub', ellie_auth_id::text, 'email', ellie_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  select id
    into ellie_profile_id
  from public.profiles
  where auth_user_id = ellie_auth_id
     or lower(coalesce(email, '')) = lower(ellie_email)
     or (lower(coalesce(full_name, '')) = 'ellie beyer' and role = 'rep')
  order by
    case when auth_user_id = ellie_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if ellie_profile_id is null then
    ellie_profile_id := ellie_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      ellie_profile_id,
      ellie_auth_id,
      'Ellie Beyer',
      ellie_email,
      '909-435-5414',
      'rep'
    );
  else
    update public.profiles
    set
      auth_user_id = ellie_auth_id,
      full_name = 'Ellie Beyer',
      email = ellie_email,
      phone = '909-435-5414',
      role = 'rep'
    where id = ellie_profile_id;
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
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    active
  )
  values (
    ellie_profile_id,
    'Ellie Beyer',
    'Empire Health & Wellness',
    'SUBREP-EHWSUB',
    'EHWSUB',
    'net_profit_share',
    0.45,
    0.20,
    0.35,
    'empire_sub_rep',
    'EHWSUB',
    0,
    '/EHWSUB',
    true,
    60,
    'Manual PayPal payout',
    ellie_email,
    'empire_downline',
    mark_rep_id,
    mark_profile_id,
    'EHWSUB',
    'Empire Health & Wellness',
    '{"palette":["#0a1628","#0d2040","#25c7d9","#ffffff"],"style":"Empire Health & Wellness duplicate storefront"}'::jsonb,
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
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    active = true
  returning id into ellie_rep_id;

  insert into public.distributors (
    name,
    slug,
    portal_name,
    commission_rate,
    is_active,
    white_label_enabled,
    wholesale_enabled
  )
  values (
    'Ellie Beyer',
    'ellie',
    'Empire Health & Wellness',
    0.45,
    true,
    false,
    false
  )
  on conflict (slug) do update set
    name = excluded.name,
    portal_name = excluded.portal_name,
    commission_rate = excluded.commission_rate,
    is_active = excluded.is_active,
    white_label_enabled = excluded.white_label_enabled,
    wholesale_enabled = excluded.wholesale_enabled,
    updated_at = now();

  insert into public.checkout_scopes (
    scope_code,
    display_name,
    account_type,
    account_id,
    parent_account_id,
    is_active,
    default_commission_rate,
    notes
  )
  values (
    'EHWSUB',
    'Ellie Beyer / Empire Health & Wellness',
    'rep',
    'EHWSUB',
    'MARK65',
    true,
    0.45,
    'Ellie Beyer checkout scope under Mark Ayala / Empire Health & Wellness.'
  )
  on conflict (scope_code) do update set
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id,
    is_active = excluded.is_active,
    default_commission_rate = excluded.default_commission_rate,
    notes = excluded.notes,
    updated_at = now();

  raise notice 'Ellie Beyer rep id: %', ellie_rep_id;
end $$;
