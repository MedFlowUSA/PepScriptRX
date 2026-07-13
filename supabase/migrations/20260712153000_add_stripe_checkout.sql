alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_provider_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_provider_check
  check (payment_provider is null or payment_provider in ('paypal', 'stripe', 'crypto', 'zelle', 'venmo', 'manual', 'other'));

alter table public.patient_submissions
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_payment_status text;

create index if not exists patient_submissions_stripe_session_idx
  on public.patient_submissions(stripe_checkout_session_id);

create index if not exists patient_submissions_stripe_payment_intent_idx
  on public.patient_submissions(stripe_payment_intent_id);
