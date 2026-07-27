-- Payable public orders must always resolve an authoritative server-side price.
-- Patch the current RPC definition in-place so already-applied projects receive
-- the same protection as clean installs.
do $migration$
declare
  v_function regprocedure := to_regprocedure('public.create_public_patient_submission(jsonb)');
  v_definition text;
  v_unsafe_block text := $unsafe$
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
$unsafe$;
begin
  if v_function is null then
    raise exception 'create_public_patient_submission(jsonb) does not exist';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if position(v_unsafe_block in v_definition) = 0 then
    raise exception 'Expected client-price fallback block was not found; refusing an incomplete pricing patch';
  end if;

  v_definition := replace(v_definition, v_unsafe_block, '');
  execute v_definition;
end
$migration$;

comment on function public.create_public_patient_submission(jsonb) is
  'Creates public submissions and prices payable cart items only from authoritative server-side catalogs; browser-supplied fallback prices are rejected.';
