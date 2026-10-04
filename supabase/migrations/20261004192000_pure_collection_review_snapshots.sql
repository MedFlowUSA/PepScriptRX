-- Publication must acknowledge each current variant price and eligibility snapshot.
do $$ declare definition text:=pg_get_functiondef('public.save_pure_collection(jsonb,numeric)'::regprocedure); marker text:='    if p_expected_total is null';
begin
  if position('Reviewed component snapshot changed' in definition)=0 then
    if position(marker in definition)=0 then raise exception 'Collection publication validator changed'; end if;
    execute replace(definition,marker,$patch$
    if p_collection->'reviewed_items' is distinct from quote->'items' then
      raise exception 'Reviewed component snapshot changed. Save a draft and review current prices and availability before publishing.';
    end if;
    $patch$ || marker);
  end if;
end $$;
-- Respect configured store margin rules; do not invent a new minimum margin.
do $$ declare definition text:=pg_get_functiondef('public.quote_pure_cart(jsonb,text,boolean)'::regprocedure);
begin
  execute replace(definition,
    '(net-costs)/net*100 < coalesce((guards->>''min_margin_percent'')::numeric,0)',
    '(guards ? ''min_margin_percent'' and (net-costs)/net*100 < (guards->>''min_margin_percent'')::numeric)');
end $$;
