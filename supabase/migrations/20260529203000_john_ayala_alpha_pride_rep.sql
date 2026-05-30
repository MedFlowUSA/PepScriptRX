-- John Ayala / Alpha Pride Wellness rep portal.
-- John is a sub-rep under Mark Ayala / Empire Health & Wellness (MARK65).
-- Split of net profit: John 45%, Mark override 20%, PepScriptRX platform 35%.

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
  john_email text := 'Gluvwrk3@gmail.com';
  john_password text := 'Agent1!';
  john_auth_id uuid;
  john_profile_id uuid;
  john_rep_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  limit 1;

  if mark_rep_id is null then
    raise exception 'Cannot create Alpha Pride Wellness rep because MARK65 rep was not found.';
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
    into john_auth_id
  from auth.users
  where lower(email) = lower(john_email)
  order by created_at desc
  limit 1;

  if john_auth_id is null then
    john_auth_id := gen_random_uuid();

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
      john_auth_id,
      'authenticated',
      'authenticated',
      john_email,
      extensions.crypt(john_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"John Ayala"}'::jsonb,
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
      john_auth_id,
      john_auth_id::text,
      jsonb_build_object('sub', john_auth_id::text, 'email', john_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  select id
    into john_profile_id
  from public.profiles
  where auth_user_id = john_auth_id
     or lower(coalesce(email, '')) = lower(john_email)
     or (lower(coalesce(full_name, '')) = 'john ayala' and role = 'rep')
  order by
    case when auth_user_id = john_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if john_profile_id is null then
    john_profile_id := john_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      john_profile_id,
      john_auth_id,
      'John Ayala',
      john_email,
      'rep'
    );
  else
    update public.profiles
    set
      auth_user_id = john_auth_id,
      full_name = 'John Ayala',
      email = john_email,
      role = 'rep'
    where id = john_profile_id;
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
    john_profile_id,
    'John Ayala',
    'Alpha Pride Wellness',
    'SUBREP-ALPHAPRIDE',
    'ALPHAPRIDE',
    'net_profit_share',
    0.45,
    0.20,
    0.35,
    'empire_sub_rep',
    'ALPHAPRIDE',
    0,
    '/alphapride',
    true,
    60,
    'Manual PayPal payout',
    john_email,
    'empire_downline',
    mark_rep_id,
    mark_profile_id,
    'alphapride',
    'Alpha Pride Wellness',
    '{"palette":["#050505","#17120a","#d4af37","#facc15"],"style":"premium black and gold lion wellness"}'::jsonb,
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
  returning id into john_rep_id;

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
    'John Ayala',
    'alpha',
    'Alpha Pride Wellness',
    0.45,
    true,
    true,
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
  values
    ('ALPHAPRIDE', 'Alpha Pride Wellness', 'rep', 'ALPHAPRIDE', 'MARK65', true, 0.45, 'Alpha Pride Wellness checkout scope for John Ayala.'),
    ('ALPHA45', 'Alpha Pride Wellness', 'rep', 'ALPHAPRIDE', 'MARK65', true, 0.45, 'Alternate Alpha Pride Wellness checkout scope.')
  on conflict (scope_code) do update set
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id,
    is_active = excluded.is_active,
    default_commission_rate = excluded.default_commission_rate,
    notes = excluded.notes,
    updated_at = now();

  raise notice 'Alpha Pride Wellness rep id: %', john_rep_id;
end $$;
