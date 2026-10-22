-- Canonical storefront URL requested for Amber OBrien.
update public.reps
set referral_path = '/blacklineao', updated_at = now()
where rep_slug = 'AMBEROBRIEN'
  and payout_email = 'anobrien917@gmail.com'
  and brand_id = 'blackline';
