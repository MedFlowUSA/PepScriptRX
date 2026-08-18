-- Narrow staging-drift repair for helper functions required by onboarding RLS.

alter table public.profiles
  add column if not exists brand_id text,
  add column if not exists store_slug text,
  add column if not exists email text,
  add column if not exists full_name text;

create or replace function public.is_current_profile_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and lower(coalesce(p.role, '')) in (
        'admin', 'platform_admin', 'master_admin', 'super_admin'
      )
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
    select 1 from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and lower(coalesce(p.role, '')) in (
        'admin', 'platform_admin', 'master_admin', 'super_admin',
        'rx_plus_admin', 'partner_admin_full'
      )
      and (
        lower(coalesce(p.brand_id, '')) = 'aactivated'
        or lower(trim(coalesce(p.email, ''))) in (
          'guy@aactivated.com', 'bossiquitinc@gmail.com'
        )
        or lower(coalesce(p.role, '')) in (
          'admin', 'platform_admin', 'master_admin', 'super_admin'
        )
      )
  );
$$;

grant execute on function public.is_current_profile_platform_admin() to authenticated;
grant execute on function public.is_current_profile_aactivated_admin() to authenticated;
