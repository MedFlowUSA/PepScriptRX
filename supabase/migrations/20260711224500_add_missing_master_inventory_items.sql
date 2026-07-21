-- Add missing master inventory items from the 2026-07-11 inventory report.
-- Existing rows only receive quantity/status updates; inserted rows use neutral
-- cost/price defaults so catalog pricing and storefront configuration remain unchanged.

begin;

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
      lower(coalesce(product_strength, '')) as strength_text
  )
  select case
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])60[[:space:]-]*mg([^0-9]|$)' then 'TR60'
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])30[[:space:]-]*mg([^0-9]|$)' then 'TR30'
    when haystack like '%semaglutide%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'SM10'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])30[[:space:]-]*mg([^0-9]|$)' then 'RXP-GLP-RETA-30'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])20[[:space:]-]*mg([^0-9]|$)' then 'RXP-GLP-RETA-20'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])15[[:space:]-]*mg([^0-9]|$)' then 'RT15'
    when haystack like '%bac%' and haystack like '%water%' then 'WA10'
    when haystack like '%pen%' and haystack like '%kit%' then 'PNKIT'
    when haystack like '%cagrisema%' then 'RXP-MAIN-CAGRISEMA-48'
    when haystack like '%cagrilintide%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-GLP-CAGRI-10'
    when haystack like '%cjc%' and haystack like '%ipamorelin%' then 'RXP-MAIN-CJCIPA-10'
    when haystack like '%ghk%' and haystack ~ '(^|[^0-9])1000[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GHKCU-1000'
    when haystack like '%ghk%' and haystack ~ '(^|[^0-9])500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GHKCU-500'
    when haystack like '%ghk%' and (haystack like '%100mg%' or haystack like '%100 mg%' or strength_text = 'standard') then 'RXP-MAIN-GHKCU-100'
    when haystack like '%glow%' then 'RXP-MAIN-GLOW70'
    when haystack like '%glutathione%' and haystack ~ '(^|[^0-9])1500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GLUTA-1500'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])240[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])24[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-240IU-KIT'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])100[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])10[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-100IU-KIT'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-IPA-5'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' or strength_text = 'standard') then 'RXP-MAIN-IPA-10'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])40[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-40'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-10'
    when haystack like '%tesamorelin%' and haystack like '%ipamorelin%' and (haystack like '%10/5%' or (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)')) then 'RXP-MAIN-TESAIPA-10-5'
    when haystack like '%tesamorelin%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TESA-10'
    when haystack like '%wolverine%' or haystack like '%bb20%' or haystack like '%bpc/tb%' or (haystack like '%bpc%' and haystack like '%tb%') then 'RXP-MAIN-WOLVERINE-20'
    when haystack like '%bpc-157%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-REC-BPC157-10'
    when haystack like '%tb-500%' and haystack ~ '(^|[^0-9])15[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TB500-15'
    when haystack like '%tb-500%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-REC-TB500-10'
    when haystack like '%nad%' and haystack ~ '(^|[^0-9])1000[[:space:]-]*(mg|iu)([^0-9]|$)' then 'RXP-LONG-NAD-1000'
    when haystack like '%nad%' and haystack ~ '(^|[^0-9])500[[:space:]-]*(mg|iu)([^0-9]|$)' then 'RXP-LONG-NAD-500'
    when haystack like '%selank%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-NEU-SELANK-10'
    else null
  end
  from normalized;
$$;

grant execute on function public.resolve_main_inventory_sku(text, text, text, text) to anon, authenticated;

with report_counts (
  sku,
  product_name,
  strength,
  report_total_qty,
  location_breakdown
) as (
  values
    ('RT15', 'Retatrutide', '15 mg', 26, 'LA: 26'),
    ('TR30', 'Tirzepatide', '30 mg', 2, 'LA: 2'),
    ('SM10', 'Semaglutide', '10 mg', 20, 'Redlands: 20'),
    ('WA10', 'BAC Water', '10 mL', 129, 'LA: 37; Redlands: 92'),
    ('RXP-MAIN-WOLVERINE-20', 'Wolverine Stack / BB20', '20 mg blend', 38, 'LA Wolverine Stack: 20; LA BB20: 9; Redlands BB20 / Wolverine Stack: 9'),
    ('RXP-MAIN-GLOW70', 'Glow', '70 mg', 22, 'LA: 8; Redlands: 14'),
    ('RXP-MAIN-CJCIPA-10', 'CJC-1295 No DAC / Ipamorelin', '5 mg + 5 mg, 10 mg total', 10, 'LA: 10'),
    ('RXP-MAIN-GLUTA-1500', 'Glutathione', '1500 mg', 6, 'Redlands: 6'),
    ('RXP-MAIN-HGH-100IU-KIT', 'HGH Kit', '100 IU', 2, 'Redlands: 2'),
    ('RXP-MAIN-TESA-10', 'Tesamorelin', '10 mg', 5, 'Redlands: 5'),
    ('RXP-REC-BPC157-10', 'BPC-157', '10 mg', 10, 'Redlands: 10'),
    ('RXP-LONG-NAD-500', 'NAD+', '500 mg', 30, 'Redlands: 30'),
    ('RXP-LONG-NAD-1000', 'NAD+', '1000 mg', 1, 'Redlands: 1'),
    ('RXP-GLP-RETA-20', 'Retatrutide', '20 mg', 34, 'Redlands: 34'),
    ('RXP-GLP-RETA-30', 'Retatrutide', '30 mg', 6, 'Redlands: 6'),
    ('RXP-GLP-CAGRI-10', 'Cagrilintide', '10 mg', 10, 'Redlands: 10'),
    ('RXP-MAIN-TB500-15', 'TB-500', '15 mg', 30, 'Redlands: 30'),
    ('RXP-MAIN-GHKCU-1000', 'GHK-Cu', '1000 mg', 9, 'Redlands: 9'),
    ('RXP-MAIN-GHKCU-500', 'GHK-Cu', '500 mg', 19, 'Redlands: 19'),
    ('RXP-MAIN-TESAIPA-10-5', 'Tesamorelin / Ipamorelin', '10/5 mg', 8, 'Redlands: 8'),
    ('RXP-MAIN-MOTSC-40', 'MOTS-c', '40 mg', 8, 'Redlands: 8'),
    ('RXP-NEU-SELANK-10', 'Selank', '10 mg', 10, 'Redlands: 10')
)
insert into public.inventory_items (
  sku,
  product_name,
  strength,
  starting_qty,
  current_qty,
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
select
  sku,
  product_name,
  strength,
  report_total_qty,
  report_total_qty,
  3,
  3,
  case
    when report_total_qty <= 0 then 'special_order'
    when report_total_qty <= 3 then 'low_stock'
    else 'in_stock'
  end,
  true,
  14,
  true,
  true,
  true,
  'main',
  true,
  'Added from PepScriptRX master inventory report dated 2026-07-11. Location counts: ' || location_breakdown || '.'
from report_counts
on conflict (sku) do update
set
  current_qty = excluded.current_qty,
  stock_status = excluded.stock_status,
  updated_at = now();

create or replace view public.public_inventory_status as
with product_rows as (
  select
    'products'::text as catalog_source,
    p.id::text as product_id,
    coalesce(ii.sku, pi.sku, public.resolve_main_inventory_sku(pi.sku, concat_ws(' ', p.id::text, p.name), null, p.category))::text as sku,
    (ii.id is not null)::boolean as inventory_matched,
    coalesce(ii.current_qty, 0)::integer as quantity_on_hand,
    coalesce(ii.low_stock_threshold, ii.reorder_level, 3)::integer as low_stock_threshold,
    (p.status not in ('hidden', 'inactive') and coalesce(p.active, true))::boolean as active,
    (p.status not in ('hidden', 'inactive') and coalesce(p.customer_visible, true))::boolean as customer_visible,
    (p.status not in ('hidden', 'inactive') and coalesce(p.sellable, true) and coalesce(ii.sellable, true))::boolean as sellable,
    coalesce(ii.admin_manageable, p.admin_manageable, true)::boolean as admin_manageable,
    coalesce(ii.allow_special_order, p.allow_special_order, true)::boolean as allow_special_order,
    coalesce(ii.estimated_fulfillment_days, p.estimated_fulfillment_days, 14)::integer as estimated_fulfillment_days,
    ii.stock_status::text as stock_status
  from public.products p
  left join public.product_intelligence_products pi on pi.product_key = p.id::text
  left join lateral (
    select ii.*
    from public.inventory_items ii
    where ii.parent_product_id = p.id::text
      or (pi.sku is not null and upper(ii.sku) = upper(pi.sku))
      or upper(ii.sku) = upper(public.resolve_main_inventory_sku(pi.sku, concat_ws(' ', p.id::text, p.name), null, p.category))
    order by
      case
        when ii.parent_product_id = p.id::text then 0
        when pi.sku is not null and upper(ii.sku) = upper(pi.sku) then 1
        else 2
      end,
      ii.updated_at desc
    limit 1
  ) ii on true
),
rx_plus_rows as (
  select
    'rx_plus_products'::text as catalog_source,
    p.id::text as product_id,
    coalesce(ii.sku, pi.sku, p.sku, public.resolve_main_inventory_sku(coalesce(pi.sku, p.sku), concat_ws(' ', p.id::text, p.product_name), p.strength, p.category))::text as sku,
    (ii.id is not null)::boolean as inventory_matched,
    coalesce(ii.current_qty, 0)::integer as quantity_on_hand,
    coalesce(ii.low_stock_threshold, ii.reorder_level, 3)::integer as low_stock_threshold,
    coalesce(p.active, true)::boolean as active,
    coalesce(p.active, true)::boolean as customer_visible,
    (coalesce(p.active, true) and coalesce(ii.sellable, true))::boolean as sellable,
    coalesce(ii.admin_manageable, true)::boolean as admin_manageable,
    coalesce(ii.allow_special_order, true)::boolean as allow_special_order,
    coalesce(ii.estimated_fulfillment_days, 14)::integer as estimated_fulfillment_days,
    ii.stock_status::text as stock_status
  from public.rx_plus_products p
  left join public.product_intelligence_products pi on pi.product_key = p.id::text
  left join lateral (
    select ii.*
    from public.inventory_items ii
    where ii.parent_product_id = p.id::text
      or upper(ii.sku) = upper(coalesce(pi.sku, p.sku))
      or upper(ii.sku) = upper(public.resolve_main_inventory_sku(coalesce(pi.sku, p.sku), concat_ws(' ', p.id::text, p.product_name), p.strength, p.category))
    order by
      case
        when ii.parent_product_id = p.id::text then 0
        when upper(ii.sku) = upper(coalesce(pi.sku, p.sku)) then 1
        else 2
      end,
      ii.updated_at desc
    limit 1
  ) ii on true
),
status_rows as (
  select * from product_rows
  union all
  select * from rx_plus_rows
)
select
  catalog_source,
  product_id,
  sku,
  quantity_on_hand,
  low_stock_threshold,
  active,
  customer_visible,
  sellable,
  admin_manageable,
  allow_special_order,
  estimated_fulfillment_days,
  stock_status,
  case
    when not active or not customer_visible or not sellable or stock_status = 'hidden' then 'hidden'
    when not inventory_matched then 'in_stock'
    when stock_status in ('in_stock', 'low_stock', 'special_order') then stock_status
    when stock_status = 'out_of_stock' and not allow_special_order then 'out_of_stock'
    when quantity_on_hand <= 0 and allow_special_order then 'special_order'
    when quantity_on_hand <= 0 then 'out_of_stock'
    when quantity_on_hand <= low_stock_threshold then 'low_stock'
    else 'in_stock'
  end as display_stock_status,
  case
    when not active or not customer_visible or not sellable or stock_status = 'hidden' then 'Hidden'
    when not inventory_matched then 'Checkout Available'
    when stock_status = 'in_stock' then 'In Stock'
    when stock_status = 'low_stock' then 'Low Stock'
    when stock_status = 'special_order' then 'Out of Stock - Checkout Available'
    when stock_status = 'out_of_stock' and not allow_special_order then 'Out of Stock'
    when quantity_on_hand <= 0 and allow_special_order then 'Out of Stock - Checkout Available'
    when quantity_on_hand <= 0 then 'Out of Stock'
    when quantity_on_hand <= low_stock_threshold then 'Low Stock'
    else 'In Stock'
  end as display_stock_label,
  case
    when not active or not customer_visible or not sellable or stock_status = 'hidden' then false
    when stock_status = 'out_of_stock' and not allow_special_order then false
    else true
  end as checkout_allowed,
  case
    when inventory_matched
      and quantity_on_hand <= 0
      and allow_special_order
      and active
      and customer_visible
      and sellable
      and coalesce(stock_status, '') not in ('hidden', 'in_stock', 'low_stock')
      then true
    else false
  end as was_special_order,
  case
    when inventory_matched
      and quantity_on_hand <= 0
      and allow_special_order
      and active
      and customer_visible
      and sellable
      and coalesce(stock_status, '') not in ('hidden', 'in_stock', 'low_stock')
      then 'Out of stock - checkout available. Fulfillment timing will be confirmed after review.'
    when inventory_matched and quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from status_rows;

grant select on public.public_inventory_status to anon, authenticated;

comment on function public.resolve_main_inventory_sku(text, text, text, text) is
  'Maps main and rep/store catalog labels, including product IDs, to exact main-account inventory SKUs.';

comment on view public.public_inventory_status is
  'Public-safe inventory status projection. Storefront products are matched to exact main inventory aliases before deriving public stock notices.';

commit;
