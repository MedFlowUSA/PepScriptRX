-- Platform admins can activate AACTIVATED rep requests from the approval center,
-- but inserted/updated rows must still remain scoped to AACTIVATED.

drop policy if exists "aactivated scoped admins insert partner reps" on public.reps;
create policy "aactivated scoped admins insert partner reps"
on public.reps
for insert
to authenticated
with check (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
);

drop policy if exists "aactivated scoped admins update partner reps" on public.reps;
create policy "aactivated scoped admins update partner reps"
on public.reps
for update
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
)
with check (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
  and (parent_rep_id is null or parent_rep_id <> id)
);
