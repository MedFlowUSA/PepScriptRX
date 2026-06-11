-- Resolve rep/store catalog products to main-account inventory when an exact
-- main inventory counterpart exists.

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
    when haystack like '%glow%' or haystack like '%glom%' then 'RXP-MAIN-GLOW-GLOM-70'
    when haystack like '%glutathione%' and haystack ~ '(^|[^0-9])1500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GLUTA-1500'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])240[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])24[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-240IU-KIT'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])100[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])10[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-100IU-KIT'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-IPA-5'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' or strength_text = 'standard') then 'RXP-MAIN-IPA-10'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-10'
    when haystack like '%tesamorelin%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TESA-10'
    when (haystack like '%wolverine%' or (haystack like '%bpc%' and haystack like '%tb%')) and haystack like '%blend%' then 'RXP-MAIN-WOLVERINE-20'
    else null
  end
  from normalized;
$$;

grant execute on function public.resolve_main_inventory_sku(text, text, text, text) to anon, authenticated;

create or replace view public.public_inventory_status as
with product_rows as (
  select
    'products'::text as catalog_source,
    p.id::text as product_id,
    coalesce(ii.sku, pi.sku, public.resolve_main_inventory_sku(pi.sku, p.name, null, p.category))::text as sku,
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
      or upper(ii.sku) = upper(public.resolve_main_inventory_sku(pi.sku, p.name, null, p.category))
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
    coalesce(ii.sku, pi.sku, p.sku, public.resolve_main_inventory_sku(coalesce(pi.sku, p.sku), p.product_name, p.strength, p.category))::text as sku,
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
      or upper(ii.sku) = upper(public.resolve_main_inventory_sku(coalesce(pi.sku, p.sku), p.product_name, p.strength, p.category))
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
      then 'Fulfillment may take up to ' || estimated_fulfillment_days || ' business days.'
    when inventory_matched and quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from status_rows;

grant select on public.public_inventory_status to anon, authenticated;

comment on function public.resolve_main_inventory_sku(text, text, text, text) is
  'Maps main and rep/store catalog labels to exact main-account inventory SKUs.';

comment on view public.public_inventory_status is
  'Public-safe inventory status projection. Storefront products are matched to exact main inventory aliases before deriving public stock notices.';
