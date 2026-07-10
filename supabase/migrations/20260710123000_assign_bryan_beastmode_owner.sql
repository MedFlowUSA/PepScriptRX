-- Assign Bryan as the BEASTMODE Performance Labs store owner.
-- The auth password is intentionally not stored in migrations; set/reset it through Supabase Auth.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists brand_id text,
  add column if not exists partner_access_level text,
  add column if not exists access_scope text,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
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
  'B_dabe@yahoo.com',
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
    'no_rep_hierarchy', true,
    'direct_to_pepscript', true
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

update public.distributors
set
  commission_rate = 0.4,
  updated_at = now()
where slug = 'beastmode';

update public.distributor_products dp
set
  commission_rate = 0.4,
  updated_at = now()
from public.distributors d
where d.id = dp.distributor_id
  and d.slug = 'beastmode';

update public.checkout_scopes
set
  display_name = 'BEASTMODE Performance Labs',
  account_type = 'store',
  account_id = 'BEASTMODE',
  parent_account_id = null,
  is_active = true,
  default_commission_rate = 0.4,
  notes = 'Independent BeastMode partner store. No rep hierarchy.',
  updated_at = now()
where scope_code = 'BEASTMODE';

insert into public.partner_store_settings (
  store_slug,
  store_name,
  settings,
  brand_id,
  status,
  custom_url,
  logo_url,
  colors,
  hero_text
)
values (
  'beastmode',
  'BEASTMODE Performance Labs',
  jsonb_build_object(
    'ownerEmail', 'B_dabe@yahoo.com',
    'supportContact', 'B_dabe@yahoo.com',
    'scopeCode', 'BEASTMODE',
    'storeOwner', 'Bryan'
  ),
  'beastmode',
  'active',
  '/beastmode',
  '/brands/beastmode/beastmode-logo.jpeg',
  jsonb_build_object(
    'primary', '#C1121F',
    'background', '#050505',
    'surface', '#18181b',
    'text', '#f4f4f5',
    'metal', '#d4d4d8'
  ),
  'WE NOT THE SAME.'
)
on conflict (store_slug) do update set
  store_name = excluded.store_name,
  settings = coalesce(public.partner_store_settings.settings, '{}'::jsonb) || excluded.settings,
  brand_id = excluded.brand_id,
  status = excluded.status,
  custom_url = excluded.custom_url,
  logo_url = excluded.logo_url,
  colors = excluded.colors,
  hero_text = excluded.hero_text,
  updated_at = now();

create or replace function public.upsert_beastmode_bryan_owner_profile(
  p_auth_id uuid,
  p_email text,
  p_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bryan_email constant text := 'b_dabe@yahoo.com';
  stored_email constant text := 'B_dabe@yahoo.com';
  target_name text := coalesce(nullif(trim(p_full_name), ''), 'Bryan');
begin
  if p_auth_id is null or lower(coalesce(p_email, '')) <> bryan_email then
    return;
  end if;

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
    global_admin,
    super_admin,
    can_view_all_brands,
    can_view_all_reps,
    can_view_all_orders,
    can_view_all_customers,
    can_edit_global_catalog,
    can_edit_global_settings,
    can_view_platform_financials,
    can_view_other_partner_financials,
    updated_at
  )
  values (
    p_auth_id,
    p_auth_id,
    stored_email,
    target_name,
    'partner_admin_limited',
    'BEASTMODE',
    'beastmode',
    stored_email,
    'beastmode',
    'limited',
    'brand_only',
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    now()
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    role = 'partner_admin_limited',
    admin_scope = 'BEASTMODE',
    store_slug = 'beastmode',
    owner_email = excluded.owner_email,
    brand_id = 'beastmode',
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
    updated_at = now();

  insert into public.partner_admin_brand_assignments (
    profile_id,
    brand_id,
    access_level,
    status
  )
  values (
    p_auth_id,
    'beastmode',
    'limited',
    'active'
  )
  on conflict (profile_id, brand_id) do update set
    access_level = excluded.access_level,
    status = excluded.status;
end;
$$;

revoke all on function public.upsert_beastmode_bryan_owner_profile(uuid, text, text) from public;

create or replace function public.ensure_beastmode_bryan_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.upsert_beastmode_bryan_owner_profile(
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Bryan')
  );
  return new;
end;
$$;

revoke all on function public.ensure_beastmode_bryan_owner_profile() from public;

drop trigger if exists ensure_beastmode_bryan_owner_profile_on_auth_user on auth.users;
create trigger ensure_beastmode_bryan_owner_profile_on_auth_user
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.ensure_beastmode_bryan_owner_profile();

do $$
declare
  auth_row record;
begin
  for auth_row in
    select id, email, raw_user_meta_data
    from auth.users
    where lower(coalesce(email, '')) = 'b_dabe@yahoo.com'
  loop
    perform public.upsert_beastmode_bryan_owner_profile(
      auth_row.id,
      auth_row.email,
      coalesce(nullif(auth_row.raw_user_meta_data ->> 'full_name', ''), 'Bryan')
    );
  end loop;
end $$;
