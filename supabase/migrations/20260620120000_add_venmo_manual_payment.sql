-- Add Venmo as a main-account manual payment option.

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_provider_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_provider_check
  check (payment_provider is null or payment_provider in ('paypal', 'crypto', 'zelle', 'venmo', 'manual', 'other'));

alter table public.zelle_payment_intents
  add column if not exists payment_provider text not null default 'zelle';

alter table public.zelle_payment_intents
  drop constraint if exists zelle_payment_intents_payment_provider_check;

alter table public.zelle_payment_intents
  add constraint zelle_payment_intents_payment_provider_check
  check (payment_provider in ('zelle', 'venmo'));

alter table public.zelle_payment_intents
  drop constraint if exists zelle_payment_intents_recipient_kind_check;

alter table public.zelle_payment_intents
  add constraint zelle_payment_intents_recipient_kind_check
  check (recipient_kind in ('email', 'phone', 'tag', 'handle'));

create index if not exists zelle_payment_intents_provider_idx
  on public.zelle_payment_intents(payment_provider);

drop view if exists public.admin_zelle_payment_queue;

create or replace view public.admin_zelle_payment_queue
with (security_invoker = true)
as
select
  z.id,
  z.order_id,
  z.payment_provider,
  z.status,
  z.subtotal_cents,
  z.discount_cents,
  z.amount_due_cents,
  z.payment_reference,
  z.recipient_display_name,
  z.recipient_kind,
  z.recipient_value,
  z.sender_name,
  z.sender_email,
  z.sender_phone,
  z.claimed_amount_cents,
  z.expires_at,
  z.customer_marked_sent_at,
  z.confirmed_at,
  z.admin_note,
  z.created_at,
  z.updated_at,
  coalesce(z.customer_name, s.full_name) as customer_name,
  coalesce(z.customer_email, s.email) as customer_email,
  coalesce(z.customer_phone, s.phone) as customer_phone,
  s.medication,
  coalesce(z.checkout_scope_code, s.checkout_scope_code) as checkout_scope_code,
  coalesce(z.source_portal, s.source_portal) as source_portal,
  coalesce(z.source_route, s.source_route) as source_route,
  coalesce(z.store_slug, s.store_slug) as store_slug,
  coalesce(z.referral_code, s.referral_code) as referral_code,
  coalesce(z.admin_code, s.admin_code) as admin_code,
  coalesce(z.store_name, s.store_name) as store_name,
  coalesce(z.account_type, s.account_type) as account_type,
  coalesce(z.attribution_source, s.attribution_source) as attribution_source,
  coalesce(z.source_store, s.source_store) as source_store,
  coalesce(z.source_admin, s.source_admin) as source_admin,
  coalesce(z.source_rep, s.source_rep) as source_rep,
  s.payment_status,
  s.status as order_status,
  count(p.id) as proof_count
from public.zelle_payment_intents z
join public.patient_submissions s on s.id = z.order_id
left join public.payment_proofs p on p.payment_intent_id = z.id
group by z.id, s.id;

grant select on public.admin_zelle_payment_queue to authenticated;
