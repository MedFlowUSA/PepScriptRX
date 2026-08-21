-- Replace the active Sandman public storefront with JSK Medical & Wellness.
-- Historical Sandman submissions, payouts, and accounting rows are intentionally preserved.

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
  'JSK Medical & Wellness',
  'jsk-medical-wellness',
  'JSK Medical & Wellness',
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

update public.distributors
set
  is_active = false,
  white_label_enabled = false,
  updated_at = now()
where slug = 'sandman';

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
where d.slug = 'jsk-medical-wellness'
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
  'JSK',
  'JSK Medical & Wellness',
  'admin',
  'JSK',
  'platform',
  true,
  0.5000,
  'JSK Medical & Wellness direct child of the main platform. Commission basis: 50% of net profit after true landed cost. No parent/upline override.'
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

update public.checkout_scopes
set
  is_active = false,
  updated_at = now()
where scope_code = 'SANDMAN';

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
  'jsk',
  'jsk-medical-wellness',
  'JSK Medical & Wellness',
  'JSK',
  'tapjoshi@yahoo.com',
  'full',
  '/brands/jsk/jsk-logo.png',
  jsonb_build_object(
    'primary', '#11100e',
    'secondary', '#24211c',
    'accent', '#c9a86a',
    'gold', '#ead39a',
    'surface', '#f5f0e8',
    'text', '#11100e'
  ),
  'Optimize. Restore. Elevate.',
  '/jsk-medical-wellness',
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
    'store_settings', true,
    'marketing', true
  ),
  jsonb_build_object(
    'pricing_engine', 'platform_preserved',
    'commission_rate', 0.5,
    'commission_basis', 'net_profit_after_true_landed_cost',
    'no_upline_overrides', true
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
  status = 'active',
  capabilities = excluded.capabilities,
  pricing_guardrails = excluded.pricing_guardrails,
  updated_at = now();

update public.partner_brands
set
  status = 'inactive',
  custom_url = '/jsk-medical-wellness',
  updated_at = now()
where brand_id = 'sandman';

do $$
declare
  joshi_profile_id uuid;
  joshi_email text := 'tapjoshi@yahoo.com';
  jsk_rep_id uuid;
begin
  select id
  into joshi_profile_id
  from public.profiles
  where lower(email) = joshi_email
  order by created_at desc nulls last
  limit 1;

  if joshi_profile_id is not null then
    update public.profiles
    set
      role = case
        when role in ('admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited', 'owner', 'platform_admin', 'super_admin')
          then role
        else 'partner_admin_full'
      end,
      brand_id = 'jsk',
      partner_access_level = 'full',
      access_scope = 'brand_only',
      admin_scope = 'JSK',
      store_slug = 'jsk-medical-wellness',
      owner_email = joshi_email,
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
    where id = joshi_profile_id;

    insert into public.partner_admin_brand_assignments (
      profile_id,
      brand_id,
      access_level,
      status
    )
    values (
      joshi_profile_id,
      'jsk',
      'full',
      'active'
    )
    on conflict (profile_id, brand_id) do update set
      access_level = 'full',
      status = 'active';

    update public.partner_admin_brand_assignments
    set status = 'inactive'
    where profile_id = joshi_profile_id
      and brand_id = 'sandman';

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
      joshi_profile_id,
      'JSK Medical & Wellness',
      'JSK',
      'JSK-DIRECT-PARTNER',
      'JSK',
      'net_profit_after_true_landed_cost',
      0.5000,
      0.0000,
      0.5000,
      'direct_platform_partner_admin',
      'JSK',
      0,
      '/jsk-medical-wellness',
      true,
      60,
      'Partner payout - 50% net profit after true landed cost',
      joshi_email,
      'jsk_direct_partner_store',
      joshi_profile_id,
      null,
      'jsk-medical-wellness',
      'JSK Medical & Wellness',
      'jsk',
      null,
      'jsk-medical-wellness',
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
    returning id into jsk_rep_id;

    update public.reps
    set
      active = false,
      updated_at = now()
    where upper(coalesce(rep_slug, '')) = 'SANDMAN';

    if jsk_rep_id is not null and to_regclass('public.partner_rep_commission_settings') is not null then
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
        'JSK',
        joshi_profile_id,
        joshi_email,
        jsk_rep_id,
        joshi_email,
        'net_profit_after_true_landed_cost',
        50.00,
        'JSK receives 50% of net profit after true landed cost. This is not gross revenue commission.',
        false,
        'active',
        'Direct child of main platform. No parent or upline override.',
        'jsk',
        'JSK Medical & Wellness',
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

      update public.partner_rep_commission_settings
      set status = 'inactive', updated_at = now()
      where store_scope = 'SANDMAN';
    end if;

    if jsk_rep_id is not null and to_regclass('public.partner_rep_store_settings') is not null then
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
        'JSK',
        joshi_profile_id,
        joshi_email,
        jsk_rep_id,
        joshi_email,
        'Dr. Tapan Joshi',
        'JSK Medical & Wellness',
        'jsk-medical-wellness',
        '/jsk-medical-wellness',
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
          'discount_code', 'JSK',
          'tagline', 'Optimize. Restore. Elevate.',
          'commission_basis', 'net_profit_after_true_landed_cost'
        ),
        'active',
        now(),
        'JSK Medical & Wellness direct platform child storefront with no upline overrides.',
        'jsk',
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

      update public.partner_rep_store_settings
      set status = 'inactive', disabled_at = coalesce(disabled_at, now()), updated_at = now()
      where store_scope = 'SANDMAN';
    end if;
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
  ('jsk', 'jsk-medical-wellness', 'JSK Medical & Wellness Logo', 'image/png', 'public/brands/jsk/jsk-logo.png', '/brands/jsk/jsk-logo.png', jsonb_build_object('usage', 'primary_logo')),
  ('jsk', 'jsk-medical-wellness', 'JSK Medical & Wellness Vial Placeholder', 'image/png', 'public/brands/jsk/jsk-vial-placeholder.png', '/brands/jsk/jsk-vial-placeholder.png', jsonb_build_object('usage', 'product_placeholder')),
  ('jsk', 'jsk-medical-wellness', 'JSK Medical & Wellness Basket Hero', 'image/png', 'public/brands/jsk/jsk-basket-hero.png', '/brands/jsk/jsk-basket-hero.png', jsonb_build_object('usage', 'hero_background'))
on conflict do nothing;

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('JSK' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''SANDMAN'' or v_store_hint like ''%sandman%'' then ''sandman''',
      '    when v_scope_code = ''JSK'' or v_store_hint like ''%jsk%'' then ''jsk-medical-wellness''
    when v_scope_code = ''SANDMAN'' or v_store_hint like ''%sandman%'' then ''jsk-medical-wellness'''
    );

    if next_fn = fn then
      next_fn := replace(
        fn,
        '    else null',
        '    when v_scope_code = ''JSK'' or v_store_hint like ''%jsk%'' then ''jsk-medical-wellness''
    else null'
      );
    end if;

    if next_fn = fn then
      raise exception 'Could not patch JSK checkout pricing mapping';
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
      'jsk-medical-wellness',
      'JSK Medical & Wellness',
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
