-- Sandman Wellness Labs direct child partner storefront.
-- Owner/admin: Dr. Tapan Joshi / tapjoshi@yahoo.com
-- Temporary password requested by support: Joshi1!
-- Commission: 50% of net profit after true landed cost. No upline overrides.

alter table public.profiles
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists brand_id text,
  add column if not exists partner_access_level text,
  add column if not exists access_scope text,
  add column if not exists global_admin boolean not null default false,
  add column if not exists super_admin boolean not null default false,
  add column if not exists can_view_all_brands boolean not null default false,
  add column if not exists can_view_all_reps boolean not null default false,
  add column if not exists can_view_all_orders boolean not null default false,
  add column if not exists can_view_all_customers boolean not null default false,
  add column if not exists can_edit_global_catalog boolean not null default false,
  add column if not exists can_edit_global_settings boolean not null default false,
  add column if not exists can_view_platform_financials boolean not null default false,
  add column if not exists can_view_other_partner_financials boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists brand_id text,
  add column if not exists parent_brand_id text,
  add column if not exists assigned_store_slug text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.patient_submissions
  add column if not exists brand_id text;

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
  'Sandman Wellness Labs',
  'sandman',
  'Sandman Wellness Labs',
  0.5000,
  true,
  true,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = true,
  white_label_enabled = true,
  wholesale_enabled = false,
  updated_at = now();

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  null,
  row_number() over (order by
    case
      when p.product_name ilike '%bpc%' then 0
      when p.product_name ilike '%tb-500%' then 1
      when p.product_name ilike '%cjc%' then 2
      when p.product_name ilike '%ipamorelin%' then 3
      when p.product_name ilike '%tirzepatide%' then 4
      when p.product_name ilike '%semaglutide%' then 5
      when p.product_name ilike '%nad%' then 6
      when p.product_name ilike '%wolverine%' then 7
      else 10
    end,
    p.product_name,
    p.strength
  ) <= 8,
  0.5000
from public.distributors d
cross join public.rx_plus_products p
where d.slug = 'sandman'
  and p.active = true
  and p.visibility_type in ('public', 'rx_plus', 'distributor_only')
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = null,
  featured = excluded.featured,
  commission_rate = 0.5000,
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
  'SANDMAN',
  'Sandman Wellness Labs',
  'admin',
  'SANDMAN',
  'platform',
  true,
  0.5000,
  'Sandman Wellness Labs direct child of the main platform. Commission basis: 50% of net profit after true landed cost. No parent/upline override.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = true,
  default_commission_rate = 0.5000,
  notes = excluded.notes,
  updated_at = now();

insert into public.partner_brands (
  brand_id,
  store_slug,
  store_name,
  scope_code,
  owner_email,
  access_level,
  logo_url,
  colors,
  hero_text,
  custom_url,
  status,
  capabilities,
  pricing_guardrails
)
values (
  'sandman',
  'sandman',
  'Sandman Wellness Labs',
  'SANDMAN',
  'tapjoshi@yahoo.com',
  'full',
  '/brands/sandman/sandman-logo.png',
  jsonb_build_object(
    'primary', '#171511',
    'secondary', '#24211c',
    'accent', '#c9a86a',
    'gold', '#ead39a',
    'surface', '#f5f0e8',
    'text', '#11100e'
  ),
  'Align. Restore. Live Well.',
  '/sandman',
  'active',
  jsonb_build_object(
    'dashboard', true,
    'analytics', true,
    'orders', true,
    'customers', true,
    'pricing', true,
    'pricing_manager', true,
    'pricing_management', true,
    'discounts', true,
    'discount_codes', true,
    'product_visibility', true,
    'products', true,
    'reports', true,
    'sales_reports', true,
    'rep_management', true,
    'inventory', true,
    'inventory_visibility', true,
    'store_settings', true,
    'store_customization', true,
    'marketing', true,
    'storefront', true,
    'commission_reports', true,
    'commission_editing', false,
    'payouts', false,
    'global_admin', false,
    'cross_brand_visibility', false
  ),
  jsonb_build_object(
    'commission_rate', 0.5,
    'platform_rate', 0.5,
    'basis', 'net_profit_after_true_landed_cost',
    'formula', 'selling_price_minus_true_landed_cost',
    'standard_catalog_pricing', true,
    'direct_child_of_platform', true,
    'no_upline_overrides', true,
    'disallow_cross_brand_visibility', true
  )
)
on conflict (brand_id) do update set
  store_slug = excluded.store_slug,
  store_name = excluded.store_name,
  scope_code = excluded.scope_code,
  owner_email = excluded.owner_email,
  access_level = excluded.access_level,
  logo_url = excluded.logo_url,
  colors = excluded.colors,
  hero_text = excluded.hero_text,
  custom_url = excluded.custom_url,
  status = excluded.status,
  capabilities = excluded.capabilities,
  pricing_guardrails = excluded.pricing_guardrails,
  updated_at = now();

do $$
declare
  sandman_email text := 'tapjoshi@yahoo.com';
  sandman_password text := 'Joshi1!';
  sandman_auth_id uuid;
  sandman_profile_id uuid;
  sandman_rep_id uuid;
begin
  select id
    into sandman_auth_id
  from auth.users
  where lower(coalesce(email, '')) = sandman_email
  order by created_at desc
  limit 1;

  if sandman_auth_id is null then
    sandman_auth_id := gen_random_uuid();

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
      sandman_auth_id,
      'authenticated',
      'authenticated',
      sandman_email,
      extensions.crypt(sandman_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Dr. Tapan Joshi',
        'role', 'partner_admin_full',
        'admin_scope', 'SANDMAN',
        'store_slug', 'sandman',
        'brand_id', 'sandman',
        'admin_code', 'SANDMAN',
        'force_password_reset', false
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
      encrypted_password = extensions.crypt(sandman_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Dr. Tapan Joshi',
          'role', 'partner_admin_full',
          'admin_scope', 'SANDMAN',
          'store_slug', 'sandman',
          'brand_id', 'sandman',
          'admin_code', 'SANDMAN',
          'force_password_reset', false
        )
    where id = sandman_auth_id;
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
    sandman_auth_id,
    sandman_auth_id::text,
    jsonb_build_object('sub', sandman_auth_id::text, 'email', sandman_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    provider_id = sandman_auth_id::text,
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', sandman_auth_id::text, 'email', sandman_email),
    updated_at = now()
  where user_id = sandman_auth_id
    and provider = 'email';

  select id
    into sandman_profile_id
  from public.profiles
  where auth_user_id = sandman_auth_id
     or lower(coalesce(email, '')) = sandman_email
  order by
    case when auth_user_id = sandman_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if sandman_profile_id is null then
    sandman_profile_id := sandman_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      admin_scope,
      store_slug,
      owner_email,
      brand_id,
      partner_access_level,
      access_scope,
      updated_at
    )
    values (
      sandman_profile_id,
      sandman_auth_id,
      sandman_email,
      'Dr. Tapan Joshi',
      'partner_admin_full',
      'SANDMAN',
      'sandman',
      sandman_email,
      'sandman',
      'full',
      'brand_only',
      now()
    );
  end if;

  update public.profiles
  set
    auth_user_id = sandman_auth_id,
    email = sandman_email,
    full_name = 'Dr. Tapan Joshi',
    role = 'partner_admin_full',
    admin_scope = 'SANDMAN',
    store_slug = 'sandman',
    owner_email = sandman_email,
    brand_id = 'sandman',
    partner_access_level = 'full',
    access_scope = 'brand_only',
    global_admin = false,
    super_admin = false,
    can_view_all_brands = false,
    can_view_all_reps = false,
    can_view_all_orders = false,
    can_view_all_customers = false,
    can_edit_global_catalog = false,
    can_edit_global_settings = false,
    can_view_platform_financials = false,
    can_view_other_partner_financials = false,
    updated_at = now()
  where id = sandman_profile_id;

  insert into public.partner_admin_brand_assignments (
    profile_id,
    brand_id,
    access_level,
    status
  )
  values (
    sandman_profile_id,
    'sandman',
    'full',
    'active'
  )
  on conflict (profile_id, brand_id) do update set
    access_level = 'full',
    status = 'active';

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
    managed_by_profile_id,
    parent_rep_id,
    custom_store_slug,
    brand_name,
    brand_id,
    parent_brand_id,
    assigned_store_slug,
    account_type,
    parent_type,
    active
  )
  values (
    sandman_profile_id,
    'Sandman Wellness Labs',
    'SANDMAN',
    'SANDMAN-DIRECT-PARTNER',
    'SANDMAN',
    'net_profit_after_true_landed_cost',
    0.5000,
    0.0000,
    0.5000,
    'direct_platform_partner_admin',
    'SANDMAN',
    0,
    '/sandman',
    true,
    60,
    'Partner payout - 50% net profit after true landed cost',
    sandman_email,
    'sandman_direct_partner_store',
    sandman_profile_id,
    null,
    'sandman',
    'Sandman Wellness Labs',
    'sandman',
    null,
    'sandman',
    'admin',
    'platform_direct_partner_store',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = 0.5000,
    override_percent = 0.0000,
    platform_percent = 0.5000,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = 0,
    referral_path = excluded.referral_path,
    attribution_locked = true,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    rep_channel = excluded.rep_channel,
    managed_by_profile_id = excluded.managed_by_profile_id,
    parent_rep_id = null,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_id = excluded.brand_id,
    parent_brand_id = null,
    assigned_store_slug = excluded.assigned_store_slug,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true,
    updated_at = now()
  returning id into sandman_rep_id;

  if sandman_rep_id is null then
    select id into sandman_rep_id
    from public.reps
    where upper(coalesce(rep_slug, '')) = 'SANDMAN'
    limit 1;
  end if;

  if sandman_rep_id is not null and to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      commission_type,
      commission_percent,
      special_note,
      approval_required,
      approval_status,
      internal_notes,
      brand_id,
      rep_name,
      commission_basis,
      parent_override_percent,
      platform_percent,
      status,
      updated_at
    )
    values (
      'SANDMAN',
      sandman_profile_id,
      sandman_email,
      sandman_rep_id,
      sandman_email,
      'net_profit_after_true_landed_cost',
      50.00,
      'Sandman receives 50% of net profit after true landed cost. This is not gross revenue commission.',
      false,
      'active',
      'Direct child of main platform. No Empire, Rock Phorm, Aurora, KLOW, GLOW, AACTIVATED, or other upline override.',
      'sandman',
      'Sandman Wellness Labs',
      'net_profit_after_true_landed_cost',
      0.00,
      50.00,
      'active',
      now()
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      commission_type = excluded.commission_type,
      commission_percent = excluded.commission_percent,
      special_note = excluded.special_note,
      approval_required = excluded.approval_required,
      approval_status = excluded.approval_status,
      internal_notes = excluded.internal_notes,
      brand_id = excluded.brand_id,
      rep_name = excluded.rep_name,
      commission_basis = excluded.commission_basis,
      parent_override_percent = 0.00,
      platform_percent = 50.00,
      status = excluded.status,
      updated_at = now();
  end if;

  if sandman_rep_id is not null and to_regclass('public.partner_rep_store_settings') is not null then
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
      product_list_id,
      product_list_name,
      pricing_mode,
      features,
      promo_config,
      status,
      activated_at,
      internal_notes,
      brand_id,
      updated_at
    )
    values (
      'SANDMAN',
      sandman_profile_id,
      sandman_email,
      sandman_rep_id,
      sandman_email,
      'Dr. Tapan Joshi',
      'Sandman Wellness Labs',
      'sandman',
      '/sandman',
      null,
      'Standard PepScriptRX Catalog',
      'main_catalog',
      jsonb_build_object(
        'standalone_storefront', true,
        'standard_catalog', true,
        'stripe_checkout', true,
        'paypal', true,
        'newsletter', true,
        'age_gate', true,
        'calculators', true,
        'certificates', true,
        'admin_analytics', true
      ),
      jsonb_build_object(
        'discount_code', 'SANDMAN',
        'tagline', 'Align. Restore. Live Well.',
        'commission_basis', 'net_profit_after_true_landed_cost'
      ),
      'active',
      now(),
      'Sandman Wellness Labs direct platform child storefront with no upline overrides.',
      'sandman',
      now()
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      rep_name = excluded.rep_name,
      public_display_name = excluded.public_display_name,
      store_slug = excluded.store_slug,
      storefront_path = excluded.storefront_path,
      product_list_id = excluded.product_list_id,
      product_list_name = excluded.product_list_name,
      pricing_mode = excluded.pricing_mode,
      features = excluded.features,
      promo_config = excluded.promo_config,
      status = excluded.status,
      activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
      internal_notes = excluded.internal_notes,
      brand_id = excluded.brand_id,
      disabled_at = null,
      updated_at = now();
  end if;
end $$;

insert into public.partner_marketing_assets (
  brand_id,
  store_slug,
  asset_name,
  asset_type,
  storage_path,
  public_url,
  metadata
)
values
  ('sandman', 'sandman', 'Sandman Wellness Labs Logo', 'image/png', 'public/brands/sandman/sandman-logo.png', '/brands/sandman/sandman-logo.png', jsonb_build_object('usage', 'primary_logo')),
  ('sandman', 'sandman', 'Sandman Wellness Labs Vial Placeholder', 'image/png', 'public/brands/sandman/sandman-vial-placeholder.png', '/brands/sandman/sandman-vial-placeholder.png', jsonb_build_object('usage', 'product_placeholder')),
  ('sandman', 'sandman', 'Sandman Wellness Labs Basket Hero', 'image/png', 'public/brands/sandman/sandman-basket-hero.png', '/brands/sandman/sandman-basket-hero.png', jsonb_build_object('usage', 'hero_background'))
on conflict do nothing;

update public.patient_submissions
set
  brand_id = 'sandman',
  store_slug = 'sandman',
  store_name = 'Sandman Wellness Labs',
  checkout_scope_code = case
    when nullif(checkout_scope_code, '') is null then 'SANDMAN'
    else checkout_scope_code
  end,
  source_portal = 'Sandman Wellness Labs',
  source_store = 'sandman',
  source_admin = 'SANDMAN',
  source_rep = 'SANDMAN',
  admin_code = 'SANDMAN',
  commission_owner = 'SANDMAN',
  commission_rate = 0.5000,
  partner_payout_eligible = true
where upper(coalesce(checkout_scope_code, '')) = 'SANDMAN'
   or lower(coalesce(store_slug, '')) = 'sandman'
   or lower(coalesce(source_portal, '')) like '%sandman%'
   or upper(coalesce(source_admin, '')) = 'SANDMAN'
   or upper(coalesce(source_rep, '')) = 'SANDMAN'
   or upper(coalesce(admin_code, '')) = 'SANDMAN'
   or upper(coalesce(referral_code, '')) = 'SANDMAN'
   or upper(coalesce(discount_code, '')) = 'SANDMAN';

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('SANDMAN' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''',
      '    when v_scope_code = ''SANDMAN'' or v_store_hint like ''%sandman%'' then ''sandman''
    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto'''
    );

    if next_fn = fn then
      next_fn := replace(
        fn,
        '    else null',
        '    when v_scope_code = ''SANDMAN'' or v_store_hint like ''%sandman%'' then ''sandman''
    else null'
      );
    end if;

    if next_fn = fn then
      raise exception 'Could not patch Sandman checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

do $$
begin
  if to_regclass('public.product_intelligence_store_visibility') is not null
     and to_regclass('public.product_intelligence_products') is not null then
    insert into public.product_intelligence_store_visibility (
      product_key,
      store_key,
      store_name,
      visible,
      source
    )
    select
      p.product_key,
      'sandman',
      'Sandman Wellness Labs',
      coalesce(main_visible.visible, p.active_status = 'active'),
      'main_catalog_mirror'
    from public.product_intelligence_products p
    left join public.product_intelligence_store_visibility main_visible
      on main_visible.product_key = p.product_key
     and main_visible.store_key = 'main'
    on conflict (product_key, store_key) do update set
      store_name = excluded.store_name,
      visible = excluded.visible,
      source = excluded.source;
  end if;
end $$;
