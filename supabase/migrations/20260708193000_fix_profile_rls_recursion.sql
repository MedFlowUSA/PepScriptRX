-- Fix profile RLS recursion introduced by policies that call current_profile_id().
-- These helpers must bypass profile RLS or profile reads can recurse until Postgres
-- raises "stack depth limit exceeded" after a successful Supabase Auth login.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
     or p.id = auth.uid()
  order by
    case when p.auth_user_id = auth.uid() then 0 else 1 end,
    p.created_at desc
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = auth.uid()
     or p.id = auth.uid()
  order by
    case when p.auth_user_id = auth.uid() then 0 else 1 end,
    p.created_at desc
  limit 1
$$;

drop policy if exists "partner admins read brand profiles" on public.profiles;
create policy "partner admins read brand profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or auth_user_id = auth.uid()
  or id = public.current_profile_id()
  or public.is_platform_admin()
  or (
    public.partner_has_capability('rep_management')
    and lower(coalesce(brand_id, '')) = public.current_partner_brand_id()
  )
);

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_role() to authenticated;
