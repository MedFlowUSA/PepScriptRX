-- Rebecca Almanza KLOW friends-and-family customer promo.
-- Keep REBECCAKLOW as the attribution/scope code; BUDDY25 is customer discount only.

update public.reps
set
  brand_theme = coalesce(brand_theme, '{}'::jsonb)
    || jsonb_build_object(
      'customerDiscountCode', 'BUDDY25',
      'customerDiscountPercent', 25,
      'customerDiscountLabel', 'Friends and family 25% off',
      'customerDiscountScope', 'Rebecca Almanza KLOW storefront'
    ),
  updated_at = now()
where upper(coalesce(rep_slug, '')) = 'REBECCA-ALMANZA'
  and lower(coalesce(custom_store_slug, '')) = 'klow';

update public.partner_rep_store_settings prs
set
  promo_config = coalesce(prs.promo_config, '{}'::jsonb)
    || jsonb_build_object(
      'discount_code', 'REBECCAKLOW',
      'attribution_code', 'REBECCAKLOW',
      'customer_discount_code', 'BUDDY25',
      'customer_discount_percent', 25,
      'friends_and_family_code', 'BUDDY25',
      'friends_and_family_percent', 25
    ),
  internal_notes = trim(coalesce(prs.internal_notes, '') || E'\nBUDDY25 enabled as Rebecca Almanza KLOW friends-and-family customer discount. Attribution remains REBECCAKLOW.'),
  updated_at = now()
from public.reps r
where prs.rep_id = r.id
  and upper(coalesce(r.rep_slug, '')) = 'REBECCA-ALMANZA'
  and upper(coalesce(prs.store_scope, '')) = 'KLOW';
