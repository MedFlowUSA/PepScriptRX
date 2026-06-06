create table if not exists public.partner_rep_commission_settings (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  partner_admin_id uuid,
  partner_admin_email text not null default 'guy@aactivated.com',
  rep_id uuid,
  rep_email text,
  commission_type text not null default 'flat_net_profit',
  commission_percent numeric(5,2) not null default 20 check (commission_percent >= 0),
  tier_config jsonb not null default '[]'::jsonb,
  override_percent numeric(5,2),
  special_note text,
  approval_required boolean not null default false,
  approval_status text not null default 'active',
  internal_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_scope, rep_id)
);

create table if not exists public.partner_product_lists (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  partner_admin_id uuid,
  partner_admin_email text not null default 'guy@aactivated.com',
  list_name text not null,
  list_type text not null default 'custom',
  default_pricing_mode text not null default 'aactivated_default',
  notes text,
  status text not null default 'active',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_product_list_items (
  id uuid primary key default gen_random_uuid(),
  product_list_id uuid not null references public.partner_product_lists(id) on delete cascade,
  store_scope text not null default 'AACTIVATEDRX',
  product_id text not null,
  product_name text not null,
  strength text,
  category text,
  retail_price numeric(10,2),
  is_visible boolean not null default true,
  sort_order integer not null default 1,
  pricing_mode text not null default 'aactivated_default',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_list_id, product_id)
);

create table if not exists public.partner_rep_store_settings (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  partner_admin_id uuid,
  partner_admin_email text not null default 'guy@aactivated.com',
  rep_id uuid,
  rep_email text,
  rep_name text,
  public_display_name text,
  store_slug text,
  storefront_path text,
  product_list_id uuid references public.partner_product_lists(id),
  product_list_name text,
  pricing_mode text not null default 'aactivated_default',
  features jsonb not null default '{}'::jsonb,
  promo_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  activated_at timestamptz,
  disabled_at timestamptz,
  internal_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_scope, rep_id)
);

create table if not exists public.partner_feature_requests (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  partner_admin_id uuid,
  partner_admin_email text not null default 'guy@aactivated.com',
  request_title text not null,
  priority text not null default 'medium',
  category text not null default 'Other',
  description text not null,
  status text not null default 'New',
  platform_admin_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_rep_setup_audit (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  actor_id uuid,
  actor_email text,
  action text not null,
  target_table text,
  target_id uuid,
  rep_id uuid,
  old_value jsonb,
  new_value jsonb,
  audit_notes text,
  created_at timestamptz not null default now()
);

alter table public.partner_rep_commission_settings enable row level security;
alter table public.partner_product_lists enable row level security;
alter table public.partner_product_list_items enable row level security;
alter table public.partner_rep_store_settings enable row level security;
alter table public.partner_feature_requests enable row level security;
alter table public.partner_rep_setup_audit enable row level security;

grant select, insert, update on public.partner_rep_commission_settings to authenticated;
grant select, insert, update, delete on public.partner_product_lists to authenticated;
grant select, insert, update, delete on public.partner_product_list_items to authenticated;
grant select, insert, update on public.partner_rep_store_settings to authenticated;
grant select, insert, update on public.partner_feature_requests to authenticated;
grant select, insert on public.partner_rep_setup_audit to authenticated;

create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        public.my_role() = 'admin'
        or (
          lower(p.email) = 'guy@aactivated.com'
          and p.role = 'rx_plus_admin'
        )
      )
  );
$$;

drop policy if exists "aactivated manage commission settings" on public.partner_rep_commission_settings;
create policy "aactivated manage commission settings"
on public.partner_rep_commission_settings
for all to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated manage product lists" on public.partner_product_lists;
create policy "aactivated manage product lists"
on public.partner_product_lists
for all to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated manage product list items" on public.partner_product_list_items;
create policy "aactivated manage product list items"
on public.partner_product_list_items
for all to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated manage rep stores" on public.partner_rep_store_settings;
create policy "aactivated manage rep stores"
on public.partner_rep_store_settings
for all to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated manage feature requests" on public.partner_feature_requests;
create policy "aactivated manage feature requests"
on public.partner_feature_requests
for all to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated read setup audit" on public.partner_rep_setup_audit;
create policy "aactivated read setup audit"
on public.partner_rep_setup_audit
for select to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());

drop policy if exists "aactivated insert setup audit" on public.partner_rep_setup_audit;
create policy "aactivated insert setup audit"
on public.partner_rep_setup_audit
for insert to authenticated
with check (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin());
