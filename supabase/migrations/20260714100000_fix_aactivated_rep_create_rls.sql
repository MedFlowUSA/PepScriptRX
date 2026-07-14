-- Allow scoped AACTIVATEDRX admins to create/update AACTIVATED downline reps.
-- The approval flow assigns new reps under Guy/AACTIVATED as the parent manager,
-- so RLS must validate the AACTIVATED scope instead of requiring manager = actor.

drop policy if exists "aactivated admins insert scoped reps" on public.reps;
create policy "aactivated admins insert scoped reps"
on public.reps
for insert
to authenticated
with check (
  public.is_current_profile_aactivated_admin()
  and rep_channel = 'aactivated_downline'
  and rep_tier = 'aactivated_rep'
  and lower(coalesce(custom_store_slug, '')) = 'aactivated'
  and upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
  and active = true
  and (
    parent_rep_id is null
    or exists (
      select 1
      from public.reps parent
      where parent.id = reps.parent_rep_id
        and parent.active = true
        and (
          upper(coalesce(parent.rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
          or lower(coalesce(parent.custom_store_slug, '')) = 'aactivated'
          or upper(coalesce(parent.brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
          or upper(coalesce(parent.rep_channel, '')) like '%AACTIVATED%'
        )
    )
  )
);

drop policy if exists "aactivated admins update scoped reps" on public.reps;
create policy "aactivated admins update scoped reps"
on public.reps
for update
to authenticated
using (
  public.is_current_profile_aactivated_admin()
  and (
    lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) = 'AACTIVATED_DOWNLINE'
    or upper(coalesce(rep_tier, '')) = 'AACTIVATED_REP'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
)
with check (
  public.is_current_profile_aactivated_admin()
  and rep_channel = 'aactivated_downline'
  and rep_tier = 'aactivated_rep'
  and lower(coalesce(custom_store_slug, '')) = 'aactivated'
  and upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
  and (
    parent_rep_id is null
    or exists (
      select 1
      from public.reps parent
      where parent.id = reps.parent_rep_id
        and parent.active = true
        and (
          upper(coalesce(parent.rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
          or lower(coalesce(parent.custom_store_slug, '')) = 'aactivated'
          or upper(coalesce(parent.brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
          or upper(coalesce(parent.rep_channel, '')) like '%AACTIVATED%'
        )
    )
  )
);
