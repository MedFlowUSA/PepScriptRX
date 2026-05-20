do $$
declare
  col_name text;
begin
  foreach col_name in array array[
    'current_dose',
    'current_price',
    'date_of_birth',
    'current_pharmacy',
    'shipping_address',
    'shipping_city',
    'shipping_state',
    'shipping_zip',
    'shipping_speed',
    'shipping_cost'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patient_submissions'
        and columns.column_name = col_name
    ) then
      execute format(
        'alter table public.patient_submissions alter column %I drop not null',
        col_name
      );
    end if;
  end loop;
end
$$;

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

alter table public.patient_submissions enable row level security;

drop policy if exists "submissions public insert" on public.patient_submissions;
create policy "submissions public insert"
on public.patient_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "documents insert during intake" on public.submission_documents;
create policy "documents insert during intake"
on public.submission_documents
for insert
to anon, authenticated
with check (true);
