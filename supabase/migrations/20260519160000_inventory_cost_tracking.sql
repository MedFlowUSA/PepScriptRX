-- PepScriptRX inventory, landed cost, and margin tracking.

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_name text not null,
  strength text,
  batch_no text,
  starting_qty integer not null default 0,
  current_qty integer not null default 0,
  base_total_cost numeric not null default 0,
  base_cost_per_vial numeric not null default 0,
  allocated_shipping_per_vial numeric not null default 0,
  allocated_label_per_vial numeric not null default 0,
  true_landed_cost_per_vial numeric not null default 0,
  retail_price numeric,
  reorder_level integer not null default 3,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  actor_profile_id uuid references profiles(id) on delete set null,
  adjustment_qty integer not null,
  reason text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_log (
  id uuid primary key default gen_random_uuid(),
  order_number text,
  submission_id uuid references patient_submissions(id) on delete set null,
  sold_at date not null default current_date,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  sku text,
  product_name text,
  qty_sold integer not null default 1,
  unit_cost numeric not null default 0,
  revenue numeric not null default 0,
  rep_id uuid references reps(id) on delete set null,
  rep_code text,
  payment_processing_fee numeric not null default 0,
  shipping_subsidy numeric not null default 0,
  ad_spend numeric not null default 0,
  refund_amount numeric not null default 0,
  profit numeric generated always as (
    coalesce(revenue, 0)
    - (coalesce(unit_cost, 0) * coalesce(qty_sold, 0))
    - coalesce(payment_processing_fee, 0)
    - coalesce(shipping_subsidy, 0)
    - coalesce(ad_spend, 0)
    - coalesce(refund_amount, 0)
  ) stored,
  created_at timestamptz not null default now()
);

alter table inventory_items enable row level security;
alter table inventory_adjustments enable row level security;
alter table sales_log enable row level security;

drop policy if exists "Admins can manage inventory items" on inventory_items;
create policy "Admins can manage inventory items"
on inventory_items
for all
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Fulfillment can view inventory items" on inventory_items;
create policy "Fulfillment can view inventory items"
on inventory_items
for select
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'fulfillment')));

drop policy if exists "Admins can manage inventory adjustments" on inventory_adjustments;
create policy "Admins can manage inventory adjustments"
on inventory_adjustments
for all
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage sales log" on sales_log;
create policy "Admins can manage sales log"
on sales_log
for all
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into inventory_items (
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
) values
  ('TR60', 'Tirzepatide', '60mg', 10, 10, 210, 21.00, 1.00, 0.50, 22.50, 249, 3, 'Initial supplier order. $60 shipping and $30 labeling allocated across 60 total vials.'),
  ('TR30', 'Tirzepatide', '30mg', 10, 10, 135, 13.50, 1.00, 0.50, 15.00, 199, 3, 'Initial supplier order. $1.50 overhead per vial.'),
  ('RT15', 'Retatrutide', '15mg', 20, 20, 140,  7.00, 1.00, 0.50,  8.50, 199, 4, 'Initial supplier order. $1.50 overhead per vial.'),
  ('SM10', 'Semaglutide', '10mg', 10, 10,  60,  6.00, 1.00, 0.50,  7.50, 129, 3, 'Initial supplier order. $1.50 overhead per vial.'),
  ('WA10', 'BAC Water', '10ml', 10, 10,   9,  0.90, 1.00, 0.50,  2.40,  12, 3, 'Usually bundled or used as an add-on.')
on conflict (sku) do update set
  product_name = excluded.product_name,
  strength = excluded.strength,
  starting_qty = excluded.starting_qty,
  current_qty = excluded.current_qty,
  base_total_cost = excluded.base_total_cost,
  base_cost_per_vial = excluded.base_cost_per_vial,
  allocated_shipping_per_vial = excluded.allocated_shipping_per_vial,
  allocated_label_per_vial = excluded.allocated_label_per_vial,
  true_landed_cost_per_vial = excluded.true_landed_cost_per_vial,
  retail_price = excluded.retail_price,
  reorder_level = excluded.reorder_level,
  notes = excluded.notes,
  updated_at = now();
