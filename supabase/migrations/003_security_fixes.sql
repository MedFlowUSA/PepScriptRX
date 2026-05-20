-- ============================================================
-- PepScriptRX — Security Hardening
-- Fixes all Supabase database linter warnings
-- ============================================================

-- ── 1. Fix mutable search_path on all functions ──────────────
-- Setting search_path = '' forces fully-qualified names,
-- preventing search_path injection attacks.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1) = 'admin', false)
$$;

-- ── 2. Restrict SECURITY DEFINER functions from public RPC ───
-- handle_new_user is a trigger — it must never be callable via REST.
-- Revoking execute from anon and authenticated prevents /rpc/handle_new_user abuse.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ── 3. Tighten audit_logs INSERT policy ──────────────────────
-- Audit logs should only be written by authenticated (staff) users, not anon.
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_admin_all" ON public.audit_logs;

CREATE POLICY "audit_authenticated_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_admin_read" ON public.audit_logs
  FOR SELECT USING (public.my_role() = 'admin');

-- ── 4. Remove duplicate RLS policies ─────────────────────────
-- Both migration files created overlapping policies. Drop the duplicates.

-- patient_submissions — keep submissions_anon_insert, drop the duplicate
DROP POLICY IF EXISTS "submissions public insert" ON public.patient_submissions;

-- submission_documents — keep docs_anon_insert, drop the duplicate
DROP POLICY IF EXISTS "documents insert during intake" ON public.submission_documents;

-- reta_waitlist — keep reta_anon_insert, drop the duplicate
DROP POLICY IF EXISTS "waitlist public insert" ON public.reta_waitlist;

-- ── 5. Drop duplicate profile / rep policies ─────────────────
DROP POLICY IF EXISTS "profiles insert during intake" ON public.profiles;
DROP POLICY IF EXISTS "profiles own or admin read" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin update" ON public.profiles;
DROP POLICY IF EXISTS "reps public active lookup" ON public.reps;
DROP POLICY IF EXISTS "reps admin all" ON public.reps;
DROP POLICY IF EXISTS "fulfillment admin all" ON public.fulfillment_orders;
DROP POLICY IF EXISTS "fulfillment assigned read update" ON public.fulfillment_orders;
DROP POLICY IF EXISTS "ledger admin all" ON public.commission_ledger;
DROP POLICY IF EXISTS "ledger rep own read" ON public.commission_ledger;
DROP POLICY IF EXISTS "reviews physician assigned all" ON public.physician_reviews;
DROP POLICY IF EXISTS "waitlist admin read" ON public.reta_waitlist;
