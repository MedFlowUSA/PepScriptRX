-- BEASTMODE Performance Labs independent partner storefront.
-- No rep hierarchy is created here. The store pays the brand owner 40% of
-- net profit after true landed product, fulfillment, shipping, and payment costs.

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
  'BEASTMODE Performance Labs',
  'beastmode',
  'BEASTMODE Performance Labs',
  0.4000,
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
  (
    row_number() over (order by p.product_name) <= 8
    or p.product_name ilike '%wolverine%'
    or p.product_name ilike '%bpc%'
    or p.product_name ilike '%tb-500%'
  ),
  0.4000
from public.distributors d
cross join public.rx_plus_products p
where d.slug = 'beastmode'
  and p.active = true
  and p.visibility_type in ('public', 'rx_plus')
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = 0.4000,
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
  'BEASTMODE',
  'BEASTMODE Performance Labs',
  'store',
  'BEASTMODE',
  null,
  true,
  0.4000,
  'Independent BeastMode partner store. Commission basis: 40% brand owner / 60% platform after true landed product, fulfillment, shipping, and payment costs. No rep hierarchy.'
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
  'beastmode',
  'beastmode',
  'BEASTMODE Performance Labs',
  'BEASTMODE',
  null,
  'limited',
  '/brands/beastmode/beastmode-logo.jpeg',
  jsonb_build_object(
    'primary', '#C1121F',
    'background', '#050505',
    'surface', '#18181b',
    'text', '#f4f4f5',
    'metal', '#d4d4d8'
  ),
  'WE NOT THE SAME.',
  '/beastmode',
  'active',
  jsonb_build_object(
    'dashboard', true,
    'analytics', true,
    'orders', true,
    'customers', true,
    'marketing', true,
    'rep_management', false,
    'rep_dashboard', false,
    'rep_creation', false,
    'referral_codes', false,
    'product_management', false,
    'pricing_management', false,
    'payouts', false
  ),
  jsonb_build_object(
    'commission_rate', 0.4,
    'platform_rate', 0.6,
    'basis', 'net_profit_after_true_landed_product_cost',
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
      'beastmode',
      'BEASTMODE Performance Labs',
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
