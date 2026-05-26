alter table public.reps
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text;

update public.reps
set
  custom_store_slug = 'aactivated',
  brand_name = coalesce(nullif(brand_name, ''), 'AACTIVATED-RX')
where rep_slug = 'GUY60';
