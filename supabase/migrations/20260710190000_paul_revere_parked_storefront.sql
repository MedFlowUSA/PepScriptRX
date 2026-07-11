-- Paul Revere Peptides parked storefront.
-- No owner, rep, login, payout account, or commission recipient is created here.

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
  'Paul Revere Peptides',
  'paulrevere',
  'Paul Revere Peptides',
  0.0000,
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
      when p.product_name ilike '%tirzepatide%' then 0
      when p.product_name ilike '%semaglutide%' then 1
      when p.product_name ilike '%retatrutide%' then 2
      when p.product_name ilike '%wolverine%' then 3
      when p.product_name ilike '%bpc%' then 4
      when p.product_name ilike '%tb-500%' then 5
      when p.product_name ilike '%nad%' then 6
      else 10
    end,
    p.product_name
  ) <= 8,
  0.0000
from public.distributors d
cross join public.rx_plus_products p
where d.slug = 'paulrevere'
  and p.active = true
  and p.visibility_type in ('public', 'rx_plus', 'distributor_only')
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = 0.0000,
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
  'PAULREVERE',
  'Paul Revere Peptides',
  'platform',
  'platform',
  null,
  true,
  0.0000,
  'Parked Paul Revere Peptides storefront. No owner or rep is assigned. Commission allocation is 0% owner/partner/rep/downline/override and 100% platform until future assignment.'
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
  'paul-revere',
  'paulrevere',
  'Paul Revere Peptides',
  'PAULREVERE',
  null,
  'limited',
  '/brands/paulrevere/paul-revere-logo.png',
  jsonb_build_object(
    'primary', '#06152d',
    'accent', '#b61f2b',
    'surface', '#0b2347',
    'brass', '#c59a55',
    'text', '#f8fafc'
  ),
  'A New Standard in American Performance',
  '/paulrevere',
  'active',
  jsonb_build_object(
    'dashboard', false,
    'analytics', false,
    'orders', false,
    'customers', false,
    'marketing', false,
    'rep_management', false,
    'rep_dashboard', false,
    'rep_creation', false,
    'referral_codes', false,
    'product_management', false,
    'pricing_management', false,
    'payouts', false
  ),
  jsonb_build_object(
    'commission_rate', 0,
    'platform_rate', 1,
    'owner_rate', 0,
    'partner_rate', 0,
    'rep_rate', 0,
    'downline_rate', 0,
    'override_rate', 0,
    'basis', 'net_profit_after_true_landed_product_cost',
    'no_owner_assigned', true,
    'no_rep_hierarchy', true
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
