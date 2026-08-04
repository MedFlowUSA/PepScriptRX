create role psrx_bridge_test_20260804b login password '__PSRX_TEST_PASSWORD__'
  nosuperuser nocreatedb nocreaterole noinherit noreplication connection limit 10
  valid until '2026-08-06 00:00:00+00';
create schema staging_bridge_test;
alter role psrx_bridge_test_20260804b set search_path=staging_bridge_test,pg_temp;

create table staging_bridge_test.control (
  reject_order_id uuid,
  test_order_ids uuid[] not null default '{}',
  test_rep_id uuid
);
insert into staging_bridge_test.control default values;

create function staging_bridge_test.reject_finalizer_audit()
returns trigger language plpgsql security definer set search_path=public,staging_bridge_test as $$
begin
  if new.order_id=(select reject_order_id from staging_bridge_test.control limit 1) then
    raise exception 'forced audit failure';
  end if;
  return new;
end $$;
create trigger staging_reject_audit before insert on public.payment_audit_log
for each row execute function staging_bridge_test.reject_finalizer_audit();

create function staging_bridge_test.command(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,staging_bridge_test,pg_temp as $$
declare
  v_id uuid;
  v_rep uuid;
  v_result jsonb;
  v_wallet_ids uuid[];
begin
  if p_action='seed_rep' then
    insert into reps(rep_slug,rep_name,commission_rate,override_percent,platform_percent)
    values('STAGING-BRIDGE-TEST','Synthetic bridge test rep',0.60,0,0.40)
    on conflict(rep_slug) do update set
      rep_name=excluded.rep_name,
      commission_rate=excluded.commission_rate,
      override_percent=excluded.override_percent,
      platform_percent=excluded.platform_percent
    returning id into v_rep;
    update staging_bridge_test.control set test_rep_id=v_rep;
    return jsonb_build_object('rep_id',v_rep);
  elsif p_action='create_order' then
    v_id := (p_payload->>'id')::uuid;
    select test_rep_id into v_rep from staging_bridge_test.control;
    insert into patient_submissions(id,rep_id,status,quoted_price,discount_amount,shipping_cost,
      cost_of_goods,inventory_marker,promo_use_marker,source_portal)
    values(v_id,case when coalesce((p_payload->>'with_rep')::boolean,false) then v_rep else null end,
      coalesce(p_payload->>'status','payment_sent'),100,10,5,25,7,3,'STAGING_BRIDGE_TEST');
    update staging_bridge_test.control set test_order_ids=array_append(test_order_ids,v_id);
    return jsonb_build_object('id',v_id);
  elsif p_action='snapshot' then
    v_id := (p_payload->>'id')::uuid;
    select jsonb_build_object(
      'status',s.status,'payment_status',s.payment_status,'payment_provider',s.payment_provider,
      'payment_reference',s.payment_reference,'inventory_marker',s.inventory_marker,
      'promo_use_marker',s.promo_use_marker,
      'events',(select count(*) from provider_payment_events where order_id=v_id),
      'commissions',(select count(*) from commission_ledger where submission_id=v_id),
      'wallet_entries',(select count(*) from wallet_entries where order_id=v_id),
      'audits',(select count(*) from payment_audit_log where order_id=v_id),
      'notifications',(select count(*) from payment_notification_outbox where order_id=v_id),
      'reconciliations',(select count(*) from payment_reconciliation_events where order_id=v_id),
      'pending_balance',coalesce((select sum(w.pending_balance) from internal_wallets w
        where w.id in(select wallet_id from wallet_entries where order_id=v_id)),0),
      'lifetime_earned',coalesce((select sum(w.lifetime_earned) from internal_wallets w
        where w.id in(select wallet_id from wallet_entries where order_id=v_id)),0)
    ) into v_result from patient_submissions s where s.id=v_id;
    return v_result;
  elsif p_action='create_session' then
    v_id := (p_payload->>'order_id')::uuid;
    insert into woocommerce_payment_sessions(
      session_token_hash,idempotency_key,submission_id,public_payment_token_hash,key_id,
      expected_amount_cents,currency,origin_store,return_path,status,woo_order_id,expires_at
    ) values(
      p_payload->>'token_hash',p_payload->>'idempotency_key',v_id,p_payload->>'public_token_hash',
      'staging-test',coalesce((p_payload->>'amount_cents')::integer,9500),'USD',
      'STAGING_BRIDGE_TEST','/staging-test','awaiting_payment',
      (p_payload->>'woo_order_id')::bigint,now()+interval '15 minutes'
    );
    return '{"ok":true}'::jsonb;
  elsif p_action='session_snapshot' then
    select jsonb_build_object(
      'status',status,'last_event_id',last_event_id,'reconciliation_required',reconciliation_required,
      'error_category',error_category,'consumed',consumed_at is not null
    ) into v_result from woocommerce_payment_sessions where session_token_hash=p_payload->>'token_hash';
    return v_result;
  elsif p_action='set_rollback_failure' then
    update staging_bridge_test.control set reject_order_id=nullif(p_payload->>'id','')::uuid;
    return '{"ok":true}'::jsonb;
  elsif p_action='disable_test_notifications' then
    update payment_notification_outbox set retry_eligible=false
    where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    return jsonb_build_object('updated',found);
  elsif p_action='make_notification_due' then
    v_id := (p_payload->>'id')::uuid;
    update payment_notification_outbox set next_attempt_at=now()-interval '1 second'
    where order_id=v_id and retry_eligible;
    return '{"ok":true}'::jsonb;
  elsif p_action='notification_snapshot' then
    v_id := (p_payload->>'id')::uuid;
    select jsonb_build_object(
      'status',status,'attempts',attempts,'retry_eligible',retry_eligible,
      'has_lock',lock_token is not null,'delivered',delivered_at is not null,
      'terminal',terminal_at is not null,'last_error_category',last_error_category
    ) into v_result from payment_notification_outbox where order_id=v_id;
    return v_result;
  elsif p_action='cleanup' then
    update staging_bridge_test.control set reject_order_id=null;
    select array_agg(distinct wallet_id) into v_wallet_ids from wallet_entries
      where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from wallet_entries where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from commission_ledger where submission_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from payment_notification_outbox where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from payment_reconciliation_events where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from provider_payment_events where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from payment_audit_log where order_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from woocommerce_payment_sessions where submission_id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from patient_submissions where id in (select unnest(test_order_ids) from staging_bridge_test.control);
    delete from reps where id=(select test_rep_id from staging_bridge_test.control);
    delete from internal_wallets where id=any(coalesce(v_wallet_ids,'{}'::uuid[]));
    update staging_bridge_test.control set test_order_ids='{}',test_rep_id=null;
    return '{"ok":true}'::jsonb;
  end if;
  raise exception 'unsupported staging test action';
end $$;

create function staging_bridge_test.finalize(
  p_provider text, p_provider_event_id text, p_provider_order_reference text,
  p_provider_transaction_reference text, p_order_id uuid, p_amount_cents integer,
  p_currency text, p_paid_at timestamptz, p_event_payload jsonb
) returns jsonb language sql security definer set search_path=public,staging_bridge_test,pg_temp as $$
  select public.finalize_verified_paid_order(
    p_provider,p_provider_event_id,p_provider_order_reference,
    p_provider_transaction_reference,p_order_id,p_amount_cents,p_currency,
    p_paid_at,p_event_payload
  )
$$;

create function staging_bridge_test.reconcile(
  p_provider text, p_provider_event_id text, p_provider_transaction_reference text,
  p_order_id uuid, p_event_type text, p_original_amount_cents integer,
  p_event_amount_cents integer, p_currency text, p_occurred_at timestamptz,
  p_private_details jsonb
) returns jsonb language sql security definer set search_path=public,staging_bridge_test,pg_temp as $$
  select public.record_payment_reconciliation_event(
    p_provider,p_provider_event_id,p_provider_transaction_reference,p_order_id,
    p_event_type,p_original_amount_cents,p_event_amount_cents,p_currency,
    p_occurred_at,p_private_details
  )
$$;

create function staging_bridge_test.claim_notifications(p_limit integer)
returns setof public.payment_notification_outbox language sql security definer
set search_path=public,staging_bridge_test,pg_temp as $$
  select * from public.claim_payment_notification_outbox(p_limit)
$$;

create function staging_bridge_test.complete_notification(
  p_id uuid, p_lock_token uuid, p_succeeded boolean,
  p_temporary_failure boolean, p_http_status integer, p_error_category text
) returns jsonb language sql security definer
set search_path=public,staging_bridge_test,pg_temp as $$
  select public.complete_payment_notification_outbox(
    p_id,p_lock_token,p_succeeded,p_temporary_failure,p_http_status,p_error_category
  )
$$;

revoke all on schema staging_bridge_test from public;
revoke all on all tables in schema staging_bridge_test from public;
revoke all on all functions in schema staging_bridge_test from public;
grant usage on schema staging_bridge_test to psrx_bridge_test_20260804b;
grant execute on function staging_bridge_test.command(text,jsonb) to psrx_bridge_test_20260804b;
grant execute on function staging_bridge_test.finalize(text,text,text,text,uuid,integer,text,timestamptz,jsonb) to psrx_bridge_test_20260804b;
grant execute on function staging_bridge_test.reconcile(text,text,text,uuid,text,integer,integer,text,timestamptz,jsonb) to psrx_bridge_test_20260804b;
grant execute on function staging_bridge_test.claim_notifications(integer) to psrx_bridge_test_20260804b;
grant execute on function staging_bridge_test.complete_notification(uuid,uuid,boolean,boolean,integer,text) to psrx_bridge_test_20260804b;
