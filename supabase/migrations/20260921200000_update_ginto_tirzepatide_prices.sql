-- Update Ginto Tirzepatide pricing to 30mg at $249 and 60mg at $299.

with requested(sku, price) as (
  values
    ('RXP-GLP-TIRZ-30', 249::numeric),
    ('RXP-GLP-TIRZ-60', 299::numeric)
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

-- Preserve the existing guard and change only its authoritative price pair.
do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.correct_ginto_tirzepatide_checkout_pricing()'::regprocedure)
  into fn;

  next_fn := replace(
    fn,
    'case v_strength when 60 then 249 else 199 end',
    'case v_strength when 60 then 299 else 249 end'
  );

  if next_fn = fn then
    raise exception 'Could not update the Ginto Tirzepatide checkout price guard';
  end if;

  execute next_fn;
end $$;

-- Reprice open Ginto Tirzepatide orders and clear only their stale payment references.
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
