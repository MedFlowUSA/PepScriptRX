create table if not exists public.aactivated_store_product_prices (
  id uuid primary key default gen_random_uuid(),
  store_slug text not null default 'aactivated',
  product_id text not null,
  product_name text,
  retail_price numeric(10,2) not null check (retail_price > 0),
  sale_price numeric(10,2) check (sale_price is null or sale_price > 0),
  is_active boolean not null default true,
  featured boolean not null default false,
  sort_order integer,
  product_note text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (store_slug, product_id)
);

alter table public.aactivated_store_product_prices
  add column if not exists product_name text,
  add column if not exists featured boolean not null default false,
  add column if not exists product_note text;

create index if not exists aactivated_store_product_prices_store_idx
  on public.aactivated_store_product_prices(store_slug);

create index if not exists aactivated_store_product_prices_product_idx
  on public.aactivated_store_product_prices(product_id);

create table if not exists public.aactivated_price_change_audit (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_name text,
  old_price numeric(10,2),
  new_price numeric(10,2) not null,
  store_scope text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

alter table public.aactivated_price_change_audit
  add column if not exists product_name text;

alter table public.aactivated_store_product_prices enable row level security;
alter table public.aactivated_price_change_audit enable row level security;

grant select on public.aactivated_store_product_prices to anon, authenticated;
grant insert, update on public.aactivated_store_product_prices to authenticated;
grant select on public.aactivated_price_change_audit to authenticated;
grant insert on public.aactivated_price_change_audit to authenticated;

create or replace function public.is_aactivated_price_admin()
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
      and lower(p.email) = 'guy@aactivated.com'
      and p.role = 'rx_plus_admin'
  );
$$;

drop policy if exists "admin manage aactivated store prices" on public.aactivated_store_product_prices;
create policy "admin manage aactivated store prices"
on public.aactivated_store_product_prices
for all
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.is_aactivated_price_admin()
    and store_slug = 'aactivated'
  )
)
with check (
  public.my_role() = 'admin'
  or (
    public.is_aactivated_price_admin()
    and store_slug = 'aactivated'
  )
);

drop policy if exists "public read active aactivated store prices" on public.aactivated_store_product_prices;
create policy "public read active aactivated store prices"
on public.aactivated_store_product_prices
for select
to anon, authenticated
using (store_slug = 'aactivated');

drop policy if exists "admin read aactivated price audit" on public.aactivated_price_change_audit;
create policy "admin read aactivated price audit"
on public.aactivated_price_change_audit
for select
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.is_aactivated_price_admin()
    and store_scope in ('aactivated', 'AACTIVATEDRX')
  )
);

drop policy if exists "admin insert aactivated price audit" on public.aactivated_price_change_audit;
create policy "admin insert aactivated price audit"
on public.aactivated_price_change_audit
for insert
to authenticated
with check (
  public.my_role() = 'admin'
  or (
    public.is_aactivated_price_admin()
    and store_scope in ('aactivated', 'AACTIVATEDRX')
  )
);

create or replace function public.audit_aactivated_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_effective numeric(10,2);
  new_effective numeric(10,2);
begin
  old_effective := case
    when tg_op = 'INSERT' then null
    else coalesce(old.sale_price, old.retail_price)
  end;
  new_effective := coalesce(new.sale_price, new.retail_price);

  if tg_op = 'INSERT'
     or old_effective is distinct from new_effective
     or old.is_active is distinct from new.is_active
     or old.featured is distinct from new.featured
     or old.sort_order is distinct from new.sort_order
     or old.product_note is distinct from new.product_note then
    insert into public.aactivated_price_change_audit (
      product_id,
      product_name,
      old_price,
      new_price,
      store_scope,
      changed_by,
      changed_at
    )
    values (
      new.product_id,
      coalesce(new.product_name, new.product_id),
      old_effective,
      new_effective,
      'AACTIVATEDRX',
      new.updated_by,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_aactivated_price_change_trigger on public.aactivated_store_product_prices;
create trigger audit_aactivated_price_change_trigger
after insert or update on public.aactivated_store_product_prices
for each row execute function public.audit_aactivated_price_change();
