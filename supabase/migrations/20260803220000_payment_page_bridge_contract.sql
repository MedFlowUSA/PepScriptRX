-- Ensure the public payment page and WooCommerce bridge share the same
-- token-scoped, production-shaped order contract in every environment.
alter table public.patient_submissions
  add column if not exists public_payment_token text,
  add column if not exists order_number text,
  add column if not exists medication text,
  add column if not exists order_items jsonb not null default '[]'::jsonb,
  add column if not exists discount_code text,
  add column if not exists shipping_speed text not null default 'standard',
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_zip text,
  add column if not exists source_store text,
  add column if not exists store_slug text,
  add column if not exists referral_code text,
  add column if not exists parent_admin_id text,
  add column if not exists crypto_asset text,
  add column if not exists crypto_expected_amount_asset numeric,
  add column if not exists crypto_tx_hash text,
  add column if not exists subtotal_cents integer,
  add column if not exists discount_cents integer,
  add column if not exists amount_due_cents integer,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists patient_submissions_public_payment_token_key
  on public.patient_submissions(public_payment_token)
  where public_payment_token is not null;

create or replace function public.get_public_payment_submission(p_payment_token text)
returns table (
  payment_token text,
  order_reference text,
  medication text,
  quoted_price numeric,
  shipping_speed text,
  shipping_cost numeric,
  status text,
  referral_code text,
  discount_code text,
  discount_amount numeric,
  crypto_asset text,
  crypto_expected_amount_asset numeric,
  crypto_tx_submitted boolean,
  checkout_scope_code text,
  source_portal text,
  payment_provider text,
  payment_status text,
  subtotal_cents integer,
  discount_cents integer,
  amount_due_cents integer,
  payment_expires_at timestamptz,
  payment_reference text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    s.public_payment_token,
    coalesce(s.order_number, 'PSRX-' || upper(left(s.public_payment_token, 8))),
    s.medication,
    s.quoted_price,
    s.shipping_speed,
    s.shipping_cost,
    s.status,
    s.referral_code,
    s.discount_code,
    s.discount_amount,
    s.crypto_asset,
    s.crypto_expected_amount_asset,
    s.crypto_tx_hash is not null,
    s.checkout_scope_code,
    s.source_portal,
    s.payment_provider,
    s.payment_status,
    coalesce(s.subtotal_cents, round(coalesce(s.quoted_price,0)*100)::integer),
    coalesce(s.discount_cents, round(coalesce(s.discount_amount,0)*100)::integer),
    coalesce(
      s.amount_due_cents,
      round(
        (greatest(0,coalesce(s.quoted_price,0)-coalesce(s.discount_amount,0)) + coalesce(s.shipping_cost,0))*100
      )::integer
    ),
    s.payment_expires_at,
    s.payment_reference,
    s.created_at
  from public.patient_submissions s
  where s.public_payment_token=p_payment_token
    and s.status in ('payment_sent','paid','fulfilled');
$$;

revoke all on function public.get_public_payment_submission(text) from public;
grant execute on function public.get_public_payment_submission(text) to anon,authenticated;
