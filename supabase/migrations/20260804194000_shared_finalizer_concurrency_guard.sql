-- Serialize all paid-order finalization attempts before entering the existing
-- transactional finalizer. This closes races between different provider event
-- IDs or transaction references for the same PepScriptRX order.

alter function public.finalize_verified_paid_order(
  text, text, text, text, uuid, integer, text, timestamptz, jsonb
) rename to finalize_verified_paid_order_unlocked;

revoke all on function public.finalize_verified_paid_order_unlocked(
  text, text, text, text, uuid, integer, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;

create function public.finalize_verified_paid_order(
  p_provider text,
  p_provider_event_id text,
  p_provider_order_reference text,
  p_provider_transaction_reference text,
  p_order_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_existing public.provider_payment_events%rowtype;
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_event_id text := trim(coalesce(p_provider_event_id, ''));
  v_transaction_reference text := trim(coalesce(p_provider_transaction_reference, ''));
begin
  -- All invocations take these locks in the same order. The order lock makes
  -- callbacks for one business order mutually exclusive; the other locks also
  -- protect accidental reuse across different orders.
  perform pg_advisory_xact_lock(hashtextextended('payment-order|' || coalesce(p_order_id::text, ''), 0));
  perform pg_advisory_xact_lock(hashtextextended('payment-transaction|' || v_provider || '|' || v_transaction_reference, 0));
  perform pg_advisory_xact_lock(hashtextextended('payment-event|' || v_provider || '|' || v_event_id, 0));

  select * into v_existing
  from public.provider_payment_events
  where order_id = p_order_id and event_type = 'payment_approved'
  order by created_at
  limit 1;

  if found and (
    v_existing.provider <> v_provider
    or v_existing.provider_transaction_reference <> v_transaction_reference
  ) then
    insert into public.payment_reconciliation_events(
      provider, provider_event_id, provider_transaction_reference, order_id,
      event_type, original_amount_cents, event_amount_cents, currency, reason,
      occurred_at, private_details
    ) values (
      v_provider, v_event_id, v_transaction_reference, p_order_id,
      'already_paid_conflict', v_existing.amount_cents, p_amount_cents,
      upper(trim(coalesce(p_currency, ''))),
      'order_already_finalized_with_different_provider_or_transaction',
      coalesce(p_paid_at, now()), coalesce(p_event_payload, '{}'::jsonb)
    ) on conflict (provider, provider_event_id, event_type) do nothing;
    return jsonb_build_object('result', 'conflicting_provider_reference', 'order_id', p_order_id);
  end if;

  return public.finalize_verified_paid_order_unlocked(
    p_provider, p_provider_event_id, p_provider_order_reference,
    p_provider_transaction_reference, p_order_id, p_amount_cents, p_currency,
    p_paid_at, p_event_payload
  );
end;
$$;

revoke all on function public.finalize_verified_paid_order(
  text, text, text, text, uuid, integer, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_verified_paid_order(
  text, text, text, text, uuid, integer, text, timestamptz, jsonb
) to service_role;

comment on function public.finalize_verified_paid_order(
  text, text, text, text, uuid, integer, text, timestamptz, jsonb
) is 'Serialized provider-neutral paid-order finalizer; all callers must use this public wrapper.';
