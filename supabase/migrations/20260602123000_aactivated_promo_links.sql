create table if not exists public.aactivated_promo_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  store_scope_code text not null default 'VITALITYINS',
  product_id text,
  promo_title text not null,
  discount_code text not null,
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  link_slug text not null unique,
  notes text
);

create index if not exists aactivated_promo_links_active_idx
  on public.aactivated_promo_links(is_active, link_slug);

create index if not exists aactivated_promo_links_scope_idx
  on public.aactivated_promo_links(store_scope_code);

alter table public.aactivated_promo_links enable row level security;

drop policy if exists "public_read_active_aactivated_promo_links" on public.aactivated_promo_links;
create policy "public_read_active_aactivated_promo_links"
on public.aactivated_promo_links for select
using (is_active = true);

drop policy if exists "admin_manage_aactivated_promo_links" on public.aactivated_promo_links;
create policy "admin_manage_aactivated_promo_links"
on public.aactivated_promo_links for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
);
