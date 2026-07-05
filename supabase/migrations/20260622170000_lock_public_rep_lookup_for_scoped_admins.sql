-- Public rep lookup is needed for storefront/referral resolution, but it must
-- not give authenticated scoped partner admins a path to every active rep.

drop policy if exists "reps_anon_read" on public.reps;
drop policy if exists "reps public active lookup" on public.reps;

create policy "reps public active lookup"
on public.reps
for select
to anon
using (active = true);

drop policy if exists "reps own profile read" on public.reps;
create policy "reps own profile read"
on public.reps
for select
to authenticated
using (profile_id = public.current_profile_id());

drop policy if exists "reps admin all" on public.reps;
drop policy if exists "reps_admin_all" on public.reps;
create policy "reps admin all"
on public.reps
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
