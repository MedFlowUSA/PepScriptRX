-- Make Billy / OMGBILLY REP50 a working customer-facing AACTIVATED promo.
-- Requested behavior: 50% promo code that works at checkout.

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
    raise exception 'Cannot activate REP50 because active OMGBILLY rep was not found';
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
    'Billy REP50 Customer Promo',
    'REP50',
    0,
    'percentage',
    50,
    'customer_discount',
    null,
    0,
    billy_rep_id,
    'OMGBILLY',
    'rep50-omgbilly-customer',
    'Billy / OMGBILLY customer-facing AACTIVATED 50% promo. Approved by support request.',
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
    promo_kind = 'customer_discount',
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

  update public.aactivated_promo_links
  set
    is_active = false,
    notes = trim(coalesce(notes, '') || E'\nSuperseded by customer-facing REP50 promo for Billy / OMGBILLY.'),
    updated_at = now()
  where upper(discount_code) = 'REP50'
    and promo_kind <> 'customer_discount';

  update public.reps
  set
    discount_code = 'REP50',
    discount_amount = 0,
    updated_at = now()
  where id = billy_rep_id;

  update public.partner_rep_store_settings
  set
    promo_config = coalesce(promo_config, '{}'::jsonb)
      || jsonb_build_object(
        'discount_code', 'REP50',
        'customer_discount_code', 'REP50',
        'customer_discount_percent', 50
      ),
    internal_notes = trim(coalesce(internal_notes, '') || E'\nREP50 changed to Billy / OMGBILLY customer-facing 50% AACTIVATED promo.'),
    updated_at = now()
  where rep_id = billy_rep_id
     or upper(coalesce(store_slug, '')) = 'OMGBILLY'
     or upper(coalesce(public_display_name, '')) = 'OMGBILLY';
end $$;
