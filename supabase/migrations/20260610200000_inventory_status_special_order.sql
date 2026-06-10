-- Inventory visibility and special-order checkout status.
-- Existing storefront pricing, distributor mappings, and promo logic remain intact.

alter table public.inventory_items
  add column if not exists quantity_on_hand integer generated always as (current_qty) stored,
  add column if not exists low_stock_threshold integer not null default 3,
  add column if not exists stock_status text,
  add column if not exists allow_special_order boolean not null default true,
  add column if not exists allow_backorder boolean generated always as (allow_special_order) stored,
  add column if not exists estimated_fulfillment_days integer not null default 14,
  add column if not exists customer_visible boolean not null default true,
  add column if not exists sellable boolean not null default true,
  add column if not exists admin_manageable boolean not null default true,
  add column if not exists inventory_source text not null default 'main',
  add column if not exists parent_product_id text;

alter table public.inventory_items
  drop constraint if exists inventory_items_stock_status_check;

alter table public.inventory_items
  add constraint inventory_items_stock_status_check
  check (
    stock_status is null
    or stock_status in ('in_stock', 'low_stock', 'special_order', 'out_of_stock', 'hidden')
  );

update public.inventory_items
set
  low_stock_threshold = coalesce(nullif(low_stock_threshold, 0), reorder_level, 3),
  estimated_fulfillment_days = coalesce(nullif(estimated_fulfillment_days, 0), 14),
  stock_status = coalesce(
    stock_status,
    case
      when current_qty <= 0 then 'out_of_stock'
      when current_qty <= coalesce(nullif(low_stock_threshold, 0), reorder_level, 3) then 'low_stock'
      else 'in_stock'
    end
  )
where true;

alter table public.products
  add column if not exists customer_visible boolean not null default true,
  add column if not exists active boolean not null default true,
  add column if not exists sellable boolean not null default true,
  add column if not exists admin_manageable boolean not null default true,
  add column if not exists allow_special_order boolean not null default true,
  add column if not exists estimated_fulfillment_days integer not null default 14,
  add column if not exists inventory_source text not null default 'main',
  add column if not exists parent_product_id text;

update public.products
set
  active = status not in ('hidden', 'inactive'),
  customer_visible = status not in ('hidden', 'inactive'),
  sellable = status not in ('hidden', 'inactive'),
  admin_manageable = true,
  allow_special_order = coalesce(allow_special_order, true),
  estimated_fulfillment_days = coalesce(nullif(estimated_fulfillment_days, 0), 14),
  inventory_source = coalesce(nullif(inventory_source, ''), 'main')
where true;

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
    when stock_status = 'special_order' then 'Special Order'
    when stock_status = 'out_of_stock' and not allow_special_order then 'Out of Stock'
    when quantity_on_hand <= 0 and allow_special_order then 'Special Order'
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
    when stock_status = 'special_order' then true
    when quantity_on_hand <= 0 and allow_special_order and active and customer_visible and sellable and coalesce(stock_status, '') <> 'hidden' then true
    else false
  end as was_special_order,
  case
    when stock_status = 'special_order' or (quantity_on_hand <= 0 and allow_special_order and active and customer_visible and sellable and coalesce(stock_status, '') <> 'hidden')
      then 'Fulfillment may take up to ' || estimated_fulfillment_days || ' business days.'
    when quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from product_rows
union all
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
    when stock_status = 'special_order' then 'Special Order'
    when stock_status = 'out_of_stock' and not allow_special_order then 'Out of Stock'
    when quantity_on_hand <= 0 and allow_special_order then 'Special Order'
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
    when stock_status = 'special_order' then true
    when quantity_on_hand <= 0 and allow_special_order and active and customer_visible and sellable and coalesce(stock_status, '') <> 'hidden' then true
    else false
  end as was_special_order,
  case
    when stock_status = 'special_order' or (quantity_on_hand <= 0 and allow_special_order and active and customer_visible and sellable and coalesce(stock_status, '') <> 'hidden')
      then 'Fulfillment may take up to ' || estimated_fulfillment_days || ' business days.'
    when quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold
      then 'Limited availability'
    else null
  end as status_message
from rx_plus_rows;

grant select on public.public_inventory_status to anon, authenticated;

comment on view public.public_inventory_status is
  'Public-safe inventory status projection. Exposes status only; cost and supplier details remain admin-only.';

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
          'inventory_status_label_at_purchase', 'Special Order',
          'quantity_on_hand_at_purchase', 0,
          'low_stock_threshold_at_purchase', 3,
          'was_special_order', true,
          'estimated_fulfillment_days_at_purchase', 14
        )
      );
    end if;
  end loop;

  new.order_items := v_next_items;
  return new;
end;
$$;

drop trigger if exists patient_submissions_inventory_snapshot on public.patient_submissions;
create trigger patient_submissions_inventory_snapshot
before insert or update of order_items on public.patient_submissions
for each row
execute function public.enrich_order_items_inventory_snapshot();

comment on function public.enrich_order_items_inventory_snapshot() is
  'Preserves inventory status, special-order flag, and fulfillment estimate on each checkout order item.';
