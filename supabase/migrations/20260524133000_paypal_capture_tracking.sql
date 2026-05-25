alter table public.patient_submissions
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_capture_status text;

alter table public.patient_submissions
  drop constraint if exists patient_submissions_payment_status_check;

alter table public.patient_submissions
  add constraint patient_submissions_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'failed', 'refunded'));

create index if not exists patient_submissions_paypal_order_id_idx
  on public.patient_submissions(paypal_order_id);

create index if not exists patient_submissions_paypal_capture_id_idx
  on public.patient_submissions(paypal_capture_id);
