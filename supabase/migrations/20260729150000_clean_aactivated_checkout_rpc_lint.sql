-- Keep the hardened public checkout RPC lint-clean after client-supplied
-- cart-price fallback was removed.

do $migration$
declare
  v_function regprocedure := to_regprocedure('public.create_public_patient_submission(jsonb)');
  v_definition text;
begin
  if v_function is null then
    raise exception 'create_public_patient_submission(jsonb) does not exist';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position('v_cart_price_text text;' in v_definition) > 0 then
    v_definition := replace(v_definition, E'  v_cart_price_text text;\n', '');
  end if;

  if position('      v_cart_price_text := coalesce(' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      E'      v_cart_price_text := coalesce(\n        nullif(v_item->>''price'', ''''),\n        case when jsonb_array_length(v_raw_items) = 1 then nullif(payload->>''quoted_price'', '''') else null end\n      );\n\n',
      ''
    );
  end if;

  execute v_definition;
end
$migration$;

grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
