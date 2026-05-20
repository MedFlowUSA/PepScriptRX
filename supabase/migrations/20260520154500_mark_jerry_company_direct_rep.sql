-- Mark Jerry Diaz as a direct company rep with no admin/upline assignment.

alter table public.reps
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null;

update public.reps
set
  rep_channel = 'company_direct',
  parent_rep_id = null,
  managed_by_profile_id = null,
  rep_tier = 'company_direct'
where rep_slug = 'JERRY45';
