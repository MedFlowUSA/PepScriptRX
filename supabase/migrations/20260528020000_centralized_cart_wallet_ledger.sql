-- Centralized commerce attribution and internal wallet ledger.

alter table public.patient_submissions
  add column if not exists source_portal text not null default 'main',
  add column if not exists source_route text,
  add column if not exists source_store text,
  add column if not exists source_admin text,
  add column if not exists source_rep text;

create index if not exists patient_submissions_source_portal_idx
  on public.patient_submissions(source_portal);

create index if not exists patient_submissions_source_store_idx
  on public.patient_submissions(source_store);

create table if not exists public.internal_wallets (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  account_type text not null
    check (account_type in ('platform', 'admin', 'rep', 'portal', 'store')),
  display_name text not null,
  available_balance numeric not null default 0,
  pending_balance numeric not null default 0,
  lifetime_earned numeric not null default 0,
  lifetime_paid numeric not null default 0,
  status text not null default 'active'
    check (status in ('active', 'hold', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_type, account_id)
);

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.internal_wallets(id) on delete cascade,
  order_id uuid references public.patient_submissions(id) on delete set null,
  entry_type text not null
    check (entry_type in ('commission', 'override', 'platform_margin', 'adjustment', 'payout', 'refund_reversal', 'chargeback_reversal')),
  amount numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'available', 'paid', 'held', 'reversed')),
  description text,
  created_at timestamptz not null default now(),
  available_at timestamptz,
  paid_at timestamptz,
  unique (wallet_id, order_id, entry_type)
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.internal_wallets(id) on delete cascade,
  account_id text not null,
  amount numeric not null check (amount > 0),
  payout_method text,
  payout_email text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'paid', 'rejected', 'failed')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_entries_order_id_idx on public.wallet_entries(order_id);
create index if not exists wallet_entries_status_idx on public.wallet_entries(status);
create index if not exists payout_requests_wallet_id_idx on public.payout_requests(wallet_id);
create index if not exists payout_requests_status_idx on public.payout_requests(status);

create or replace function public.refresh_internal_wallet_balance(p_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.internal_wallets w
  set
    pending_balance = coalesce((
      select sum(amount)
      from public.wallet_entries e
      where e.wallet_id = p_wallet_id
        and e.status in ('pending', 'held')
    ), 0),
    available_balance = coalesce((
      select sum(amount)
      from public.wallet_entries e
      where e.wallet_id = p_wallet_id
        and e.status = 'available'
    ), 0),
    lifetime_earned = coalesce((
      select sum(amount)
      from public.wallet_entries e
      where e.wallet_id = p_wallet_id
        and e.entry_type in ('commission', 'override', 'platform_margin', 'adjustment')
        and e.status <> 'reversed'
    ), 0),
    lifetime_paid = coalesce((
      select sum(abs(amount))
      from public.wallet_entries e
      where e.wallet_id = p_wallet_id
        and e.entry_type = 'payout'
        and e.status = 'paid'
    ), 0),
    updated_at = now()
  where w.id = p_wallet_id;
end;
$$;

create or replace function public.wallet_entries_refresh_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_internal_wallet_balance(old.wallet_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_internal_wallet_balance(new.wallet_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists wallet_entries_refresh_wallet_trigger on public.wallet_entries;
create trigger wallet_entries_refresh_wallet_trigger
after insert or update or delete on public.wallet_entries
for each row execute function public.wallet_entries_refresh_wallet();

alter table public.internal_wallets enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.payout_requests enable row level security;

drop policy if exists "admin_manage_internal_wallets" on public.internal_wallets;
create policy "admin_manage_internal_wallets"
on public.internal_wallets for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin_manage_wallet_entries" on public.wallet_entries;
create policy "admin_manage_wallet_entries"
on public.wallet_entries for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin_manage_payout_requests" on public.payout_requests;
create policy "admin_manage_payout_requests"
on public.payout_requests for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.create_public_patient_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := coalesce(nullif(payload->>'id', '')::uuid, gen_random_uuid());
begin
  insert into public.patient_submissions (
    id,
    full_name,
    email,
    phone,
    rep_id,
    medication,
    current_dose,
    current_price,
    state,
    date_of_birth,
    current_pharmacy,
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_speed,
    shipping_cost,
    referral_code,
    discount_code,
    discount_amount,
    status,
    quoted_price,
    product_id,
    product_name,
    product_category,
    product_type,
    selected_addons,
    is_accessory_only,
    submission_type,
    inquiry_notes,
    order_number,
    order_items,
    order_total,
    admin_code,
    store_slug,
    store_name,
    account_type,
    parent_type,
    source_portal,
    source_route,
    source_store,
    source_admin,
    source_rep,
    tracking_url
  )
  values (
    new_id,
    nullif(payload->>'full_name', ''),
    nullif(payload->>'email', ''),
    nullif(payload->>'phone', ''),
    nullif(payload->>'rep_id', '')::uuid,
    nullif(payload->>'medication', ''),
    nullif(payload->>'current_dose', ''),
    nullif(payload->>'current_price', '')::numeric,
    nullif(payload->>'state', ''),
    nullif(payload->>'date_of_birth', '')::date,
    nullif(payload->>'current_pharmacy', ''),
    nullif(payload->>'shipping_address', ''),
    nullif(payload->>'shipping_city', ''),
    nullif(payload->>'shipping_state', ''),
    nullif(payload->>'shipping_zip', ''),
    coalesce(nullif(payload->>'shipping_speed', ''), 'standard'),
    coalesce(nullif(payload->>'shipping_cost', '')::numeric, 0),
    nullif(payload->>'referral_code', ''),
    nullif(payload->>'discount_code', ''),
    coalesce(nullif(payload->>'discount_amount', '')::numeric, 0),
    coalesce(nullif(payload->>'status', ''), 'new_submission'),
    nullif(payload->>'quoted_price', '')::numeric,
    nullif(payload->>'product_id', ''),
    nullif(payload->>'product_name', ''),
    nullif(payload->>'product_category', ''),
    nullif(payload->>'product_type', ''),
    coalesce(payload->'selected_addons', '[]'::jsonb),
    coalesce((payload->>'is_accessory_only')::boolean, false),
    coalesce(nullif(payload->>'submission_type', ''), 'savings_check'),
    nullif(payload->>'inquiry_notes', ''),
    nullif(payload->>'order_number', ''),
    coalesce(payload->'order_items', '[]'::jsonb),
    nullif(payload->>'order_total', '')::numeric,
    nullif(payload->>'admin_code', ''),
    nullif(payload->>'store_slug', ''),
    nullif(payload->>'store_name', ''),
    nullif(payload->>'account_type', ''),
    nullif(payload->>'parent_type', ''),
    coalesce(nullif(payload->>'source_portal', ''), 'main'),
    nullif(payload->>'source_route', ''),
    nullif(payload->>'source_store', ''),
    nullif(payload->>'source_admin', ''),
    nullif(payload->>'source_rep', ''),
    nullif(payload->>'tracking_url', '')
  );

  return new_id;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

drop view if exists public.admin_paypal_routing_audit;

create or replace view public.admin_paypal_routing_audit
with (security_invoker = true)
as
select
  s.id as order_id,
  s.created_at,
  null::uuid as store_id,
  s.store_slug as portal_id,
  null::uuid as admin_account_id,
  null::uuid as parent_admin_id,
  s.rep_id,
  coalesce(r.rep_slug, s.referral_code) as rep_code,
  s.discount_code,
  s.email as customer_email,
  s.product_id,
  coalesce(s.product_name, s.medication) as product_name,
  coalesce(
    s.order_total,
    greatest(0, coalesce(s.quoted_price, 0) - coalesce(s.discount_amount, 0)) + coalesce(s.shipping_cost, 0)
  ) as total_amount,
  s.store_name,
  s.admin_code as admin_account,
  coalesce(r.brand_name, r.rep_name, r.rep_slug) as rep_account,
  s.source_portal,
  s.source_store,
  s.source_admin,
  s.source_rep,
  s.source_route,
  s.payment_provider,
  s.payment_status,
  s.paypal_order_id,
  s.paypal_capture_id,
  s.paypal_capture_status,
  coalesce(string_agg(distinct cl.status, ', ') filter (where cl.status is not null), 'pending') as commission_status,
  coalesce(string_agg(distinct p.status, ', ') filter (where p.status is not null), s.payout_status, 'pending') as payout_status,
  coalesce(s.fulfillment_status, 'pending') as fulfillment_status,
  coalesce(sum(we.amount) filter (where we.entry_type = 'platform_margin'), 0) as platform_margin,
  count(distinct we.id) as wallet_entries_created,
  (
    s.payment_provider = 'paypal'
    and s.payment_status = 'paid'
    and s.paypal_order_id is not null
    and s.paypal_capture_id is not null
    and s.paypal_capture_status = 'COMPLETED'
  ) as official_paypal_flow,
  (
    coalesce(s.paypal_link, '') <> ''
    or coalesce(r.paypal_link, '') <> ''
    or coalesce(r.payout_method, '') ilike '%paypal.me%'
    or coalesce(r.payout_method, '') ilike 'paypal:%'
    or coalesce(r.payout_method, '') ilike '%paypal business:%'
  ) as legacy_paypal_config_exists,
  case
    when coalesce(s.paypal_link, '') <> ''
      or coalesce(r.paypal_link, '') <> ''
      or coalesce(r.payout_method, '') ilike '%paypal.me%'
      or coalesce(r.payout_method, '') ilike 'paypal:%'
      or coalesce(r.payout_method, '') ilike '%paypal business:%'
      then 'Legacy PayPal configuration detected. This portal may not be using the official PepScriptRX PayPal Business account.'
    when s.source_portal ilike 'optimax%'
      and coalesce(s.source_route, '') in ('', '/', '/start')
      then 'Order is attributed to Optimax without an Optimax storefront route. Review for stale cart/session routing.'
    when s.payment_status = 'paid'
      and (
        s.payment_provider is distinct from 'paypal'
        or s.paypal_order_id is null
        or s.paypal_capture_id is null
        or s.paypal_capture_status is distinct from 'COMPLETED'
      )
      then 'Paid order is missing official PayPal capture evidence.'
    when s.payment_status = 'paid'
      and count(distinct we.id) = 0
      then 'Paid order has no wallet ledger entries.'
    else null
  end as routing_warning
from public.patient_submissions s
left join public.reps r on r.id = s.rep_id
left join public.commission_ledger cl on cl.submission_id = s.id
left join public.payouts p on p.submission_id = s.id
left join public.wallet_entries we on we.order_id = s.id
group by
  s.id,
  r.id,
  r.rep_slug,
  r.rep_name,
  r.brand_name,
  r.paypal_link,
  r.payout_method;

grant select on public.admin_paypal_routing_audit to authenticated;
