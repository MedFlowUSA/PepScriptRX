-- Central WooCommerce payment bridge. Additive and disabled until server secrets
-- and the WordPress companion plugin are configured.
alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_provider_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_provider_check
  check (payment_provider is null or payment_provider in
    ('paypal', 'stripe', 'woocommerce', 'crypto', 'zelle', 'venmo', 'manual', 'other'));

create table if not exists public.woocommerce_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  idempotency_key text not null unique,
  submission_id uuid not null references public.patient_submissions(id) on delete restrict,
  public_payment_token_hash text not null,
  key_id text not null,
  expected_amount_cents integer not null check (expected_amount_cents between 1500 and 140000),
  currency text not null default 'USD' check (currency = 'USD'),
  origin_store text not null,
  return_path text not null,
  status text not null default 'created' check (status in (
    'created','awaiting_payment','redirected','payment_processing','paid','declined',
    'failed','cancelled','expired','refunded','partially_refunded','voided',
    'disputed','reconciliation_required'
  )),
  woo_order_id bigint,
  processor_reference text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  verified_callback_at timestamptz,
  last_event_at timestamptz,
  last_event_id text,
  reconciliation_required boolean not null default false,
  error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists woocommerce_payment_sessions_woo_order_uidx
  on public.woocommerce_payment_sessions(woo_order_id) where woo_order_id is not null;
create index if not exists woocommerce_payment_sessions_submission_idx
  on public.woocommerce_payment_sessions(submission_id);
create index if not exists woocommerce_payment_sessions_expiry_idx
  on public.woocommerce_payment_sessions(status, expires_at);
create index if not exists woocommerce_payment_sessions_reconcile_idx
  on public.woocommerce_payment_sessions(reconciliation_required, updated_at)
  where reconciliation_required;

alter table public.woocommerce_payment_sessions enable row level security;
revoke all on public.woocommerce_payment_sessions from anon, authenticated;
grant all on public.woocommerce_payment_sessions to service_role;

comment on table public.woocommerce_payment_sessions is
  'Private, server-only one-time sessions for the centralized WooCommerce payment bridge.';

create or replace function public.expire_woocommerce_payment_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.woocommerce_payment_sessions
  set status = 'expired', updated_at = now(), error_category = 'session_expired'
  where expires_at <= now()
    and status in ('created', 'awaiting_payment', 'redirected', 'payment_processing');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_woocommerce_payment_sessions() from public;
grant execute on function public.expire_woocommerce_payment_sessions() to service_role;

-- Rollback: disable WOOCOMMERCE_BRIDGE_ENABLED first. The table is intentionally
-- retained for audit/reconciliation. Only drop it after the retention period.
