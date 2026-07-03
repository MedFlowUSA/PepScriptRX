-- Promote REP50 to Guy's AACTIVATED rep program.
-- This makes REP50 the active 50% customer product discount for AACTIVATED reps.

do $$
declare
  guy_profile_id uuid;
  guy_rep_id uuid;
begin
  select id
    into guy_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = 'guy@aactivated.com'
     or lower(coalesce(owner_email, '')) = 'guy@aactivated.com'
     or upper(coalesce(admin_scope, '')) in ('AACTIVATEDRX', 'AACTIVATED', 'GUY60', 'VITALITYINS')
  order by
    case when lower(coalesce(email, '')) = 'guy@aactivated.com' then 0 else 1 end,
    created_at desc
  limit 1;

  select id
    into guy_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'GUY60'
     or lower(coalesce(payout_email, '')) = 'guy@aactivated.com'
     or (guy_profile_id is not null and profile_id = guy_profile_id)
  order by
    case when upper(coalesce(rep_slug, '')) = 'GUY60' then 0 else 1 end,
    created_at asc
  limit 1;

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
    'AACTIVATEDRX',
    null,
    'AACTIVATED REP50 Product Discount',
    'REP50',
    0,
    'percentage',
    50,
    'customer_discount',
    null,
    0,
    guy_rep_id,
    'GUY60',
    'rep50-aactivated-guy-reps',
    'Guy / AACTIVATEDRX customer-facing 50% product discount for AACTIVATED reps.',
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
    notes = trim(coalesce(notes, '') || E'\nSuperseded by AACTIVATED-wide REP50 product discount for Guy reps.'),
    updated_at = now()
  where upper(discount_code) = 'REP50'
    and promo_kind = 'customer_discount'
    and link_slug <> 'rep50-aactivated-guy-reps';

  update public.aactivated_promo_links
  set
    is_active = false,
    notes = trim(coalesce(notes, '') || E'\nNot customer-facing; superseded by AACTIVATED-wide REP50 product discount for Guy reps.'),
    updated_at = now()
  where upper(discount_code) = 'REP50'
    and promo_kind <> 'customer_discount';

  update public.reps
  set
    discount_code = 'REP50',
    discount_amount = 0,
    updated_at = now()
  where active = true
    and (
      upper(coalesce(rep_slug, '')) in ('GUY60', 'VITALITYINS')
      or upper(coalesce(custom_store_slug, '')) = 'AACTIVATED'
      or upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
      or upper(coalesce(rep_channel, '')) = 'AACTIVATED_DOWNLINE'
      or upper(coalesce(rep_tier, '')) = 'AACTIVATED_REP'
      or (guy_profile_id is not null and managed_by_profile_id = guy_profile_id)
      or (guy_rep_id is not null and parent_rep_id = guy_rep_id)
    );

  if to_regclass('public.partner_rep_store_settings') is not null then
    update public.partner_rep_store_settings
    set
      promo_config = coalesce(promo_config, '{}'::jsonb)
        || jsonb_build_object(
          'discount_code', 'REP50',
          'customer_discount_code', 'REP50',
          'customer_discount_percent', 50,
          'discount_audience', 'customer_product_discount'
        ),
      internal_notes = trim(coalesce(internal_notes, '') || E'\nREP50 enabled as the AACTIVATED 50% customer product discount for Guy reps.'),
      updated_at = now()
    where status = 'active'
      and (
        upper(coalesce(store_scope, '')) in ('AACTIVATEDRX', 'AACTIVATED', 'GUY60', 'VITALITYINS')
        or upper(coalesce(store_slug, '')) = 'AACTIVATED'
        or upper(coalesce(partner_admin_email, '')) = 'GUY@AACTIVATED.COM'
        or (guy_profile_id is not null and partner_admin_id = guy_profile_id)
        or (guy_rep_id is not null and rep_id in (
          select id
          from public.reps
          where active = true
            and (
              upper(coalesce(custom_store_slug, '')) = 'AACTIVATED'
              or upper(coalesce(brand_name, '')) = 'AACTIVATEDRX'
              or upper(coalesce(rep_channel, '')) = 'AACTIVATED_DOWNLINE'
              or parent_rep_id = guy_rep_id
              or managed_by_profile_id = guy_profile_id
            )
        ))
      );
  end if;
end $$;
