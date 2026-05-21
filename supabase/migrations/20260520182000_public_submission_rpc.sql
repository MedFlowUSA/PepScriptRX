create or replace function public.create_public_patient_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := coalesce(nullif(payload->>'id', '')::uuid, gen_random_uuid());
begin
  insert into public.patient_submissions (
    id,
    full_name,
    email,
    phone,
    rep_id,
    medication,
    current_dose,
    current_price,
    state,
    date_of_birth,
    current_pharmacy,
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_speed,
    shipping_cost,
    referral_code,
    discount_code,
    discount_amount,
    status,
    product_id,
    product_name,
    product_category,
    product_type,
    selected_addons,
    is_accessory_only,
    submission_type,
    inquiry_notes
  )
  values (
    new_id,
    nullif(payload->>'full_name', ''),
    nullif(payload->>'email', ''),
    nullif(payload->>'phone', ''),
    nullif(payload->>'rep_id', '')::uuid,
    nullif(payload->>'medication', ''),
    nullif(payload->>'current_dose', ''),
    nullif(payload->>'current_price', '')::numeric,
    nullif(payload->>'state', ''),
    nullif(payload->>'date_of_birth', '')::date,
    nullif(payload->>'current_pharmacy', ''),
    nullif(payload->>'shipping_address', ''),
    nullif(payload->>'shipping_city', ''),
    nullif(payload->>'shipping_state', ''),
    nullif(payload->>'shipping_zip', ''),
    coalesce(nullif(payload->>'shipping_speed', ''), 'standard'),
    coalesce(nullif(payload->>'shipping_cost', '')::numeric, 0),
    nullif(payload->>'referral_code', ''),
    nullif(payload->>'discount_code', ''),
    coalesce(nullif(payload->>'discount_amount', '')::numeric, 0),
    coalesce(nullif(payload->>'status', ''), 'new_submission'),
    nullif(payload->>'product_id', ''),
    nullif(payload->>'product_name', ''),
    nullif(payload->>'product_category', ''),
    nullif(payload->>'product_type', ''),
    coalesce(payload->'selected_addons', '[]'::jsonb),
    coalesce((payload->>'is_accessory_only')::boolean, false),
    coalesce(nullif(payload->>'submission_type', ''), 'savings_check'),
    nullif(payload->>'inquiry_notes', '')
  );

  return new_id;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
