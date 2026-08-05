-- Give AACTIVATED full partner admins read-only Product Intelligence access
-- for products carried by the AACTIVATED storefront.

create or replace function public.can_read_aactivated_product_intelligence(target_product_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_aactivated_partner_ops_admin()
    and exists (
      select 1
      from public.product_intelligence_store_visibility v
      where v.product_key = target_product_key
        and lower(v.store_key) = 'aactivated'
        and v.visible = true
    );
$$;

drop policy if exists "aactivated admins read carried product intelligence products" on public.product_intelligence_products;
create policy "aactivated admins read carried product intelligence products"
on public.product_intelligence_products
for select
to authenticated
using (public.can_read_aactivated_product_intelligence(product_key));

drop policy if exists "aactivated admins read carried product intelligence aliases" on public.product_intelligence_aliases;
create policy "aactivated admins read carried product intelligence aliases"
on public.product_intelligence_aliases
for select
to authenticated
using (public.can_read_aactivated_product_intelligence(product_key));

drop policy if exists "aactivated admins read carried product intelligence visibility" on public.product_intelligence_store_visibility;
create policy "aactivated admins read carried product intelligence visibility"
on public.product_intelligence_store_visibility
for select
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and lower(store_key) = 'aactivated'
  and visible = true
);

comment on table public.product_intelligence_products is
  'Internal cost analysis. Main admins manage all rows; AACTIVATED full partner admins have read-only access only to products carried by the AACTIVATED storefront.';

grant execute on function public.can_read_aactivated_product_intelligence(text) to authenticated;
