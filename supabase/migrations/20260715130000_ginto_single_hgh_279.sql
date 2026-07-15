-- Ginto should offer only the 10 IU x 10, 100 IU total HGH / Somatropin kit at $279.

with ginto as (
  select id
  from public.distributors
  where slug = 'ginto'
  limit 1
),
hgh_products as (
  select
    id,
    upper(sku) as sku
  from public.rx_plus_products
  where lower(concat_ws(' ', product_name, display_name, strength, sku, description)) like any (array['%hgh%', '%somatropin%'])
)
update public.distributor_products dp
set
  is_enabled = h.sku = 'RXP-GROW-HGH-10',
  enabled = h.sku = 'RXP-GROW-HGH-10',
  custom_price = case when h.sku = 'RXP-GROW-HGH-10' then 279 else custom_price end,
  custom_retail_price = case when h.sku = 'RXP-GROW-HGH-10' then 279 else custom_retail_price end,
  updated_at = now()
from ginto g, hgh_products h
where dp.distributor_id = g.id
  and dp.product_id = h.id;
