-- Update the existing EHWSUB storefront presentation in place.
-- Secure identity, authentication, hierarchy, attribution, historical orders,
-- commission settings, and payout records remain unchanged.

update public.reps
set
  brand_name = 'Radiance Wellness',
  referral_path = '/radiance',
  custom_store_slug = 'radiance'
where upper(coalesce(rep_slug, '')) = 'EHWSUB';

update public.distributors
set
  portal_name = 'Radiance Wellness',
  updated_at = now()
where lower(coalesce(slug, '')) = 'ehwsub';

update public.checkout_scopes
set
  display_name = 'Radiance Wellness',
  updated_at = now()
where upper(coalesce(scope_code, '')) = 'EHWSUB';
