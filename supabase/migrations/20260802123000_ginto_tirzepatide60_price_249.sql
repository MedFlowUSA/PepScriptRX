-- Correct Ginto Tirzepatide 60mg pricing to $249.
update public.distributor_products dp
set
  custom_price = 249,
  custom_retail_price = 249,
  is_enabled = true,
  enabled = true,
  updated_at = now()
from public.distributors d
join public.rx_plus_products p on p.sku = 'RXP-GLP-TIRZ-60'
where d.slug = 'ginto'
  and dp.distributor_id = d.id
  and dp.product_id = p.id;
