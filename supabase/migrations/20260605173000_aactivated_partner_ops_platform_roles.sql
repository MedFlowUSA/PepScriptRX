create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin')
        or (
          lower(p.email) = 'guy@aactivated.com'
          and p.role = 'rx_plus_admin'
        )
      )
  );
$$;
