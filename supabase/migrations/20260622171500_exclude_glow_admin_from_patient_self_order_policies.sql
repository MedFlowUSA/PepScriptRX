-- Vanessa's scoped GLOW admin account must not inherit unrelated patient/self
-- orders in the admin portal. GLOW admin order access is handled only by the
-- explicit "rx plus glow submissions scoped" policies.

drop policy if exists "submissions patient read own" on public.patient_submissions;
create policy "submissions patient read own"
on public.patient_submissions
for select
using (
  not public.is_glow_scoped_admin()
  and patient_profile_id = public.current_profile_id()
);

drop policy if exists "submissions patient read by profile or email" on public.patient_submissions;
create policy "submissions patient read by profile or email"
on public.patient_submissions
for select
using (
  not public.is_glow_scoped_admin()
  and (
    patient_profile_id = public.current_profile_id()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
