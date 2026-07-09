-- The public AACTIVATED rep request form writes directly to this intake table.
-- RLS already limits the action to insert-only for anon users; this grant makes
-- that policy reachable through Supabase/PostgREST.

grant insert on table public.rep_store_intake_submissions to anon;
grant insert on table public.rep_store_intake_submissions to authenticated;
