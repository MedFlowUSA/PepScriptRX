-- Add tracking_carrier to patient_submissions (tracking_number already exists from initial schema)
alter table public.patient_submissions
  add column if not exists tracking_carrier text;

-- Add height_inches to patient_goals
alter table public.patient_goals
  add column if not exists height_inches numeric;

-- Enable realtime on key tables (idempotent via publication alter)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'submission_messages'
  ) then
    alter publication supabase_realtime add table public.submission_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'patient_submissions'
  ) then
    alter publication supabase_realtime add table public.patient_submissions;
  end if;
end $$;
