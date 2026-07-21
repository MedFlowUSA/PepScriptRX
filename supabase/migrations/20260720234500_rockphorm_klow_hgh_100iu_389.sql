-- Rock Phorm and KLOW share the Rock Phorm distributor catalog.
-- Keep the HGH / Somatropin 10 IU x 10, 100 IU total kit at $389 for both
-- storefronts without changing global/main-platform HGH pricing.

begin;

with rockphorm_hgh as (
  select p.id
  from public.rx_plus_products p
  where (
      upper(coalesce(p.sku, '')) = 'ROCKPHORM-HGH-SOMATROPIN'
      or lower(coalesce(p.id::text, '')) = 'rockphorm-hgh-somatropin'
      or (
        lower(concat_ws(' ', p.product_name, p.display_name, p.strength, p.sku, p.description)) like any (array['%hgh%', '%somatropin%'])
        and lower(concat_ws(' ', p.product_name, p.display_name, p.strength, p.sku, p.description)) like any (array['%100 iu%', '%100iu%', '%10 iu x 10%', '%10iu x 10%'])
        and (
          upper(coalesce(p.sku, '')) like 'ROCKPHORM-%'
          or lower(coalesce(p.partner_slug, '')) = 'rockphorm'
          or lower(coalesce(p.visibility_type, '')) = 'distributor_only'
        )
      )
    )
)
update public.rx_plus_products p
set
  product_name = 'HGH / Somatropin',
  display_name = 'HGH / Somatropin 10 IU x 10, 100 IU total',
  strength = '10 IU x 10, 100 IU total',
  suggested_retail_price = 389,
  retail_price = 389,
  active = true,
  visibility_type = coalesce(nullif(visibility_type, ''), 'distributor_only'),
  partner_visible = true,
  partner_slug = coalesce(nullif(partner_slug, ''), 'rockphorm'),
  description = 'HGH / Somatropin 10 IU x 10 kit, 100 IU total. Rock Phorm/KLOW catalog item. Availability, suitability, and fulfillment are subject to verification.',
  updated_at = now()
from rockphorm_hgh h
where p.id = h.id;

with rockphorm_hgh as (
  select p.id
  from public.rx_plus_products p
  where upper(coalesce(p.sku, '')) = 'ROCKPHORM-HGH-SOMATROPIN'
     or lower(coalesce(p.id::text, '')) = 'rockphorm-hgh-somatropin'
     or (
       lower(concat_ws(' ', p.product_name, p.display_name, p.strength, p.sku, p.description)) like any (array['%hgh%', '%somatropin%'])
       and lower(concat_ws(' ', p.product_name, p.display_name, p.strength, p.sku, p.description)) like any (array['%100 iu%', '%100iu%', '%10 iu x 10%', '%10iu x 10%'])
     )
)
update public.distributor_products dp
set
  is_enabled = true,
  enabled = true,
  custom_price = 389,
  custom_retail_price = 389,
  commission_rate = 0.65,
  updated_at = now()
from public.distributors d
join rockphorm_hgh h on true
where dp.distributor_id = d.id
  and dp.product_id = h.id
  and lower(coalesce(d.slug, '')) = 'rockphorm';

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
  d.id,
  p.id,
  true,
  true,
  389,
  389,
  true,
  0.65
from public.distributors d
join public.rx_plus_products p
  on upper(coalesce(p.sku, '')) = 'ROCKPHORM-HGH-SOMATROPIN'
where lower(coalesce(d.slug, '')) = 'rockphorm'
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = 389,
  custom_retail_price = 389,
  featured = true,
  commission_rate = 0.65,
  updated_at = now();

commit;
