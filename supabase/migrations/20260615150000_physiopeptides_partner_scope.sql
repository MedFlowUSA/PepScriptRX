-- PhysioPeptides partner storefront/admin scope.
-- Idempotent seed only: this does not create or reset Supabase Auth passwords.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text;

alter table public.reps
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null;

insert into public.distributors (
  name,
  slug,
  portal_name,
  commission_rate,
  is_active,
  white_label_enabled,
  wholesale_enabled
) values (
  'Dr. Roman Felix',
  'physiopeptides',
  'PhysioPeptides',
  0.99,
  true,
  true,
  false
) on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

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
  custom_store_slug,
  brand_name,
  brand_theme,
  account_type,
  parent_type,
  parent_rep_id,
  managed_by_profile_id,
  active
) values (
  null,
  'PhysioPeptides',
  'PhysioPeptides',
  'PHYSIOPEPTIDES',
  'PHYSIOPEPTIDES',
  'net_profit_after_true_cost',
  0.99,
  0,
  0.01,
  'physiopeptides_admin_store',
  'PHYSIOPEPTIDES',
  0,
  '/PhysioPeptides',
  true,
  60,
  'Payout Pending',
  null,
  null,
  'physiopeptides_admin',
  'physiopeptides',
  'PhysioPeptides',
  jsonb_build_object(
    'palette', jsonb_build_array('#ffffff', '#0f766e', '#0ea5e9', '#22c55e', '#061425'),
    'style', 'premium clinical physical recovery wellness science performance storefront',
    'logo', '/marketing/physiopeptides-logo.png',
    'productImage', '/marketing/physiopeptides-vial.png',
    'owner', 'Dr. Roman Felix / PepScriptRX',
    'trueCostRule', 'retail collected minus true landing cost, shipping cost, packaging cost, and processing cost',
    'compliance', 'research use only; not intended to diagnose, treat, cure, or prevent disease'
  ),
  'admin',
  'platform',
  null,
  null,
  true
) on conflict (rep_slug) do update set
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

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  featured,
  commission_rate
)
select
  physio.id,
  products.id,
  true,
  products.suggested_retail_price,
  row_number() over (order by products.category, products.product_name, products.strength) <= 8,
  0.99
from public.rx_plus_products products
join public.distributors physio on physio.slug = 'physiopeptides'
where products.active = true
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled,
  custom_price = coalesce(public.distributor_products.custom_price, excluded.custom_price),
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
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
  'PHYSIOPEPTIDES',
  'PhysioPeptides',
  'admin',
  'PHYSIOPEPTIDES',
  null,
  true,
  0.99,
  'PhysioPeptides checkout scope for Dr. Roman Felix / PepScriptRX. Commission basis: 99% of net profit after retail collected minus true landing cost, shipping, packaging, and processing costs. Platform retained share is 1%.'
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
