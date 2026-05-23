-- Add tracking_carrier to fulfillment_orders so fulfillment team can record it
-- and it syncs to patient_submissions for patient-facing tracking display
alter table public.fulfillment_orders
  add column if not exists tracking_carrier text;
