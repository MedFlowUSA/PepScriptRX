-- Keep AACTIVATED rep-store activation inside the AACTIVATED scope while
-- allowing scoped partner admins to create the rep, commission, and store rows.

update public.reps
set
  brand_id = 'aactivated',
  parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'aactivated'),
  assigned_store_slug = coalesce(nullif(assigned_store_slug, ''), 'aactivated'),
  custom_store_slug = coalesce(nullif(custom_store_slug, ''), 'aactivated')
where lower(coalesce(custom_store_slug, '')) = 'aactivated'
   or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
   or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
   or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
   or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
   or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS');

update public.partner_rep_commission_settings
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_product_lists
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_product_list_items
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_rep_store_settings
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_feature_requests
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_rep_setup_audit
set brand_id = 'aactivated'
where upper(coalesce(store_scope, '')) = 'AACTIVATEDRX';

update public.partner_store_settings
set brand_id = 'aactivated'
where lower(coalesce(store_slug, '')) = 'aactivated';

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
      and lower(coalesce(p.role, '')) in ('rx_plus_admin', 'partner_admin_full')
      and (
        lower(trim(coalesce(p.email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.brand_id, ''))) = 'aactivated'
        or upper(trim(coalesce(p.admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
        or lower(trim(coalesce(p.store_slug, ''))) in ('aactivated', 'aactivatedrx')
        or upper(coalesce(p.admin_scope, '') || ' ' || coalesce(p.store_slug, '')) like '%AACTIVATED%'
      )
  );
$$;

create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_current_profile_aactivated_admin()
    or public.is_platform_admin();
$$;

drop policy if exists "aactivated scoped admins insert partner reps" on public.reps;
create policy "aactivated scoped admins insert partner reps"
on public.reps
for insert
to authenticated
with check (
  public.is_current_profile_aactivated_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
);

drop policy if exists "aactivated scoped admins update partner reps" on public.reps;
create policy "aactivated scoped admins update partner reps"
on public.reps
for update
to authenticated
using (
  public.is_current_profile_aactivated_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
)
with check (
  public.is_current_profile_aactivated_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
  and (parent_rep_id is null or parent_rep_id <> id)
);

drop policy if exists "aactivated scoped admins manage commission settings" on public.partner_rep_commission_settings;
create policy "aactivated scoped admins manage commission settings"
on public.partner_rep_commission_settings
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins manage product lists" on public.partner_product_lists;
create policy "aactivated scoped admins manage product lists"
on public.partner_product_lists
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins manage product list items" on public.partner_product_list_items;
create policy "aactivated scoped admins manage product list items"
on public.partner_product_list_items
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins manage rep stores" on public.partner_rep_store_settings;
create policy "aactivated scoped admins manage rep stores"
on public.partner_rep_store_settings
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins manage feature requests" on public.partner_feature_requests;
create policy "aactivated scoped admins manage feature requests"
on public.partner_feature_requests
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins insert setup audit" on public.partner_rep_setup_audit;
create policy "aactivated scoped admins insert setup audit"
on public.partner_rep_setup_audit
for insert
to authenticated
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins read setup audit" on public.partner_rep_setup_audit;
create policy "aactivated scoped admins read setup audit"
on public.partner_rep_setup_audit
for select
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated scoped admins manage store settings" on public.partner_store_settings;
create policy "aactivated scoped admins manage store settings"
on public.partner_store_settings
for all
to authenticated
using (lower(store_slug) = 'aactivated' and public.is_aactivated_partner_ops_admin())
with check (lower(store_slug) = 'aactivated' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

grant execute on function public.is_current_profile_aactivated_admin() to authenticated;
grant execute on function public.is_aactivated_partner_ops_admin() to authenticated;
