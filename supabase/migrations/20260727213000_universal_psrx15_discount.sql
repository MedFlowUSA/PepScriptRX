-- Universal PSRX15 customer discount.
-- Applies 15% to product subtotal on Main and every partner storefront.
-- Shipping remains undiscounted. Attribution and commission routing are unchanged.

alter table public.aactivated_promo_links
  add column if not exists discount_type text not null default 'fixed_amount',
  add column if not exists discount_percent numeric(5,2),
  add column if not exists promo_kind text not null default 'customer_discount',
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists usage_limit integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists rep_id uuid references public.reps(id) on delete set null,
  add column if not exists rep_slug text,
  add column if not exists min_subtotal numeric not null default 0,
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists requires_platform_approval boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

insert into public.aactivated_promo_links (
  is_active,
  store_scope_code,
  product_id,
  promo_title,
  discount_code,
  discount_amount,
  discount_type,
  discount_percent,
  promo_kind,
  starts_at,
  expires_at,
  usage_limit,
  uses_count,
  rep_id,
  rep_slug,
  link_slug,
  notes,
  requires_platform_approval,
  approval_status,
  approved_at,
  updated_at
)
values (
  true,
  'GLOBAL',
  null,
  'Universal PSRX15 Customer Discount',
  'PSRX15',
  0,
  'percentage',
  15,
  'customer_discount',
  null,
  null,
  null,
  0,
  null,
  null,
  'universal-psrx15',
  'Universal customer-facing 15% discount across Main and every partner storefront. Shipping is excluded. Attribution and commissions remain attached to the active checkout scope.',
  false,
  'approved',
  now(),
  now()
)
on conflict (link_slug) do update set
  is_active = true,
  store_scope_code = 'GLOBAL',
  product_id = null,
  promo_title = excluded.promo_title,
  discount_code = excluded.discount_code,
  discount_amount = 0,
  discount_type = 'percentage',
  discount_percent = 15,
  promo_kind = 'customer_discount',
  starts_at = null,
  expires_at = null,
  usage_limit = null,
  rep_id = null,
  rep_slug = null,
  notes = excluded.notes,
  requires_platform_approval = false,
  approval_status = 'approved',
  approved_at = coalesce(public.aactivated_promo_links.approved_at, now()),
  disabled_by = null,
  disabled_at = null,
  updated_at = now();

create or replace function public.apply_universal_psrx15_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_subtotal numeric := greatest(0, coalesce(new.quoted_price, 0));
  v_shipping numeric := greatest(0, coalesce(new.shipping_cost, 0));
begin
  if upper(trim(coalesce(new.discount_code, ''))) <> 'PSRX15' then
    return new;
  end if;

  if v_product_subtotal <= 0 then
    new.discount_amount := 0;
    new.promo_discount_percent := 15;
    return new;
  end if;

  new.discount_code := 'PSRX15';
  new.discount_amount := round(v_product_subtotal * 0.15, 2);
  new.order_total := greatest(0, v_product_subtotal - new.discount_amount) + v_shipping;
  new.amount_due_cents := round(new.order_total * 100)::integer;
  new.promo_discount_percent := 15;
  new.final_customer_paid_amount := new.order_total;
  return new;
end;
$$;

drop trigger if exists zz_apply_universal_psrx15_discount on public.patient_submissions;
create trigger zz_apply_universal_psrx15_discount
before insert or update of discount_code, quoted_price, shipping_cost, order_total
on public.patient_submissions
for each row
execute function public.apply_universal_psrx15_discount();

comment on function public.apply_universal_psrx15_discount() is
  'Applies the universal PSRX15 15% product-subtotal discount after store-specific pricing triggers; shipping and checkout attribution are preserved.';
