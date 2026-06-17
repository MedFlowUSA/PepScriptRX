-- Ginto Wellness Labs private-label storefront.
-- Public-facing attribution uses only the Ginto Wellness Labs brand.

alter table public.reps
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists rep_channel text,
  add column if not exists payout_method text,
  add column if not exists attribution_window_days integer not null default 60,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists override_percent numeric not null default 0,
  add column if not exists platform_percent numeric not null default 0;

insert into public.reps (
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
  rep_channel,
  custom_store_slug,
  brand_name,
  brand_theme,
  account_type,
  parent_type,
  active
)
values (
  'Ginto Wellness Labs',
  'GINTO',
  'STORE-GINTO',
  'GINTO',
  'net_profit_after_true_cost',
  0.50,
  0,
  0.50,
  'private_label_store',
  'GINTO',
  0,
  '/ginto',
  true,
  60,
  'Manual payout',
  'private_label_pepscriptrx',
  'ginto',
  'Ginto Wellness Labs',
  jsonb_build_object(
    'palette', jsonb_build_array('#1d4ed8', '#f59e0b', '#dc2626', '#ffffff'),
    'style', 'premium private wellness lab storefront',
    'logo', '/brands/ginto/ginto-logo.png',
    'productImage', '/brands/ginto/ginto-vial-placeholder.png',
    'productScope', 'main_pepscriptrx_storefront_catalog',
    'trueCostRule', 'customer amount collected minus true landed product, fulfillment, shipping, and payment costs'
  ),
  'admin',
  'platform',
  true
)
on conflict (rep_slug) do update set
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
  rep_channel = excluded.rep_channel,
  custom_store_slug = excluded.custom_store_slug,
  brand_name = excluded.brand_name,
  brand_theme = excluded.brand_theme,
  account_type = excluded.account_type,
  parent_type = excluded.parent_type,
  active = true;

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
  'Ginto Wellness Labs',
  'ginto',
  'Ginto Wellness Labs',
  0.50,
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
values (
  'GINTO',
  'Ginto Wellness Labs',
  'admin',
  'GINTO',
  null,
  true,
  0.50,
  'Ginto Wellness Labs private-label PepScriptRX storefront. Commission basis: 50% of net profit after true landed product, fulfillment, shipping, and payment costs. Product scope mirrors the main PepScriptRX storefront catalog.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = true,
  default_commission_rate = excluded.default_commission_rate,
  notes = excluded.notes,
  updated_at = now();

insert into public.product_intelligence_store_visibility (
  product_key,
  store_key,
  store_name,
  visible,
  source
)
select
  p.product_key,
  'ginto',
  'Ginto Wellness Labs',
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
