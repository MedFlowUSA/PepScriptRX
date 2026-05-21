-- PepScriptRX+ distributor portal skeleton.
-- This creates the persistence layer for expanded distributor catalogs, wholesale tiers,
-- and net-profit commission tracking. The first frontend pass uses seeded local data,
-- but these tables are ready for the next Supabase wiring step.

create table if not exists public.distributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  portal_name text not null,
  commission_rate numeric(5,4) not null default 0.6000,
  is_active boolean not null default true,
  white_label_enabled boolean not null default false,
  wholesale_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rx_plus_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null,
  strength text,
  sku text not null unique,
  suggested_retail_price numeric(10,2) not null,
  base_cost numeric(10,2) not null default 0,
  active boolean not null default true,
  visibility_type text not null default 'rx_plus'
    check (visibility_type in ('public','rx_plus','distributor_only','wholesale_only','invite_only')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributor_products (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  product_id uuid not null references public.rx_plus_products(id) on delete cascade,
  is_enabled boolean not null default true,
  custom_price numeric(10,2),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distributor_id, product_id)
);

create table if not exists public.wholesale_tiers (
  id uuid primary key default gen_random_uuid(),
  tier_name text not null unique,
  min_vials integer not null,
  max_vials integer,
  discount_type text not null default 'custom_quote',
  discount_value numeric(10,2),
  description text
);

create table if not exists public.rx_plus_orders (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references public.distributors(id),
  referral_slug text,
  gross_sale numeric(10,2) not null default 0,
  product_cost numeric(10,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  processing_fee numeric(10,2) not null default 0,
  discounts numeric(10,2) not null default 0,
  refunds numeric(10,2) not null default 0,
  net_profit numeric(10,2) generated always as (
    greatest(0, gross_sale - product_cost - shipping_cost - processing_fee - discounts - refunds)
  ) stored,
  distributor_commission numeric(10,2),
  platform_profit numeric(10,2),
  payout_status text not null default 'pending'
    check (payout_status in ('pending','payable','paid','reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.distributors (
  name, slug, portal_name, commission_rate, is_active, white_label_enabled, wholesale_enabled
) values (
  'Guy', 'guy', 'PepScriptRX+ Guy Portal', 0.6000, true, true, true
) on conflict (slug) do update set
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

insert into public.wholesale_tiers (tier_name, min_vials, max_vials, discount_type, discount_value, description)
values
  ('Tier 1 Partner', 10, 49, 'custom_quote', null, 'Entry wholesale access for approved partners.'),
  ('Tier 2 Distributor', 50, 99, 'custom_quote', null, 'Expanded distributor pricing and portal support.'),
  ('Tier 3 White Label', 100, 249, 'custom_quote', null, 'White-label-ready volume for approved accounts.'),
  ('Tier 4 Strategic Account', 250, null, 'custom_quote', null, 'Custom quote and strategic fulfillment planning.')
on conflict (tier_name) do update set
  min_vials = excluded.min_vials,
  max_vials = excluded.max_vials,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  description = excluded.description;

alter table public.distributors enable row level security;
alter table public.rx_plus_products enable row level security;
alter table public.distributor_products enable row level security;
alter table public.wholesale_tiers enable row level security;
alter table public.rx_plus_orders enable row level security;

drop policy if exists "Admins manage distributors" on public.distributors;
create policy "Admins manage distributors"
  on public.distributors for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage rx plus products" on public.rx_plus_products;
create policy "Admins manage rx plus products"
  on public.rx_plus_products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage distributor products" on public.distributor_products;
create policy "Admins manage distributor products"
  on public.distributor_products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage wholesale tiers" on public.wholesale_tiers;
create policy "Admins manage wholesale tiers"
  on public.wholesale_tiers for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage rx plus orders" on public.rx_plus_orders;
create policy "Admins manage rx plus orders"
  on public.rx_plus_orders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
