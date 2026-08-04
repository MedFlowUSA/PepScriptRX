-- Remove all synthetic bridge-test records and every temporary test object.
do $$
declare
  v_order_ids uuid[] := '{}';
  v_wallet_ids uuid[] := '{}';
  v_rep_id uuid;
begin
  if to_regclass('staging_bridge_test.control') is not null then
    select coalesce(test_order_ids,'{}'::uuid[]),test_rep_id
    into v_order_ids,v_rep_id from staging_bridge_test.control limit 1;
    select coalesce(array_agg(distinct wallet_id),'{}'::uuid[]) into v_wallet_ids
    from public.wallet_entries where order_id=any(v_order_ids);
    delete from public.wallet_entries where order_id=any(v_order_ids);
    delete from public.commission_ledger where submission_id=any(v_order_ids);
    delete from public.payment_notification_outbox where order_id=any(v_order_ids);
    delete from public.payment_reconciliation_events where order_id=any(v_order_ids);
    delete from public.provider_payment_events where order_id=any(v_order_ids);
    delete from public.payment_audit_log where order_id=any(v_order_ids);
    delete from public.woocommerce_payment_sessions where submission_id=any(v_order_ids);
    delete from public.patient_submissions where id=any(v_order_ids);
    delete from public.reps where id=v_rep_id;
    delete from public.internal_wallets where id=any(v_wallet_ids);
  end if;
end $$;

drop schema if exists staging_bridge_test cascade;
drop role if exists psrx_bridge_test_20260804;
drop role if exists psrx_bridge_test_20260804b;

do $$
begin
  if exists(select 1 from pg_roles where rolname='psrx_bridge_test_20260804') then
    raise exception 'temporary bridge test role still exists';
  end if;
  if exists(select 1 from pg_roles where rolname='psrx_bridge_test_20260804b') then
    raise exception 'temporary bridge test role still exists';
  end if;
  if exists(select 1 from pg_namespace where nspname='staging_bridge_test') then
    raise exception 'temporary bridge test schema still exists';
  end if;
end $$;
