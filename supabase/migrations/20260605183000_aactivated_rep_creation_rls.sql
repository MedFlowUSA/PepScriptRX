drop policy if exists "rx plus admins insert aactivated reps" on public.reps;
create policy "rx plus admins insert aactivated reps"
  on public.reps for insert
  to authenticated
  with check (
    public.current_role() = 'rx_plus_admin'
    and public.current_profile_id() is not null
    and managed_by_profile_id = public.current_profile_id()
    and parent_rep_id = public.current_rx_plus_parent_rep_id()
    and rep_channel = 'aactivated_downline'
    and rep_tier = 'aactivated_rep'
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
    and exists (
      select 1
      from public.profiles p
      where p.id = public.current_profile_id()
        and lower(p.email) = 'guy@aactivated.com'
        and p.role = 'rx_plus_admin'
    )
  );

drop policy if exists "rx plus admins update aactivated reps" on public.reps;
create policy "rx plus admins update aactivated reps"
  on public.reps for update
  to authenticated
  using (
    public.current_role() = 'rx_plus_admin'
    and managed_by_profile_id = public.current_profile_id()
    and rep_channel = 'aactivated_downline'
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
    and exists (
      select 1
      from public.profiles p
      where p.id = public.current_profile_id()
        and lower(p.email) = 'guy@aactivated.com'
        and p.role = 'rx_plus_admin'
    )
  )
  with check (
    public.current_role() = 'rx_plus_admin'
    and managed_by_profile_id = public.current_profile_id()
    and parent_rep_id = public.current_rx_plus_parent_rep_id()
    and rep_channel = 'aactivated_downline'
    and rep_tier = 'aactivated_rep'
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
    and exists (
      select 1
      from public.profiles p
      where p.id = public.current_profile_id()
        and lower(p.email) = 'guy@aactivated.com'
        and p.role = 'rx_plus_admin'
    )
  );
