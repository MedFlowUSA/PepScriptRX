alter table public.patient_submissions
  add column if not exists product_id text,
  add column if not exists product_name text,
  add column if not exists product_category text,
  add column if not exists product_type text,
  add column if not exists selected_addons jsonb not null default '[]'::jsonb,
  add column if not exists is_accessory_only boolean not null default false,
  add column if not exists submission_type text not null default 'savings_check',
  add column if not exists inquiry_notes text;

alter table public.patient_submissions
  drop constraint if exists patient_submissions_submission_type_check;

alter table public.patient_submissions
  add constraint patient_submissions_submission_type_check
  check (
    submission_type in (
      'savings_check',
      'accessory_inquiry',
      'supply_inquiry',
      'availability_review',
      'physician_review'
    )
  );

alter table public.patient_submissions
  drop constraint if exists patient_submissions_product_type_check;

alter table public.patient_submissions
  add constraint patient_submissions_product_type_check
  check (
    product_type is null
    or product_type in (
      'glp1',
      'manual_review',
      'physician_review',
      'supply',
      'accessory'
    )
  );

comment on column public.patient_submissions.selected_addons is 'Optional add-on products selected during public intake.';
comment on column public.patient_submissions.is_accessory_only is 'True when the public intake is only for an accessory request.';
comment on column public.patient_submissions.submission_type is 'Public intake type, such as savings_check, accessory_inquiry, or supply_inquiry.';

alter table public.products
  add column if not exists product_type text,
  add column if not exists requires_prescription_upload boolean not null default false,
  add column if not exists requires_receipt_upload boolean not null default false,
  add column if not exists requires_dob boolean not null default true,
  add column if not exists requires_physician_review boolean not null default false;

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('active','active_addon','manual_review','physician_review','hidden','inactive'));

alter table public.products
  drop constraint if exists products_product_type_check;

alter table public.products
  add constraint products_product_type_check
  check (
    product_type is null
    or product_type in ('glp1','manual_review','physician_review','supply','accessory')
  );

update public.products
set
  product_type = 'glp1',
  requires_dob = true,
  requires_receipt_upload = true,
  requires_prescription_upload = false,
  requires_physician_review = false
where id in ('tirzepatide-30', 'tirzepatide-60', 'semaglutide-10');

update public.products
set
  category = 'Accessory',
  status = 'active_addon',
  product_type = 'accessory',
  requires_dob = false,
  requires_receipt_upload = false,
  requires_prescription_upload = false,
  requires_physician_review = false,
  display_note = coalesce(display_note, 'Includes reusable pen body, cartridge, and pen needles. Multiple colors available.')
where id = 'pen-kit';

update public.products
set
  category = 'Supply',
  product_type = 'supply',
  requires_dob = false,
  requires_receipt_upload = false,
  requires_prescription_upload = false,
  requires_physician_review = false
where id = 'bac-water';

update public.products
set
  status = 'manual_review',
  product_type = 'manual_review',
  requires_dob = true,
  requires_receipt_upload = false,
  requires_prescription_upload = false,
  requires_physician_review = false
where id = 'retatrutide';

update public.products
set
  product_type = 'physician_review',
  requires_dob = true,
  requires_receipt_upload = false,
  requires_prescription_upload = false,
  requires_physician_review = true
where id = 'igf1';
