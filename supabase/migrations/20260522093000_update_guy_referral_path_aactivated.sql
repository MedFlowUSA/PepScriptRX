-- Change Guy's primary public referral/storefront path to /AACTIVATED.
-- /guy remains available in the frontend as a legacy alias.

update public.reps
set
  referral_path = '/AACTIVATED',
  attribution_locked = true,
  active = true
where rep_slug = 'GUY60';
