-- Blackline Peptides direct child partner storefront.
-- Owner/admin: Erick Castro Garcia / erickcastrogarcia1991@outlook.com
-- No temporary password is stored in this migration.
-- Commission: not assigned here. Configure only after an approved commission is confirmed.

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
  'Erick Castro Garcia',
  'blackline',
  'Blackline Peptides',
  0.0000,
  true,
  true,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  is_active = true,
  white_label_enabled = true,
  wholesale_enabled = false,
  updated_at = now();

with requested_products(product_key, product_name, category, strength, sku, requested_price, description, sort_order, featured) as (
  values
    ('retatrutide-5mg', 'Retatrutide', 'GLP / Weight Management', '5mg', 'RXP-GLP-RETA-5', 179.00, 'Advanced metabolic research option in the Blackline GLP collection.', 10, false),
    ('retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'RXP-GLP-RETA-10', 229.00, 'Advanced metabolic research option in the Blackline GLP collection.', 20, true),
    ('retatrutide-15mg', 'Retatrutide', 'GLP / Weight Management', '15mg', 'RXP-GLP-RETA-15', 269.00, 'Advanced metabolic research option in the Blackline GLP collection.', 30, false),
    ('retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'RXP-GLP-RETA-20', 299.00, 'Expanded metabolic research option in the Blackline GLP collection.', 40, true),
    ('retatrutide-30mg', 'Retatrutide', 'GLP / Weight Management', '30mg', 'RXP-GLP-RETA-30', 349.00, 'High-strength metabolic research option sourced from the main platform inventory.', 50, true),
    ('tirzepatide-10mg', 'Tirzepatide', 'GLP / Weight Management', '10mg', 'RXP-GLP-TIRZ-10', 129.00, 'GLP/GIP research option selected for the Blackline metabolic catalog.', 60, true),
    ('tirzepatide-15mg', 'Tirzepatide', 'GLP / Weight Management', '15mg', 'RXP-GLP-TIRZ-15', 149.00, 'GLP/GIP research option selected for the Blackline metabolic catalog.', 70, false),
    ('tirzepatide-20mg', 'Tirzepatide', 'GLP / Weight Management', '20mg', 'RXP-GLP-TIRZ-20', 169.00, 'Expanded GLP/GIP research option for the Blackline metabolic catalog.', 80, true),
    ('tirzepatide-30mg', 'Tirzepatide', 'GLP / Weight Management', '30mg', 'RXP-GLP-TIRZ-30', 199.00, 'Higher-strength GLP/GIP research option for the Blackline metabolic catalog.', 90, true),
    ('tirzepatide-60mg', 'Tirzepatide', 'GLP / Weight Management', '60mg', 'RXP-GLP-TIRZ-60', 249.00, 'High-strength GLP/GIP research option available through platform review.', 100, false),
    ('semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'RXP-GLP-SEMA-10', 99.00, 'GLP research option in the Blackline weight-management collection.', 110, false),
    ('cagrisema', 'CagriSema', 'GLP / Weight Management', '2.4 mg + 2.4 mg, 4.8 mg total', 'RXP-GLP-CAGRISEMA', 249.00, 'Cagrilintide and semaglutide blend configured for the requested Blackline catalog.', 120, false),
    ('cagrilintide-5mg', 'Cagrilintide', 'GLP / Weight Management', '5mg', 'RXP-GLP-CAGRI-5', 179.00, 'Metabolic research option configured for the Blackline catalog.', 130, false),
    ('bpc-157-5mg', 'BPC-157', 'Recovery / Performance / Wellness', '5mg', 'RXP-REC-BPC157-5', 99.00, 'Recovery and repair research option selected for Blackline.', 140, false),
    ('bpc-157-10mg', 'BPC-157', 'Recovery / Performance / Wellness', '10mg', 'RXP-REC-BPC157-10', 139.00, 'Recovery and repair research option selected for Blackline.', 150, false),
    ('tb-500-5mg', 'TB-500', 'Recovery / Performance / Wellness', '5mg', 'RXP-REC-TB500-5', 99.00, 'Recovery research option configured for the Blackline catalog.', 160, false),
    ('tb-500-10mg', 'TB-500', 'Recovery / Performance / Wellness', '10mg', 'RXP-REC-TB500-10', 149.00, 'Recovery research option configured for the Blackline catalog.', 170, false),
    ('wolverine-bpc-tb', 'Wolverine Stack', 'Recovery / Performance / Wellness', 'BPC-157 10 mg + TB-500 10 mg, 20 mg total', 'RXP-REC-WOLV', 159.00, 'BPC-157 and TB-500 recovery stack configured for the Blackline catalog.', 180, true),
    ('nad-1000mg', 'NAD+', 'Recovery / Performance / Wellness', '1000 mg', 'RXP-LONG-NAD-1000', 149.00, 'Cellular wellness and recovery-support option for the Blackline catalog.', 190, true),
    ('glutathione-1500mg', 'Glutathione', 'Recovery / Performance / Wellness', '1500mg', 'RXP-LONG-GLUTA-1500', 149.00, 'Antioxidant wellness option configured for the Blackline catalog.', 200, false),
    ('ghk-cu-100mg', 'GHK-Cu', 'Recovery / Performance / Wellness', '100mg', 'RXP-REC-GHKCU-100', 129.00, 'Copper peptide research option configured for the Blackline catalog.', 210, false),
    ('glow-peptide-blend', 'Glow Stack', 'Recovery / Performance / Wellness', '70 mg total', 'RXP-REC-GLOW', 169.00, 'Blend-based wellness stack configured for the Blackline catalog.', 220, false),
    ('tesamorelin-2mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '2mg', 'RXP-GROW-TESA-2', 99.00, 'Performance and growth-pathway research option for Blackline.', 230, false),
    ('tesamorelin-5mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '5mg', 'RXP-GROW-TESA-5', 149.00, 'Performance and growth-pathway research option for Blackline.', 240, false),
    ('tesamorelin-10mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '10mg', 'RXP-GROW-TESA-10', 199.00, 'Performance and growth-pathway research option for Blackline.', 250, false),
    ('sermorelin', 'Sermorelin', 'Recovery / Performance / Wellness', 'Standard', 'RXP-GROW-SERM', 129.00, 'Growth-pathway research option configured for the Blackline catalog.', 260, false),
    ('ipamorelin-5mg', 'Ipamorelin', 'Recovery / Performance / Wellness', '5 mg', 'RXP-MAIN-IPA-5', 129.00, 'Growth-pathway research option configured for the Blackline catalog.', 270, false),
    ('cjc-ipamorelin-10mg', 'CJC-1295 / Ipamorelin', 'Recovery / Performance / Wellness', '5 mg + 5 mg, 10 mg total', 'RXP-GROW-CJCIPA-10', 169.00, 'CJC-1295 and Ipamorelin blend configured for the Blackline catalog.', 280, true),
    ('hgh-somatropin-240iu-kit', 'HGH / Somatropin', 'Recovery / Performance / Wellness', '24 IU x 10, 240 IU total', 'RXP-MAIN-HGH-240IU-KIT', 199.00, 'Premium HGH / Somatropin kit configured for the Blackline catalog. Availability and fulfillment are subject to review.', 290, true)
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
    rp.product_name || ' ' || rp.strength,
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
    'blackline',
    rp.featured,
    '/brands/blackline/blackline-vial-placeholder.png'
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
  null
from requested_products rp
join public.distributors d on d.slug = 'blackline'
join public.rx_plus_products p on upper(p.sku) = upper(rp.sku)
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured,
  commission_rate = null,
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
  'BLACKLINE',
  'Blackline Peptides',
  'admin',
  'BLACKLINE',
  'platform',
  true,
  0.0000,
  'Blackline Peptides direct child of the main platform. Commission requires approved configuration before payouts are enabled.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = true,
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
  'blackline',
  'blackline',
  'Blackline Peptides',
  'BLACKLINE',
  'erickcastrogarcia1991@outlook.com',
  'full',
  '/brands/blackline/blackline-logo.png',
  jsonb_build_object(
    'primary', '#050505',
    'secondary', '#141416',
    'accent', '#b1121d',
    'red', '#e31d2d',
    'silver', '#d5d7da',
    'text', '#ffffff'
  ),
  'Precision. Strength. Legacy.',
  '/blackline',
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
    'commission_status', 'requires_configuration',
    'standard_catalog_pricing', false,
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
  blackline_email text := 'erickcastrogarcia1991@outlook.com';
  blackline_profile_id uuid;
  blackline_rep_id uuid;
begin
  select id
    into blackline_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = blackline_email
  order by created_at desc
  limit 1;

  if blackline_profile_id is not null then
    update public.profiles
    set
      email = blackline_email,
      full_name = 'Erick Castro Garcia',
      role = 'partner_admin_full',
      admin_scope = 'BLACKLINE',
      store_slug = 'blackline',
      owner_email = blackline_email,
      brand_id = 'blackline',
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
    where id = blackline_profile_id;

    insert into public.partner_admin_brand_assignments (
      profile_id,
      brand_id,
      access_level,
      status
    )
    values (
      blackline_profile_id,
      'blackline',
      'full',
      'active'
    )
    on conflict (profile_id, brand_id) do update set
      access_level = 'full',
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
    blackline_profile_id,
    'Blackline Peptides',
    'BLACKLINE',
    'BLACKLINE-DIRECT-PARTNER',
    'BLACKLINE',
    'requires_configuration',
    0.0000,
    0.0000,
    1.0000,
    'direct_platform_partner_admin',
    'BLACKLINE',
    0,
    '/blackline',
    true,
    60,
    'Partner payout pending approved commission configuration',
    blackline_email,
    'blackline_direct_partner_store',
    blackline_profile_id,
    null,
    'blackline',
    'Blackline Peptides',
    'blackline',
    null,
    'blackline',
    'admin',
    'platform_direct_partner_store',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = 0.0000,
    override_percent = 0.0000,
    platform_percent = 1.0000,
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
  returning id into blackline_rep_id;

  if blackline_rep_id is null then
    select id into blackline_rep_id
    from public.reps
    where upper(coalesce(rep_slug, '')) = 'BLACKLINE'
    limit 1;
  end if;

  if blackline_rep_id is not null and to_regclass('public.partner_rep_store_settings') is not null then
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
      'BLACKLINE',
      blackline_profile_id,
      blackline_email,
      blackline_rep_id,
      blackline_email,
      'Erick Castro Garcia',
      'Blackline Peptides',
      'blackline',
      '/blackline',
      null,
      'Blackline Requested Product List',
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
        'discount_code', 'BLACKLINE',
        'tagline', 'Precision. Strength. Legacy.',
        'commission_status', 'requires_configuration'
      ),
      'active',
      now(),
      'Blackline Peptides direct platform child storefront. Commission requires approved configuration before payouts are enabled.',
      'blackline',
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
  ('blackline', 'blackline', 'Blackline Peptides Logo', 'image/png', 'public/brands/blackline/blackline-logo.png', '/brands/blackline/blackline-logo.png', jsonb_build_object('usage', 'primary_logo')),
  ('blackline', 'blackline', 'Blackline Peptides Vial Placeholder', 'image/png', 'public/brands/blackline/blackline-vial-placeholder.png', '/brands/blackline/blackline-vial-placeholder.png', jsonb_build_object('usage', 'product_placeholder')),
  ('blackline', 'blackline', 'Blackline Peptides Studio Hero', 'image/png', 'public/brands/blackline/blackline-hero.png', '/brands/blackline/blackline-hero.png', jsonb_build_object('usage', 'hero_background'))
on conflict do nothing;

update public.patient_submissions
set
  brand_id = 'blackline',
  store_slug = 'blackline',
  store_name = 'Blackline Peptides',
  checkout_scope_code = case
    when nullif(checkout_scope_code, '') is null then 'BLACKLINE'
    else checkout_scope_code
  end,
  source_portal = 'Blackline Peptides',
  source_store = 'blackline',
  source_admin = 'BLACKLINE',
  source_rep = 'BLACKLINE',
  admin_code = 'BLACKLINE',
  commission_owner = 'BLACKLINE',
  commission_rate = 0.0000,
  partner_payout_eligible = false
where upper(coalesce(checkout_scope_code, '')) = 'BLACKLINE'
   or lower(coalesce(store_slug, '')) = 'blackline'
   or lower(coalesce(source_portal, '')) like '%blackline%'
   or upper(coalesce(source_admin, '')) = 'BLACKLINE'
   or upper(coalesce(source_rep, '')) = 'BLACKLINE'
   or upper(coalesce(admin_code, '')) = 'BLACKLINE'
   or upper(coalesce(referral_code, '')) = 'BLACKLINE'
   or upper(coalesce(discount_code, '')) = 'BLACKLINE';

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('BLACKLINE' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      '    when v_scope_code = ''BLACKLINE'' or v_store_hint like ''%blackline%'' then ''blackline''
    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm'''
    );

    if next_fn = fn then
      raise exception 'Could not patch Blackline checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

do $$
begin
  if to_regclass('public.rep_store_intake_submissions') is not null then
    update public.rep_store_intake_submissions
    set
      status = 'launched',
      store_brand_name = 'Blackline Peptides',
      internal_notes = concat_ws(E'\n',
        nullif(internal_notes, ''),
        'Resolved by Blackline Peptides direct platform storefront provisioning on 2026-07-15. Commission still requires approved configuration.'
      )
    where lower(coalesce(email, '')) = 'erickcastrogarcia1991@outlook.com'
       or regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = '9514197602';
  end if;
end $$;

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
      'blackline',
      'Blackline Peptides',
      p.product_key in (
        'retatrutide-5mg',
        'retatrutide-10mg',
        'retatrutide-15mg',
        'retatrutide-20mg',
        'retatrutide-30mg',
        'tirzepatide-10mg',
        'tirzepatide-15mg',
        'tirzepatide-20mg',
        'tirzepatide-30mg',
        'tirzepatide-60mg',
        'semaglutide-10mg',
        'cagrisema',
        'cagrilintide-5mg',
        'bpc-157-5mg',
        'bpc-157-10mg',
        'tb-500-5mg',
        'tb-500-10mg',
        'wolverine-bpc-tb',
        'nad-1000mg',
        'nad-1000iu',
        'glutathione-1500mg',
        'ghk-cu-100mg',
        'glow-peptide-blend',
        'tesamorelin-2mg',
        'tesamorelin-5mg',
        'tesamorelin-10mg',
        'sermorelin',
        'ipamorelin-5mg',
        'cjc-ipamorelin-10mg',
        'hgh-somatropin-240iu-kit'
      ),
      'blackline_selected_catalog'
    from public.product_intelligence_products p
    on conflict (product_key, store_key) do update set
      store_name = excluded.store_name,
      visible = excluded.visible,
      source = excluded.source;
  end if;
end $$;
