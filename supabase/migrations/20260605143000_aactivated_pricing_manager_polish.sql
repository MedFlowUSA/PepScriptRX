alter table public.aactivated_store_product_prices
  add column if not exists product_name text,
  add column if not exists featured boolean not null default false,
  add column if not exists product_note text;

alter table public.aactivated_price_change_audit
  add column if not exists product_name text;

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
