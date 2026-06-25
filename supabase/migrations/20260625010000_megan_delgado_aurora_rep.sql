-- Megan Delgado Aurora Labs rep under Mike / Aurora Labs.
-- Direct login:
--   email: Delgado.megan@yahoo.com
--   temporary password: Delgado1!

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text,
  add column if not exists override_percent numeric,
  add column if not exists platform_percent numeric,
  add column if not exists rep_tier text,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default false,
  add column if not exists attribution_window_days integer not null default 30,
  add column if not exists payout_method text,
  add column if not exists payout_email text,
  add column if not exists paypal_link text,
  add column if not exists paypal_identifier text,
  add column if not exists payout_preference text,
  add column if not exists payout_status text,
  add column if not exists rep_channel text,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  megan_email text := 'Delgado.megan@yahoo.com';
  megan_email_normalized text := lower('Delgado.megan@yahoo.com');
  megan_password text := 'Delgado1!';
  megan_rep_code text := 'MEGDEL';
  megan_auth_id uuid;
  megan_profile_id uuid;
  megan_rep_id uuid;
  mike_profile_id uuid;
  aurora_rep_id uuid;
  aurora_prices jsonb := '[]'::jsonb;
  aurora_theme jsonb := '{}'::jsonb;
begin
  select id
    into megan_auth_id
  from auth.users
  where lower(coalesce(email, '')) = megan_email_normalized
  order by created_at desc
  limit 1;

  if megan_auth_id is null then
    megan_auth_id := gen_random_uuid();

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
      megan_auth_id,
      'authenticated',
      'authenticated',
      megan_email,
      extensions.crypt(megan_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Megan Delgado',
        'role', 'rep',
        'store_scope', 'AURORA',
        'store_slug', 'aurora',
        'rep_slug', megan_rep_code,
        'parent_rep_slug', 'AURORA',
        'parent_admin', 'Mike / Aurora Labs',
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
      email = megan_email,
      encrypted_password = extensions.crypt(megan_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Megan Delgado',
          'role', 'rep',
          'store_scope', 'AURORA',
          'store_slug', 'aurora',
          'rep_slug', megan_rep_code,
          'parent_rep_slug', 'AURORA',
          'parent_admin', 'Mike / Aurora Labs',
          'force_password_reset', true
        )
    where id = megan_auth_id;
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
    megan_auth_id,
    megan_auth_id::text,
    jsonb_build_object('sub', megan_auth_id::text, 'email', megan_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', megan_auth_id::text, 'email', megan_email),
    updated_at = now()
  where user_id = megan_auth_id
    and provider = 'email';

  select id
    into mike_profile_id
  from public.profiles
  where role in ('admin', 'rx_plus_admin')
    and (
      upper(coalesce(admin_scope, '')) = 'AURORA'
      or lower(coalesce(store_slug, '')) = 'aurora'
      or lower(coalesce(email, '')) in ('mnsgroup107@gmail.com', 'msngroup107@gmail.com')
    )
  order by
    case when lower(coalesce(email, '')) = 'mnsgroup107@gmail.com' then 0 else 1 end,
    case when lower(coalesce(email, '')) = 'msngroup107@gmail.com' then 0 else 1 end,
    created_at desc
  limit 1;

  select id, coalesce(custom_price_list, '[]'::jsonb), coalesce(brand_theme, '{}'::jsonb)
    into aurora_rep_id, aurora_prices, aurora_theme
  from public.reps
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
  order by case when rep_slug = 'AURORA' then 0 else 1 end, created_at desc
  limit 1;

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
    megan_auth_id,
    megan_auth_id,
    megan_email,
    'Megan Delgado',
    'rep',
    'AURORA',
    'aurora',
    coalesce((select email from public.profiles where id = mike_profile_id), 'mnsgroup107@gmail.com'),
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
    updated_at = now()
  returning id into megan_profile_id;

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
    paypal_identifier,
    payout_preference,
    payout_status,
    rep_channel,
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    account_type,
    parent_type,
    parent_rep_id,
    managed_by_profile_id,
    active
  )
  values (
    megan_profile_id,
    'Megan Delgado',
    null,
    megan_rep_code,
    megan_rep_code,
    'net_profit_after_true_cost',
    0.20,
    0.20,
    0.60,
    'aurora_downline_rep',
    megan_rep_code,
    0,
    '/MegDel',
    true,
    60,
    'pending',
    null,
    null,
    null,
    'pending',
    'pending',
    'aurora_downline_rep',
    'aurora',
    'Aurora Labs',
    aurora_theme || jsonb_build_object(
      'parentStore', 'Aurora Labs',
      'parentAdmin', 'Mike',
      'rollupParent', 'Rick Diaz / Rock Phorm',
      'payoutMethod', 'pending',
      'payoutPreference', 'pending',
      'payoutStatus', 'pending',
      'storefrontLink', '/MegDel',
      'queryStorefrontLink', '/auroralabs?rep=' || megan_rep_code
    ),
    aurora_prices,
    'rep',
    'aurora_downline',
    aurora_rep_id,
    mike_profile_id,
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
    paypal_identifier = excluded.paypal_identifier,
    payout_preference = excluded.payout_preference,
    payout_status = excluded.payout_status,
    rep_channel = excluded.rep_channel,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    active = true,
    updated_at = now()
  returning id into megan_rep_id;

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
    megan_rep_code,
    'Megan Delgado / Aurora Labs',
    'rep',
    megan_rep_code,
    'AURORA',
    true,
    0.20,
    'Aurora Labs downline rep for Megan Delgado. Megan receives 20% net profit. Parent attribution stays under Mike / Aurora Labs and rolls up under Rick Diaz / Rock Phorm.'
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
      internal_notes
    )
    values (
      'AURORA',
      mike_profile_id,
      coalesce((select email from public.profiles where id = mike_profile_id), 'mnsgroup107@gmail.com'),
      megan_rep_id,
      megan_email,
      'net_profit_after_true_cost',
      20,
      20,
      false,
      'active',
      'Megan Delgado receives 20% net-profit commission on Aurora Labs customer purchases.',
      'Parent store Aurora Labs. Parent admin Mike. Parent rep AURORA. Rollup parent Rick Diaz / Rock Phorm. Payout metadata pending; no PayPal identifier provided.'
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
      internal_notes
    )
    values (
      'AURORA',
      mike_profile_id,
      coalesce((select email from public.profiles where id = mike_profile_id), 'mnsgroup107@gmail.com'),
      megan_rep_id,
      megan_email,
      'Megan Delgado',
      'Megan Delgado',
      'aurora',
      '/MegDel',
      'aurora_rockphorm_pricing',
      jsonb_build_object(
        'storefront', true,
        'rep_portal', true,
        'checkout_attribution', true,
        'aurora_branding', true,
        'rockphorm_rollup', true
      ),
      jsonb_build_object(
        'attribution_code', megan_rep_code,
        'referral_link', '/r/' || megan_rep_code,
        'storefront_link', '/MegDel',
        'query_storefront_link', '/auroralabs?rep=' || megan_rep_code,
        'rep_portal', '/rep',
        'discount_code', megan_rep_code,
        'parent_rep_slug', 'AURORA',
        'parent_admin', 'Mike / Aurora Labs',
        'rollup_parent', 'Rick Diaz / Rock Phorm',
        'commission_percent', 20,
        'payoutMethod', 'pending',
        'payoutPreference', 'pending',
        'payoutStatus', 'pending',
        'paypalIdentifier', null
      ),
      'active',
      now(),
      'Aurora Labs storefront access for Megan Delgado under Mike / Aurora Labs. Payout metadata pending.'
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
      updated_at = now();
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
      'AURORA',
      mike_profile_id,
      coalesce((select email from public.profiles where id = mike_profile_id), 'mnsgroup107@gmail.com'),
      'aurora_rep_created',
      'reps',
      megan_rep_id,
      megan_rep_id,
      jsonb_build_object(
        'rep_slug', megan_rep_code,
        'rep_email', megan_email,
        'storefront_link', '/MegDel',
        'query_storefront_link', '/auroralabs?rep=' || megan_rep_code,
        'referral_link', '/r/' || megan_rep_code,
        'commission_percent', 20,
        'parent_rep_slug', 'AURORA',
        'rollup_parent', 'ROCKPHORM',
        'payoutMethod', 'pending',
        'payoutPreference', 'pending',
        'payoutStatus', 'pending',
        'paypalIdentifier', null
      ),
      'Megan Delgado Aurora Labs rep account, storefront attribution, commission, and pending payout metadata seeded.'
    );
  end if;
end $$;
