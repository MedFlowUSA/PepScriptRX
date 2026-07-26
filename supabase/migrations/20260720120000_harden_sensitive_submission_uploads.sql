-- Harden the existing private submission-document channel without changing
-- customer/order ownership or granting any new read access.

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']::text[]
where id = 'submission-documents';

drop policy if exists "submission documents can be uploaded" on storage.objects;
drop policy if exists "submission documents hardened upload" on storage.objects;
create policy "submission documents hardened upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'submission-documents'
  and name ~ '^[0-9a-fA-F-]{36}/(prescription|receipt|medication_photo)-[0-9a-zA-Z-]+\.(pdf|jpg|png|heic)$'
);

drop policy if exists "docs_anon_insert" on public.submission_documents;
drop policy if exists "documents insert during intake" on public.submission_documents;
drop policy if exists "documents public form insert" on public.submission_documents;
drop policy if exists "documents constrained public insert" on public.submission_documents;
create policy "documents constrained public insert"
on public.submission_documents
for insert
to anon, authenticated
with check (
  file_path like submission_id::text || '/%'
  and document_type in ('prescription', 'receipt', 'medication_photo')
  and length(file_path) <= 180
);

-- The linked migration role can manage this policy but does not own
-- storage.objects, so COMMENT ON POLICY is intentionally omitted.
