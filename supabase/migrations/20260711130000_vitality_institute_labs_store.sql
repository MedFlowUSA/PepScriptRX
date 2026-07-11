-- Vitality Institute Labs 0% marketing partner storefront.
-- Admin: Jane / Jane@touchofvitality.life
-- Auth users and temporary passwords are intentionally not created here.

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
  'Vitality Institute Labs',
  'vitality',
  'Vitality Institute Labs',
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
      when p.product_name ilike '%nad%' then 3
      when p.product_name ilike '%mots%' then 4
      when p.product_name ilike '%glow%' then 5
      when p.product_name ilike '%wolverine%' then 6
      else 10
    end,
    p.product_name,
    p.strength
  ) <= 8,
  0.0000
from public.distributors d
cross join public.rx_plus_products p
where d.slug = 'vitality'
  and p.active = true
  and p.visibility_type in ('public', 'rx_plus', 'distributor_only')
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = null,
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
  'VITALITY',
  'Vitality Institute Labs',
  'admin',
  'VITALITY',
  'platform',
  true,
  0.0000,
  'Vitality Institute Labs marketing partner storefront. Jane earns 0% commission. All profit remains with PepScriptRX; scope exists for source attribution and analytics only.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = true,
  default_commission_rate = 0.0000,
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
  'vitality',
  'vitality',
  'Vitality Institute Labs',
  'VITALITY',
  'Jane@touchofvitality.life',
  'limited',
  '/brands/vitality/vitality-logo.png',
  jsonb_build_object(
    'primary', '#3b0b78',
    'secondary', '#6d28d9',
    'lavender', '#eee6ff',
    'lilac', '#d8c4ff',
    'accent', '#c8a45d',
    'surface', '#ffffff'
  ),
  'Premium longevity, precision wellness, and AI-enhanced healthcare.',
  '/vitality',
  'active',
  jsonb_build_object(
    'dashboard', true,
    'analytics', true,
    'orders', true,
    'customers', true,
    'marketing', true,
    'store_customization', true,
    'product_visibility', true,
    'reports', true,
    'storefront', true,
    'product_management', false,
    'pricing_overrides', false,
    'commission_reports', false,
    'commission_editing', false,
    'earnings', false,
    'payouts', false,
    'rep_payouts', false,
    'rep_management', false,
    'discount_codes', false
  ),
  jsonb_build_object(
    'pricing_locked_to_platform', true,
    'commission_rate', 0,
    'platform_rate', 1,
    'owner_rate', 0,
    'partner_rate', 0,
    'rep_rate', 0,
    'downline_rate', 0,
    'override_rate', 0,
    'partner_payout_eligible', false,
    'no_commission_reports', true,
    'no_payout_modules', true
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
  jane_email text := 'Jane@touchofvitality.life';
  jane_auth_id uuid;
  jane_profile_id uuid;
begin
  select id
    into jane_auth_id
  from auth.users
  where lower(email) = lower(jane_email)
  order by created_at desc
  limit 1;

  select id
    into jane_profile_id
  from public.profiles
  where (jane_auth_id is not null and auth_user_id = jane_auth_id)
     or lower(coalesce(email, '')) = lower(jane_email)
  order by
    case when auth_user_id = jane_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if jane_profile_id is null and jane_auth_id is not null then
    jane_profile_id := jane_auth_id;
    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      jane_profile_id,
      jane_auth_id,
      'Jane',
      jane_email,
      null,
      'partner_admin_limited'
    );
  end if;

  if jane_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(jane_auth_id, auth_user_id),
      full_name = 'Jane',
      email = jane_email,
      role = 'partner_admin_limited',
      brand_id = 'vitality',
      partner_access_level = 'limited',
      access_scope = 'brand_only',
      admin_scope = 'VITALITY',
      store_slug = 'vitality',
      owner_email = jane_email,
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
    where id = jane_profile_id;

    insert into public.partner_admin_brand_assignments (
      profile_id,
      brand_id,
      access_level,
      status
    )
    values (
      jane_profile_id,
      'vitality',
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
    jane_profile_id,
    'Vitality Institute Labs',
    'VITALITY',
    'VITALITY-MARKETING-PARTNER',
    'VITALITY',
    'marketing_attribution_only',
    0,
    0,
    1,
    'marketing_partner_0_percent',
    'VITALITY',
    0,
    '/vitality',
    true,
    60,
    'No payout - 0% marketing partner',
    jane_email,
    'vitality_marketing_partner',
    jane_profile_id,
    'vitality',
    'Vitality Institute Labs',
    'vitality',
    null,
    'vitality',
    'admin',
    'platform_owned_marketing_store',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = 0,
    override_percent = 0,
    platform_percent = 1,
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
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_id = excluded.brand_id,
    parent_brand_id = excluded.parent_brand_id,
    assigned_store_slug = excluded.assigned_store_slug,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true,
    updated_at = now();
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
  ('vitality', 'vitality', 'Vitality Institute Labs Logo', 'image/png', 'public/brands/vitality/vitality-logo.png', '/brands/vitality/vitality-logo.png', jsonb_build_object('usage', 'primary_logo')),
  ('vitality', 'vitality', 'Vitality Institute Labs Vial Placeholder', 'image/png', 'public/brands/vitality/vitality-vial.png', '/brands/vitality/vitality-vial.png', jsonb_build_object('usage', 'product_placeholder')),
  ('vitality', 'vitality', 'Vitality Institute Labs Jane Basket Hero', 'image/png', 'public/brands/vitality/vitality-basket-hero.png', '/brands/vitality/vitality-basket-hero.png', jsonb_build_object('usage', 'hero_background'))
on conflict do nothing;

update public.patient_submissions
set
  brand_id = 'vitality',
  partner_payout_eligible = false,
  commission_rate = 0
where (
    upper(coalesce(checkout_scope_code, '')) = 'VITALITY'
    or lower(coalesce(store_slug, '')) = 'vitality'
    or lower(coalesce(source_portal, '')) like '%vitality institute labs%'
    or upper(coalesce(source_admin, '')) = 'VITALITY'
    or upper(coalesce(source_rep, '')) = 'VITALITY'
    or upper(coalesce(admin_code, '')) = 'VITALITY'
  );
