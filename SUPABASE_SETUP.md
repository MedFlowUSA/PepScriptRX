# PepScriptRX Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260519000000_pepscriptrx_mvp.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Add these Vercel/local environment variables:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Confirm the private Storage bucket exists:

```text
submission-documents
```

5. Create staff accounts in Supabase Auth, then add matching rows in `profiles` with `auth_user_id` set to the auth user id and role set to `admin`, `rep`, `physician`, or `fulfillment`.
6. Add rep records with unique `rep_slug` values such as `cynthia`, `ish`, and `jane`.

The public intake form can insert patient profiles, submissions, waitlist records, audit logs, and private storage files. Staff dashboards are scaffolded in the UI; production data reads and update actions should use the RLS-backed tables from the migration.
