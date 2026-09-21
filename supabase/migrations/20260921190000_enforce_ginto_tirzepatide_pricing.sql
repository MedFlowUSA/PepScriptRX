-- Keep Ginto Tirzepatide pricing authoritative from order creation through payment.

with requested(sku, price) as (
  values
    ('RXP-GLP-TIRZ-30', 199::numeric),
    ('RXP-GLP-TIRZ-60', 249::numeric)
)
update public.distributor_products dp
set
  custom_price = requested.price,
  custom_retail_price = requested.price,
  is_enabled = true,
  enabled = true,
  updated_at = now()
from public.distributors d
join public.rx_plus_products p on p.sku in ('RXP-GLP-TIRZ-30', 'RXP-GLP-TIRZ-60')
join requested on requested.sku = p.sku
where d.slug = 'ginto'
  and dp.distributor_id = d.id
  and dp.product_id = p.id;

-- A later checkout RPC replacement omitted Ginto from distributor resolution.
-- Patch the current definition in place so later storefront additions are preserved.
do $$
declare
  fn text;
  next_fn text;
  target_function regprocedure;
begin
  target_function := to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)');
  if target_function is null then
    target_function := to_regprocedure('public.create_public_patient_submission(jsonb)');
  end if;

  if target_function is null then
    raise exception 'Ginto checkout pricing RPC was not found';
  end if;

  select pg_get_functiondef(target_function)
  into fn;

  if position('then ''ginto''' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_store_hint like ''%anatolia%'' then ''anatolia''',
      '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''
    when v_store_hint like ''%anatolia%'' then ''anatolia'''
    );

    if next_fn = fn then
      raise exception 'Could not restore Ginto checkout catalog routing';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

create or replace function public.correct_ginto_tirzepatide_checkout_pricing()
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
  v_strength integer;
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
    new.brand_id,
    new.referral_code
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
    v_strength := null;

    if v_id = 'tirzepatide-60mg'
      or v_sku = 'RXP-GLP-TIRZ-60'
      or (v_name like '%tirzepatide%' and v_name like '%60%')
    then
      v_strength := 60;
    elsif v_id = 'tirzepatide-30mg'
      or v_sku = 'RXP-GLP-TIRZ-30'
      or (v_name like '%tirzepatide%' and v_name like '%30%')
    then
      v_strength := 30;
    end if;

    v_qty := case
      when coalesce(v_item->>'quantity', v_item->>'qty', '') ~ '^[0-9]+$'
        then greatest(1, least(20, coalesce(v_item->>'quantity', v_item->>'qty')::integer))
      else 1
    end;

    if v_strength is not null then
      v_price := case v_strength when 60 then 249 else 199 end;
      v_changed := true;
      v_next_item := v_item || jsonb_build_object(
        'id', format('tirzepatide-%smg', v_strength),
        'sku', format('RXP-GLP-TIRZ-%s', v_strength),
        'name', format('Tirzepatide %smg', v_strength),
        'display_name_at_purchase', format('Tirzepatide %smg', v_strength),
        'strength', format('%smg', v_strength),
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
    v_discount := case upper(coalesce(new.discount_code, ''))
      when 'BROOKS25' then round(v_subtotal * 0.25, 2)
      when 'EHWSUB10' then round(v_subtotal * 0.10, 2)
      when 'PEP10' then round(v_subtotal * 0.10, 2)
      when 'PORTAL10' then round(v_subtotal * 0.10, 2)
      when 'PSRX15' then round(v_subtotal * 0.15, 2)
      else least(greatest(coalesce(new.discount_amount, 0), 0), v_subtotal)
    end;
    v_shipping := greatest(coalesce(new.shipping_cost, 0), 0);
    new.discount_amount := v_discount;
    new.order_total := greatest(0, v_subtotal - v_discount) + v_shipping;
    new.amount_due_cents := round(new.order_total * 100)::integer;
    new.final_customer_paid_amount := new.order_total;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_ginto_tirzepatide60_price_guard on public.patient_submissions;
drop trigger if exists patient_submissions_ginto_tirzepatide_price_guard on public.patient_submissions;
create trigger patient_submissions_ginto_tirzepatide_price_guard
before insert or update of order_items, quoted_price, order_total, discount_code, discount_amount, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name
on public.patient_submissions
for each row
execute function public.correct_ginto_tirzepatide_checkout_pricing();

-- Re-run the guard for open Ginto Tirzepatide orders and invalidate stale provider references.
update public.patient_submissions ps
set
  order_items = ps.order_items,
  payment_status = 'unpaid',
  payment_provider = null,
  payment_reference = null,
  stripe_checkout_session_id = null,
  stripe_payment_status = null,
  updated_at = now()
where ps.payment_status <> 'paid'
  and jsonb_typeof(ps.order_items) = 'array'
  and lower(concat_ws(' ', ps.checkout_scope_code, ps.source_portal, ps.source_store, ps.store_slug, ps.store_name, ps.referral_code)) like '%ginto%'
  and exists (
    select 1
    from jsonb_array_elements(ps.order_items) item
    where lower(coalesce(item->>'id', '')) in ('tirzepatide-30mg', 'tirzepatide-60mg')
      or upper(coalesce(item->>'sku', '')) in ('RXP-GLP-TIRZ-30', 'RXP-GLP-TIRZ-60')
      or (lower(concat_ws(' ', item->>'name', item->>'display_name_at_purchase')) like '%tirzepatide%'
        and lower(concat_ws(' ', item->>'name', item->>'display_name_at_purchase', item->>'strength')) ~ '(30|60)')
  );
