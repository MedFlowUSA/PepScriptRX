-- Make AACTIVATEDRX rep request access follow scoped profile metadata, not only exact emails.

alter table public.profiles
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text;

update public.profiles
set
  admin_scope = coalesce(nullif(admin_scope, ''), 'AACTIVATEDRX'),
  store_slug = coalesce(nullif(store_slug, ''), 'aactivated'),
  owner_email = coalesce(nullif(owner_email, ''), 'guy@aactivated.com')
where role = 'rx_plus_admin'
  and lower(trim(coalesce(email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com');

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
      and (
        lower(trim(coalesce(p.email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or upper(trim(coalesce(p.admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
        or lower(trim(coalesce(p.store_slug, ''))) in ('aactivated', 'aactivatedrx')
        or upper(coalesce(p.admin_scope, '') || ' ' || coalesce(p.store_slug, '')) like '%AACTIVATED%'
      )
  );
$$;
