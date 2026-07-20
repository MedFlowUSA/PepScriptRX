-- The P Lounge owner product discount.
-- REP60 is scoped to The P Lounge and applies 60% to the product subtotal.

do $$
declare
  lounge_rep_id uuid;
begin
  select id into lounge_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'THEPLOUNGE'
    and active = true
  order by created_at desc
  limit 1;

  if lounge_rep_id is null then
    raise exception 'Cannot activate REP60 because The P Lounge owner account was not found';
  end if;

  insert into public.aactivated_promo_links (
    is_active, store_scope_code, product_id, promo_title, discount_code,
    discount_amount, discount_type, discount_percent, promo_kind,
    usage_limit, uses_count, rep_id, rep_slug, link_slug, notes,
    requires_platform_approval, approval_status, approved_at, updated_at
  ) values (
    true, 'THEPLOUNGE', null, 'The P Lounge Owner REP60', 'REP60',
    0, 'percentage', 60, 'customer_discount',
    null, 0, lounge_rep_id, 'THEPLOUNGE', 'rep60-the-p-lounge-owner',
    'Owner-requested 60% product discount scoped exclusively to The P Lounge checkout.',
    false, 'approved', now(), now()
  )
  on conflict (link_slug) do update set
    is_active = true,
    store_scope_code = excluded.store_scope_code,
    product_id = null,
    promo_title = excluded.promo_title,
    discount_code = excluded.discount_code,
    discount_amount = 0,
    discount_type = 'percentage',
    discount_percent = 60,
    promo_kind = 'customer_discount',
    usage_limit = null,
    rep_id = excluded.rep_id,
    rep_slug = excluded.rep_slug,
    notes = excluded.notes,
    requires_platform_approval = false,
    approval_status = 'approved',
    approved_at = coalesce(public.aactivated_promo_links.approved_at, now()),
    disabled_by = null,
    disabled_at = null,
    updated_at = now();

  update public.partner_rep_store_settings
  set promo_config = coalesce(promo_config, '{}'::jsonb) || jsonb_build_object(
        'owner_discount_code', 'REP60',
        'owner_discount_percent', 60,
        'owner_discount_scope', 'THEPLOUNGE'
      ),
      internal_notes = trim(coalesce(internal_notes, '') || E'\nREP60 enabled as The P Lounge owner 60% product discount.'),
      updated_at = now()
  where rep_id = lounge_rep_id
     or lower(coalesce(store_slug, '')) = 'the-p-lounge';
end $$;

create or replace function public.apply_the_p_lounge_rep60_to_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := split_part(upper(trim(coalesce(new.discount_code, ''))), '+', 1);
  v_scope text := upper(coalesce(new.checkout_scope_code, ''));
  v_store_hint text := lower(concat_ws(' ', new.store_slug, new.store_name, new.source_store, new.source_portal));
  v_product_total numeric := greatest(0, coalesce(new.quoted_price, 0));
  v_discount numeric;
begin
  if v_code <> 'REP60'
     or not (v_scope = 'THEPLOUNGE' or v_store_hint like '%the-p-lounge%' or v_store_hint like '%the p lounge%')
     or v_product_total <= 0 then
    return new;
  end if;

  if not exists (
    select 1 from public.aactivated_promo_links p
    where upper(p.discount_code) = 'REP60'
      and upper(coalesce(p.store_scope_code, '')) = 'THEPLOUNGE'
      and p.promo_kind = 'customer_discount'
      and p.is_active = true
      and (p.starts_at is null or p.starts_at <= now())
      and (p.expires_at is null or p.expires_at > now())
      and (p.usage_limit is null or p.uses_count < p.usage_limit)
      and (p.requires_platform_approval = false or p.approval_status = 'approved')
  ) then
    return new;
  end if;

  v_discount := round(v_product_total * 0.60, 2);
  new.discount_code := case when upper(coalesce(new.discount_code, '')) like '%+BUNDLE%' then 'REP60+BUNDLE' else 'REP60' end;
  new.discount_amount := v_discount;
  new.order_total := greatest(0, v_product_total - v_discount) + coalesce(new.shipping_cost, 0);
  new.subtotal_cents := round((v_product_total + coalesce(new.shipping_cost, 0)) * 100)::integer;
  new.discount_cents := round(v_discount * 100)::integer;
  new.amount_due_cents := round(new.order_total * 100)::integer;
  new.promo_discount_percent := 60;
  new.promo_rep_slug := 'THEPLOUNGE';
  new.commission_basis_amount := greatest(0, v_product_total - v_discount);
  new.final_customer_paid_amount := new.order_total;

  if tg_op = 'INSERT' then
    update public.aactivated_promo_links
    set uses_count = uses_count + 1, updated_at = now()
    where upper(discount_code) = 'REP60'
      and upper(coalesce(store_scope_code, '')) = 'THEPLOUNGE'
      and promo_kind = 'customer_discount'
      and is_active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_the_p_lounge_rep60_trigger on public.patient_submissions;
create trigger patient_submissions_the_p_lounge_rep60_trigger
before insert or update of discount_code, quoted_price, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name
on public.patient_submissions
for each row
execute function public.apply_the_p_lounge_rep60_to_submission();
