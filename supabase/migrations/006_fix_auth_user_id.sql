-- ============================================================
-- PepScriptRX — Fix handle_new_user to set auth_user_id
-- New users created after migration 001 had auth_user_id = NULL
-- which breaks current_profile_id() and RLS policies.
-- ============================================================

-- 1. Backfill existing profiles where auth_user_id is still NULL
UPDATE public.profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id);

-- 2. Fix the trigger so new users always get auth_user_id set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, auth_user_id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.profiles.auth_user_id IS NULL;
  RETURN NEW;
END;
$$;
