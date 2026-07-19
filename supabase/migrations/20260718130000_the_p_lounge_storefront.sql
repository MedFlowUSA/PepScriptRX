-- The P Lounge direct PepScriptRX white-label storefront.
-- Owner/admin: Kendra Salot / hello@theplounge.com
-- Commission: 55% of net profit after true landed cost, direct to PepScriptRX platform.
-- No temporary password is stored in this migration.

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
  'Kendra Salot',
  'the-p-lounge',
  'The P Lounge',
  0.5500,
  true,
  true,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = 0.5500,
  is_active = true,
  white_label_enabled = true,
  wholesale_enabled = false,
  updated_at = now();

with requested_products(product_key, product_name, category, strength, sku, requested_price, description, sort_order, featured) as (
  values
    ('retatrutide-5mg', 'Retatrutide', 'GLP / Weight Management', '5mg', 'RXP-GLP-RETA-5', 179.00, 'Metabolic research option configured for The P Lounge.', 10, false),
    ('retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'RXP-GLP-RETA-10', 229.00, 'Metabolic research option configured for The P Lounge.', 20, false),
    ('retatrutide-15mg', 'Retatrutide', 'GLP / Weight Management', '15mg', 'RXP-GLP-RETA-15', 269.00, 'Metabolic research option configured for The P Lounge.', 30, false),
    ('retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'RXP-GLP-RETA-20', 299.00, 'Metabolic research option configured for The P Lounge.', 40, true),
    ('retatrutide-30mg', 'Retatrutide', 'GLP / Weight Management', '30mg', 'RXP-GLP-RETA-30', 349.00, 'High-strength metabolic research option configured for The P Lounge.', 50, true),
    ('tirzepatide-10mg', 'Tirzepatide', 'GLP / Weight Management', '10mg', 'RXP-GLP-TIRZ-10', 129.00, 'GLP/GIP research option configured for The P Lounge.', 60, false),
    ('tirzepatide-15mg', 'Tirzepatide', 'GLP / Weight Management', '15mg', 'RXP-GLP-TIRZ-15', 149.00, 'GLP/GIP research option configured for The P Lounge.', 70, false),
    ('tirzepatide-20mg', 'Tirzepatide', 'GLP / Weight Management', '20mg', 'RXP-GLP-TIRZ-20', 169.00, 'GLP/GIP research option configured for The P Lounge.', 80, false),
    ('tirzepatide-30mg', 'Tirzepatide', 'GLP / Weight Management', '30mg', 'RXP-GLP-TIRZ-30', 199.00, 'GLP/GIP research option configured for The P Lounge.', 90, true),
    ('tirzepatide-60mg', 'Tirzepatide', 'GLP / Weight Management', '60mg', 'RXP-GLP-TIRZ-60', 249.00, 'High-strength GLP/GIP research option configured for The P Lounge.', 100, false),
    ('semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'RXP-GLP-SEMA-10', 99.00, 'GLP research option configured for The P Lounge.', 110, false),
    ('cagrisema', 'CagriSema', 'GLP / Weight Management', '2.4 mg + 2.4 mg, 4.8 mg total', 'RXP-GLP-CAGRISEMA', 249.00, 'Cagrilintide and semaglutide blend configured for The P Lounge.', 120, true),
    ('cagrilintide-5mg', 'Cagrilintide', 'GLP / Weight Management', '5mg', 'RXP-GLP-CAGRI-5', 179.00, 'Metabolic research option configured for The P Lounge.', 130, false),
    ('bpc-157-5mg', 'BPC-157', 'Recovery / Performance / Wellness', '5mg', 'RXP-REC-BPC157-5', 99.00, 'Recovery research option configured for The P Lounge.', 140, false),
    ('bpc-157-10mg', 'BPC-157', 'Recovery / Performance / Wellness', '10mg', 'RXP-REC-BPC157-10', 139.00, 'Recovery research option configured for The P Lounge.', 150, false),
    ('tb-500-5mg', 'TB-500', 'Recovery / Performance / Wellness', '5mg', 'RXP-REC-TB500-5', 99.00, 'Recovery research option configured for The P Lounge.', 160, false),
    ('tb-500-10mg', 'TB-500', 'Recovery / Performance / Wellness', '10mg', 'RXP-REC-TB500-10', 149.00, 'Recovery research option configured for The P Lounge.', 170, false),
    ('wolverine-bpc-tb', 'Wolverine Stack', 'Recovery / Performance / Wellness', 'BPC-157 10 mg + TB-500 10 mg, 20 mg total', 'RXP-REC-WOLV', 159.00, 'BPC-157 and TB-500 stack configured for The P Lounge.', 180, true),
    ('nad-1000mg', 'NAD+', 'Recovery / Performance / Wellness', '1000 mg', 'RXP-LONG-NAD-1000', 149.00, 'Cellular wellness research option configured for The P Lounge.', 190, true),
    ('glutathione-1500mg', 'Glutathione', 'Recovery / Performance / Wellness', '1500mg', 'RXP-LONG-GLUTA-1500', 149.00, 'Antioxidant wellness option configured for The P Lounge.', 200, false),
    ('ghk-cu-100mg', 'GHK-Cu', 'Recovery / Performance / Wellness', '100mg', 'RXP-REC-GHKCU-100', 129.00, 'Copper peptide research option configured for The P Lounge.', 210, false),
    ('glow-peptide-blend', 'Glow Stack', 'Recovery / Performance / Wellness', '70 mg total', 'RXP-REC-GLOW', 169.00, 'Wellness stack configured for The P Lounge.', 220, true),
    ('tesamorelin-2mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '2mg', 'RXP-GROW-TESA-2', 99.00, 'Growth-pathway research option configured for The P Lounge.', 230, false),
    ('tesamorelin-5mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '5mg', 'RXP-GROW-TESA-5', 149.00, 'Growth-pathway research option configured for The P Lounge.', 240, false),
    ('tesamorelin-10mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '10mg', 'RXP-GROW-TESA-10', 199.00, 'Growth-pathway research option configured for The P Lounge.', 250, false),
    ('sermorelin', 'Sermorelin', 'Recovery / Performance / Wellness', 'Standard', 'RXP-GROW-SERM', 129.00, 'Growth-pathway research option configured for The P Lounge.', 260, false),
    ('ipamorelin-5mg', 'Ipamorelin', 'Recovery / Performance / Wellness', '5 mg', 'RXP-MAIN-IPA-5', 129.00, 'Growth-pathway research option configured for The P Lounge.', 270, false),
    ('cjc-ipamorelin-10mg', 'CJC-1295 / Ipamorelin', 'Recovery / Performance / Wellness', '5 mg + 5 mg, 10 mg total', 'RXP-GROW-CJCIPA-10', 169.00, 'CJC-1295 and Ipamorelin blend configured for The P Lounge.', 280, true),
    ('hgh-somatropin-240iu-kit', 'HGH / Somatropin', 'Recovery / Performance / Wellness', '24 IU x 10, 240 IU total', 'RXP-MAIN-HGH-240IU-KIT', 199.00, 'Premium HGH / Somatropin kit configured for The P Lounge.', 290, true),
    ('aod-9604-5mg', 'AOD-9604', 'Additional Catalog / Optional', '5mg', 'RXP-ADD-AOD9604-5', 119.00, 'Optional catalog item configured for The P Lounge.', 300, false),
    ('aod-9604-10mg', 'AOD-9604', 'Additional Catalog / Optional', '10mg', 'RXP-ADD-AOD9604-10', 169.00, 'Optional catalog item configured for The P Lounge.', 310, false),
    ('pt-141', 'PT-141', 'Additional Catalog / Optional', 'Standard', 'RXP-ADD-PT141', 119.00, 'Optional catalog item configured for The P Lounge.', 320, false),
    ('melanotan-ii', 'Melanotan II', 'Additional Catalog / Optional', 'Standard', 'RXP-ADD-MELANOTAN-II', 119.00, 'Optional catalog item configured for The P Lounge.', 330, false),
    ('epithalon-10mg', 'Epitalon', 'Additional Catalog / Optional', 'Standard', 'RXP-LONG-EPI-10', 129.00, 'Optional catalog item configured for The P Lounge.', 340, false),
    ('mots-c-10mg', 'MOTS-c', 'Additional Catalog / Optional', '10mg', 'RXP-LONG-MOTSC-10', 149.00, 'Optional catalog item configured for The P Lounge.', 350, false),
    ('ss-31', 'SS-31', 'Additional Catalog / Optional', 'Standard', 'RXP-LONG-SS31', 169.00, 'Optional catalog item configured for The P Lounge.', 360, false),
    ('kisspeptin', 'Kisspeptin', 'Additional Catalog / Optional', 'Standard', 'RXP-ADD-KISSPEPTIN', 129.00, 'Optional catalog item configured for The P Lounge.', 370, false),
    ('thymosin-alpha-1', 'Thymosin Alpha-1', 'Additional Catalog / Optional', 'Standard', 'RXP-IMM-THYMOSIN-A1', 159.00, 'Optional catalog item configured for The P Lounge.', 380, false),
    ('dsip', 'DSIP', 'Additional Catalog / Optional', 'Standard', 'RXP-ADD-DSIP', 119.00, 'Optional catalog item configured for The P Lounge.', 390, false),
    ('selank', 'Selank', 'Additional Catalog / Optional', 'Standard', 'RXP-COG-SELANK', 119.00, 'Optional catalog item configured for The P Lounge.', 400, false),
    ('semax', 'Semax', 'Additional Catalog / Optional', 'Standard', 'RXP-COG-SEMAX', 119.00, 'Optional catalog item configured for The P Lounge.', 410, false),
    ('ll-37', 'LL-37', 'Additional Catalog / Optional', 'Standard', 'RXP-IMM-LL37', 149.00, 'Optional catalog item configured for The P Lounge.', 420, false),
    ('bac-water-syringe-kit', 'BAC Water + 8-Pack Syringe Kit', 'Supplies / Add-ons', 'Kit', 'RXP-SUP-BAC-SYR-8', 12.00, 'Supply kit configured for The P Lounge.', 430, false),
    ('reusable-pen-kit', 'Reusable Pen Kit', 'Supplies / Add-ons', 'Kit', 'RXP-SUP-PEN-KIT', 19.00, 'Reusable pen kit configured for The P Lounge.', 440, false),
    ('insulin-syringe-pack', 'Insulin Syringe Pack', 'Supplies / Add-ons', 'Pack', 'RXP-SUP-INS-SYR', 12.00, 'Syringe pack configured for The P Lounge.', 450, false)
),
inserted_products as (
  insert into public.rx_plus_products (
    product_name,
    display_name,
    category,
    strength,
    sku,
    suggested_retail_price,
    retail_price,
    base_cost,
    active,
    visibility_type,
    description,
    public_visible,
    partner_visible,
    partner_slug,
    featured,
    image_url
  )
  select
    rp.product_name,
    rp.product_name || case when rp.strength in ('Standard', 'Kit', 'Pack') then '' else ' ' || rp.strength end,
    rp.category,
    rp.strength,
    rp.sku,
    rp.requested_price,
    rp.requested_price,
    0,
    true,
    'rx_plus',
    rp.description,
    false,
    true,
    'the-p-lounge',
    rp.featured,
    '/brands/the-p-lounge/the-p-lounge-vial.png'
  from requested_products rp
  where not exists (
    select 1 from public.rx_plus_products p where upper(p.sku) = upper(rp.sku)
  )
  returning sku
)
insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  true,
  rp.requested_price,
  rp.requested_price,
  rp.featured,
  0.5500
from requested_products rp
join public.distributors d on d.slug = 'the-p-lounge'
join public.rx_plus_products p on upper(p.sku) = upper(rp.sku)
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured,
  commission_rate = 0.5500,
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
  'THEPLOUNGE',
  'The P Lounge',
  'admin',
  'THEPLOUNGE',
  'platform',
  true,
  0.5500,
  'The P Lounge direct white-label platform store. Commission basis: 55% of net profit after true landed cost. No upline override.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = true,
  default_commission_rate = 0.5500,
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
  'theplounge',
  'the-p-lounge',
  'The P Lounge',
  'THEPLOUNGE',
  'hello@theplounge.com',
  'limited',
  '/brands/the-p-lounge/the-p-lounge-logo.png',
  jsonb_build_object(
    'primary', '#101010',
    'secondary', '#f7f0e4',
    'accent', '#c9a44a',
    'gold', '#d8b65d',
    'surface', '#fffaf1',
    'text', '#15110b'
  ),
  'The P Lounge peptide catalog.',
  '/the-p-lounge',
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
    'rep_management', false,
    'inventory', false,
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
    'commission_basis', 'net_profit_after_true_landed_cost',
    'commission_rate', 0.55,
    'store_owner_percent', 55,
    'platform_percent', 45,
    'requested_price_list', true,
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
  lounge_email text := 'hello@theplounge.com';
  lounge_profile_id uuid;
  lounge_rep_id uuid;
begin
  select id
    into lounge_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = lounge_email
  order by created_at desc
  limit 1;

  if lounge_profile_id is not null then
    update public.profiles
    set
      email = lounge_email,
      full_name = 'Kendra Salot',
      role = 'partner_admin_limited',
      admin_scope = 'THEPLOUNGE',
      store_slug = 'the-p-lounge',
      owner_email = lounge_email,
      brand_id = 'theplounge',
      partner_access_level = 'limited',
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
    where id = lounge_profile_id;

    insert into public.partner_admin_brand_assignments (
      profile_id,
      brand_id,
      access_level,
      status
    )
    values (
      lounge_profile_id,
      'theplounge',
      'limited',
      'active'
    )
    on conflict (profile_id, brand_id) do update set
      access_level = 'limited',
      status = 'active';
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
    lounge_profile_id,
    'The P Lounge',
    'THEPLOUNGE',
    'THEPLOUNGE-DIRECT-WHITELABEL',
    'THEPLOUNGE',
    'net_profit_after_true_landed_cost',
    0.5500,
    0.0000,
    0.4500,
    'direct_platform_whitelabel_admin',
    'THEPLOUNGE',
    0,
    '/the-p-lounge',
    true,
    60,
    'PayPal',
    lounge_email,
    'theplounge_direct_whitelabel_store',
    lounge_profile_id,
    null,
    'the-p-lounge',
    'The P Lounge',
    'theplounge',
    null,
    'the-p-lounge',
    'admin',
    'platform_direct_whitelabel_store',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = 0.5500,
    override_percent = 0.0000,
    platform_percent = 0.4500,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = 0,
    referral_path = excluded.referral_path,
    attribution_locked = true,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    rep_channel = excluded.rep_channel,
    managed_by_profile_id = coalesce(excluded.managed_by_profile_id, public.reps.managed_by_profile_id),
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
  returning id into lounge_rep_id;

  if lounge_rep_id is null then
    select id into lounge_rep_id
    from public.reps
    where upper(coalesce(rep_slug, '')) = 'THEPLOUNGE'
    limit 1;
  end if;

  if lounge_rep_id is not null and to_regclass('public.partner_rep_commission_settings') is not null then
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
      'THEPLOUNGE',
      lounge_profile_id,
      lounge_email,
      lounge_rep_id,
      lounge_email,
      'net_profit_after_true_landed_cost',
      55.00,
      'The P Lounge receives 55% of net profit after true landed cost. This is not gross revenue commission.',
      false,
      'active',
      'Direct PepScriptRX white-label store. No parent or upline override.',
      'theplounge',
      'The P Lounge',
      'net_profit_after_true_landed_cost',
      0.00,
      45.00,
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
      platform_percent = 45.00,
      status = excluded.status,
      updated_at = now();
  end if;

  if lounge_rep_id is not null and to_regclass('public.partner_rep_store_settings') is not null then
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
      'THEPLOUNGE',
      lounge_profile_id,
      lounge_email,
      lounge_rep_id,
      lounge_email,
      'Kendra Salot',
      'The P Lounge',
      'the-p-lounge',
      '/the-p-lounge',
      null,
      'The P Lounge Requested Product List',
      'custom_requested_prices',
      jsonb_build_object(
        'standalone_storefront', true,
        'selected_catalog', true,
        'stripe_checkout', true,
        'paypal', true,
        'age_gate', true,
        'calculators', true,
        'certificates', true,
        'admin_analytics', true
      ),
      jsonb_build_object(
        'discount_code', 'THEPLOUNGE',
        'tagline', 'The P Lounge peptide catalog.',
        'commission_basis', 'net_profit_after_true_landed_cost',
        'commission_rate', 0.55
      ),
      'active',
      now(),
      'The P Lounge direct white-label platform store with 55% net-profit commission after landed cost.',
      'theplounge',
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
  ('theplounge', 'the-p-lounge', 'The P Lounge Logo', 'image/png', 'public/brands/the-p-lounge/the-p-lounge-logo.png', '/brands/the-p-lounge/the-p-lounge-logo.png', jsonb_build_object('usage', 'primary_logo')),
  ('theplounge', 'the-p-lounge', 'The P Lounge Vial', 'image/png', 'public/brands/the-p-lounge/the-p-lounge-vial.png', '/brands/the-p-lounge/the-p-lounge-vial.png', jsonb_build_object('usage', 'product_placeholder')),
  ('theplounge', 'the-p-lounge', 'The P Lounge Hero', 'image/png', 'public/brands/the-p-lounge/the-p-lounge-hero.png', '/brands/the-p-lounge/the-p-lounge-hero.png', jsonb_build_object('usage', 'hero_background'))
on conflict do nothing;

update public.patient_submissions
set
  brand_id = 'theplounge',
  store_slug = 'the-p-lounge',
  store_name = 'The P Lounge',
  checkout_scope_code = case
    when nullif(checkout_scope_code, '') is null then 'THEPLOUNGE'
    else checkout_scope_code
  end,
  source_portal = 'The P Lounge',
  source_store = 'the-p-lounge',
  source_admin = 'THEPLOUNGE',
  source_rep = 'THEPLOUNGE',
  admin_code = 'THEPLOUNGE',
  commission_owner = 'THEPLOUNGE',
  commission_rate = 0.5500,
  partner_payout_eligible = true
where upper(coalesce(checkout_scope_code, '')) = 'THEPLOUNGE'
   or lower(coalesce(store_slug, '')) in ('the-p-lounge', 'theplounge', 'p-lounge', 'plounge')
   or lower(coalesce(source_portal, '')) like '%p lounge%'
   or lower(coalesce(source_store, '')) in ('the-p-lounge', 'theplounge', 'p-lounge', 'plounge')
   or upper(coalesce(source_admin, '')) = 'THEPLOUNGE'
   or upper(coalesce(source_rep, '')) = 'THEPLOUNGE'
   or upper(coalesce(admin_code, '')) = 'THEPLOUNGE'
   or upper(coalesce(referral_code, '')) = 'THEPLOUNGE'
   or upper(coalesce(discount_code, '')) = 'THEPLOUNGE';

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('THEPLOUNGE' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      '    when v_scope_code = ''THEPLOUNGE'' or v_store_hint like ''%the-p-lounge%'' or v_store_hint like ''%theplounge%'' or v_store_hint like ''%p lounge%'' or v_store_hint like ''%plounge%'' then ''the-p-lounge''
    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm'''
    );

    if next_fn = fn then
      raise exception 'Could not patch The P Lounge checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
