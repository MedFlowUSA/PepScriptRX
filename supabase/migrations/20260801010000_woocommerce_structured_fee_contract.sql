-- Bind structured server-authoritative cart totals and WooCommerce's fee result.
alter table public.woocommerce_payment_sessions
  add column if not exists merchandise_subtotal_cents integer not null default 0 check (merchandise_subtotal_cents >= 0),
  add column if not exists discount_total_cents integer not null default 0 check (discount_total_cents >= 0),
  add column if not exists shipping_total_cents integer not null default 0 check (shipping_total_cents >= 0),
  add column if not exists tax_total_cents integer not null default 0 check (tax_total_cents >= 0),
  add column if not exists pre_fee_amount_cents integer not null default 0 check (pre_fee_amount_cents >= 0),
  add column if not exists processing_fee_rule text not null default 'woocommerce_6_percent_v1',
  add column if not exists processing_fee_basis_points integer not null default 600 check (processing_fee_basis_points = 600),
  add column if not exists expected_processing_fee_cents integer not null default 0 check (expected_processing_fee_cents >= 0),
  add column if not exists expected_captured_total_cents integer not null default 0 check (expected_captured_total_cents >= 0),
  add column if not exists cart_fingerprint text,
  add column if not exists cancel_path text;

alter table public.payment_reconciliation_events
  add column if not exists merchandise_amount_cents integer,
  add column if not exists shipping_tax_amount_cents integer,
  add column if not exists processing_fee_amount_cents integer;

create or replace function public.record_payment_reconciliation_event(
  p_provider text, p_provider_event_id text, p_provider_transaction_reference text,
  p_order_id uuid, p_event_type text, p_original_amount_cents integer,
  p_event_amount_cents integer, p_currency text, p_occurred_at timestamptz,
  p_private_details jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $$
begin
  insert into public.payment_reconciliation_events(
    provider,provider_event_id,provider_transaction_reference,order_id,event_type,
    original_amount_cents,event_amount_cents,currency,reason,occurred_at,private_details,
    merchandise_amount_cents,shipping_tax_amount_cents,processing_fee_amount_cents
  )
  values(
    lower(p_provider),p_provider_event_id,p_provider_transaction_reference,p_order_id,
    p_event_type,p_original_amount_cents,p_event_amount_cents,upper(p_currency),
    'manual_financial_review_required',p_occurred_at,coalesce(p_private_details,'{}'::jsonb),
    case when p_private_details->>'merchandise_refunded_cents' ~ '^[0-9]+$'
      then (p_private_details->>'merchandise_refunded_cents')::integer end,
    case when p_private_details->>'shipping_tax_refunded_cents' ~ '^[0-9]+$'
      then (p_private_details->>'shipping_tax_refunded_cents')::integer end,
    case when p_private_details->>'processing_fee_refunded_cents' ~ '^[0-9]+$'
      then (p_private_details->>'processing_fee_refunded_cents')::integer end
  )
  on conflict(provider,provider_event_id,event_type) do nothing;
  return jsonb_build_object('result','reconciliation_required');
end $$;
