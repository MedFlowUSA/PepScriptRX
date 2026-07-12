-- Keep true global admins cross-store even if legacy profile attribution
-- fields are populated for login or audit context.

create or replace function public.is_platform_admin()
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
      and (
        lower(coalesce(p.role, '')) in ('master_admin', 'super_admin')
        or (
          lower(coalesce(p.role, '')) in ('admin', 'owner', 'platform_admin')
          and nullif(trim(coalesce(p.brand_id, '')), '') is null
          and nullif(trim(coalesce(p.store_slug, '')), '') is null
          and nullif(trim(coalesce(p.admin_scope, '')), '') is null
        )
      )
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(coalesce(p.role, '')) in ('master_admin', 'super_admin') then 'admin'
    when lower(coalesce(p.role, '')) in ('admin', 'owner', 'platform_admin')
      and nullif(trim(coalesce(p.brand_id, '')), '') is null
      and nullif(trim(coalesce(p.store_slug, '')), '') is null
      and nullif(trim(coalesce(p.admin_scope, '')), '') is null
      then 'admin'
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid() or p.auth_user_id = auth.uid()
  order by case when p.auth_user_id = auth.uid() then 0 else 1 end, p.created_at desc
  limit 1
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.my_role() to authenticated, anon;
