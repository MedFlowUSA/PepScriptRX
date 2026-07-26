-- Disable remaining Rock Phorm orphan pricing rows that have no rx_plus_products record.

update public.distributor_products
set
  is_enabled = false,
  enabled = false,
  updated_at = now()
where id in (
  'f546b35d-1580-41c1-b754-d1f8407c2cda',
  'c86a9d8d-cfb2-46de-9871-3561d0693909'
);
