-- Make 3% the only fee contract accepted for new WooCommerce bridge sessions.
-- Historical 6% rows remain unchanged and can still receive status-only updates.
alter table public.woocommerce_payment_sessions
  alter column processing_fee_rule set default 'woocommerce_3_percent_v1',
  alter column processing_fee_basis_points set default 300;

alter table public.woocommerce_payment_sessions
  drop constraint if exists woocommerce_payment_sessions_processing_fee_basis_points_check;

alter table public.woocommerce_payment_sessions
  add constraint woocommerce_payment_sessions_processing_fee_basis_points_check
  check (processing_fee_basis_points between 0 and 600);

create or replace function public.enforce_woocommerce_processing_fee_three_percent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_expected_fee integer;
begin
  if new.processing_fee_rule <> 'woocommerce_3_percent_v1'
     or new.processing_fee_basis_points <> 300 then
    raise exception 'new WooCommerce sessions require the 3 percent fee contract'
      using errcode = '23514';
  end if;

  v_expected_fee := ((new.pre_fee_amount_cents::bigint * 300) + 5000) / 10000;
  if new.expected_processing_fee_cents <> v_expected_fee
     or new.expected_captured_total_cents <> new.pre_fee_amount_cents + new.expected_processing_fee_cents
     or new.expected_amount_cents <> new.expected_captured_total_cents then
    raise exception 'WooCommerce session fee totals do not match the 3 percent contract'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_woocommerce_processing_fee_three_percent() from public;

drop trigger if exists enforce_woocommerce_processing_fee_three_percent
  on public.woocommerce_payment_sessions;
create trigger enforce_woocommerce_processing_fee_three_percent
before insert or update of
  processing_fee_rule,
  processing_fee_basis_points,
  pre_fee_amount_cents,
  expected_processing_fee_cents,
  expected_captured_total_cents,
  expected_amount_cents
on public.woocommerce_payment_sessions
for each row execute function public.enforce_woocommerce_processing_fee_three_percent();

comment on function public.enforce_woocommerce_processing_fee_three_percent() is
  'Rejects new or altered WooCommerce session contracts unless the server-authoritative fee is exactly 3% with integer-cent half-up rounding.';
