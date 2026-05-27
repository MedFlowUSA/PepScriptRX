-- Keep public storefronts, branded customer portals, and rep dashboards aligned.

alter table public.reps
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb;

update public.reps
set
  custom_store_slug = 'EmpireHealth&Wellness',
  brand_name = 'Empire Health & Wellness',
  referral_path = '/EmpireHealth&Wellness'
where rep_slug = 'MARK65';

update public.reps
set
  custom_store_slug = 'aactivated',
  brand_name = 'AACTIVATED-RX',
  referral_path = '/aactivated'
where rep_slug = 'GUY60';

update public.reps
set
  custom_store_slug = 'warxlabz',
  brand_name = 'WarXlabz',
  referral_path = '/warxlabz'
where rep_slug = 'ROBERT';

update public.reps
set
  custom_store_slug = 'peakform',
  brand_name = 'Peak Form Peptides',
  referral_path = '/peakform',
  brand_theme = coalesce(
    brand_theme,
    '{"palette":["#0d1b3e","#2563eb","#e5edf8","#ffffff"],"style":"premium athletic medical mountain"}'::jsonb
  )
where rep_slug = 'SCOTTB';
