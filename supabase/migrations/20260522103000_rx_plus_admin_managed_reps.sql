create or replace function public.current_rx_plus_parent_rep_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.reps r
  where r.profile_id = public.current_profile_id()
    and r.parent_rep_id is null
  order by r.created_at asc
  limit 1
$$;

drop policy if exists "rx plus admins read managed reps" on public.reps;
create policy "rx plus admins read managed reps"
  on public.reps for select
  using (
    public.current_role() = 'rx_plus_admin'
    and (
      managed_by_profile_id = public.current_profile_id()
      or id = public.current_rx_plus_parent_rep_id()
    )
  );

drop policy if exists "rx plus admins insert managed reps" on public.reps;
create policy "rx plus admins insert managed reps"
  on public.reps for insert
  with check (
    public.current_role() = 'rx_plus_admin'
    and managed_by_profile_id = public.current_profile_id()
    and parent_rep_id = public.current_rx_plus_parent_rep_id()
    and rep_channel = 'rx_plus_downline'
  );

drop policy if exists "rx plus admins update managed reps" on public.reps;
create policy "rx plus admins update managed reps"
  on public.reps for update
  using (
    public.current_role() = 'rx_plus_admin'
    and managed_by_profile_id = public.current_profile_id()
  )
  with check (
    public.current_role() = 'rx_plus_admin'
    and managed_by_profile_id = public.current_profile_id()
    and parent_rep_id = public.current_rx_plus_parent_rep_id()
    and rep_channel = 'rx_plus_downline'
  );
