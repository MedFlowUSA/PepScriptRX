-- Make Rock Phorm's enabled catalog explicitly eligible for KLOW card checkout.
alter table public.distributor_products
  add column if not exists processor_eligibility text not null default 'alternate_processor'
  check (processor_eligibility in ('stripe_approved', 'alternate_processor'));

update public.distributor_products dp
set processor_eligibility = 'stripe_approved',
    updated_at = now()
from public.distributors d, public.rx_plus_products p
where dp.distributor_id = d.id
  and dp.product_id = p.id
  and d.slug = 'rockphorm'
  and d.is_active = true
  and dp.is_enabled = true
  and p.active = true;

-- Rebecca's public storefront advertises a 30% preferred price. Apply it to the
-- authoritative server total before the order is inserted, rather than trusting
-- the browser-supplied total.
create or replace function public.apply_rebecca_klow_preferred_pricing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if upper(coalesce(new.checkout_scope_code, '')) = 'REBECCAKLOW'
     and lower(coalesce(new.store_slug, new.source_store, '')) = 'klow'
  then
    new.quoted_price := round(coalesce(new.quoted_price, 0) * 0.70, 2);
    new.order_total := greatest(
      0,
      round(new.quoted_price - coalesce(new.discount_amount, 0) + coalesce(new.shipping_cost, 0), 2)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists patient_submissions_rebecca_klow_pricing on public.patient_submissions;
create trigger patient_submissions_rebecca_klow_pricing
before insert on public.patient_submissions
for each row execute function public.apply_rebecca_klow_preferred_pricing();

-- The token finalizer originally recognized only public.products. KLOW uses
-- rx_plus_products through Rock Phorm's distributor catalog, so resolve that
-- catalog before failing closed.
do $$
declare
  fn text;
  next_fn text;
  old_block text := $patch$
    select processor_eligibility into v_eligibility from public.products where id=v_product_id;
    if coalesce(v_eligibility,'manual_review') <> 'stripe_approved' then
$patch$;
  new_block text := $patch$
    select processor_eligibility into v_eligibility from public.products where id=v_product_id;
    if not found then
      select dp.processor_eligibility into v_eligibility
      from public.distributor_products dp
      join public.distributors d on d.id = dp.distributor_id
      join public.rx_plus_products p on p.id = dp.product_id
      where p.id::text = v_product_id
        and dp.is_enabled = true
        and p.active = true
        and d.is_active = true
        and d.slug = case
          when upper(coalesce(v_order.checkout_scope_code, '')) in ('REBECCAKLOW', 'NIKKIKLOW')
            or lower(coalesce(v_order.store_slug, v_order.source_store, '')) = 'klow'
          then 'rockphorm'
          else lower(coalesce(v_order.store_slug, v_order.source_store, ''))
        end
      limit 1;
    end if;
    if coalesce(v_eligibility,'manual_review') <> 'stripe_approved' then
$patch$;
begin
  select pg_get_functiondef('public.finalize_stripe_token_order(text,text,text,uuid,integer,text,timestamptz,jsonb)'::regprocedure)
  into fn;
  if fn is null then raise exception 'finalize_stripe_token_order was not found'; end if;
  if position('join public.rx_plus_products p on p.id = dp.product_id' in fn) = 0 then
    next_fn := replace(fn, old_block, new_block);
    if next_fn = fn then raise exception 'Could not patch distributor Stripe eligibility finalizer'; end if;
    execute next_fn;
  end if;
end $$;

revoke all on function public.apply_rebecca_klow_preferred_pricing() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from public.distributor_products dp
    join public.distributors d on d.id = dp.distributor_id
    where d.slug = 'rockphorm'
      and dp.is_enabled = true
      and dp.processor_eligibility = 'stripe_approved'
  ) then
    raise exception 'Rock Phorm KLOW Stripe eligibility verification failed';
  end if;
end $$;
