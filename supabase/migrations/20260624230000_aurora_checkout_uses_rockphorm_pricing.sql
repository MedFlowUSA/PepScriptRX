-- Allow Aurora Labs checkout to price items from the Rock Phorm catalog.
-- Aurora keeps its own checkout scope, attribution, store slug, and rollup; only
-- item pricing resolves through the Rock Phorm distributor product list.

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is null then
    raise exception 'create_public_patient_submission(jsonb) was not found';
  end if;

  if position('v_scope_code = ''AURORA''' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      '    when v_scope_code = ''AURORA'' or v_store_hint like ''%aurora%'' then ''rockphorm''
    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm'''
    );

    if next_fn = fn then
      raise exception 'Could not patch Aurora checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

update public.checkout_scopes
set
  default_commission_rate = 0.45,
  is_active = true,
  updated_at = now()
where scope_code = 'AURORA';
