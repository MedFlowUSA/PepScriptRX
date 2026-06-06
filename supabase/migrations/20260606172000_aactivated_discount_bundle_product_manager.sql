alter table public.aactivated_store_product_prices
  add column if not exists bundle_group_key text,
  add column if not exists bundle_group_name text,
  add column if not exists bundle_discount_percent numeric(5,2),
  add column if not exists bundle_discount_amount numeric(10,2),
  add column if not exists bundle_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aactivated_store_product_prices_bundle_percent_check'
  ) then
    alter table public.aactivated_store_product_prices
      add constraint aactivated_store_product_prices_bundle_percent_check
      check (bundle_discount_percent is null or (bundle_discount_percent >= 0 and bundle_discount_percent <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'aactivated_store_product_prices_bundle_amount_check'
  ) then
    alter table public.aactivated_store_product_prices
      add constraint aactivated_store_product_prices_bundle_amount_check
      check (bundle_discount_amount is null or bundle_discount_amount >= 0);
  end if;
end $$;

create index if not exists aactivated_store_product_prices_bundle_idx
  on public.aactivated_store_product_prices(store_slug, bundle_group_key)
  where bundle_group_key is not null;

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
     or old.product_note is distinct from new.product_note
     or old.bundle_group_key is distinct from new.bundle_group_key
     or old.bundle_group_name is distinct from new.bundle_group_name
     or old.bundle_discount_percent is distinct from new.bundle_discount_percent
     or old.bundle_discount_amount is distinct from new.bundle_discount_amount
     or old.bundle_note is distinct from new.bundle_note then
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
