-- Update Ginto to the requested visible catalog and price list.

with requested(sku, price) as (
  values
    ('RXP-GLP-RETA-20', 295::numeric),
    ('RXP-GLP-TIRZ-30', 249::numeric),
    ('RXP-GLP-TIRZ-60', 299::numeric),
    ('RXP-GLP-SEMA-10', 99::numeric),
    ('RXP-GLP-CAGRISEMA', 450::numeric),
    ('RXP-GLP-CAGRI-5', 220::numeric),
    ('RXP-GLP-AOD-5', 119::numeric),
    ('RXP-GLP-AOD-10', 199::numeric),
    ('RXP-GROW-HGH-10', 279::numeric),
    ('RXP-GROW-TESA-10', 229::numeric),
    ('RXP-GROW-CJCIPA-10', 149::numeric),
    ('RXP-GROW-MK677', 79::numeric),
    ('RXP-REC-WOLV', 149::numeric),
    ('RXP-REC-GLOW', 169::numeric),
    ('RXP-REC-KLOW', 169::numeric),
    ('RXP-REC-BPC157-10', 99::numeric),
    ('RXP-REC-TB500-10', 149::numeric),
    ('RXP-REC-GHKCU-100', 119::numeric),
    ('RXP-LONG-MOTSC-10', 129::numeric),
    ('RXP-LONG-NAD-500', 139::numeric),
    ('RXP-LONG-NAD-1000', 189::numeric),
    ('RXP-LONG-GLUTA-1500', 179::numeric),
    ('RXP-LONG-EPI-10', 99::numeric),
    ('RXP-LONG-SS31', 399::numeric),
    ('RXP-COG-SELANK', 89::numeric),
    ('RXP-COG-SEMAX', 89::numeric),
    ('RXP-COG-PT141', 129::numeric),
    ('RXP-GROW-IGF1-LR3-1', 199::numeric)
),
ginto_products as (
  select
    dp.id,
    requested.price
  from public.distributor_products dp
  join public.distributors d on d.id = dp.distributor_id
  join public.rx_plus_products p on p.id = dp.product_id
  left join requested on upper(requested.sku) = upper(p.sku)
  where d.slug = 'ginto'
)
update public.distributor_products dp
set
  is_enabled = ginto_products.price is not null,
  enabled = ginto_products.price is not null,
  custom_price = coalesce(ginto_products.price, dp.custom_price),
  custom_retail_price = coalesce(ginto_products.price, dp.custom_retail_price),
  updated_at = now()
from ginto_products
where dp.id = ginto_products.id;
