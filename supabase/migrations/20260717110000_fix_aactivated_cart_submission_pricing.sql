-- Fix AACTIVATED customer checkout failures when a cart item cannot be priced
-- through the old Guy-only storefront hint. This keeps server-side pricing first,
-- with a guarded cart-price fallback for portal cart orders.

create or replace function public.create_public_patient_submission(payload jsonb)
returns table (
  submission_id uuid,
  public_payment_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  v_payment_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_full_name text := nullif(payload->>'full_name', '');
  v_email text := nullif(payload->>'email', '');
  v_phone text := nullif(payload->>'phone', '');
  v_shipping_speed text := lower(coalesce(nullif(payload->>'shipping_speed', ''), 'standard'));
  v_shipping_cost numeric := 0;
  v_order_ready boolean := lower(coalesce(payload->>'order_ready', 'false')) = 'true'
    or lower(coalesce(payload->>'status', '')) = 'payment_sent';
  v_receipt_review boolean := lower(coalesce(payload->>'receipt_discount_review', 'false')) = 'true';
  v_submission_type text := coalesce(nullif(payload->>'submission_type', ''), 'savings_check');
  v_is_accessory_only boolean := lower(coalesce(payload->>'is_accessory_only', 'false')) = 'true';
  v_scope_code text := public.normalize_checkout_scope_code(coalesce(nullif(payload->>'checkout_scope_code', ''), nullif(payload->>'source_rep', ''), nullif(payload->>'admin_code', ''), nullif(payload->>'referral_code', ''), 'MAIN'));
  v_scope record;
  v_rep_id uuid := null;
  v_store_hint text := lower(concat_ws(
    ' ',
    nullif(payload->>'store_slug', ''),
    nullif(payload->>'source_store', ''),
    nullif(payload->>'source_portal', ''),
    nullif(payload->>'source_route', ''),
    nullif(payload->>'brand_id', ''),
    nullif(payload->>'admin_code', ''),
    nullif(payload->>'source_admin', ''),
    nullif(payload->>'source_rep', ''),
    nullif(payload->>'referral_code', ''),
    nullif(payload->>'checkout_scope_code', '')
  ));
  v_distributor_slug text := null;
  v_aactivated_store_slug text := null;
  v_referral_code text := nullif(payload->>'referral_code', '');
  v_discount_code text := upper(coalesce(nullif(payload->>'discount_code', ''), ''));
  v_discount_amount numeric := 0;
  v_discount_percent numeric := 0;
  v_status text := 'new_submission';
  v_product_total numeric := 0;
  v_order_total numeric := null;
  v_cost_of_goods numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_selected_addons jsonb := case when jsonb_typeof(payload->'selected_addons') = 'array' then payload->'selected_addons' else '[]'::jsonb end;
  v_raw_items jsonb := case when jsonb_typeof(payload->'order_items') = 'array' then payload->'order_items' else '[]'::jsonb end;
  v_item jsonb;
  v_item_id text;
  v_item_sku text;
  v_qty int;
  v_name text;
  v_category text;
  v_strength text;
  v_price numeric;
  v_cost numeric;
  v_qty_text text;
  v_cart_price_text text;
  v_medication text := nullif(payload->>'medication', '');
  v_product_id text := nullif(payload->>'product_id', '');
  v_product_name text := nullif(payload->>'product_name', '');
  v_product_category text := nullif(payload->>'product_category', '');
  v_product_type text := nullif(payload->>'product_type', '');
  v_dob_raw text := nullif(payload->>'date_of_birth', '');
  v_current_price_raw text := nullif(payload->>'current_price', '');
begin
  if v_shipping_speed not in ('standard', 'expedited', 'overnight') then
    v_shipping_speed := 'standard';
  end if;
  v_shipping_cost := case v_shipping_speed when 'expedited' then 25 when 'overnight' then 50 else 0 end;

  select *
  into v_scope
  from public.checkout_scopes
  where scope_code = coalesce(v_scope_code, 'MAIN')
    and is_active = true
  limit 1;

  if found then
    v_scope_code := v_scope.scope_code;
    v_referral_code := coalesce(nullif(v_scope.account_id, ''), v_referral_code, v_scope.scope_code);
  else
    v_scope_code := 'MAIN';
  end if;

  select r.id
  into v_rep_id
  from public.reps r
  where r.active = true
    and (
      upper(r.rep_slug) = upper(coalesce(v_referral_code, ''))
      or (v_discount_code <> '' and upper(r.discount_code) = v_discount_code)
    )
  limit 1;

  v_distributor_slug := case
    when v_scope_code in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
      or v_store_hint like '%aactivated%'
      or v_store_hint like '%vitality%'
      or exists (
        select 1
        from public.reps r
        where r.active = true
          and upper(r.rep_slug) = upper(coalesce(v_referral_code, v_scope_code, ''))
          and (
            lower(coalesce(r.brand_id, '')) = 'aactivated'
            or lower(coalesce(r.parent_brand_id, '')) = 'aactivated'
            or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
            or lower(coalesce(r.assigned_store_slug, '')) = 'aactivated'
            or upper(coalesce(r.brand_name, '')) like '%AACTIVATED%'
          )
      )
      then 'guy'
    when v_scope_code = 'ROCKPHORM' or v_store_hint like '%rock%' then 'rockphorm'
    when v_store_hint like '%optimax%' then 'optimax'
    when v_store_hint like '%alpha%' then 'alpha'
    when v_store_hint like '%ronin%' then 'ronin'
    when v_store_hint like '%agprime%' then 'agprime'
    when v_store_hint like '%vyigenix%' then 'vyigenix'
    when v_store_hint like '%zenora%' then 'zenora'
    when v_store_hint like '%anatolia%' then 'anatolia'
    else null
  end;
  v_aactivated_store_slug := case when v_distributor_slug = 'guy' then 'aactivated' else null end;

  if v_order_ready or jsonb_array_length(v_raw_items) > 0 then
    if jsonb_array_length(v_raw_items) = 0 and v_product_id is not null then
      v_raw_items := jsonb_build_array(jsonb_build_object(
        'id', v_product_id,
        'sku', payload->>'sku',
        'quantity', 1,
        'price', payload->>'quoted_price'
      ));
    end if;

    for v_item in select value from jsonb_array_elements(v_raw_items)
    loop
      v_item_id := nullif(v_item->>'id', '');
      v_item_sku := upper(coalesce(nullif(v_item->>'sku', ''), ''));
      v_qty_text := coalesce(nullif(v_item->>'quantity', ''), nullif(v_item->>'qty', ''), '1');
      v_qty := case when v_qty_text ~ '^[0-9]+$' then greatest(1, least(20, v_qty_text::int)) else 1 end;
      v_name := null;
      v_category := null;
      v_strength := null;
      v_price := null;
      v_cost := 0;
      v_cart_price_text := coalesce(
        nullif(v_item->>'price', ''),
        case when jsonb_array_length(v_raw_items) = 1 then nullif(payload->>'quoted_price', '') else null end
      );

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

      if v_price is null and v_distributor_slug is not null then
        select
          coalesce(p.display_name, p.product_name),
          p.category,
          p.strength,
          coalesce(dp.custom_price, dp.custom_retail_price, p.retail_price, p.suggested_retail_price),
          coalesce(dp.internal_wholesale_cost_per_vial, p.true_wholesale_cost_per_vial, p.base_cost, 0)
        into v_name, v_category, v_strength, v_price, v_cost
        from public.rx_plus_products p
        join public.distributor_products dp on dp.product_id = p.id
        join public.distributors d on d.id = dp.distributor_id
        where d.slug = v_distributor_slug
          and coalesce(dp.is_enabled, true) = true
          and coalesce(p.active, true) = true
          and (
            p.id::text = v_item_id
            or upper(p.sku) = v_item_sku
          )
        limit 1;
      end if;

      if v_price is null then
        select
          p.name,
          p.category,
          null::text,
          p.price,
          0::numeric
        into v_name, v_category, v_strength, v_price, v_cost
        from public.products p
        where p.id = v_item_id
          and p.status in ('active', 'manual_review', 'physician_review')
        limit 1;
      end if;

      if (v_price is null or v_price <= 0)
        and v_cart_price_text ~ '^[0-9]+(\.[0-9]{1,2})?$'
        and (v_item_id is not null or v_item_sku <> '')
      then
        v_name := coalesce(nullif(v_item->>'name', ''), nullif(v_item->>'display_name_at_purchase', ''), v_item_id, v_item_sku, 'PepScriptRX order');
        v_category := nullif(v_item->>'category', '');
        v_strength := nullif(v_item->>'strength', '');
        v_price := v_cart_price_text::numeric;
        v_cost := 0;
      end if;

      if v_price is null or v_price <= 0 then
        raise exception 'Could not price checkout item %', coalesce(v_item_sku, v_item_id, 'unknown');
      end if;

      v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
        'id', coalesce(v_item_id, v_item_sku),
        'sku', nullif(v_item_sku, ''),
        'name', coalesce(v_name, 'PepScriptRX order'),
        'category', v_category,
        'strength', v_strength,
        'price', v_price,
        'quantity', v_qty
      ));
      v_product_total := v_product_total + (v_price * v_qty);
      v_cost_of_goods := v_cost_of_goods + (coalesce(v_cost, 0) * v_qty);
      v_medication := coalesce(v_medication, coalesce(v_name, 'PepScriptRX order'));
      v_product_name := coalesce(v_product_name, v_name);
      v_product_category := coalesce(v_product_category, v_category);
    end loop;
  end if;

  if v_discount_code <> '' and v_product_total > 0 then
    v_discount_percent := case
      when v_discount_code in ('PORTAL10', 'PEP10', 'EHWSUB10') then 0.10
      when v_discount_code = 'BROOKS25' then 0.25
      else 0
    end;

    if v_discount_percent > 0 then
      v_discount_amount := round(v_product_total * greatest(0, least(1, coalesce(v_discount_percent, 0))), 2);
    else
      select coalesce(r.discount_amount, 0)
      into v_discount_amount
      from public.reps r
      where upper(r.discount_code) = v_discount_code
        and r.active = true
      limit 1;
    end if;

    v_discount_amount := least(v_product_total, greatest(0, coalesce(v_discount_amount, 0)));
  end if;

  if v_order_ready and v_product_total > 0 and not v_receipt_review then
    v_status := 'payment_sent';
    v_order_total := greatest(0, v_product_total - v_discount_amount) + v_shipping_cost;
  elsif v_receipt_review then
    v_status := 'under_review';
  else
    v_status := 'new_submission';
  end if;

  insert into public.patient_submissions (
    id,
    public_payment_token,
    full_name,
    email,
    phone,
    rep_id,
    medication,
    current_dose,
    current_price,
    state,
    date_of_birth,
    current_pharmacy,
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_speed,
    shipping_cost,
    referral_code,
    discount_code,
    discount_amount,
    status,
    payment_status,
    paid_at,
    quoted_price,
    product_id,
    product_name,
    product_category,
    product_type,
    selected_addons,
    is_accessory_only,
    submission_type,
    inquiry_notes,
    order_number,
    order_items,
    order_total,
    cost_of_goods,
    admin_code,
    store_slug,
    store_name,
    account_type,
    parent_type,
    checkout_scope_code,
    attribution_source,
    source_portal,
    source_route,
    source_store,
    source_admin,
    source_rep,
    locale,
    commission_owner,
    commission_rate,
    partner_payout_eligible
  )
  values (
    new_id,
    v_payment_token,
    v_full_name,
    v_email,
    v_phone,
    v_rep_id,
    coalesce(v_medication, 'PepScriptRX request'),
    nullif(payload->>'current_dose', ''),
    case when v_current_price_raw ~ '^[0-9]+(\.[0-9]{1,2})?$' then v_current_price_raw::numeric else null end,
    coalesce(nullif(payload->>'state', ''), nullif(payload->>'shipping_state', '')),
    case when v_dob_raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then v_dob_raw::date else null end,
    nullif(payload->>'current_pharmacy', ''),
    nullif(payload->>'shipping_address', ''),
    nullif(payload->>'shipping_city', ''),
    nullif(payload->>'shipping_state', ''),
    nullif(payload->>'shipping_zip', ''),
    v_shipping_speed,
    v_shipping_cost,
    v_referral_code,
    nullif(v_discount_code, ''),
    v_discount_amount,
    v_status,
    'unpaid',
    null,
    case when v_status = 'payment_sent' then v_product_total else null end,
    v_product_id,
    v_product_name,
    v_product_category,
    v_product_type,
    v_selected_addons,
    v_is_accessory_only,
    v_submission_type,
    nullif(payload->>'inquiry_notes', ''),
    'PSRX-' || upper(left(new_id::text, 8)),
    case when v_status = 'payment_sent' then v_order_items else '[]'::jsonb end,
    v_order_total,
    coalesce(v_cost_of_goods, 0),
    nullif(payload->>'admin_code', ''),
    nullif(payload->>'store_slug', ''),
    nullif(payload->>'store_name', ''),
    nullif(payload->>'account_type', ''),
    nullif(payload->>'parent_type', ''),
    v_scope_code,
    coalesce(nullif(payload->>'attribution_source', ''), 'default'),
    coalesce(nullif(payload->>'source_portal', ''), 'main'),
    nullif(payload->>'source_route', ''),
    nullif(payload->>'source_store', ''),
    nullif(payload->>'source_admin', ''),
    nullif(payload->>'source_rep', ''),
    nullif(payload->>'locale', ''),
    nullif(payload->>'commission_owner', ''),
    nullif(payload->>'commission_rate', '')::numeric,
    nullif(payload->>'partner_payout_eligible', '')::boolean
  );

  return query select new_id, v_payment_token;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
