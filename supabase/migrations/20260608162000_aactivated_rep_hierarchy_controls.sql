-- Allow AACTIVATEDRX partner ops admins to manage scoped rep hierarchy.
-- Parent assignments remain inside the AACTIVATEDRX rep tree.

create index if not exists reps_aactivated_parent_rep_id_idx
  on public.reps(parent_rep_id)
  where lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX';

drop policy if exists "rx plus admins update aactivated reps" on public.reps;
drop policy if exists "aactivated ops update scoped reps" on public.reps;

create policy "aactivated ops update scoped reps"
  on public.reps for update
  to authenticated
  using (
    public.is_aactivated_partner_ops_admin()
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
  )
  with check (
    public.is_aactivated_partner_ops_admin()
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
    and upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
    and coalesce(rep_tier, '') <> ''
    and (
      parent_rep_id is null
      or parent_rep_id <> id
    )
    and (
      parent_rep_id is null
      or exists (
        select 1
        from public.reps parent
        where parent.id = reps.parent_rep_id
          and lower(coalesce(parent.custom_store_slug, '')) = 'aactivated'
          and upper(coalesce(parent.brand_name, '')) = 'AACTIVATEDRX'
          and parent.active = true
      )
    )
  );
