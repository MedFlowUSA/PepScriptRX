-- Release all paid orders by default and mirror the full active catalog into Ginto.

alter table public.patient_submissions
  alter column payment_release_policy set default 'released';

update public.patient_submissions
set payment_release_policy = 'released'
where payment_release_policy in ('paid_hold', 'manual_release');

with ginto_distributor as (
  select id
  from public.distributors
  where slug = 'ginto'
  limit 1
),
catalog as (
  select
    p.id,
    coalesce(p.retail_price, p.suggested_retail_price) as retail_price,
    row_number() over (order by p.category, p.product_name, p.strength, p.sku) as sort_rank
  from public.rx_plus_products p
  where coalesce(p.active, true) = true
)
insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate
)
select
  g.id,
  c.id,
  true,
  true,
  c.retail_price,
  c.retail_price,
  c.sort_rank <= 8,
  0.50
from catalog c
cross join ginto_distributor g
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
  updated_at = now();

insert into public.product_intelligence_store_visibility (
  product_key,
  store_key,
  store_name,
  visible,
  source
)
select
  p.product_key,
  'ginto',
  'Ginto Wellness Labs',
  true,
  'full_catalog'
from public.product_intelligence_products p
where p.active_status = 'active'
on conflict (product_key, store_key) do update set
  store_name = excluded.store_name,
  visible = true,
  source = excluded.source;
