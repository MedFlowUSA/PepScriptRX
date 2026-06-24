-- Provision Jordan Wiggins / WIGG for AACTIVATEDRX rep portal login.
-- Temporary login:
--   email: showtimewigg@gmail.com
--   password: Wigg-Temp-2026!

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists payout_email text,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  jordan_email text := 'showtimewigg@gmail.com';
  jordan_password text := 'Wigg-Temp-2026!';
  jordan_auth_id uuid;
  jordan_profile_id uuid;
  jordan_rep_id uuid;
  guy_profile_id uuid;
  guy_rep_id uuid;
begin
  select id
    into guy_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = 'guy@aactivated.com'
     or lower(coalesce(owner_email, '')) = 'guy@aactivated.com'
     or upper(coalesce(admin_scope, '')) in ('AACTIVATEDRX', 'AACTIVATED', 'GUY60', 'VITALITYINS')
  order by
    case when lower(coalesce(email, '')) = 'guy@aactivated.com' then 0 else 1 end,
    created_at desc
  limit 1;

  select id
    into guy_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'GUY60'
     or lower(coalesce(payout_email, '')) = 'guy@aactivated.com'
     or profile_id = guy_profile_id
  order by
    case when upper(coalesce(rep_slug, '')) = 'GUY60' then 0 else 1 end,
    created_at asc
  limit 1;

  select id
    into jordan_auth_id
  from auth.users
  where lower(coalesce(email, '')) = jordan_email
  order by created_at desc
  limit 1;

  if jordan_auth_id is null then
    jordan_auth_id := gen_random_uuid();

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
      jordan_auth_id,
      'authenticated',
      'authenticated',
      jordan_email,
      extensions.crypt(jordan_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Jordan Wiggins',
        'role', 'rep',
        'store_scope', 'AACTIVATEDRX',
        'store_slug', 'aactivated',
        'rep_slug', 'WIGG',
        'portal', '/rep',
        'storefront', '/AACTIVATED?rep=WIGG',
        'force_password_reset', true
      ),
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set
      email = jordan_email,
      encrypted_password = extensions.crypt(jordan_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Jordan Wiggins',
          'role', 'rep',
          'store_scope', 'AACTIVATEDRX',
          'store_slug', 'aactivated',
          'rep_slug', 'WIGG',
          'portal', '/rep',
          'storefront', '/AACTIVATED?rep=WIGG',
          'force_password_reset', true
        )
    where id = jordan_auth_id;
  end if;

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
    jordan_auth_id,
    jordan_auth_id::text,
    jsonb_build_object('sub', jordan_auth_id::text, 'email', jordan_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', jordan_auth_id::text, 'email', jordan_email),
    updated_at = now()
  where user_id = jordan_auth_id
    and provider = 'email';

  select id
    into jordan_profile_id
  from public.profiles
  where auth_user_id = jordan_auth_id
     or lower(coalesce(email, '')) = jordan_email
  order by
    case when auth_user_id = jordan_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if jordan_profile_id is null then
    jordan_profile_id := jordan_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      admin_scope,
      store_slug,
      owner_email,
      updated_at
    )
    values (
      jordan_profile_id,
      jordan_auth_id,
      jordan_email,
      'Jordan Wiggins',
      'rep',
      'AACTIVATEDRX',
      'aactivated',
      jordan_email,
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = excluded.full_name,
      role = 'rep',
      admin_scope = excluded.admin_scope,
      store_slug = excluded.store_slug,
      owner_email = excluded.owner_email,
      updated_at = now();
  else
    update public.profiles
    set
      auth_user_id = jordan_auth_id,
      email = jordan_email,
      full_name = 'Jordan Wiggins',
      role = 'rep',
      admin_scope = 'AACTIVATEDRX',
      store_slug = 'aactivated',
      owner_email = jordan_email,
      updated_at = now()
    where id = jordan_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_slug,
    rep_name,
    handle,
    commission_type,
    commission_rate,
    payout_email,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    rep_tier,
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    active,
    updated_at
  )
  values (
    jordan_profile_id,
    'WIGG',
    'Jordan Wiggins',
    'Jordan Wiggins',
    'net_profit_share',
    0.5,
    jordan_email,
    'WIGG',
    0,
    '/r/WIGG',
    true,
    60,
    'aactivated_rep',
    'aactivated_downline',
    guy_rep_id,
    guy_profile_id,
    'aactivated',
    'AACTIVATEDRX',
    true,
    now()
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    payout_email = excluded.payout_email,
    discount_code = excluded.discount_code,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    rep_tier = excluded.rep_tier,
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    active = true,
    updated_at = now()
  returning id into jordan_rep_id;

  if to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      commission_type,
      commission_percent,
      override_percent,
      approval_required,
      approval_status,
      special_note,
      internal_notes,
      created_by,
      updated_by
    )
    values (
      'AACTIVATEDRX',
      guy_profile_id,
      'guy@aactivated.com',
      jordan_rep_id,
      jordan_email,
      'flat_net_profit',
      50,
      0,
      false,
      'active',
      'Jordan Wiggins / WIGG receives 50% net-profit commission on customer purchases.',
      'AACTIVATEDRX rep portal login repaired and linked to WIGG.',
      guy_profile_id,
      guy_profile_id
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      commission_type = excluded.commission_type,
      commission_percent = excluded.commission_percent,
      override_percent = excluded.override_percent,
      approval_required = excluded.approval_required,
      approval_status = excluded.approval_status,
      special_note = excluded.special_note,
      internal_notes = excluded.internal_notes,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;

  if to_regclass('public.partner_rep_store_settings') is not null then
    insert into public.partner_rep_store_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      rep_name,
      public_display_name,
      store_slug,
      storefront_path,
      pricing_mode,
      features,
      promo_config,
      status,
      activated_at,
      internal_notes,
      created_by,
      updated_by
    )
    values (
      'AACTIVATEDRX',
      guy_profile_id,
      'guy@aactivated.com',
      jordan_rep_id,
      jordan_email,
      'Jordan Wiggins',
      'Jordan Wiggins',
      'wigg',
      '/AACTIVATED?rep=WIGG',
      'aactivated_default',
      jsonb_build_object('storefront', true, 'rep_portal', true, 'checkout_attribution', true, 'promo_links', true),
      jsonb_build_object(
        'attribution_code', 'WIGG',
        'referral_link', '/r/WIGG',
        'storefront_link', '/AACTIVATED?rep=WIGG',
        'discount_code', 'WIGG',
        'rep_portal', '/rep'
      ),
      'active',
      now(),
      'AACTIVATEDRX rep storefront and login repaired for Jordan Wiggins / WIGG.',
      guy_profile_id,
      guy_profile_id
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      rep_name = excluded.rep_name,
      public_display_name = excluded.public_display_name,
      store_slug = excluded.store_slug,
      storefront_path = excluded.storefront_path,
      pricing_mode = excluded.pricing_mode,
      features = excluded.features,
      promo_config = excluded.promo_config,
      status = excluded.status,
      activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
      disabled_at = null,
      internal_notes = excluded.internal_notes,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;

  if to_regclass('public.rep_store_intake_submissions') is not null then
    update public.rep_store_intake_submissions
    set
      status = 'launched',
      approval_status = 'approved',
      source_portal_id = coalesce(source_portal_id, 'aactivated'),
      source_portal = coalesce(source_portal, 'AACTIVATEDRX'),
      source_route = coalesce(source_route, '/AACTIVATED/rep-intake'),
      parent_store_slug = 'aactivated',
      parent_store_name = 'AACTIVATEDRX',
      partner_admin_email = 'guy@aactivated.com',
      approval_owner_email = 'guy@aactivated.com',
      review_queue = 'aactivated',
      review_admin_code = coalesce(review_admin_code, 'GUY60'),
      review_admin_name = coalesce(review_admin_name, 'Guy Griffithe - GUY60'),
      approval_notes = trim(coalesce(approval_notes, '') || E'\nRep portal login repaired. Email showtimewigg@gmail.com linked to WIGG.'),
      internal_notes = trim(coalesce(internal_notes, '') || E'\nRep portal login repaired. Email showtimewigg@gmail.com linked to WIGG.'),
      updated_at = now()
    where lower(coalesce(email, '')) = jordan_email
       or upper(coalesce(desired_rep_code, '')) = 'WIGG';
  end if;

  if to_regclass('public.partner_rep_setup_audit') is not null then
    insert into public.partner_rep_setup_audit (
      store_scope,
      actor_id,
      actor_email,
      action,
      target_table,
      target_id,
      rep_id,
      new_value,
      audit_notes
    )
    values (
      'AACTIVATEDRX',
      guy_profile_id,
      'guy@aactivated.com',
      'rep_portal_login_repaired',
      'reps',
      jordan_rep_id,
      jordan_rep_id,
      jsonb_build_object(
        'rep_slug', 'WIGG',
        'email', jordan_email,
        'profile_id', jordan_profile_id,
        'auth_user_id', jordan_auth_id,
        'storefront_link', '/AACTIVATED?rep=WIGG',
        'rep_portal', '/rep'
      ),
      'Jordan Wiggins / WIGG login provisioned from support request.'
    );
  end if;
end $$;
