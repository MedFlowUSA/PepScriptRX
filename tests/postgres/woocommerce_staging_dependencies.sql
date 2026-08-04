-- Minimal production-shaped dependencies required to execute the two bridge
-- migrations in an otherwise empty, isolated Supabase staging project.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  role text not null default 'patient'
);

create table public.reps (
  id uuid primary key default gen_random_uuid(),
  rep_slug text unique not null,
  rep_name text,
  commission_rate numeric not null default 0.20,
  parent_rep_id uuid references public.reps(id),
  override_percent numeric not null default 0,
  platform_percent numeric not null default 0.35
);

create table public.internal_wallets (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  account_type text not null,
  display_name text not null,
  available_balance numeric not null default 0,
  pending_balance numeric not null default 0,
  lifetime_earned numeric not null default 0,
  lifetime_paid numeric not null default 0,
  status text not null default 'active',
  unique (account_type, account_id)
);

create table public.checkout_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_code text not null unique,
  display_name text not null,
  account_type text not null,
  account_id text,
  is_active boolean not null default true,
  default_commission_rate numeric not null default 0
);

create table public.patient_submissions (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid references public.reps(id),
  status text not null default 'payment_sent',
  quoted_price numeric,
  discount_amount numeric not null default 0,
  shipping_cost numeric not null default 0,
  cost_of_goods numeric not null default 0,
  payment_provider text,
  payment_status text not null default 'unpaid',
  payout_status text not null default 'pending',
  fulfillment_status text not null default 'pending',
  payment_release_policy text not null default 'paid_hold',
  payment_reference text,
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_payment_status text,
  paypal_order_id text,
  paypal_capture_id text,
  paypal_capture_status text,
  order_type text not null default 'CUSTOMER_ORDER',
  checkout_scope_id uuid references public.checkout_scopes(id),
  checkout_scope_code text,
  account_type text,
  admin_code text,
  store_name text,
  source_portal text,
  source_rep text,
  inventory_marker integer not null default 0,
  promo_use_marker integer not null default 0
);

create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  rep_id uuid not null references public.reps(id),
  gross_sale numeric,
  margin numeric,
  commission_rate numeric,
  commission_amount numeric,
  commission_role text not null,
  owner_label text,
  status text not null default 'pending',
  unique (submission_id, rep_id, commission_role)
);

create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.internal_wallets(id) on delete cascade,
  order_id uuid references public.patient_submissions(id),
  entry_type text not null,
  amount numeric not null,
  status text not null default 'pending',
  description text,
  unique (wallet_id, order_id, entry_type)
);

create or replace function public.refresh_internal_wallet_balance(p_wallet_id uuid)
returns void language sql as $$
  update public.internal_wallets w set
    pending_balance = coalesce((select sum(amount) from public.wallet_entries e where e.wallet_id=w.id and e.status in ('pending','held')),0),
    available_balance = coalesce((select sum(amount) from public.wallet_entries e where e.wallet_id=w.id and e.status='available'),0),
    lifetime_earned = coalesce((select sum(amount) from public.wallet_entries e where e.wallet_id=w.id and e.entry_type in ('commission','override','platform_margin','adjustment') and e.status<>'reversed'),0)
  where w.id=p_wallet_id
$$;

create or replace function public.wallet_entries_refresh_wallet()
returns trigger language plpgsql as $$
begin
  perform public.refresh_internal_wallet_balance(coalesce(new.wallet_id,old.wallet_id));
  return coalesce(new,old);
end $$;

create trigger wallet_entries_refresh_wallet_trigger
after insert or update or delete on public.wallet_entries
for each row execute function public.wallet_entries_refresh_wallet();

create table public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.patient_submissions(id) on delete cascade,
  actor_type text not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
