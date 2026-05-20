-- Seed reusable pen kit inventory for launch.

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
  notes
) values (
  'PNKIT',
  'Reusable Pen Kit',
  'Pen body, cartridge, and pen needles',
  20,
  20,
  0,
  0,
  0,
  0,
  0,
  19,
  5,
  'Initial reusable pen kit inventory. Update landed cost after supplier invoice is finalized.'
)
on conflict (sku) do update set
  product_name = excluded.product_name,
  strength = excluded.strength,
  starting_qty = excluded.starting_qty,
  current_qty = excluded.current_qty,
  retail_price = excluded.retail_price,
  reorder_level = excluded.reorder_level,
  notes = excluded.notes,
  active = true,
  updated_at = now();

insert into public.products (id, name, price, category, status, display_note, sort_order)
values (
  'pen-kit',
  'Reusable Pen Kit',
  19,
  'Supplies',
  'active',
  'Includes reusable pen body, cartridge, and pen needles. Multiple colors available.',
  5
)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note,
  sort_order = excluded.sort_order,
  updated_at = now();
