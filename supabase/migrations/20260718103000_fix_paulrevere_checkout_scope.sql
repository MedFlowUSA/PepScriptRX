-- Route Paul Revere Peptides checkout carts through the Paul Revere distributor
-- catalog so multi-item and quantity orders keep the correct store scope.

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('PAULREVERE' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      '    when v_scope_code = ''PAULREVERE'' or v_store_hint like ''%paulrevere%'' or v_store_hint like ''%paul revere%'' then ''paulrevere''
    when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm'''
    );

    if next_fn = fn then
      raise exception 'Could not patch Paul Revere checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;
