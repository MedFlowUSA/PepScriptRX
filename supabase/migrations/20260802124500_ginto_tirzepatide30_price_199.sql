-- Correct Ginto Tirzepatide 30mg pricing to $199.
update public.distributor_products dp
set
  custom_price = 199,
  custom_retail_price = 199,
  is_enabled = true,
  enabled = true,
  updated_at = now()
from public.distributors d
join public.rx_plus_products p on p.sku = 'RXP-GLP-TIRZ-30'
where d.slug = 'ginto'
  and dp.distributor_id = d.id
  and dp.product_id = p.id;
