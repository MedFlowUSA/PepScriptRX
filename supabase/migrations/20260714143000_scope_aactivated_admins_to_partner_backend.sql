-- Reassert that AACTIVATED admins are partner-scoped, not platform-global.
-- This keeps backend reads/writes limited to AACTIVATED store, reps, orders, and partner tools.

alter table public.profiles
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists brand_id text,
  add column if not exists partner_access_level text,
  add column if not exists access_scope text,
  add column if not exists global_admin boolean not null default false,
  add column if not exists super_admin boolean not null default false,
  add column if not exists can_view_all_brands boolean not null default false,
  add column if not exists can_view_all_reps boolean not null default false,
  add column if not exists can_view_all_orders boolean not null default false,
  add column if not exists can_view_all_customers boolean not null default false,
  add column if not exists can_edit_global_catalog boolean not null default false,
  add column if not exists can_edit_global_settings boolean not null default false,
  add column if not exists can_view_platform_financials boolean not null default false,
  add column if not exists can_view_other_partner_financials boolean not null default false;

update public.profiles
set
  role = 'partner_admin_full',
  brand_id = 'aactivated',
  partner_access_level = 'full',
  access_scope = 'brand_only',
  admin_scope = 'AACTIVATEDRX',
  store_slug = 'aactivated',
  owner_email = 'guy@aactivated.com',
  global_admin = false,
  super_admin = false,
  can_view_all_brands = false,
  can_view_all_reps = false,
  can_view_all_orders = false,
  can_view_all_customers = false,
  can_edit_global_catalog = false,
  can_edit_global_settings = false,
  can_view_platform_financials = false,
  can_view_other_partner_financials = false,
  updated_at = now()
where lower(trim(coalesce(email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
   or lower(trim(coalesce(owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
   or (
     upper(trim(coalesce(admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'GUY60', 'VITALITYINS')
     and lower(trim(coalesce(store_slug, ''))) in ('aactivated', 'aactivatedrx', '')
   );

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select id, 'aactivated', 'full', 'active'
from public.profiles
where brand_id = 'aactivated'
  and partner_access_level = 'full'
  and (
    lower(trim(coalesce(email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
    or lower(trim(coalesce(owner_email, ''))) = 'guy@aactivated.com'
    or upper(trim(coalesce(admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'GUY60', 'VITALITYINS')
  )
on conflict (profile_id, brand_id) do update set
  access_level = excluded.access_level,
  status = excluded.status;

create or replace function public.is_current_profile_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin();
$$;

grant execute on function public.is_current_profile_platform_admin() to authenticated;
