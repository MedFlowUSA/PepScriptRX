-- Ensure AACTIVATEDRX rep requests are visible to the AACTIVATED approval portal.

create or replace function public.is_current_profile_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and p.role in ('admin', 'owner', 'platform_admin', 'super_admin')
  );
$$;

create or replace function public.is_current_profile_aactivated_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and p.role = 'rx_plus_admin'
      and lower(coalesce(p.email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
  );
$$;

update public.rep_store_intake_submissions
set
  source_portal_id = coalesce(source_portal_id, 'aactivated'),
  source_portal = coalesce(source_portal, 'AACTIVATEDRX'),
  source_route = coalesce(source_route, '/AACTIVATED/rep-intake'),
  parent_store_slug = 'aactivated',
  parent_store_name = 'AACTIVATEDRX',
  partner_admin_email = 'guy@aactivated.com',
  approval_owner_email = 'guy@aactivated.com',
  approval_status = coalesce(approval_status, 'pending'),
  review_queue = 'aactivated',
  review_admin_code = coalesce(review_admin_code, 'GUY60'),
  review_admin_name = coalesce(review_admin_name, 'Guy Griffithe - GUY60'),
  internal_notes = coalesce(
    nullif(internal_notes, ''),
    'AACTIVATED_REP_INTAKE: Visibility repaired for AACTIVATEDRX approval portal.'
  )
where lower(coalesce(email, '')) = 'showtimewigg@gmail.com'
   or upper(coalesce(desired_rep_code, '')) = 'WIGG';

drop policy if exists "admin_manage_rep_store_intake" on public.rep_store_intake_submissions;
create policy "admin_manage_rep_store_intake"
on public.rep_store_intake_submissions
for all
to authenticated
using (
  public.is_current_profile_platform_admin()
  or (
    public.is_current_profile_aactivated_admin()
    and (
      lower(coalesce(review_queue, '')) = 'aactivated'
      or lower(coalesce(parent_store_slug, '')) in ('aactivated', 'aactivatedrx')
      or lower(coalesce(source_portal_id, '')) = 'aactivated'
      or lower(coalesce(partner_admin_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
      or lower(coalesce(approval_owner_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
      or upper(coalesce(review_admin_code, '')) = 'GUY60'
      or upper(
        coalesce(source_portal, '') || ' ' ||
        coalesce(source_url, '') || ' ' ||
        coalesce(source_route, '') || ' ' ||
        coalesce(parent_store_name, '') || ' ' ||
        coalesce(parent_rep_or_admin_name, '') || ' ' ||
        coalesce(store_type, '') || ' ' ||
        coalesce(store_brand_name, '') || ' ' ||
        coalesce(internal_notes, '')
      ) like '%AACTIVATED%'
    )
  )
)
with check (
  public.is_current_profile_platform_admin()
  or (
    public.is_current_profile_aactivated_admin()
    and (
      lower(coalesce(review_queue, '')) = 'aactivated'
      or lower(coalesce(parent_store_slug, '')) in ('aactivated', 'aactivatedrx')
      or lower(coalesce(source_portal_id, '')) = 'aactivated'
      or lower(coalesce(partner_admin_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
      or lower(coalesce(approval_owner_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
      or upper(coalesce(review_admin_code, '')) = 'GUY60'
      or upper(
        coalesce(source_portal, '') || ' ' ||
        coalesce(source_url, '') || ' ' ||
        coalesce(source_route, '') || ' ' ||
        coalesce(parent_store_name, '') || ' ' ||
        coalesce(parent_rep_or_admin_name, '') || ' ' ||
        coalesce(store_type, '') || ' ' ||
        coalesce(store_brand_name, '') || ' ' ||
        coalesce(internal_notes, '')
      ) like '%AACTIVATED%'
    )
  )
);
