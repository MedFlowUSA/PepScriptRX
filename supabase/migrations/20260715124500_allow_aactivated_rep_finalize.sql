-- Let scoped AACTIVATED admins finish rep setup without exposing other stores.

drop policy if exists "aactivated scoped admins read partner reps" on public.reps;
create policy "aactivated scoped admins read partner reps"
on public.reps
for select
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(parent_brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
);

drop policy if exists "aactivated scoped admins finalize rep intake" on public.rep_store_intake_submissions;
create policy "aactivated scoped admins finalize rep intake"
on public.rep_store_intake_submissions
for update
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and public.is_aactivated_rep_intake_scope(
    source_portal_id,
    source_portal,
    source_url,
    source_route,
    review_queue,
    parent_store_slug,
    parent_store_name,
    partner_admin_email,
    approval_owner_email,
    review_admin_code,
    review_admin_name,
    parent_rep_or_admin_name,
    store_type,
    store_brand_name,
    internal_notes
  )
)
with check (
  public.is_aactivated_partner_ops_admin()
  and status in ('new', 'reviewing', 'logo_needed', 'pricing_review', 'ready_to_build', 'launched', 'rejected')
  and (approval_status is null or approval_status in ('pending', 'approved', 'rejected', 'more_info_requested'))
  and public.is_aactivated_rep_intake_scope(
    source_portal_id,
    source_portal,
    source_url,
    source_route,
    review_queue,
    parent_store_slug,
    parent_store_name,
    partner_admin_email,
    approval_owner_email,
    review_admin_code,
    review_admin_name,
    parent_rep_or_admin_name,
    store_type,
    store_brand_name,
    internal_notes
  )
);

grant execute on function public.is_aactivated_partner_ops_admin() to authenticated;
grant execute on function public.is_aactivated_rep_intake_scope(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
