-- Manual Zelle payment-intent MVP for the main PepScriptRX checkout only.

alter table public.patient_submissions
  add column if not exists subtotal_cents integer,
  add column if not exists discount_cents integer,
  add column if not exists amount_due_cents integer,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists payment_release_policy text not null default 'paid_hold';

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_provider_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_provider_check
  check (payment_provider is null or payment_provider in ('paypal', 'crypto', 'zelle', 'manual', 'other'));

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_status_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_status_check
  check (payment_status in ('unpaid', 'payment_pending', 'paid', 'payment_exception', 'failed', 'refunded', 'reversed', 'cancelled'));

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_release_policy_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_release_policy_check
  check (payment_release_policy in ('paid_hold', 'manual_release', 'released'));

create table if not exists public.zelle_payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.patient_submissions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'needs_info', 'confirmed', 'rejected', 'expired', 'cancelled')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  amount_due_cents integer not null check (amount_due_cents >= 0),
  discount_bps integer not null default 1000 check (discount_bps >= 0 and discount_bps <= 10000),
  recipient_display_name text not null,
  recipient_kind text not null check (recipient_kind in ('email', 'phone', 'tag')),
  recipient_value text not null,
  payment_reference text not null unique,
  expires_at timestamptz not null,
  sender_name text,
  sender_email text,
  sender_phone text,
  claimed_amount_cents integer,
  customer_marked_sent_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists zelle_payment_intents_one_active_order_idx
  on public.zelle_payment_intents(order_id)
  where status in ('pending', 'sent', 'needs_info');

create index if not exists zelle_payment_intents_status_idx on public.zelle_payment_intents(status);
create index if not exists zelle_payment_intents_order_idx on public.zelle_payment_intents(order_id);

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.zelle_payment_intents(id) on delete cascade,
  order_id uuid not null references public.patient_submissions(id) on delete cascade,
  provider text not null default 'zelle',
  file_path text not null,
  file_name text,
  content_type text,
  file_size integer,
  uploaded_by_email text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'reviewed', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists payment_proofs_intent_idx on public.payment_proofs(payment_intent_id);
create index if not exists payment_proofs_order_idx on public.payment_proofs(order_id);

create table if not exists public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.patient_submissions(id) on delete cascade,
  payment_intent_id uuid references public.zelle_payment_intents(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id),
  actor_type text not null default 'system'
    check (actor_type in ('customer', 'admin', 'system')),
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_order_idx on public.payment_audit_log(order_id);
create index if not exists payment_audit_intent_idx on public.payment_audit_log(payment_intent_id);

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

alter table public.zelle_payment_intents enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.payment_audit_log enable row level security;

drop policy if exists "admin_manage_zelle_payment_intents" on public.zelle_payment_intents;
create policy "admin_manage_zelle_payment_intents"
on public.zelle_payment_intents for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin_manage_payment_proofs" on public.payment_proofs;
create policy "admin_manage_payment_proofs"
on public.payment_proofs for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin_manage_payment_audit_log" on public.payment_audit_log;
create policy "admin_manage_payment_audit_log"
on public.payment_audit_log for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin_read_payment_proof_objects" on storage.objects;
create policy "admin_read_payment_proof_objects"
on storage.objects for select
using (
  bucket_id = 'payment-proofs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

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
  source_portal text,
  source_route text,
  store_slug text,
  payment_provider text,
  payment_status text,
  subtotal_cents integer,
  discount_cents integer,
  amount_due_cents integer,
  payment_expires_at timestamptz,
  payment_reference text
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
    s.source_portal,
    s.source_route,
    s.store_slug,
    s.payment_provider,
    s.payment_status,
    s.subtotal_cents,
    s.discount_cents,
    s.amount_due_cents,
    s.payment_expires_at,
    s.payment_reference
  from public.patient_submissions s
  where s.id = p_submission_id
    and s.status in ('payment_sent', 'paid', 'fulfilled');
$$;

grant execute on function public.get_public_payment_submission(uuid) to anon, authenticated;

create or replace view public.admin_zelle_payment_queue
with (security_invoker = true)
as
select
  z.id,
  z.order_id,
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
  s.full_name as customer_name,
  s.email as customer_email,
  s.phone as customer_phone,
  s.medication,
  s.checkout_scope_code,
  s.source_portal,
  s.payment_status,
  s.status as order_status,
  count(p.id) as proof_count
from public.zelle_payment_intents z
join public.patient_submissions s on s.id = z.order_id
left join public.payment_proofs p on p.payment_intent_id = z.id
group by z.id, s.id;

grant select on public.admin_zelle_payment_queue to authenticated;
