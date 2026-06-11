-- Main-account Wolverine Stack promo.
-- BEASTMODE is intentionally scoped to the main PepScriptRX checkout only.

update public.products
set
  name = 'Wolverine Stack / BB20 - BPC-157 + TB-500',
  price = 149,
  category = 'Recovery / Repair',
  status = 'manual_review',
  product_type = 'manual_review',
  requires_prescription_upload = false,
  requires_receipt_upload = false,
  requires_dob = true,
  requires_physician_review = false,
  customer_visible = true,
  active = true,
  sellable = true,
  display_note = 'BPC-157 10mg + TB-500 10mg blend. Eligible for BEASTMODE promo while active.',
  updated_at = now()
where id = 'wolverine-stack';

create or replace function public.apply_main_beastmode_wolverine_promo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(new.discount_code, '')));
  v_is_main boolean;
  v_product_total numeric := greatest(0, coalesce(new.quoted_price, 0));
  v_shipping numeric := greatest(0, coalesce(new.shipping_cost, 0));
  v_discount numeric := 0;
  v_has_wolverine boolean := false;
  v_item jsonb;
  v_haystack text;
  v_qty numeric;
  v_price numeric;
begin
  if v_code <> 'BEASTMODE' then
    return new;
  end if;

  v_is_main := (
    upper(coalesce(new.checkout_scope_code, '')) in ('', 'MAIN')
    and lower(coalesce(new.source_portal, 'main')) in ('', 'main', 'pepscriptrx')
    and nullif(trim(coalesce(new.source_store, '')), '') is null
    and nullif(trim(coalesce(new.store_slug, '')), '') is null
    and nullif(trim(coalesce(new.admin_code, '')), '') is null
    and nullif(trim(coalesce(new.source_admin, '')), '') is null
    and nullif(trim(coalesce(new.source_rep, '')), '') is null
    and lower(coalesce(new.account_type, 'main')) not in ('rep', 'sub_account', 'admin', 'partner')
  );

  for v_item in select value from jsonb_array_elements(coalesce(new.order_items, '[]'::jsonb))
  loop
    v_haystack := lower(concat_ws(
      ' ',
      v_item->>'id',
      v_item->>'sku',
      v_item->>'name',
      v_item->>'product_name',
      v_item->>'display_name_at_purchase',
      v_item->>'strength'
    ));

    if v_haystack = '' then
      continue;
    end if;

    if v_haystack like '%wolverine%'
      or v_haystack like '%bb20%'
      or v_haystack like '%bpc/tb%'
      or (v_haystack like '%bpc-157%' and v_haystack like '%tb-500%')
      or (v_haystack like '%bpc%' and v_haystack like '%tb%')
    then
      v_has_wolverine := true;
      v_qty := case
        when coalesce(v_item->>'quantity', v_item->>'qty', '') ~ '^[0-9]+(\.[0-9]+)?$'
          then greatest(1, coalesce(v_item->>'quantity', v_item->>'qty')::numeric)
        else 1
      end;
      v_price := case
        when coalesce(v_item->>'price', '') ~ '^[0-9]+(\.[0-9]+)?$'
          then greatest(0, (v_item->>'price')::numeric)
        else 0
      end;
      v_discount := v_discount + (greatest(0, v_price - 99) * v_qty);
    end if;
  end loop;

  v_haystack := lower(concat_ws(' ', new.product_id, new.product_name, new.medication));
  if not v_has_wolverine and (
    v_haystack like '%wolverine%'
    or v_haystack like '%bb20%'
    or v_haystack like '%bpc/tb%'
    or (v_haystack like '%bpc-157%' and v_haystack like '%tb-500%')
    or (v_haystack like '%bpc%' and v_haystack like '%tb%')
  ) then
    v_has_wolverine := true;
    v_discount := greatest(0, least(50, v_product_total - 99));
  end if;

  if not v_is_main or not v_has_wolverine or v_product_total <= 0 then
    new.discount_code := null;
    new.discount_amount := 0;
    new.discount_cents := 0;
    if new.status in ('payment_sent', 'paid', 'fulfilled') and v_product_total > 0 then
      new.order_total := v_product_total + v_shipping;
      new.amount_due_cents := round(new.order_total * 100)::integer;
      new.final_customer_paid_amount := new.order_total;
      new.commission_basis_amount := v_product_total;
    end if;
    return new;
  end if;

  if v_discount <= 0 and v_product_total >= 149 then
    v_discount := 50;
  end if;

  v_discount := round(least(v_product_total, greatest(0, v_discount)), 2);

  new.discount_code := 'BEASTMODE';
  new.discount_amount := v_discount;
  new.order_total := greatest(0, v_product_total - v_discount) + v_shipping;
  new.subtotal_cents := round((v_product_total + v_shipping) * 100)::integer;
  new.discount_cents := round(v_discount * 100)::integer;
  new.amount_due_cents := round(new.order_total * 100)::integer;
  new.commission_basis_amount := greatest(0, v_product_total - v_discount);
  new.final_customer_paid_amount := new.order_total;

  return new;
end;
$$;

drop trigger if exists patient_submissions_main_beastmode_promo_trigger on public.patient_submissions;
create trigger patient_submissions_main_beastmode_promo_trigger
before insert or update of discount_code, order_items, quoted_price, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, admin_code, source_admin, source_rep, account_type
on public.patient_submissions
for each row
execute function public.apply_main_beastmode_wolverine_promo();

comment on function public.apply_main_beastmode_wolverine_promo() is
  'Applies BEASTMODE only to main-account Wolverine Stack / BB20 checkout submissions.';
