-- Allow Ginto Wellness Labs checkout to price items from the Ginto distributor catalog.
-- Without this mapping the public checkout RPC can receive valid GINTO cart items,
-- but fail server-side pricing with "Could not price checkout item ...".

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

  if position('v_scope_code = ''GINTO''' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_store_hint like ''%glow%'' or v_scope_code = ''GLOW'' then ''glow''',
      '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''
    when v_store_hint like ''%glow%'' or v_scope_code = ''GLOW'' then ''glow'''
    );

    if next_fn = fn then
      next_fn := replace(
        fn,
        '    when v_store_hint like ''%anatolia%'' then ''anatolia''',
        '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''
    when v_store_hint like ''%anatolia%'' then ''anatolia'''
      );
    end if;

    if next_fn = fn then
      next_fn := replace(
        fn,
        '    else null',
        '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''
    else null'
      );
    end if;

    if next_fn = fn then
      raise exception 'Could not patch GINTO checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

update public.checkout_scopes
set
  default_commission_rate = 0.50,
  is_active = true,
  updated_at = now()
where scope_code = 'GINTO';
