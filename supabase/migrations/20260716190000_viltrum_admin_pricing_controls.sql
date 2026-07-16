-- Promote Dennis Hernandez / Dean to full Viltrum Peptide partner admin
-- and enable scoped catalog pricing controls for his storefront.

alter table public.profiles
  add column if not exists partner_access_level text,
  add column if not exists access_scope text;

alter table public.distributor_products
  add column if not exists enabled boolean,
  add column if not exists custom_retail_price numeric(10,2);

update public.partner_brands
set
  access_level = 'full',
  capabilities = coalesce(capabilities, '{}'::jsonb) || jsonb_build_object(
    'dashboard', true,
    'analytics', true,
    'orders', true,
    'customers', true,
    'products', true,
    'product_visibility', true,
    'pricing', true,
    'pricing_manager', true,
    'pricing_management', true,
    'storefront', true,
    'store_settings', true,
    'marketing', true,
    'payouts', true
  ),
  pricing_guardrails = coalesce(pricing_guardrails, '{}'::jsonb) || jsonb_build_object(
    'commission_rate', 0.5,
    'platform_rate', 0.5,
    'basis', 'net_profit_after_true_landed_product_cost',
    'standard_catalog_pricing', false,
    'partner_can_edit_storefront_prices', true,
    'price_scope', 'viltrumpeptide',
    'disallow_cross_brand_visibility', true
  ),
  updated_at = now()
where brand_id = 'viltrumpeptide';

update public.profiles
set
  role = 'partner_admin_full',
  admin_scope = 'VILTRUMPEPTIDE',
  store_slug = 'viltrumpeptide',
  brand_id = 'viltrumpeptide',
  partner_access_level = 'full',
  access_scope = 'viltrumpeptide',
  owner_email = coalesce(nullif(owner_email, ''), 'Deanvenus1977@outlook.com'),
  updated_at = now()
where lower(coalesce(email, '')) = 'deanvenus1977@outlook.com'
   or lower(coalesce(full_name, '')) in ('dennis hernandez', 'dean hernandez')
   or id in (
     select profile_id
     from public.reps
     where upper(coalesce(rep_slug, '')) = 'DEAN50'
       and profile_id is not null
   );

update public.reps
set
  account_type = 'admin',
  rep_tier = 'independent_brand_owner',
  rep_channel = 'independent_partner_store',
  brand_id = 'viltrumpeptide',
  parent_brand_id = 'viltrumpeptide',
  assigned_store_slug = 'viltrumpeptide',
  custom_store_slug = 'viltrumpeptide',
  brand_name = 'Viltrum Peptide',
  referral_path = '/viltrumpeptide',
  active = true,
  updated_at = now()
where upper(coalesce(rep_slug, '')) = 'DEAN50';

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select p.id, 'viltrumpeptide', 'full', 'active'
from public.profiles p
where lower(coalesce(p.email, '')) = 'deanvenus1977@outlook.com'
   or lower(coalesce(p.full_name, '')) in ('dennis hernandez', 'dean hernandez')
   or p.id in (
     select profile_id
     from public.reps
     where upper(coalesce(rep_slug, '')) = 'DEAN50'
       and profile_id is not null
   )
on conflict (profile_id, brand_id) do update set
  access_level = excluded.access_level,
  status = excluded.status;

create or replace function public.partner_upsert_distributor_product(
  p_store_slug text,
  p_product_id uuid,
  p_retail_price numeric,
  p_is_enabled boolean default true,
  p_featured boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_slug text := lower(trim(coalesce(p_store_slug, '')));
  v_distributor_id uuid;
  v_commission_rate numeric;
begin
  if v_store_slug = '' then
    raise exception 'Store slug is required.';
  end if;

  if p_product_id is null then
    raise exception 'Product id is required.';
  end if;

  if p_retail_price is null or p_retail_price <= 0 then
    raise exception 'Retail price must be greater than 0.';
  end if;

  if not (
    public.is_platform_admin()
    or (
      public.current_partner_access_level() = 'full'
      and (
        public.partner_has_capability('pricing_management')
        or public.partner_has_capability('pricing_manager')
        or public.partner_has_capability('pricing')
      )
      and public.is_current_partner_brand(null, v_store_slug, null)
    )
  ) then
    raise exception 'Only a full partner admin for this store can manage pricing.';
  end if;

  select id, commission_rate
  into v_distributor_id, v_commission_rate
  from public.distributors
  where slug = v_store_slug
  limit 1;

  if v_distributor_id is null then
    raise exception 'Distributor store % is missing.', v_store_slug;
  end if;

  if not exists (
    select 1
    from public.rx_plus_products
    where id = p_product_id
      and active = true
  ) then
    raise exception 'Product is not active or does not exist in the platform catalog.';
  end if;

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
  values (
    v_distributor_id,
    p_product_id,
    coalesce(p_is_enabled, true),
    coalesce(p_is_enabled, true),
    p_retail_price,
    p_retail_price,
    coalesce(p_featured, false),
    coalesce(v_commission_rate, 0.5)
  )
  on conflict (distributor_id, product_id) do update set
    is_enabled = excluded.is_enabled,
    enabled = excluded.enabled,
    custom_price = excluded.custom_price,
    custom_retail_price = excluded.custom_retail_price,
    featured = excluded.featured,
    commission_rate = excluded.commission_rate,
    updated_at = now();

  return p_product_id;
end;
$$;

create or replace function public.partner_set_distributor_product_enabled(
  p_store_slug text,
  p_product_id uuid,
  p_is_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_slug text := lower(trim(coalesce(p_store_slug, '')));
  v_distributor_id uuid;
begin
  if v_store_slug = '' then
    raise exception 'Store slug is required.';
  end if;

  if not (
    public.is_platform_admin()
    or (
      public.current_partner_access_level() = 'full'
      and (
        public.partner_has_capability('pricing_management')
        or public.partner_has_capability('pricing_manager')
        or public.partner_has_capability('pricing')
      )
      and public.is_current_partner_brand(null, v_store_slug, null)
    )
  ) then
    raise exception 'Only a full partner admin for this store can manage product visibility.';
  end if;

  select id
  into v_distributor_id
  from public.distributors
  where slug = v_store_slug
  limit 1;

  update public.distributor_products
  set
    is_enabled = coalesce(p_is_enabled, false),
    enabled = coalesce(p_is_enabled, false),
    updated_at = now()
  where distributor_id = v_distributor_id
    and product_id = p_product_id;

  if not found then
    raise exception 'Product is not part of the % catalog.', v_store_slug;
  end if;
end;
$$;

grant execute on function public.partner_upsert_distributor_product(text, uuid, numeric, boolean, boolean) to authenticated;
grant execute on function public.partner_set_distributor_product_enabled(text, uuid, boolean) to authenticated;
