-- Keep AACTIVATEDRX/Guy rep requests in the AACTIVATED approval queue.
-- This backfills missed rows such as Paul Hourani and normalizes future intake inserts.

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
      and p.role in ('admin', 'owner', 'platform_admin', 'master_admin', 'super_admin')
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
      and p.role in ('rx_plus_admin', 'partner_admin_full')
      and (
        lower(trim(coalesce(p.email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or upper(trim(coalesce(p.admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
        or lower(trim(coalesce(p.store_slug, ''))) in ('aactivated', 'aactivatedrx')
        or upper(coalesce(p.admin_scope, '') || ' ' || coalesce(p.store_slug, '')) like '%AACTIVATED%'
      )
  );
$$;

create or replace function public.is_aactivated_rep_intake_scope(
  p_source_portal_id text,
  p_source_portal text,
  p_source_url text,
  p_source_route text,
  p_review_queue text,
  p_parent_store_slug text,
  p_parent_store_name text,
  p_partner_admin_email text,
  p_approval_owner_email text,
  p_review_admin_code text,
  p_review_admin_name text,
  p_parent_rep_or_admin_name text,
  p_store_type text,
  p_store_brand_name text,
  p_internal_notes text
)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_source_portal_id, ''))) in ('aactivated', 'aactivatedrx')
    or lower(trim(coalesce(p_review_queue, ''))) = 'aactivated'
    or lower(trim(coalesce(p_parent_store_slug, ''))) in ('aactivated', 'aactivatedrx')
    or lower(trim(coalesce(p_partner_admin_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
    or lower(trim(coalesce(p_approval_owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
    or upper(trim(coalesce(p_review_admin_code, ''))) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
    or upper(concat_ws(
      ' ',
      p_source_portal,
      p_source_url,
      p_source_route,
      p_parent_store_name,
      p_review_admin_name,
      p_parent_rep_or_admin_name,
      p_store_type,
      p_store_brand_name,
      p_internal_notes
    )) like '%AACTIVATED%';
$$;

create or replace function public.normalize_aactivated_rep_intake_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_aactivated_rep_intake_scope(
    new.source_portal_id,
    new.source_portal,
    new.source_url,
    new.source_route,
    new.review_queue,
    new.parent_store_slug,
    new.parent_store_name,
    new.partner_admin_email,
    new.approval_owner_email,
    new.review_admin_code,
    new.review_admin_name,
    new.parent_rep_or_admin_name,
    new.store_type,
    new.store_brand_name,
    new.internal_notes
  ) then
    new.source_portal_id = 'aactivated';
    new.source_portal = coalesce(nullif(new.source_portal, ''), 'AACTIVATEDRX');
    new.source_route = coalesce(nullif(new.source_route, ''), '/AACTIVATED/rep-intake');
    new.parent_store_slug = 'aactivated';
    new.parent_store_name = 'AACTIVATEDRX';
    new.partner_admin_email = 'guy@aactivated.com';
    new.approval_owner_email = 'guy@aactivated.com';
    new.approval_status = coalesce(nullif(new.approval_status, ''), 'pending');
    new.review_queue = 'aactivated';
    new.review_admin_code = coalesce(nullif(new.review_admin_code, ''), 'GUY60');
    new.review_admin_name = coalesce(nullif(new.review_admin_name, ''), 'Guy Griffithe - GUY60');
    new.internal_notes = coalesce(
      nullif(new.internal_notes, ''),
      'AACTIVATED_REP_INTAKE: Routed to AACTIVATED review queue.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_aactivated_rep_intake_scope_trigger
on public.rep_store_intake_submissions;

create trigger normalize_aactivated_rep_intake_scope_trigger
before insert or update on public.rep_store_intake_submissions
for each row
execute function public.normalize_aactivated_rep_intake_scope();

update public.rep_store_intake_submissions
set
  source_portal_id = 'aactivated',
  source_portal = coalesce(nullif(source_portal, ''), 'AACTIVATEDRX'),
  source_route = coalesce(nullif(source_route, ''), '/AACTIVATED/rep-intake'),
  parent_store_slug = 'aactivated',
  parent_store_name = 'AACTIVATEDRX',
  partner_admin_email = 'guy@aactivated.com',
  approval_owner_email = 'guy@aactivated.com',
  approval_status = coalesce(nullif(approval_status, ''), 'pending'),
  review_queue = 'aactivated',
  review_admin_code = coalesce(nullif(review_admin_code, ''), 'GUY60'),
  review_admin_name = coalesce(nullif(review_admin_name, ''), 'Guy Griffithe - GUY60'),
  internal_notes = coalesce(
    nullif(internal_notes, ''),
    'AACTIVATED_REP_INTAKE: Routed to AACTIVATED review queue.'
  )
where lower(trim(coalesce(full_name, ''))) = 'paul hourani'
   or public.is_aactivated_rep_intake_scope(
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
   );

drop policy if exists "admin_manage_rep_store_intake" on public.rep_store_intake_submissions;
create policy "admin_manage_rep_store_intake"
on public.rep_store_intake_submissions
for all
to authenticated
using (
  public.is_current_profile_platform_admin()
  or (
    public.is_current_profile_aactivated_admin()
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
)
with check (
  public.is_current_profile_platform_admin()
  or (
    public.is_current_profile_aactivated_admin()
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
);
