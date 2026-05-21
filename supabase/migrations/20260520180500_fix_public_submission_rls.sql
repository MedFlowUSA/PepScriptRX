grant usage on schema public to anon, authenticated;
grant insert on table public.patient_submissions to anon, authenticated;
grant insert on table public.submission_documents to anon, authenticated;
grant select on table public.reps to anon, authenticated;
grant select on table public.products to anon, authenticated;

alter table public.patient_submissions enable row level security;
alter table public.submission_documents enable row level security;

drop policy if exists "submissions_anon_insert" on public.patient_submissions;
drop policy if exists "submissions public insert" on public.patient_submissions;
drop policy if exists "submissions public form insert" on public.patient_submissions;

create policy "submissions public form insert"
on public.patient_submissions
as permissive
for insert
to public
with check (true);

drop policy if exists "docs_anon_insert" on public.submission_documents;
drop policy if exists "documents insert during intake" on public.submission_documents;
drop policy if exists "documents public form insert" on public.submission_documents;

create policy "documents public form insert"
on public.submission_documents
as permissive
for insert
to public
with check (true);
