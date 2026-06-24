-- Repair patient-facing tracking fields for environments where
-- patient_submissions existed before the initial schema added tracking_number.
alter table public.patient_submissions
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text,
  add column if not exists tracking_url text;

comment on column public.patient_submissions.tracking_number is
  'Carrier tracking number displayed to patients after shipment.';

comment on column public.patient_submissions.tracking_carrier is
  'Shipping carrier used with tracking_number, such as USPS, UPS, or FedEx.';

comment on column public.patient_submissions.tracking_url is
  'Optional explicit package tracking URL.';

notify pgrst, 'reload schema';
