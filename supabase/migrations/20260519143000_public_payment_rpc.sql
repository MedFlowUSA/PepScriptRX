-- Public-safe payment page reader.
-- This lets /pay/:id show only payment-safe fields without opening broad RLS SELECT access.

alter table public.reps
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true;

alter table public.patient_submissions
  add column if not exists referral_code text,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0;

insert into public.reps (
  rep_slug,
  commission_rate,
  discount_code,
  discount_amount,
  referral_path,
  attribution_locked,
  active
)
values (
  'RICK50',
  0.50,
  'RICK50',
  10,
  '/r/RICK50',
  true,
  true
)
on conflict (rep_slug) do update set
  commission_rate = excluded.commission_rate,
  discount_code = excluded.discount_code,
  discount_amount = excluded.discount_amount,
  referral_path = excluded.referral_path,
  attribution_locked = excluded.attribution_locked,
  active = true;

create or replace function public.get_public_payment_submission(p_submission_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  medication text,
  quoted_price numeric,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_speed text,
  shipping_cost numeric,
  status text,
  referral_code text,
  discount_code text,
  discount_amount numeric,
  crypto_asset text,
  crypto_expected_amount_asset numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.full_name,
    s.email,
    s.medication,
    s.quoted_price,
    s.shipping_address,
    s.shipping_city,
    s.shipping_state,
    s.shipping_zip,
    s.shipping_speed,
    s.shipping_cost,
    s.status,
    s.referral_code,
    s.discount_code,
    s.discount_amount,
    s.crypto_asset,
    s.crypto_expected_amount_asset
  from public.patient_submissions s
  where s.id = p_submission_id
    and s.status in ('payment_sent', 'paid', 'fulfilled');
$$;

grant execute on function public.get_public_payment_submission(uuid) to anon, authenticated;
