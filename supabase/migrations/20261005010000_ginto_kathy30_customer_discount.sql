-- Ginto customer promotion only. Catalog prices, attribution and commission rates stay unchanged.
insert into public.aactivated_promo_links
  (link_slug, store_scope_code, promo_title, discount_code, discount_amount,
   discount_type, discount_percent, promo_kind, is_active, rep_slug,
   requires_platform_approval, approval_status, approved_at, updated_at)
values ('ginto-kathy30', 'GINTO', 'Ginto KATHY30 30% customer discount',
  'KATHY30', 0, 'percentage', 30, 'customer_discount', true, null, false, 'approved', now(), now())
on conflict (link_slug) do update set
  store_scope_code = excluded.store_scope_code,
  promo_title = excluded.promo_title,
  discount_code = excluded.discount_code,
  discount_type = excluded.discount_type,
  discount_percent = excluded.discount_percent,
  discount_amount = 0,
  promo_kind = 'customer_discount',
  is_active = true,
  rep_id = null,
  rep_slug = null,
  product_id = null,
  starts_at = null,
  expires_at = null,
  usage_limit = null,
  min_subtotal = 0,
  requires_platform_approval = false,
  approval_status = 'approved',
  approved_at = coalesce(public.aactivated_promo_links.approved_at, now()),
  updated_at = now();

-- Extend the existing server calculator so this code cannot leak into another storefront.
do $migration$
declare
  definition text := pg_get_functiondef('public.apply_aactivated_server_promo_to_submission()'::regprocedure);
  anchor text := '  if not v_is_supported_store or v_base_code';
begin
  if position('KATHY30 Ginto-only guard' in definition) = 0 then
    if position(anchor in definition) = 0
      or position('  if not found then' in definition) = 0
      or position('where upper(p.discount_code) = v_base_code' in definition) = 0 then
      raise exception 'Existing promo calculator changed; review before applying KATHY30';
    end if;

    definition := replace(definition, anchor, $patch$
  -- KATHY30 Ginto-only guard; reject cross-store, non-customer and stacked use.
  if v_base_code = 'KATHY30' then
    if upper(trim(coalesce(new.checkout_scope_code, ''))) <> 'GINTO'
       or v_order_type <> 'CUSTOMER_ORDER'
       or v_raw_code <> 'KATHY30' then
      raise exception 'KATHY30 is valid only for Ginto customer orders and cannot be combined with another code';
    end if;
    v_is_supported_store := true;
  end if;
$patch$ || anchor);

    definition := replace(
      definition,
      'where upper(p.discount_code) = v_base_code',
      'where upper(p.discount_code) = v_base_code and (v_base_code <> ''KATHY30'' or p.link_slug = ''ginto-kathy30'')'
    );

    definition := replace(definition, '  if not found then', $patch$
  if not found and v_base_code = 'KATHY30' then
    raise exception 'KATHY30 is not available for this order';
  end if;
  if not found then$patch$);

    execute definition;
  end if;
end $migration$;
