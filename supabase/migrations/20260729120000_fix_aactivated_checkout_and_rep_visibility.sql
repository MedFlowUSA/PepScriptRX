-- Repair AACTIVATED checkout after strict server-side pricing enforcement.
-- The RPC still rejects browser-supplied prices, but it can now price any active
-- RX+ catalog item by authoritative product id or SKU when the AACTIVATED
-- scoped price/distributor mappings are incomplete.

do $migration$
declare
  v_function regprocedure := to_regprocedure('public.create_public_patient_submission(jsonb)');
  v_definition text;
  v_legacy_fallback text := $legacy$
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
$legacy$;
  v_rx_plus_fallback text := $rxplus$
      if v_price is null then
        select
          coalesce(p.display_name, p.product_name),
          p.category,
          p.strength,
          coalesce(p.retail_price, p.suggested_retail_price),
          coalesce(p.true_wholesale_cost_per_vial, p.base_cost, 0)
        into v_name, v_category, v_strength, v_price, v_cost
        from public.rx_plus_products p
        where coalesce(p.active, true) = true
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
$rxplus$;
begin
  if v_function is null then
    raise exception 'create_public_patient_submission(jsonb) does not exist';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position('from public.rx_plus_products p
        where coalesce(p.active, true) = true
          and (
            p.id::text = v_item_id
            or upper(p.sku) = v_item_sku
          )' in v_definition) = 0 then
    if position(v_legacy_fallback in v_definition) = 0 then
      raise exception 'Expected legacy checkout pricing fallback was not found; refusing incomplete AACTIVATED checkout patch';
    end if;

    v_definition := replace(v_definition, v_legacy_fallback, v_rx_plus_fallback);
    execute v_definition;
  end if;
end
$migration$;

grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

-- Re-normalize any newer AACTIVATEDRX rep intake rows whose source fields were
-- partially populated, so Guy's scoped admin portal can select them reliably.
update public.rep_store_intake_submissions
set
  source_portal_id = 'aactivated',
  source_portal = coalesce(nullif(source_portal, ''), 'AACTIVATEDRX'),
  source_route = coalesce(nullif(source_route, ''), '/AACTIVATED/rep-intake'),
  parent_store_slug = 'aactivated',
  parent_store_name = 'AACTIVATEDRX',
  partner_admin_email = 'guy@aactivated.com',
  approval_owner_email = 'guy@aactivated.com',
  approval_status = coalesce(nullif(approval_status, ''), 'pending'),
  review_queue = 'aactivated',
  review_admin_code = coalesce(nullif(review_admin_code, ''), 'GUY60'),
  review_admin_name = coalesce(nullif(review_admin_name, ''), 'Guy Griffithe - GUY60'),
  internal_notes = coalesce(
    nullif(internal_notes, ''),
    'AACTIVATED_REP_INTAKE: Routed to AACTIVATED review queue.'
  )
where public.is_aactivated_rep_intake_scope(
  source_portal_id,
  source_portal,
  source_url,
  source_route,
  review_queue,
  parent_store_slug,
  parent_store_name,
  partner_admin_email,
  approval_owner_email,
  review_admin_code,
  review_admin_name,
  parent_rep_or_admin_name,
  store_type,
  store_brand_name,
  internal_notes
);
