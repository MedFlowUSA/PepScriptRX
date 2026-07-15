-- Align Ginto Wellness Labs storefront pricing with the main PepScriptRX platform catalog.

with main_platform_price(product_id, main_product_id) as (
  values
    ('retatrutide-15mg', 'retatrutide'),
    ('tirzepatide-30mg', 'tirzepatide-30'),
    ('tirzepatide-60mg', 'tirzepatide-60'),
    ('semaglutide-10mg', 'semaglutide-10'),
    ('bpc-157-10mg', 'bpc-157-10mg'),
    ('tb-500-10mg', 'tb-500-10mg'),
    ('wolverine-bpc-tb', 'wolverine-stack'),
    ('cjc-ipamorelin-10mg', 'cjc-ipamorelin-10mg'),
    ('nad-1000iu', 'nad-plus'),
    ('ghk-cu-100mg', 'ghk-cu-100mg')
),
resolved_price as (
  select
    m.product_id,
    p.price
  from main_platform_price m
  join public.products p on p.id = m.main_product_id
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
  and dp.product_id = rp.product_id;
