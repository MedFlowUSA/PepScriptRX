-- Centralize PayPal checkout routing through the official PepScriptRX account.
-- Rep/admin/store earnings stay in the internal ledger until an admin pays them manually.

alter table public.patient_submissions
  add column if not exists payment_provider text,
  add column if not exists payout_status text not null default 'pending',
  add column if not exists fulfillment_status text not null default 'pending';

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_provider_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_provider_check
  check (payment_provider is null or payment_provider in ('paypal', 'crypto', 'manual', 'other'));

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payout_status_check;

alter table public.patient_submissions
  add constraint patient_submissions_payout_status_check
  check (payout_status in ('pending', 'payable', 'paid', 'failed', 'reversed'));

create index if not exists patient_submissions_payment_provider_idx
  on public.patient_submissions(payment_provider);

create index if not exists patient_submissions_payout_status_idx
  on public.patient_submissions(payout_status);

update public.patient_submissions
set payment_provider = 'paypal'
where payment_provider is null
  and paypal_capture_id is not null;

update public.patient_submissions
set payout_status = 'pending'
where payout_status is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reps'
      and column_name = 'paypal_link'
  ) then
    update public.reps
    set paypal_link = null
    where paypal_link is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reps'
      and column_name = 'payout_method'
  ) then
    update public.reps
    set payout_method = 'Manual PayPal payout'
    where payout_method is not null
      and payout_method <> 'Manual PayPal payout'
      and (
        payout_method ilike '%paypal.me%'
        or payout_method ilike 'paypal:%'
        or payout_method ilike '%paypal business:%'
      );
  end if;
end $$;

comment on column public.patient_submissions.payment_provider is
  'Payment processor confirmed by server-side capture. PayPal orders must be captured by capture-paypal-order.';

comment on column public.patient_submissions.payout_status is
  'Internal payout state. Customer payment capture does not automatically pay reps/admins/sub-accounts.';

comment on column public.patient_submissions.fulfillment_status is
  'Internal fulfillment state for paid orders. Defaults to pending after checkout capture.';

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
  s.payment_provider,
  s.payment_status,
  s.paypal_order_id,
  s.paypal_capture_id,
  s.paypal_capture_status,
  coalesce(string_agg(distinct cl.status, ', ') filter (where cl.status is not null), 'pending') as commission_status,
  coalesce(string_agg(distinct p.status, ', ') filter (where p.status is not null), s.payout_status, 'pending') as payout_status,
  coalesce(s.fulfillment_status, 'pending') as fulfillment_status,
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
    when s.payment_status = 'paid'
      and (
        s.payment_provider is distinct from 'paypal'
        or s.paypal_order_id is null
        or s.paypal_capture_id is null
        or s.paypal_capture_status is distinct from 'COMPLETED'
      )
      then 'Paid order is missing official PayPal capture evidence.'
    else null
  end as routing_warning
from public.patient_submissions s
left join public.reps r on r.id = s.rep_id
left join public.commission_ledger cl on cl.submission_id = s.id
left join public.payouts p on p.submission_id = s.id
group by
  s.id,
  r.rep_slug,
  r.brand_name,
  r.rep_name,
  r.paypal_link,
  r.payout_method;

grant select on public.admin_paypal_routing_audit to authenticated;
