-- Remove hard 14-day fulfillment copy from the public inventory status feed.
-- Depleted sellable products still show an out-of-stock checkout notice, but timing is confirmed after review.

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
      then 'Out of stock - checkout available. Fulfillment timing will be confirmed after review.'
    when inventory_matched and quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from status_rows;

grant select on public.public_inventory_status to anon, authenticated;

comment on view public.public_inventory_status is
  'Public-safe inventory status projection. Storefront products are matched to exact main inventory aliases before deriving public stock notices.';
