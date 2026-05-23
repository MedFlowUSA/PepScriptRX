alter table public.patient_submissions
  add column if not exists order_number text,
  add column if not exists order_items jsonb not null default '[]'::jsonb,
  add column if not exists order_total numeric,
  add column if not exists tracking_url text,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists shipping_email_sent_at timestamptz;

update public.patient_submissions
set order_number = 'PSRX-' || upper(substr(id::text, 1, 8))
where order_number is null;

update public.patient_submissions
set order_items = jsonb_build_array(jsonb_build_object(
    'name', coalesce(product_name, medication, 'PepScriptRX order'),
    'price', coalesce(quoted_price, current_price, 0)
  ))
where order_items = '[]'::jsonb;

update public.patient_submissions
set order_total = greatest(
  0,
  coalesce(quoted_price, 0) + coalesce(shipping_cost, 0) - coalesce(discount_amount, 0)
)
where order_total is null;

alter table public.patient_submissions
  alter column order_number set default ('PSRX-' || upper(substr(gen_random_uuid()::text, 1, 8)));

create unique index if not exists patient_submissions_order_number_idx
  on public.patient_submissions(order_number);

alter table public.patient_submissions
  drop constraint if exists patient_submissions_status_check;

alter table public.patient_submissions
  add constraint patient_submissions_status_check
  check (
    status in (
      'new_submission',
      'missing_info',
      'under_review',
      'physician_review',
      'fulfillment_review',
      'eligible',
      'payment_sent',
      'paid',
      'shipped',
      'fulfilled',
      'not_eligible',
      'cancelled_refunded'
    )
  );

create or replace function public.claim_order_email_send(
  p_submission_id uuid,
  p_email_type text,
  p_force boolean default false
)
returns table (should_send boolean, sent_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_sent_at timestamptz;
  claimed_sent_at timestamptz := now();
begin
  if p_email_type = 'order_confirmation' then
    select confirmation_email_sent_at
      into existing_sent_at
      from public.patient_submissions
      where id = p_submission_id;

    if existing_sent_at is not null and not p_force then
      return query select false, existing_sent_at;
      return;
    end if;

    update public.patient_submissions
      set confirmation_email_sent_at = claimed_sent_at,
          updated_at = now()
      where id = p_submission_id;

    return query select true, claimed_sent_at;
    return;
  end if;

  if p_email_type = 'shipping_confirmation' then
    select shipping_email_sent_at
      into existing_sent_at
      from public.patient_submissions
      where id = p_submission_id;

    if existing_sent_at is not null and not p_force then
      return query select false, existing_sent_at;
      return;
    end if;

    update public.patient_submissions
      set shipping_email_sent_at = claimed_sent_at,
          updated_at = now()
      where id = p_submission_id;

    return query select true, claimed_sent_at;
    return;
  end if;

  raise exception 'Unsupported email type: %', p_email_type;
end;
$$;

revoke all on function public.claim_order_email_send(uuid, text, boolean) from public;
grant execute on function public.claim_order_email_send(uuid, text, boolean) to anon, authenticated;

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
    quoted_price,
    product_id,
    product_name,
    product_category,
    product_type,
    selected_addons,
    is_accessory_only,
    submission_type,
    inquiry_notes,
    order_number,
    order_items,
    order_total,
    tracking_url
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
    nullif(payload->>'quoted_price', '')::numeric,
    nullif(payload->>'product_id', ''),
    nullif(payload->>'product_name', ''),
    nullif(payload->>'product_category', ''),
    nullif(payload->>'product_type', ''),
    coalesce(payload->'selected_addons', '[]'::jsonb),
    coalesce((payload->>'is_accessory_only')::boolean, false),
    coalesce(nullif(payload->>'submission_type', ''), 'savings_check'),
    nullif(payload->>'inquiry_notes', ''),
    nullif(payload->>'order_number', ''),
    coalesce(payload->'order_items', '[]'::jsonb),
    nullif(payload->>'order_total', '')::numeric,
    nullif(payload->>'tracking_url', '')
  );

  return new_id;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
