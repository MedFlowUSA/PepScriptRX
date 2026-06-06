-- Let Rock Phorm manage its storefront catalog without exposing other stores.

grant select on public.distributors to anon, authenticated;
grant select on public.rx_plus_products to anon, authenticated;
grant select on public.distributor_products to anon, authenticated;

drop policy if exists "public read active distributors" on public.distributors;
create policy "public read active distributors"
on public.distributors
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "public read active rx plus products" on public.rx_plus_products;
create policy "public read active rx plus products"
on public.rx_plus_products
for select
to anon, authenticated
using (active = true);

drop policy if exists "public read active distributor products" on public.distributor_products;
create policy "public read active distributor products"
on public.distributor_products
for select
to anon, authenticated
using (
  coalesce(enabled, is_enabled) = true
  and exists (
    select 1
    from public.distributors d
    where d.id = distributor_products.distributor_id
      and d.is_active = true
  )
);

create or replace function public.rockphorm_upsert_catalog_product(
  p_product_id uuid,
  p_product_name text,
  p_strength text,
  p_category text,
  p_sku text,
  p_retail_price numeric,
  p_is_enabled boolean default true,
  p_featured boolean default false,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distributor_id uuid;
  v_product_id uuid;
  v_sku text;
  v_name text;
  v_category text;
  v_strength text;
  v_description text;
begin
  if not public.is_rockphorm_admin() then
    raise exception 'Only the Rock Phorm admin can manage this catalog.';
  end if;

  v_name := nullif(trim(p_product_name), '');
  v_category := coalesce(nullif(trim(p_category), ''), 'Rock Phorm Catalog');
  v_strength := coalesce(nullif(trim(p_strength), ''), 'Standard');
  v_sku := upper(regexp_replace(coalesce(nullif(trim(p_sku), ''), v_name || '-' || v_strength), '[^a-zA-Z0-9]+', '-', 'g'));
  v_sku := trim(both '-' from v_sku);

  if v_name is null then
    raise exception 'Product name is required.';
  end if;

  if p_retail_price is null or p_retail_price <= 0 then
    raise exception 'Retail price must be greater than 0.';
  end if;

  if v_sku = '' then
    raise exception 'SKU is required.';
  end if;

  if v_sku not like 'ROCKPHORM-%' then
    v_sku := 'ROCKPHORM-' || v_sku;
  end if;

  select id into v_distributor_id
  from public.distributors
  where slug = 'rockphorm'
  limit 1;

  if v_distributor_id is null then
    raise exception 'Rock Phorm distributor row is missing.';
  end if;

  if p_product_id is not null then
    select p.id into v_product_id
    from public.rx_plus_products p
    where p.id = p_product_id
      and (
        p.partner_slug = 'rockphorm'
        or p.sku ilike 'ROCKPHORM-%'
        or exists (
          select 1
          from public.distributor_products dp
          where dp.product_id = p.id
            and dp.distributor_id = v_distributor_id
        )
      );

    if v_product_id is null then
      raise exception 'Product is not part of the Rock Phorm catalog.';
    end if;
  end if;

  v_description := coalesce(
    nullif(trim(p_description), ''),
    'Rock Phorm catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
  );

  if v_product_id is null then
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
      public_visible,
      partner_visible,
      partner_slug,
      featured,
      image_url,
      description
    )
    values (
      v_name,
      v_name || case when v_strength <> 'Standard' then ' ' || v_strength else '' end,
      v_category,
      v_strength,
      v_sku,
      p_retail_price,
      p_retail_price,
      0,
      true,
      'distributor_only',
      false,
      true,
      'rockphorm',
      p_featured,
      '/marketing/rockphorm-vial.png',
      v_description
    )
    on conflict (sku) do update set
      product_name = excluded.product_name,
      display_name = excluded.display_name,
      category = excluded.category,
      strength = excluded.strength,
      suggested_retail_price = excluded.suggested_retail_price,
      retail_price = excluded.retail_price,
      active = true,
      visibility_type = 'distributor_only',
      public_visible = false,
      partner_visible = true,
      partner_slug = 'rockphorm',
      featured = excluded.featured,
      image_url = excluded.image_url,
      description = excluded.description,
      updated_at = now()
    returning id into v_product_id;
  else
    update public.rx_plus_products
    set product_name = v_name,
        display_name = v_name || case when v_strength <> 'Standard' then ' ' || v_strength else '' end,
        category = v_category,
        strength = v_strength,
        sku = v_sku,
        suggested_retail_price = p_retail_price,
        retail_price = p_retail_price,
        active = true,
        visibility_type = 'distributor_only',
        public_visible = false,
        partner_visible = true,
        partner_slug = 'rockphorm',
        featured = p_featured,
        image_url = '/marketing/rockphorm-vial.png',
        description = v_description,
        updated_at = now()
    where id = v_product_id;
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
    v_product_id,
    coalesce(p_is_enabled, true),
    coalesce(p_is_enabled, true),
    p_retail_price,
    p_retail_price,
    coalesce(p_featured, false),
    0.55
  )
  on conflict (distributor_id, product_id) do update set
    is_enabled = excluded.is_enabled,
    enabled = excluded.enabled,
    custom_price = excluded.custom_price,
    custom_retail_price = excluded.custom_retail_price,
    featured = excluded.featured,
    commission_rate = excluded.commission_rate,
    updated_at = now();

  return v_product_id;
end;
$$;

create or replace function public.rockphorm_set_catalog_product_enabled(
  p_product_id uuid,
  p_is_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distributor_id uuid;
begin
  if not public.is_rockphorm_admin() then
    raise exception 'Only the Rock Phorm admin can manage this catalog.';
  end if;

  select id into v_distributor_id
  from public.distributors
  where slug = 'rockphorm'
  limit 1;

  update public.distributor_products dp
  set is_enabled = coalesce(p_is_enabled, false),
      enabled = coalesce(p_is_enabled, false),
      updated_at = now()
  where dp.distributor_id = v_distributor_id
    and dp.product_id = p_product_id;

  if not found then
    raise exception 'Product is not part of the Rock Phorm catalog.';
  end if;
end;
$$;

grant execute on function public.rockphorm_upsert_catalog_product(uuid, text, text, text, text, numeric, boolean, boolean, text) to authenticated;
grant execute on function public.rockphorm_set_catalog_product_enabled(uuid, boolean) to authenticated;
