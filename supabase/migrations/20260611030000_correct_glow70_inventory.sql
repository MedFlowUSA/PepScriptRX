-- Correct main Glow inventory naming and stock.
-- Supplier SKU is GLOW70. "GloM" was an entry error and should not appear in active labels.

create or replace function public.resolve_main_inventory_sku(
  product_sku text,
  product_name text,
  product_strength text,
  product_category text default null
)
returns text
language sql
immutable
as $$
  with normalized as (
    select
      lower(concat_ws(' ', product_sku, product_name, product_strength, product_category)) as haystack,
      lower(coalesce(product_name, '')) as name_text,
      lower(coalesce(product_strength, '')) as strength_text
  )
  select case
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])60[[:space:]-]*mg([^0-9]|$)' then 'TR60'
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])30[[:space:]-]*mg([^0-9]|$)' then 'TR30'
    when haystack like '%semaglutide%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'SM10'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])15[[:space:]-]*mg([^0-9]|$)' then 'RT15'
    when haystack like '%bac%' and haystack like '%water%' then 'WA10'
    when haystack like '%pen%' and haystack like '%kit%' then 'PNKIT'
    when haystack like '%cagrisema%' then 'RXP-MAIN-CAGRISEMA-48'
    when haystack like '%cjc%' and haystack like '%ipamorelin%' then 'RXP-MAIN-CJCIPA-10'
    when haystack like '%ghk%' and (haystack like '%100mg%' or haystack like '%100 mg%' or strength_text = 'standard') then 'RXP-MAIN-GHKCU-100'
    when haystack like '%glow%' then 'RXP-MAIN-GLOW70'
    when haystack like '%glutathione%' and haystack ~ '(^|[^0-9])1500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GLUTA-1500'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])240[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])24[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-240IU-KIT'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])100[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])10[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-100IU-KIT'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-IPA-5'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' or strength_text = 'standard') then 'RXP-MAIN-IPA-10'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-10'
    when haystack like '%tesamorelin%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TESA-10'
    when haystack like '%wolverine%' or haystack like '%bb20%' or haystack like '%bpc/tb%' or (haystack like '%bpc%' and haystack like '%tb%') then 'RXP-MAIN-WOLVERINE-20'
    else null
  end
  from normalized;
$$;

grant execute on function public.resolve_main_inventory_sku(text, text, text, text) to anon, authenticated;

insert into public.inventory_items (
  sku,
  product_name,
  strength,
  starting_qty,
  current_qty,
  base_total_cost,
  base_cost_per_vial,
  allocated_shipping_per_vial,
  allocated_label_per_vial,
  true_landed_cost_per_vial,
  retail_price,
  reorder_level,
  low_stock_threshold,
  stock_status,
  allow_special_order,
  estimated_fulfillment_days,
  customer_visible,
  sellable,
  admin_manageable,
  inventory_source,
  active,
  notes
)
values (
  'RXP-MAIN-GLOW70',
  'Glow Stack - 70 mg total',
  'Glow 70',
  8,
  8,
  219.00,
  21.90,
  2.19,
  1.10,
  25.19,
  179.00,
  3,
  3,
  'in_stock',
  true,
  14,
  true,
  true,
  true,
  'main',
  true,
  'Supplier match: GLOW70. Supplier box $219 / 10 vials. Landed cost uses 1.15 multiplier.'
)
on conflict (sku) do update
set
  product_name = excluded.product_name,
  strength = excluded.strength,
  current_qty = 8,
  stock_status = 'in_stock',
  active = true,
  customer_visible = true,
  sellable = true,
  admin_manageable = true,
  inventory_source = 'main',
  base_total_cost = excluded.base_total_cost,
  base_cost_per_vial = excluded.base_cost_per_vial,
  allocated_shipping_per_vial = excluded.allocated_shipping_per_vial,
  allocated_label_per_vial = excluded.allocated_label_per_vial,
  true_landed_cost_per_vial = excluded.true_landed_cost_per_vial,
  retail_price = excluded.retail_price,
  reorder_level = excluded.reorder_level,
  low_stock_threshold = excluded.low_stock_threshold,
  notes = excluded.notes,
  updated_at = now();

update public.inventory_items
set
  sku = 'ARCHIVED-GLOW70-' || left(id::text, 8),
  product_name = 'Archived Glow duplicate',
  strength = 'Archived',
  current_qty = 0,
  stock_status = 'hidden',
  active = false,
  customer_visible = false,
  sellable = false,
  admin_manageable = false,
  notes = 'Archived duplicate after GLOW70 correction.',
  updated_at = now()
where upper(sku) = 'RXP-MAIN-GLOW-GLOM-70'
   or product_name ilike '%glom%';

update public.product_intelligence_products
set
  sku = 'RXP-MAIN-GLOW70',
  product_name = 'Glow Stack',
  scientific_name = 'BPC-157 / TB-500 / GHK-Cu Blend',
  category = 'Glow / Beauty / Wellness',
  strength = '70 mg total',
  description = regexp_replace(coalesce(description, 'Glow blend, 70 mg total.'), 'GloM|BBG70|Glow/GloM|Glow / GloM', 'GLOW70', 'gi'),
  typical_use_case = 'Glow, beauty, and wellness blend.',
  updated_at = now()
where upper(sku) in ('RXP-MAIN-GLOW-GLOM-70', 'RXP-MAIN-GLOW70')
   or product_key in ('glow-glom-70mg', 'glow70')
   or product_name ilike '%glom%';

delete from public.product_intelligence_aliases
where product_key in ('glow-glom-70mg', 'glow70')
  and alias ilike '%glom%';

insert into public.product_intelligence_aliases (product_key, alias)
select p.product_key, alias_seed.alias
from public.product_intelligence_products p
cross join (
  values
    ('Glow Stack'),
    ('GLOW70'),
    ('Glow Peptide Blend')
) as alias_seed(alias)
where upper(p.sku) = 'RXP-MAIN-GLOW70'
on conflict do nothing;
