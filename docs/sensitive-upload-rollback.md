# Sensitive upload hardening rollback

Migration: `20260720120000_harden_sensitive_submission_uploads.sql`

The migration is additive/idempotent and preserves the private bucket and all staff read policies. If an emergency rollback is required:

1. Keep the bucket private.
2. Drop `submission documents hardened upload` on `storage.objects`.
3. Recreate the prior `submission documents can be uploaded` insert policy for the `submission-documents` bucket.
4. Drop `documents constrained public insert` on `public.submission_documents`.
5. Recreate the former public insert policy only for the minimum recovery window.
6. Investigate rejected MIME/path telemetry before restoring the hardened policy.

Do not remove the 10 MB bucket limit or make the bucket public during rollback.
