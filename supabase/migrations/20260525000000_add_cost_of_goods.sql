-- Add cost_of_goods to patient_submissions so payout calculations
-- use net profit (gross - cogs) instead of gross revenue as commission base.
alter table public.patient_submissions
  add column if not exists cost_of_goods numeric(10,2) not null default 0;

comment on column public.patient_submissions.cost_of_goods is
  'Wholesale product cost entered by admin. Commission base = (gross_sale - discount - cost_of_goods).';
