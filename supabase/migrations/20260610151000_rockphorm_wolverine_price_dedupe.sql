with rock as (
  select id
  from public.distributors
  where slug = 'rockphorm'
  limit 1
),
candidates as (
  select
    dp.id,
    row_number() over (
      order by coalesce(dp.custom_retail_price, dp.custom_price, p.retail_price, p.suggested_retail_price, 999999) asc,
               dp.updated_at desc
    ) as rn,
    min(coalesce(dp.custom_retail_price, dp.custom_price, p.retail_price, p.suggested_retail_price)) over () as canonical_price
  from public.distributor_products dp
  join rock on rock.id = dp.distributor_id
  join public.rx_plus_products p on p.id = dp.product_id
  where
    lower(coalesce(p.product_name, '') || ' ' || coalesce(p.display_name, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.description, '')) like '%wolverine%'
    or lower(coalesce(p.product_name, '') || ' ' || coalesce(p.display_name, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.description, '')) like '%bpc/tb%'
    or (
      lower(coalesce(p.product_name, '') || ' ' || coalesce(p.display_name, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.description, '')) like '%bpc-157%'
      and lower(coalesce(p.product_name, '') || ' ' || coalesce(p.display_name, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.description, '')) like '%tb-500%'
    )
    or lower(coalesce(p.sku, '')) like '%bb10%'
)
update public.distributor_products dp
set
  is_enabled = candidates.rn = 1,
  enabled = candidates.rn = 1,
  custom_price = candidates.canonical_price,
  custom_retail_price = candidates.canonical_price,
  updated_at = now()
from candidates
where dp.id = candidates.id
  and (select count(*) from candidates) > 1;
