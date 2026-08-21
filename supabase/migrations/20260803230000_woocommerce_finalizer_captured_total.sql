-- WooCommerce captures the server-authoritative pre-fee order total plus the
-- separately contracted 6% processing fee. Bind finalization to the exact
-- WooCommerce session/order pair while preserving Stripe and PayPal behavior.
do $migration$
declare
  v_proc regprocedure := to_regprocedure(
    'public.finalize_verified_paid_order(text,text,text,text,uuid,integer,text,timestamptz,jsonb)'
  );
  v_definition text;
  v_old text := '  v_expected_cents := round((v_product_total - v_discount + v_shipping) * 100)::integer;';
  v_new text := $replacement$
  if p_provider = 'woocommerce' then
    if coalesce(p_provider_order_reference, '') !~ '^[0-9]+$' then
      return jsonb_build_object('result', 'invalid_provider_event');
    end if;
    select s.expected_amount_cents
    into v_expected_cents
    from public.woocommerce_payment_sessions s
    where s.submission_id = p_order_id
      and s.woo_order_id = p_provider_order_reference::bigint
    order by s.created_at desc
    limit 1;
    if not found then
      return jsonb_build_object('result', 'invalid_order_state');
    end if;
  else
    v_expected_cents := round((v_product_total - v_discount + v_shipping) * 100)::integer;
  end if;$replacement$;
begin
  if v_proc is null then
    raise exception 'finalize_verified_paid_order is not installed';
  end if;
  v_definition := pg_get_functiondef(v_proc);
  if position('from public.woocommerce_payment_sessions s' in v_definition) > 0 then
    return;
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'finalizer amount-verification block did not match the expected source';
  end if;
  execute replace(v_definition, v_old, v_new);
end
$migration$;

comment on function public.finalize_verified_paid_order(
  text,text,text,text,uuid,integer,text,timestamptz,jsonb
) is 'Transactional paid-order finalizer. WooCommerce amounts are bound to the exact private bridge session, including the contracted processing fee.';
