-- Older AACTIVATED rep rows may not have the newer exact rep_tier/rep_channel
-- values, but the admin back page still needs to update hierarchy fields.
-- Keep updates scoped to AACTIVATED rows and AACTIVATED/platform admins.

drop policy if exists "aactivated admins update scoped reps" on public.reps;
create policy "aactivated admins update scoped reps"
on public.reps
for update
to authenticated
using (
  (
    public.is_current_profile_platform_admin()
    or public.is_current_profile_aactivated_admin()
  )
  and (
    lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
)
with check (
  (
    public.is_current_profile_platform_admin()
    or public.is_current_profile_aactivated_admin()
  )
  and (
    lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
  and (
    parent_rep_id is null
    or parent_rep_id <> id
  )
  and (
    parent_rep_id is null
    or exists (
      select 1
      from public.reps parent
      where parent.id = reps.parent_rep_id
        and parent.active = true
        and (
          lower(coalesce(parent.custom_store_slug, '')) = 'aactivated'
          or upper(coalesce(parent.brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
          or upper(coalesce(parent.rep_channel, '')) like '%AACTIVATED%'
          or upper(coalesce(parent.rep_tier, '')) like '%AACTIVATED%'
          or upper(coalesce(parent.rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
        )
    )
  )
);
