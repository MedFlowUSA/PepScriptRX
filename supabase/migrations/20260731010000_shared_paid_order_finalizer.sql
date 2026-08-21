-- Atomic, provider-neutral paid-order finalization for Stripe, PayPal and WooCommerce.
-- Initial launch intentionally preserves current manual inventory and promo behavior.

create table if not exists public.provider_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'paypal', 'woocommerce')),
  provider_event_id text not null,
  provider_order_reference text,
  provider_transaction_reference text not null,
  order_id uuid not null references public.patient_submissions(id) on delete restrict,
  event_type text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  provider_paid_at timestamptz,
  event_fingerprint text not null,
  result text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create unique index if not exists provider_payment_events_transaction_uidx
  on public.provider_payment_events(provider, provider_transaction_reference)
  where event_type = 'payment_approved';
create index if not exists provider_payment_events_order_idx
  on public.provider_payment_events(order_id, created_at desc);

create table if not exists public.payment_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_transaction_reference text,
  order_id uuid references public.patient_submissions(id) on delete restrict,
  event_type text not null,
  original_amount_cents integer,
  event_amount_cents integer,
  currency text,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  occurred_at timestamptz,
  private_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id, event_type)
);

create index if not exists payment_reconciliation_events_queue_idx
  on public.payment_reconciliation_events(status, created_at);

create table if not exists public.payment_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.patient_submissions(id) on delete cascade,
  notification_type text not null check (notification_type in ('partner_sale')),
  payment_provider text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, notification_type)
);

alter table public.provider_payment_events enable row level security;
alter table public.payment_reconciliation_events enable row level security;
alter table public.payment_notification_outbox enable row level security;
revoke all on public.provider_payment_events, public.payment_reconciliation_events, public.payment_notification_outbox from anon, authenticated;
grant all on public.provider_payment_events, public.payment_reconciliation_events, public.payment_notification_outbox to service_role;

create policy "authorized admins read payment reconciliation"
on public.payment_reconciliation_events for select to authenticated
using (exists (
  select 1 from public.profiles p
  where (p.id = auth.uid() or p.auth_user_id = auth.uid())
    and p.role in ('admin','owner','platform_admin','master_admin','super_admin')
));
grant select on public.payment_reconciliation_events to authenticated;

create or replace view public.admin_payment_reconciliation_queue
with (security_invoker = true)
as
select id, provider, provider_event_id, provider_transaction_reference, order_id,
  event_type, original_amount_cents, event_amount_cents, currency, reason,
  status, occurred_at, created_at, updated_at
from public.payment_reconciliation_events;
grant select on public.admin_payment_reconciliation_queue to authenticated;

create or replace function public.finalize_verified_paid_order(
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
  v_order public.patient_submissions%rowtype;
  v_existing public.provider_payment_events%rowtype;
  v_expected_cents integer;
  v_fingerprint text;
  v_result text;
  v_scope public.checkout_scopes%rowtype;
  v_rep public.reps%rowtype;
  v_parent public.reps%rowtype;
  v_product_total numeric;
  v_discount numeric;
  v_shipping numeric;
  v_cogs numeric;
  v_gross numeric;
  v_profit numeric;
  v_rate numeric;
  v_override numeric;
  v_platform numeric;
  v_scope_amount numeric;
  v_platform_amount numeric;
  v_row record;
  v_wallet_id uuid;
  v_wallet_type text;
  v_wallet_account text;
  v_wallet_name text;
  v_entry_type text;
  v_has_scope boolean := false;
begin
  p_provider := lower(trim(coalesce(p_provider, '')));
  p_currency := upper(trim(coalesce(p_currency, '')));
  if p_provider not in ('stripe', 'paypal', 'woocommerce')
     or nullif(trim(coalesce(p_provider_event_id, '')), '') is null
     or nullif(trim(coalesce(p_provider_transaction_reference, '')), '') is null then
    return jsonb_build_object('result', 'invalid_provider_event');
  end if;

  v_fingerprint := encode(digest(concat_ws('|', p_provider, p_provider_event_id,
    coalesce(p_provider_order_reference, ''), p_provider_transaction_reference,
    p_order_id::text, p_amount_cents::text, p_currency), 'sha256'), 'hex');

  select * into v_existing from public.provider_payment_events
  where provider = p_provider and provider_event_id = p_provider_event_id;
  if found then
    if v_existing.event_fingerprint = v_fingerprint then
      return jsonb_build_object('result', 'already_finalized', 'order_id', v_existing.order_id);
    end if;
    insert into public.payment_reconciliation_events(
      provider, provider_event_id, provider_transaction_reference, order_id, event_type,
      event_amount_cents, currency, reason, occurred_at, private_details
    ) values (
      p_provider, p_provider_event_id, p_provider_transaction_reference, p_order_id,
      'conflicting_provider_event', p_amount_cents, p_currency,
      'provider_event_id_reused_with_conflicting_facts', now(),
      jsonb_build_object('fingerprint', v_fingerprint)
    ) on conflict (provider, provider_event_id, event_type) do nothing;
    return jsonb_build_object('result', 'conflicting_provider_reference');
  end if;

  select * into v_order from public.patient_submissions where id = p_order_id for update;
  if not found then return jsonb_build_object('result', 'invalid_order_state'); end if;

  v_product_total := greatest(0, coalesce(v_order.quoted_price, 0));
  v_discount := least(v_product_total, greatest(0, coalesce(v_order.discount_amount, 0)));
  v_shipping := greatest(0, coalesce(v_order.shipping_cost, 0));
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
  end if;

  if p_currency <> 'USD' then
    insert into public.payment_reconciliation_events(provider, provider_event_id,
      provider_transaction_reference, order_id, event_type, original_amount_cents,
      event_amount_cents, currency, reason, occurred_at)
    values (p_provider, p_provider_event_id, p_provider_transaction_reference, p_order_id,
      'currency_mismatch', v_expected_cents, p_amount_cents, p_currency,
      'verified_currency_does_not_match_usd', now())
    on conflict (provider, provider_event_id, event_type) do nothing;
    return jsonb_build_object('result', 'currency_mismatch', 'expected_currency', 'USD');
  end if;
  if p_amount_cents <> v_expected_cents then
    insert into public.payment_reconciliation_events(provider, provider_event_id,
      provider_transaction_reference, order_id, event_type, original_amount_cents,
      event_amount_cents, currency, reason, occurred_at)
    values (p_provider, p_provider_event_id, p_provider_transaction_reference, p_order_id,
      'amount_mismatch', v_expected_cents, p_amount_cents, p_currency,
      'verified_amount_does_not_match_order', now())
    on conflict (provider, provider_event_id, event_type) do nothing;
    return jsonb_build_object('result', 'amount_mismatch', 'expected_amount_cents', v_expected_cents);
  end if;

  select * into v_existing from public.provider_payment_events
  where provider = p_provider
    and provider_transaction_reference = p_provider_transaction_reference
    and event_type = 'payment_approved';
  if found and (v_existing.order_id <> p_order_id or v_existing.amount_cents <> p_amount_cents or v_existing.currency <> p_currency) then
    insert into public.payment_reconciliation_events(provider, provider_event_id,
      provider_transaction_reference, order_id, event_type, original_amount_cents,
      event_amount_cents, currency, reason, occurred_at)
    values (p_provider, p_provider_event_id, p_provider_transaction_reference, p_order_id,
      'conflicting_provider_reference', v_existing.amount_cents, p_amount_cents,
      p_currency, 'transaction_reference_reused_with_conflicting_facts', now())
    on conflict (provider, provider_event_id, event_type) do nothing;
    return jsonb_build_object('result', 'conflicting_provider_reference');
  end if;

  if v_order.payment_status = 'paid' or v_order.status in ('paid', 'fulfilled') then
    if v_order.payment_provider is distinct from p_provider
       or coalesce(v_order.payment_reference, coalesce(nullif(p_provider_order_reference,''),p_provider_transaction_reference))
          <> coalesce(nullif(p_provider_order_reference,''),p_provider_transaction_reference) then
      insert into public.payment_reconciliation_events(provider, provider_event_id,
        provider_transaction_reference, order_id, event_type, original_amount_cents,
        event_amount_cents, currency, reason, occurred_at)
      values (p_provider, p_provider_event_id, p_provider_transaction_reference, p_order_id,
        'already_paid_conflict', v_expected_cents, p_amount_cents, p_currency,
        'order_already_paid_by_different_provider_or_reference', now())
      on conflict (provider, provider_event_id, event_type) do nothing;
      return jsonb_build_object('result', 'conflicting_provider_reference');
    end if;
    v_result := 'already_finalized';
  elsif v_order.status <> 'payment_sent' then
    return jsonb_build_object('result', 'invalid_order_state', 'order_status', v_order.status);
  else
    update public.patient_submissions set
      status = 'paid',
      payment_provider = p_provider,
      payment_status = 'paid',
      payout_status = 'pending',
      fulfillment_status = 'pending',
      payment_release_policy = 'released',
      payment_reference = coalesce(nullif(p_provider_order_reference,''),p_provider_transaction_reference),
      paid_at = coalesce(p_paid_at, now()),
      stripe_checkout_session_id = case when p_provider = 'stripe' then p_provider_order_reference else stripe_checkout_session_id end,
      stripe_payment_intent_id = case when p_provider = 'stripe' then p_provider_transaction_reference else stripe_payment_intent_id end,
      stripe_payment_status = case when p_provider = 'stripe' then 'paid' else stripe_payment_status end,
      paypal_order_id = case when p_provider = 'paypal' then p_provider_order_reference else paypal_order_id end,
      paypal_capture_id = case when p_provider = 'paypal' then p_provider_transaction_reference else paypal_capture_id end,
      paypal_capture_status = case when p_provider = 'paypal' then 'COMPLETED' else paypal_capture_status end
    where id = p_order_id;
    v_result := 'finalized';
  end if;

  insert into public.provider_payment_events(provider, provider_event_id,
    provider_order_reference, provider_transaction_reference, order_id, event_type,
    amount_cents, currency, provider_paid_at, event_fingerprint, result, event_payload)
  values (p_provider, p_provider_event_id, nullif(p_provider_order_reference, ''),
    p_provider_transaction_reference, p_order_id, 'payment_approved', p_amount_cents,
    p_currency, p_paid_at, v_fingerprint, v_result, coalesce(p_event_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing;

  -- Existing policies: no automatic inventory mutation and no promo-use mutation.
  if v_result = 'finalized' then
    create temporary table if not exists pg_temp.finalizer_commission_rows(
      rep_id uuid, gross_sale numeric, margin numeric, commission_rate numeric,
      commission_amount numeric, commission_role text, owner_label text,
      wallet_account_type text, wallet_account_id text
    ) on commit drop;
    truncate pg_temp.finalizer_commission_rows;

    v_cogs := greatest(0, coalesce(v_order.cost_of_goods, 0));
    v_gross := greatest(0, v_product_total - v_discount) + v_shipping;
    v_profit := greatest(0, v_product_total - v_discount - v_cogs);

    if upper(coalesce(v_order.order_type, 'CUSTOMER_ORDER')) not in ('REP_SAMPLE', 'REP_INTERNAL') then
      if v_order.checkout_scope_id is not null or nullif(v_order.checkout_scope_code, '') is not null then
        select * into v_scope from public.checkout_scopes
        where is_active and (id = v_order.checkout_scope_id or scope_code = v_order.checkout_scope_code)
        order by (id = v_order.checkout_scope_id) desc limit 1;
        v_has_scope := v_scope.id is not null;
      end if;

      if v_has_scope and v_scope.scope_code <> 'MAIN' then
        if v_scope.account_type in ('rep', 'sub_account', 'admin') and v_scope.account_id is not null then
          select * into v_rep from public.reps where lower(rep_slug) = lower(v_scope.account_id) limit 1;
        end if;
        if v_rep.id is not null then
          if v_rep.parent_rep_id is not null then select * into v_parent from public.reps where id = v_rep.parent_rep_id; end if;
          v_rate := greatest(0, least(1, coalesce(v_rep.commission_rate, v_scope.default_commission_rate, 0)));
          v_override := greatest(0, least(1, coalesce(v_rep.override_percent, 0)));
          v_platform := greatest(0, least(1, coalesce(v_rep.platform_percent, greatest(0, 1-v_rate-v_override))));
          insert into pg_temp.finalizer_commission_rows values
            (v_rep.id,v_gross,v_profit,v_rate,round(v_profit*v_rate,2),'rep_commission_owner',coalesce(v_scope.display_name,v_rep.rep_name,v_rep.rep_slug),v_scope.account_type,v_scope.account_id);
          if v_parent.id is not null and v_override > 0 then
            insert into pg_temp.finalizer_commission_rows values
              (v_parent.id,v_gross,v_profit,v_override,round(v_profit*v_override,2),'override_owner',coalesce(v_parent.rep_name,v_parent.rep_slug,'Parent rep'),'rep',coalesce(v_parent.rep_slug,v_parent.id::text));
          end if;
          if v_platform > 0 then insert into pg_temp.finalizer_commission_rows values
            (null,v_gross,v_profit,v_platform,round(v_profit*v_platform,2),'platform_margin_owner','PepScriptRX',null,null); end if;
        else
          v_rate := greatest(0, least(1, coalesce(v_scope.default_commission_rate,0)));
          v_scope_amount := round(v_profit*v_rate,2);
          v_platform_amount := round(greatest(0,v_profit-v_scope_amount),2);
          if v_scope_amount > 0 then insert into pg_temp.finalizer_commission_rows values
            ((select id from public.reps where lower(rep_slug)=lower(coalesce(v_scope.account_id,v_scope.display_name)) limit 1),
             v_gross,v_profit,v_rate,v_scope_amount,'scope_commission_owner',coalesce(v_scope.display_name,v_scope.scope_code),v_scope.account_type,coalesce(v_scope.account_id,v_scope.scope_code)); end if;
          if v_platform_amount > 0 then insert into pg_temp.finalizer_commission_rows values
            (null,v_gross,v_profit,1-v_rate,v_platform_amount,'platform_margin_owner','PepScriptRX',null,null); end if;
        end if;
      elsif v_order.rep_id is not null then
        select * into v_rep from public.reps where id=v_order.rep_id;
        if v_rep.parent_rep_id is not null then select * into v_parent from public.reps where id=v_rep.parent_rep_id; end if;
        v_rate:=greatest(0,least(1,coalesce(v_rep.commission_rate,0.2)));
        v_override:=greatest(0,least(1,coalesce(v_rep.override_percent,0)));
        v_platform:=greatest(0,least(1,coalesce(v_rep.platform_percent,greatest(0,1-v_rate-v_override))));
        insert into pg_temp.finalizer_commission_rows values
          (v_rep.id,v_gross,v_profit,v_rate,round(v_profit*v_rate,2),'rep_commission_owner',coalesce(v_rep.rep_name,v_rep.rep_slug,'Rep'),null,null);
        if v_parent.id is not null and v_override>0 then insert into pg_temp.finalizer_commission_rows values
          (v_parent.id,v_gross,v_profit,v_override,round(v_profit*v_override,2),'override_owner',coalesce(v_parent.rep_name,v_parent.rep_slug,'Parent rep'),null,null); end if;
        if v_platform>0 then insert into pg_temp.finalizer_commission_rows values
          (v_rep.id,v_gross,v_profit,v_platform,round(v_profit*v_platform,2),'platform_margin_owner','PepScriptRX',null,null); end if;
      else
        insert into pg_temp.finalizer_commission_rows values
          (null,v_gross,v_profit,1,v_profit,'platform_margin_owner','PepScriptRX',null,null);
      end if;

      for v_row in select * from pg_temp.finalizer_commission_rows where commission_amount > 0 loop
        if v_row.rep_id is not null then
          insert into public.commission_ledger(submission_id,rep_id,gross_sale,margin,
            commission_rate,commission_amount,commission_role,owner_label,status)
          values(p_order_id,v_row.rep_id,v_row.gross_sale,v_row.margin,v_row.commission_rate,
            v_row.commission_amount,case when v_row.commission_role='scope_commission_owner' then 'rep_commission_owner' else v_row.commission_role end,v_row.owner_label,'pending')
          on conflict (submission_id,rep_id,commission_role) do nothing;
        end if;

        if v_row.commission_role='platform_margin_owner' then
          v_wallet_type:='platform'; v_wallet_account:='platform'; v_wallet_name:='PepScriptRX'; v_entry_type:='platform_margin';
        elsif v_row.wallet_account_type is not null and v_row.wallet_account_id is not null then
          v_wallet_type:=v_row.wallet_account_type; v_wallet_account:=v_row.wallet_account_id; v_wallet_name:=v_row.owner_label;
          v_entry_type:=case when v_row.commission_role='override_owner' then 'override' else 'commission' end;
        elsif v_row.commission_role='rep_commission_owner' and lower(coalesce(v_order.account_type,''))='admin' and v_order.admin_code is not null then
          v_wallet_type:='admin'; v_wallet_account:=v_order.admin_code; v_wallet_name:=coalesce(v_order.store_name,v_order.source_portal,v_order.admin_code); v_entry_type:='commission';
        else
          v_wallet_type:='rep'; v_wallet_account:=coalesce(v_row.rep_id::text,v_order.source_rep,'unassigned'); v_wallet_name:=coalesce(v_row.owner_label,v_order.source_portal,'Rep');
          v_entry_type:=case when v_row.commission_role='override_owner' then 'override' else 'commission' end;
        end if;
        insert into public.internal_wallets(account_type,account_id,display_name,status)
        values(v_wallet_type,v_wallet_account,v_wallet_name,'active')
        on conflict(account_type,account_id) do update set display_name=excluded.display_name
        returning id into v_wallet_id;
        insert into public.wallet_entries(wallet_id,order_id,entry_type,amount,status,description)
        values(v_wallet_id,p_order_id,v_entry_type,v_row.commission_amount,'pending',
          v_row.owner_label||' - '||replace(v_row.commission_role,'_',' '))
        on conflict(wallet_id,order_id,entry_type) do nothing;
      end loop;
    end if;

    insert into public.payment_notification_outbox(order_id,notification_type,payment_provider)
    values(p_order_id,'partner_sale',p_provider)
    on conflict(order_id,notification_type) do nothing;
  end if;

  insert into public.payment_audit_log(order_id,actor_type,event_type,event_payload)
  values(p_order_id,'system','shared_paid_order_'||v_result,
    jsonb_build_object('provider',p_provider,'provider_event_id',p_provider_event_id,
      'amount_cents',p_amount_cents,'currency',p_currency));
  return jsonb_build_object('result',v_result,'order_id',p_order_id,
    'notification_outbox',true,'inventory_automation',false,'promo_mutation',false);
exception when unique_violation then
  return jsonb_build_object('result','already_finalized','order_id',p_order_id);
end;
$$;

create or replace function public.record_payment_reconciliation_event(
  p_provider text, p_provider_event_id text, p_provider_transaction_reference text,
  p_order_id uuid, p_event_type text, p_original_amount_cents integer,
  p_event_amount_cents integer, p_currency text, p_occurred_at timestamptz,
  p_private_details jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.payment_reconciliation_events(provider,provider_event_id,
    provider_transaction_reference,order_id,event_type,original_amount_cents,
    event_amount_cents,currency,reason,occurred_at,private_details)
  values(lower(p_provider),p_provider_event_id,p_provider_transaction_reference,p_order_id,
    p_event_type,p_original_amount_cents,p_event_amount_cents,upper(p_currency),
    'manual_financial_review_required',p_occurred_at,coalesce(p_private_details,'{}'::jsonb))
  on conflict(provider,provider_event_id,event_type) do nothing;
  return jsonb_build_object('result','reconciliation_required');
end $$;

revoke all on function public.finalize_verified_paid_order(text,text,text,text,uuid,integer,text,timestamptz,jsonb) from public;
revoke all on function public.record_payment_reconciliation_event(text,text,text,uuid,text,integer,integer,text,timestamptz,jsonb) from public;
grant execute on function public.finalize_verified_paid_order(text,text,text,text,uuid,integer,text,timestamptz,jsonb) to service_role;
grant execute on function public.record_payment_reconciliation_event(text,text,text,uuid,text,integer,integer,text,timestamptz,jsonb) to service_role;
