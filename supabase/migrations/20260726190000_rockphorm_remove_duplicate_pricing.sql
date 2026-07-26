-- Remove duplicate active Rock Phorm pricing rows while preserving audit history.
-- KLOW inherits Rock Phorm catalog pricing, so this keeps both storefronts on one
-- active price source for HGH / Somatropin and removes orphan price rows.

begin;

with rockphorm as (
  select id
  from public.distributors
  where lower(coalesce(slug, '')) = 'rockphorm'
  limit 1
),
canonical_hgh as (
  select p.id
  from public.rx_plus_products p
  where upper(coalesce(p.sku, '')) = 'ROCKPHORM-HGH-SOMATROPIN'
  limit 1
)
update public.distributor_products dp
set
  is_enabled = false,
  enabled = false,
  updated_at = now()
from rockphorm r
where dp.distributor_id = r.id
  and coalesce(dp.is_enabled, false) = true
  and coalesce(dp.enabled, true) = true
  and (
    not exists (
      select 1
      from public.rx_plus_products p
      where p.id = dp.product_id
    )
    or (
      exists (
        select 1
        from public.rx_plus_products p
        where p.id = dp.product_id
          and upper(coalesce(p.sku, '')) = 'RXP-GROW-HGH-10'
      )
      and exists (select 1 from canonical_hgh)
    )
  );

with rockphorm as (
  select id
  from public.distributors
  where lower(coalesce(slug, '')) = 'rockphorm'
  limit 1
),
canonical_hgh as (
  select p.id
  from public.rx_plus_products p
  where upper(coalesce(p.sku, '')) = 'ROCKPHORM-HGH-SOMATROPIN'
  limit 1
)
update public.distributor_products dp
set
  is_enabled = true,
  enabled = true,
  custom_price = 389,
  custom_retail_price = 389,
  featured = true,
  commission_rate = 0.65,
  updated_at = now()
from rockphorm r
join canonical_hgh h on true
where dp.distributor_id = r.id
  and dp.product_id = h.id;

commit;
