-- Allow AACTIVATEDRX scoped admins to create and manage backend checkout discount codes.

drop policy if exists "admin_manage_aactivated_promo_links" on public.aactivated_promo_links;
create policy "admin_manage_aactivated_promo_links"
on public.aactivated_promo_links
for all
to authenticated
using (
  public.is_current_profile_platform_admin()
  or public.is_current_profile_aactivated_admin()
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_promo_links.rep_id
      and r.profile_id = public.current_profile_id()
      and r.active = true
      and public.is_aactivated_rep_profile(public.current_profile_id())
  )
)
with check (
  public.is_current_profile_platform_admin()
  or public.is_current_profile_aactivated_admin()
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_promo_links.rep_id
      and r.profile_id = public.current_profile_id()
      and r.active = true
      and public.is_aactivated_rep_profile(public.current_profile_id())
  )
);
