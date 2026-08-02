-- Guard Ginto Tirzepatide 60mg checkout pricing from stale client carts.
create or replace function public.correct_ginto_tirzepatide60_checkout_pricing()
returns trigger
language plpgsql
as $$
declare
  v_hint text;
  v_item jsonb;
  v_next_item jsonb;
  v_next_items jsonb := '[]'::jsonb;
  v_id text;
  v_sku text;
  v_name text;
  v_qty integer;
  v_price numeric;
  v_subtotal numeric := 0;
  v_changed boolean := false;
  v_discount numeric;
  v_shipping numeric;
begin
  v_hint := lower(concat_ws(' ',
    new.checkout_scope_code,
    new.source_portal,
    new.source_store,
    new.store_slug,
    new.store_name,
    new.brand_id
  ));

  if v_hint not like '%ginto%' or jsonb_typeof(new.order_items) <> 'array' then
    return new;
  end if;

  for v_item in select value from jsonb_array_elements(new.order_items)
  loop
    v_id := lower(coalesce(v_item->>'id', ''));
    v_sku := upper(coalesce(v_item->>'sku', ''));
    v_name := lower(concat_ws(' ',
      v_item->>'name',
      v_item->>'display_name_at_purchase',
      v_item->>'strength'
    ));

    v_qty := case
      when coalesce(v_item->>'quantity', v_item->>'qty', '') ~ '^[0-9]+$'
        then greatest(1, least(20, coalesce(v_item->>'quantity', v_item->>'qty')::integer))
      else 1
    end;

    if v_id = 'tirzepatide-60mg'
      or v_sku = 'RXP-GLP-TIRZ-60'
      or (v_name like '%tirzepatide%' and v_name like '%60%')
    then
      v_price := 249;
      v_changed := true;
      v_next_item := v_item || jsonb_build_object(
        'id', 'tirzepatide-60mg',
        'sku', 'RXP-GLP-TIRZ-60',
        'name', 'Tirzepatide 60mg',
        'display_name_at_purchase', 'Tirzepatide 60mg',
        'strength', '60mg',
        'category', coalesce(nullif(v_item->>'category', ''), 'GLP / Weight Management'),
        'price', v_price,
        'quantity', v_qty
      );
    else
      v_price := case
        when coalesce(v_item->>'price', '') ~ '^[0-9]+(\.[0-9]+)?$'
          then (v_item->>'price')::numeric
        else 0
      end;
      v_next_item := v_item || jsonb_build_object('quantity', v_qty);
    end if;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_next_items := v_next_items || jsonb_build_array(v_next_item);
  end loop;

  if v_changed then
    new.order_items := v_next_items;
    new.quoted_price := v_subtotal;
    v_discount := least(greatest(coalesce(new.discount_amount, 0), 0), v_subtotal);
    v_shipping := greatest(coalesce(new.shipping_cost, 0), 0);
    new.order_total := greatest(0, v_subtotal - v_discount) + v_shipping;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_ginto_tirzepatide60_price_guard on public.patient_submissions;
create trigger patient_submissions_ginto_tirzepatide60_price_guard
before insert or update of order_items, quoted_price, order_total, discount_amount, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name
on public.patient_submissions
for each row
execute function public.correct_ginto_tirzepatide60_checkout_pricing();

update public.patient_submissions
set
  order_items = order_items,
  payment_status = case when payment_status = 'paid' then payment_status else 'unpaid' end,
  payment_provider = case when payment_status = 'paid' then payment_provider else null end,
  payment_reference = case when payment_status = 'paid' then payment_reference else null end,
  stripe_checkout_session_id = case when payment_status = 'paid' then stripe_checkout_session_id else null end,
  stripe_payment_status = case when payment_status = 'paid' then stripe_payment_status else null end,
  updated_at = now()
where payment_status <> 'paid'
  and created_at > now() - interval '7 days'
  and (
    coalesce(store_slug, '') ilike '%ginto%'
    or coalesce(source_portal, '') ilike '%ginto%'
    or coalesce(checkout_scope_code, '') ilike '%ginto%'
  )
  and coalesce(medication, '') ilike '%tirz%'
  and coalesce(quoted_price, 0) >= 900;

update public.woocommerce_payment_sessions wps
set
  status = 'cancelled',
  consumed_at = coalesce(consumed_at, now()),
  error_category = 'ginto_tirzepatide60_repriced',
  updated_at = now()
from public.patient_submissions ps
where wps.submission_id = ps.id
  and ps.payment_status <> 'paid'
  and ps.created_at > now() - interval '7 days'
  and (
    coalesce(ps.store_slug, '') ilike '%ginto%'
    or coalesce(ps.source_portal, '') ilike '%ginto%'
    or coalesce(ps.checkout_scope_code, '') ilike '%ginto%'
  )
  and coalesce(ps.medication, '') ilike '%tirz%'
  and coalesce(wps.merchandise_subtotal_cents, wps.expected_amount_cents, 0) >= 90000
  and wps.status not in ('failed', 'declined', 'cancelled', 'expired', 'paid', 'captured');
