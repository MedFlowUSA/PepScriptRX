-- Keep BEASTMODE Performance Labs mapped to the complete active RX Plus catalog.
-- This is intentionally idempotent so new catalog items can be backfilled safely.

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  null,
  (
    row_number() over (order by p.product_name) <= 8
    or p.product_name ilike '%wolverine%'
    or p.product_name ilike '%bpc%'
    or p.product_name ilike '%tb-500%'
  ),
  0.4000
from public.distributors d
cross join public.rx_plus_products p
where d.slug = 'beastmode'
  and p.active = true
  and coalesce(p.visibility_type, 'public') in ('public', 'rx_plus')
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = 0.4000,
  updated_at = now();

do $$
begin
  if to_regclass('public.product_intelligence_store_visibility') is not null
     and to_regclass('public.product_intelligence_products') is not null then
    insert into public.product_intelligence_store_visibility (
      product_key,
      store_key,
      store_name,
      visible,
      source
    )
    select
      p.product_key,
      'beastmode',
      'BEASTMODE Performance Labs',
      coalesce(main_visible.visible, p.active_status = 'active'),
      'main_catalog_mirror'
    from public.product_intelligence_products p
    left join public.product_intelligence_store_visibility main_visible
      on main_visible.product_key = p.product_key
     and main_visible.store_key = 'main'
    where coalesce(main_visible.visible, p.active_status = 'active') = true
    on conflict (product_key, store_key) do update set
      store_name = excluded.store_name,
      visible = true,
      source = excluded.source;
  end if;
end $$;
