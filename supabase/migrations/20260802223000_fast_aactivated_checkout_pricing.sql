-- Keep AACTIVATED multi-item checkout under the Supabase statement timeout.
-- The older pricing branch used OR-heavy joins for every cart item; this adds
-- the supporting indexes and documents the intended database-side fix.

create index if not exists aactivated_store_product_prices_store_product_active_idx
  on public.aactivated_store_product_prices(store_slug, product_id)
  where is_active = true;

create index if not exists rx_plus_products_upper_sku_idx
  on public.rx_plus_products(upper(sku));

do $migration$
declare
  v_function regprocedure := to_regprocedure('public.create_public_patient_submission(jsonb)');
  v_definition text;
  v_slow_block text := $slow$
      if v_aactivated_store_slug is not null then
        select
          coalesce(asp.product_name, p.display_name, p.product_name, asp.product_id),
          p.category,
          p.strength,
          coalesce(asp.sale_price, asp.retail_price, p.retail_price, p.suggested_retail_price),
          coalesce(p.true_wholesale_cost_per_vial, p.base_cost, 0)
        into v_name, v_category, v_strength, v_price, v_cost
        from public.aactivated_store_product_prices asp
        left join public.rx_plus_products p
          on p.id::text = asp.product_id
          or upper(p.sku) = upper(asp.product_id)
        where asp.store_slug = v_aactivated_store_slug
          and asp.is_active = true
          and (
            asp.product_id = v_item_id
            or upper(asp.product_id) = v_item_sku
            or p.id::text = v_item_id
            or upper(p.sku) = v_item_sku
          )
        order by asp.sort_order nulls last, asp.product_id
        limit 1;
      end if;
$slow$;
  v_fast_block text := $fast$
      if v_aactivated_store_slug is not null and v_item_id is not null then
        select
          coalesce(asp.product_name, p.display_name, p.product_name, asp.product_id),
          p.category,
          p.strength,
          coalesce(asp.sale_price, asp.retail_price, p.retail_price, p.suggested_retail_price),
          coalesce(p.true_wholesale_cost_per_vial, p.base_cost, 0)
        into v_name, v_category, v_strength, v_price, v_cost
        from public.aactivated_store_product_prices asp
        left join public.rx_plus_products p
          on p.id::text = asp.product_id
        where asp.store_slug = v_aactivated_store_slug
          and asp.is_active = true
          and asp.product_id = v_item_id
        order by asp.sort_order nulls last, asp.product_id
        limit 1;
      end if;

      if v_aactivated_store_slug is not null and v_price is null and v_item_sku <> '' then
        select
          coalesce(asp.product_name, p.display_name, p.product_name, p.id::text),
          p.category,
          p.strength,
          coalesce(asp.sale_price, asp.retail_price, p.retail_price, p.suggested_retail_price),
          coalesce(p.true_wholesale_cost_per_vial, p.base_cost, 0)
        into v_name, v_category, v_strength, v_price, v_cost
        from public.rx_plus_products p
        left join lateral (
          select asp_inner.*
          from public.aactivated_store_product_prices asp_inner
          where asp_inner.store_slug = v_aactivated_store_slug
            and asp_inner.is_active = true
            and (
              asp_inner.product_id = p.id::text
              or upper(asp_inner.product_id) = upper(p.sku)
            )
          order by asp_inner.sort_order nulls last, asp_inner.product_id
          limit 1
        ) asp on true
        where coalesce(p.active, true) = true
          and upper(p.sku) = v_item_sku
        limit 1;
      end if;
$fast$;
begin
  if v_function is null then
    raise exception 'create_public_patient_submission(jsonb) does not exist';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position('left join lateral (
          select asp_inner.*' in v_definition) = 0 then
    if position(v_slow_block in v_definition) = 0 then
      raise exception 'Expected AACTIVATED checkout pricing block was not found; refusing incomplete performance patch';
    end if;

    v_definition := replace(v_definition, v_slow_block, v_fast_block);
    execute v_definition;
  end if;
end
$migration$;

grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
