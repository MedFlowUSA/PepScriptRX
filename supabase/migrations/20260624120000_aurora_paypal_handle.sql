-- Store Aurora Labs' PayPal handle separately from the Aurora admin login email.

alter table public.reps
  add column if not exists payout_method text,
  add column if not exists paypal_link text,
  add column if not exists brand_theme jsonb,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  aurora_paypal_handle text := '@auroralabsco';
  aurora_paypal_link text := 'https://www.paypal.com/biz/profile/auroralabsco';
  aurora_business_name text := 'MSN Group Capital Inc';
begin
  update public.reps
  set
    payout_email = aurora_paypal_handle,
    payout_method = 'Manual PayPal handle payout',
    paypal_link = aurora_paypal_link,
    brand_theme = coalesce(brand_theme, '{}'::jsonb) || jsonb_build_object(
      'paypalIdentifier', aurora_paypal_handle,
      'paypalBusinessName', aurora_business_name,
      'paypalLink', aurora_paypal_link,
      'payoutMethod', 'paypal',
      'payoutPreference', 'manual_paypal_handle',
      'payoutStatus', 'provided_pending_verification'
    ),
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or (
      account_type = 'admin'
      and lower(coalesce(custom_store_slug, '')) = 'aurora'
      and brand_name = 'Aurora Labs'
    );
end $$;

create or replace function public.ensure_aurora_mike_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) in ('mnsgroup107@gmail.com', 'msngroup107@gmail.com') then
    insert into public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      admin_scope,
      store_slug,
      owner_email
    )
    values (
      new.id,
      new.id,
      'mnsgroup107@gmail.com',
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      'mnsgroup107@gmail.com'
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = excluded.owner_email,
      updated_at = now();

    update public.reps
    set
      profile_id = new.id,
      payout_email = case
        when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then '@auroralabsco'
        else payout_email
      end,
      payout_method = case
        when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then 'Manual PayPal handle payout'
        else payout_method
      end,
      paypal_link = case
        when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then 'https://www.paypal.com/biz/profile/auroralabsco'
        else paypal_link
      end,
      brand_theme = case
        when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then coalesce(brand_theme, '{}'::jsonb) || jsonb_build_object(
          'paypalIdentifier', '@auroralabsco',
          'paypalBusinessName', 'MSN Group Capital Inc',
          'paypalLink', 'https://www.paypal.com/biz/profile/auroralabsco',
          'payoutMethod', 'paypal',
          'payoutPreference', 'manual_paypal_handle',
          'payoutStatus', 'provided_pending_verification'
        )
        else brand_theme
      end,
      updated_at = now()
    where (rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA')
      and (profile_id is null or profile_id = new.id);
  end if;

  return new;
end;
$$;
