-- Remove the customer-facing/admin-facing phrase "special order" from inventory labels.
-- Internal status values remain unchanged for compatibility with checkout logic.

create or replace view public.public_inventory_status as
with product_rows as (
  select
    'products'::text as catalog_source,
    p.id::text as product_id,
    pi.sku::text as sku,
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
  left join public.inventory_items ii on upper(ii.sku) = upper(pi.sku)
),
rx_plus_rows as (
  select
    'rx_plus_products'::text as catalog_source,
    p.id::text as product_id,
    p.sku::text as sku,
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
  left join public.inventory_items ii on upper(ii.sku) = upper(coalesce(pi.sku, p.sku))
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
    when stock_status in ('in_stock', 'low_stock', 'special_order') then stock_status
    when stock_status = 'out_of_stock' and not allow_special_order then 'out_of_stock'
    when quantity_on_hand <= 0 and allow_special_order then 'special_order'
    when quantity_on_hand <= 0 then 'out_of_stock'
    when quantity_on_hand <= low_stock_threshold then 'low_stock'
    else 'in_stock'
  end as display_stock_status,
  case
    when not active or not customer_visible or not sellable or stock_status = 'hidden' then 'Hidden'
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
    when quantity_on_hand <= 0
      and allow_special_order
      and active
      and customer_visible
      and sellable
      and coalesce(stock_status, '') not in ('hidden', 'in_stock', 'low_stock')
      then true
    else false
  end as was_special_order,
  case
    when quantity_on_hand <= 0
      and allow_special_order
      and active
      and customer_visible
      and sellable
      and coalesce(stock_status, '') not in ('hidden', 'in_stock', 'low_stock')
      then 'Fulfillment may take up to ' || estimated_fulfillment_days || ' business days.'
    when quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from status_rows;

grant select on public.public_inventory_status to anon, authenticated;

comment on view public.public_inventory_status is
  'Public-safe inventory status projection. Exposes status only; cost and supplier details remain admin-only. Extended fulfillment notes are shown only when stock is depleted.';

create or replace function public.enrich_order_items_inventory_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_item_id text;
  v_item_sku text;
  v_status record;
  v_next_items jsonb := '[]'::jsonb;
begin
  if new.order_items is null or jsonb_typeof(new.order_items) <> 'array' then
    return new;
  end if;

  for v_item in select value from jsonb_array_elements(new.order_items)
  loop
    v_item_id := nullif(v_item->>'id', '');
    v_item_sku := upper(coalesce(nullif(v_item->>'sku', ''), ''));
    v_status := null;

    select *
    into v_status
    from public.public_inventory_status s
    where (v_item_id is not null and s.product_id = v_item_id)
      or (v_item_sku <> '' and upper(coalesce(s.sku, '')) = v_item_sku)
    order by case when s.catalog_source = 'rx_plus_products' then 0 else 1 end
    limit 1;

    if found then
      v_next_items := v_next_items || jsonb_build_array(
        v_item || jsonb_build_object(
          'display_name_at_purchase', coalesce(v_item->>'name', v_item->>'display_name', v_item_id, v_item_sku),
          'inventory_status_at_purchase', v_status.display_stock_status,
          'inventory_status_label_at_purchase', v_status.display_stock_label,
          'quantity_on_hand_at_purchase', v_status.quantity_on_hand,
          'low_stock_threshold_at_purchase', v_status.low_stock_threshold,
          'was_special_order', v_status.was_special_order,
          'estimated_fulfillment_days_at_purchase', v_status.estimated_fulfillment_days
        )
      );
    else
      v_next_items := v_next_items || jsonb_build_array(
        v_item || jsonb_build_object(
          'display_name_at_purchase', coalesce(v_item->>'name', v_item->>'display_name', v_item_id, v_item_sku),
          'inventory_status_at_purchase', 'special_order',
          'inventory_status_label_at_purchase', 'Out of Stock - Checkout Available',
          'quantity_on_hand_at_purchase', 0,
          'low_stock_threshold_at_purchase', 3,
          'was_special_order', false,
          'estimated_fulfillment_days_at_purchase', 14
        )
      );
    end if;
  end loop;

  new.order_items := v_next_items;
  return new;
end;
$$;

comment on function public.enrich_order_items_inventory_snapshot() is
  'Preserves inventory status, depletion flag, and fulfillment estimate on each checkout order item. Extended fulfillment notification is true only for confirmed depleted stock.';

update public.patient_submissions ps
set order_items = cleaned.order_items
from (
  select
    id,
    jsonb_agg(
      case
        when lower(coalesce(item->>'inventory_status_label_at_purchase', '')) = 'special order'
          then jsonb_set(item, '{inventory_status_label_at_purchase}', to_jsonb('Out of Stock - Checkout Available'::text), true)
        else item
      end
      order by ordinality
    ) as order_items
  from public.patient_submissions
  cross join lateral jsonb_array_elements(order_items) with ordinality as parts(item, ordinality)
  where order_items is not null
    and jsonb_typeof(order_items) = 'array'
  group by id
) cleaned
where ps.id = cleaned.id
  and ps.order_items::text ilike '%Special Order%';
