-- Checkout-only scope codes for attribution and wallet routing.

create table if not exists public.checkout_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_code text not null unique,
  display_name text not null,
  account_type text not null
    check (account_type in ('platform', 'admin', 'rep', 'portal', 'store', 'sub_account')),
  account_id text,
  parent_account_id text,
  is_active boolean not null default true,
  default_commission_rule_id uuid null,
  default_wallet_id uuid null references public.internal_wallets(id) on delete set null,
  default_commission_rate numeric not null default 0
    check (default_commission_rate >= 0 and default_commission_rate <= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_scopes_active_idx on public.checkout_scopes(is_active);
create index if not exists checkout_scopes_account_idx on public.checkout_scopes(account_type, account_id);

alter table public.patient_submissions
  add column if not exists checkout_scope_code text,
  add column if not exists checkout_scope_id uuid references public.checkout_scopes(id) on delete set null,
  add column if not exists attribution_source text not null default 'default'
    check (attribution_source in ('url', 'session', 'manual_checkout', 'admin_link', 'default', 'invalid')),
  add column if not exists source_admin_id text,
  add column if not exists source_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists parent_admin_id text;

create index if not exists patient_submissions_checkout_scope_code_idx
  on public.patient_submissions(checkout_scope_code);

create index if not exists patient_submissions_checkout_scope_id_idx
  on public.patient_submissions(checkout_scope_id);

create or replace function public.normalize_checkout_scope_code(p_scope_code text)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(coalesce(p_scope_code, ''))) ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
      then upper(trim(coalesce(p_scope_code, '')))
    else null
  end;
$$;

insert into public.checkout_scopes (
  scope_code,
  display_name,
  account_type,
  account_id,
  parent_account_id,
  is_active,
  default_commission_rate,
  notes
)
values
  ('MAIN', 'PepScriptRX', 'platform', 'platform', null, true, 0, 'Default centralized checkout scope.'),
  ('LEGACYPEPS', 'Legacy PepScriptRX', 'platform', 'platform', null, true, 0, 'Legacy platform attribution scope.'),
  ('VITALITYINS', 'VITALITYINS', 'portal', 'VITALITYINS', null, true, 0.60, 'Checkout-only portal attribution scope.'),
  ('OPTIMAX', 'Optimax Peptide Therapy', 'admin', 'GABE50', null, true, 0.55, 'Optimax checkout-only attribution scope.'),
  ('GABE50', 'Optimax Peptide Therapy', 'admin', 'GABE50', null, true, 0.55, 'Legacy Optimax admin code mapped as checkout scope.'),
  ('GABRIELRX', 'Optimax Peptide Therapy', 'admin', 'GABE50', null, true, 0.55, 'Alternate Optimax checkout scope.'),
  ('MARK65', 'Mark Ayala / Empire Health & Wellness', 'rep', 'MARK65', null, true, 0.40, 'Rep checkout scope.'),
  ('SCOTTB', 'Peak Form Peptides', 'rep', 'SCOTTB', 'MARK65', true, 0.40, 'Peak Form checkout scope.'),
  ('GUY60', 'AACTIVATED-RX', 'portal', 'GUY60', null, true, 0.60, 'AACTIVATED-RX checkout scope.'),
  ('ROBERT', 'WarXlabz', 'sub_account', 'ROBERT', 'MARK65', true, 0.40, 'WarXlabz checkout scope.')
on conflict (scope_code) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  account_id = excluded.account_id,
  parent_account_id = excluded.parent_account_id,
  is_active = excluded.is_active,
  default_commission_rate = excluded.default_commission_rate,
  notes = excluded.notes,
  updated_at = now();

create or replace function public.validate_checkout_scope(p_scope_code text)
returns table (
  valid boolean,
  scope_code text,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (s.id is not null) as valid,
    s.scope_code,
    s.display_name
  from (select public.normalize_checkout_scope_code(p_scope_code) as normalized) n
  left join public.checkout_scopes s
    on s.scope_code = n.normalized
   and s.is_active = true
  limit 1;
$$;

grant execute on function public.validate_checkout_scope(text) to anon, authenticated;

create or replace function public.apply_checkout_scope(
  p_submission_id uuid,
  p_scope_code text,
  p_attribution_source text default 'url'
)
returns table (
  valid boolean,
  scope_code text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_checkout_scope_code(p_scope_code);
  source_value text := case
    when p_attribution_source in ('url', 'session', 'manual_checkout', 'admin_link', 'default') then p_attribution_source
    else 'url'
  end;
  scope_row public.checkout_scopes%rowtype;
begin
  if normalized is null then
    return query select false, null::text, null::text;
    return;
  end if;

  select *
  into scope_row
  from public.checkout_scopes
  where scope_code = normalized
    and is_active = true
  limit 1;

  if scope_row.id is null then
    return query select false, null::text, null::text;
    return;
  end if;

  update public.patient_submissions
  set
    checkout_scope_code = scope_row.scope_code,
    checkout_scope_id = scope_row.id,
    attribution_source = source_value,
    source_portal = coalesce(nullif(source_portal, ''), scope_row.scope_code),
    source_store = coalesce(source_store, scope_row.account_id),
    source_admin = case when scope_row.account_type = 'admin' then scope_row.account_id else source_admin end,
    source_rep = case when scope_row.account_type in ('rep', 'sub_account') then scope_row.account_id else source_rep end,
    updated_at = now()
  where id = p_submission_id
    and status = 'payment_sent';

  return query select true, scope_row.scope_code, scope_row.display_name;
end;
$$;

grant execute on function public.apply_checkout_scope(uuid, text, text) to anon, authenticated;

create or replace function public.patient_submissions_apply_checkout_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_scope text;
  scope_row public.checkout_scopes%rowtype;
begin
  raw_scope := public.normalize_checkout_scope_code(new.checkout_scope_code);

  if raw_scope is null then
    raw_scope := public.normalize_checkout_scope_code(new.source_rep);
  end if;
  if raw_scope is null then
    raw_scope := public.normalize_checkout_scope_code(new.admin_code);
  end if;
  if raw_scope is null and new.store_slug = 'optimax-peptide-therapy' then
    raw_scope := 'OPTIMAX';
  end if;
  if raw_scope is null and coalesce(new.source_portal, '') <> '' and lower(new.source_portal) <> 'main' then
    raw_scope := public.normalize_checkout_scope_code(new.source_portal);
  end if;
  if raw_scope is null then
    raw_scope := 'MAIN';
  end if;

  select *
  into scope_row
  from public.checkout_scopes
  where scope_code = raw_scope
    and is_active = true
  limit 1;

  if scope_row.id is null then
    select *
    into scope_row
    from public.checkout_scopes
    where scope_code = 'MAIN'
      and is_active = true
    limit 1;

    new.attribution_source := 'invalid';
  end if;

  if scope_row.id is not null then
    new.checkout_scope_code := scope_row.scope_code;
    new.checkout_scope_id := scope_row.id;
    if coalesce(new.source_portal, '') = '' then
      new.source_portal := case when scope_row.scope_code = 'MAIN' then 'main' else scope_row.scope_code end;
    end if;
    if coalesce(new.source_store, '') = '' then
      new.source_store := scope_row.account_id;
    end if;
    if scope_row.account_type = 'admin' and coalesce(new.source_admin, '') = '' then
      new.source_admin := scope_row.account_id;
    end if;
    if scope_row.account_type in ('rep', 'sub_account') and coalesce(new.source_rep, '') = '' then
      new.source_rep := scope_row.account_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_apply_checkout_scope_trigger on public.patient_submissions;
create trigger patient_submissions_apply_checkout_scope_trigger
before insert or update of checkout_scope_code, source_portal, source_store, source_admin, source_rep, admin_code, store_slug
on public.patient_submissions
for each row execute function public.patient_submissions_apply_checkout_scope();

alter table public.checkout_scopes enable row level security;

drop policy if exists "admin_manage_checkout_scopes" on public.checkout_scopes;
create policy "admin_manage_checkout_scopes"
on public.checkout_scopes for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "public_read_active_checkout_scopes" on public.checkout_scopes;

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
    checkout_scope_code,
    attribution_source,
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
    nullif(payload->>'checkout_scope_code', ''),
    coalesce(nullif(payload->>'attribution_source', ''), 'default'),
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

drop function if exists public.get_public_payment_submission(uuid);

create function public.get_public_payment_submission(p_submission_id uuid)
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
  crypto_expected_amount_asset numeric,
  checkout_scope_code text,
  attribution_source text,
  source_portal text
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
    s.crypto_expected_amount_asset,
    s.checkout_scope_code,
    s.attribution_source,
    s.source_portal
  from public.patient_submissions s
  where s.id = p_submission_id
    and s.status in ('payment_sent', 'paid', 'fulfilled');
$$;

grant execute on function public.get_public_payment_submission(uuid) to anon, authenticated;

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
  s.parent_admin_id,
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
  s.checkout_scope_code,
  cs.display_name as checkout_scope_name,
  s.attribution_source,
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
    when s.checkout_scope_code = 'OPTIMAX'
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
left join public.checkout_scopes cs on cs.id = s.checkout_scope_id
left join public.reps r on r.id = s.rep_id
left join public.commission_ledger cl on cl.submission_id = s.id
left join public.payouts p on p.submission_id = s.id
left join public.wallet_entries we on we.order_id = s.id
group by
  s.id,
  cs.id,
  cs.display_name,
  r.id,
  r.rep_slug,
  r.rep_name,
  r.brand_name,
  r.paypal_link,
  r.payout_method;

grant select on public.admin_paypal_routing_audit to authenticated;
