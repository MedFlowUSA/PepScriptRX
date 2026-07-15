-- Align Ginto Wellness Labs storefront pricing with the main PepScriptRX platform catalog.

with main_platform_price(product_sku, main_product_id) as (
  values
    ('RXP-GLP-RETA-15', 'retatrutide'),
    ('RXP-GLP-TIRZ-30', 'tirzepatide-30'),
    ('RXP-GLP-TIRZ-60', 'tirzepatide-60'),
    ('RXP-GLP-SEMA-10', 'semaglutide-10'),
    ('RXP-REC-BPC157-10', 'bpc-157-10mg'),
    ('RXP-REC-TB500-10', 'tb-500-10mg'),
    ('RXP-REC-WOLV', 'wolverine-stack'),
    ('RXP-GROW-CJCIPA-10', 'cjc-ipamorelin-10mg'),
    ('RXP-LONG-NAD-1000', 'nad-plus'),
    ('RXP-REC-GHKCU-100', 'ghk-cu-100mg')
),
resolved_price as (
  select
    rx.id as rx_product_id,
    p.price
  from main_platform_price m
  join public.products p on p.id = m.main_product_id
  join public.rx_plus_products rx on upper(rx.sku) = upper(m.product_sku)
)
update public.distributor_products dp
set
  custom_price = rp.price,
  custom_retail_price = rp.price,
  updated_at = now()
from public.distributors d
join resolved_price rp on true
where d.slug = 'ginto'
  and dp.distributor_id = d.id
  and dp.product_id = rp.rx_product_id;
