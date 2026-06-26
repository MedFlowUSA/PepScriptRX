-- Billy / OMGBILLY rep-only internal discount code.
-- REP50 is intentionally not a public customer promo. It applies only to REP_INTERNAL orders.

alter table public.patient_submissions
  add column if not exists promo_discount_percent numeric(5,2),
  add column if not exists promo_rep_slug text,
  add column if not exists commission_basis_amount numeric(10,2),
  add column if not exists final_customer_paid_amount numeric(10,2);

do $$
declare
  billy_rep_id uuid;
begin
  select id
    into billy_rep_id
  from public.reps
  where upper(rep_slug) = 'OMGBILLY'
    and active = true
  order by created_at desc
  limit 1;

  if billy_rep_id is null then
    raise exception 'Cannot create REP50 because active OMGBILLY rep was not found';
  end if;

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
    'OMGBILLY',
    null,
    'Billy REP50 Internal Purchase',
    'REP50',
    0,
    'percentage',
    50,
    'rep_internal',
    null,
    0,
    billy_rep_id,
    'OMGBILLY',
    'rep50-omgbilly-internal',
    'Rep-only internal purchase code for Billy / OMGBILLY. Requires REP_INTERNAL order_type; not valid for public customer checkout, customer commissions, or leaderboard credit.',
    false,
    'approved',
    now(),
    now()
  )
  on conflict (link_slug) do update set
    is_active = true,
    store_scope_code = excluded.store_scope_code,
    product_id = excluded.product_id,
    promo_title = excluded.promo_title,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    discount_type = excluded.discount_type,
    discount_percent = excluded.discount_percent,
    promo_kind = excluded.promo_kind,
    usage_limit = excluded.usage_limit,
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
  set
    promo_config = coalesce(promo_config, '{}'::jsonb)
      || jsonb_build_object(
        'internal_rep_discount_code', 'REP50',
        'internal_rep_discount_percent', 50,
        'internal_rep_discount_audience', 'rep_internal'
      ),
    internal_notes = trim(coalesce(internal_notes, '') || E'\nREP50 enabled as Billy / OMGBILLY rep-only internal purchase discount.'),
    updated_at = now()
  where rep_id = billy_rep_id
     or upper(coalesce(store_slug, '')) = 'OMGBILLY'
     or upper(coalesce(public_display_name, '')) = 'OMGBILLY';
end $$;

create or replace function public.apply_aactivated_server_promo_to_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_code text := upper(trim(coalesce(new.discount_code, '')));
  v_base_code text := split_part(upper(trim(coalesce(new.discount_code, ''))), '+', 1);
  v_order_type text := upper(coalesce(new.order_type, 'CUSTOMER_ORDER'));
  v_required_promo_kind text := case
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'REP_SAMPLE' then 'rep_sample'
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'REP_INTERNAL' then 'rep_internal'
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'WHOLESALE' then 'wholesale'
    else 'customer_discount'
  end;
  v_is_supported_store boolean;
  v_noncustomer_code_exists boolean := false;
  v_promo record;
  v_item jsonb;
  v_item_id text;
  v_qty numeric;
  v_price numeric;
  v_product_total numeric := greatest(0, coalesce(new.quoted_price, 0));
  v_eligible_total numeric := 0;
  v_discount numeric := null;
begin
  v_is_supported_store := (
    upper(coalesce(new.checkout_scope_code, '')) in (
      'AACTIVATED',
      'AACTIVATEDRX',
      'VITALITYINS',
      'GUY60',
      'ADONIS',
      'AAMIR',
      '2LEGIT',
      'WENDYCREATES54',
      'JUJUAN',
      'POWERS',
      'OMGBILLY',
      'BOSSIQUIT',
      'GLOW'
    )
    or upper(coalesce(new.source_portal, '')) like '%AACTIVATED%'
    or upper(coalesce(new.source_portal, '')) like '%VITALITY%'
    or upper(coalesce(new.source_portal, '')) like '%GLOW%'
    or upper(coalesce(new.source_store, '')) like '%AACTIVATED%'
    or upper(coalesce(new.source_store, '')) like '%VITALITY%'
    or upper(coalesce(new.source_store, '')) like '%GLOW%'
    or upper(coalesce(new.store_slug, '')) in ('AACTIVATED', 'GLOW')
    or upper(coalesce(new.store_name, '')) like '%AACTIVATED%'
    or upper(coalesce(new.store_name, '')) like '%GLOW%'
    or upper(coalesce(new.admin_code, '')) = 'GLOW'
    or upper(coalesce(new.source_admin, '')) = 'GLOW'
    or upper(coalesce(new.source_rep, '')) = 'GLOW'
  );

  if not v_is_supported_store or v_base_code = '' or v_base_code = 'BUNDLE' or v_product_total <= 0 then
    return new;
  end if;

  select *
  into v_promo
  from public.aactivated_promo_links p
  where upper(p.discount_code) = v_base_code
    and p.promo_kind = v_required_promo_kind
    and p.is_active = true
    and (p.starts_at is null or p.starts_at <= now())
    and (p.expires_at is null or p.expires_at > now())
    and (p.usage_limit is null or p.uses_count < p.usage_limit)
    and coalesce(p.min_subtotal, 0) <= v_product_total
    and (
      p.requires_platform_approval = false
      or p.approval_status = 'approved'
    )
  order by p.created_at desc
  limit 1
  for update;

  if not found then
    select exists (
      select 1
      from public.aactivated_promo_links p
      where upper(p.discount_code) = v_base_code
        and p.promo_kind in ('rep_sample', 'rep_internal', 'wholesale')
        and p.is_active = true
    )
    into v_noncustomer_code_exists;

    if v_order_type = 'CUSTOMER_ORDER' and (v_base_code like 'REP-%' or v_noncustomer_code_exists) then
      new.discount_amount := 0;
      new.discount_cents := 0;
      new.order_total := v_product_total + coalesce(new.shipping_cost, 0);
      new.amount_due_cents := round(new.order_total * 100)::integer;
      new.promo_discount_percent := null;
      new.promo_rep_slug := null;
      new.commission_basis_amount := v_product_total;
      new.final_customer_paid_amount := new.order_total;
    end if;

    return new;
  end if;

  if v_promo.product_id is null then
    v_eligible_total := v_product_total;
  else
    for v_item in select value from jsonb_array_elements(coalesce(new.order_items, '[]'::jsonb))
    loop
      v_item_id := coalesce(nullif(v_item->>'id', ''), nullif(v_item->>'product_id', ''));
      v_qty := greatest(1, coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'qty', '')::numeric, 1));
      v_price := greatest(0, coalesce(nullif(v_item->>'price', '')::numeric, 0));
      if v_item_id = v_promo.product_id then
        v_eligible_total := v_eligible_total + (v_price * v_qty);
      end if;
    end loop;
  end if;

  if v_eligible_total <= 0 then
    new.discount_amount := 0;
    new.discount_cents := 0;
    return new;
  end if;

  if v_promo.discount_type = 'percentage' then
    v_discount := v_eligible_total * (coalesce(v_promo.discount_percent, 0) / 100);
  else
    v_discount := coalesce(v_promo.discount_amount, 0);
  end if;

  v_discount := round(least(v_product_total, v_eligible_total, greatest(0, coalesce(v_discount, 0))), 2);

  new.discount_code := case
    when v_raw_code like '%+BUNDLE%' then v_promo.discount_code || '+BUNDLE'
    else v_promo.discount_code
  end;
  new.discount_amount := v_discount;
  new.order_total := greatest(0, v_product_total - v_discount) + coalesce(new.shipping_cost, 0);
  new.subtotal_cents := round((v_product_total + coalesce(new.shipping_cost, 0)) * 100)::integer;
  new.discount_cents := round(v_discount * 100)::integer;
  new.amount_due_cents := round(new.order_total * 100)::integer;
  new.promo_discount_percent := case when v_promo.discount_type = 'percentage' then v_promo.discount_percent else null end;
  new.promo_rep_slug := v_promo.rep_slug;
  new.commission_basis_amount := greatest(0, v_product_total - v_discount);
  new.final_customer_paid_amount := new.order_total;

  if tg_op = 'INSERT' then
    update public.aactivated_promo_links
    set uses_count = uses_count + 1,
        updated_at = now()
    where id = v_promo.id;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_aactivated_server_promo_trigger on public.patient_submissions;
create trigger patient_submissions_aactivated_server_promo_trigger
before insert or update of discount_code, order_items, quoted_price, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name, admin_code, source_admin, source_rep, order_type
on public.patient_submissions
for each row
execute function public.apply_aactivated_server_promo_to_submission();
