-- Ellie neutral PepScriptRX storefront update.
-- Public /EHWSUB mirrors the main PepScriptRX storefront while preserving
-- internal Ellie commission attribution through ELLIEBEYER.

do $$
declare
  old_email text := 'leebeyer21@gmail.com';
  new_email text := 'LEBEYER21@gmail.com';
  ellie_profile_id uuid;
  ellie_rep_id uuid;
  legacy_ehwsub_rep_id uuid;
  existing_ellie_rep_id uuid;
begin
  select id
    into ellie_profile_id
  from public.profiles
  where lower(coalesce(email, '')) in (lower(old_email), lower(new_email))
     or id in (
       select profile_id
       from public.reps
       where rep_slug in ('EHWSUB', 'ELLIEBEYER')
     )
  order by created_at desc
  limit 1;

  update auth.users
  set
    email = new_email,
    updated_at = now(),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('email', new_email)
  where lower(email) in (lower(old_email), lower(new_email))
     or id = ellie_profile_id;

  update auth.identities
  set
    provider_id = new_email,
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('email', new_email),
    updated_at = now()
  where lower(provider_id) in (lower(old_email), lower(new_email))
     or user_id = ellie_profile_id;

  update public.profiles
  set
    email = new_email,
    phone = coalesce(nullif(phone, ''), '909-435-5414'),
    role = 'rep'
  where id = ellie_profile_id
     or lower(coalesce(email, '')) in (lower(old_email), lower(new_email));

  select id into legacy_ehwsub_rep_id
  from public.reps
  where rep_slug = 'EHWSUB'
  limit 1;

  select id into existing_ellie_rep_id
  from public.reps
  where rep_slug = 'ELLIEBEYER'
  limit 1;

  if existing_ellie_rep_id is not null and legacy_ehwsub_rep_id is not null and existing_ellie_rep_id <> legacy_ehwsub_rep_id then
    update public.patient_submissions
    set rep_id = existing_ellie_rep_id
    where rep_id = legacy_ehwsub_rep_id;

    update public.commission_ledger
    set rep_id = existing_ellie_rep_id
    where rep_id = legacy_ehwsub_rep_id;

    update public.reps
    set active = false
    where id = legacy_ehwsub_rep_id;

    ellie_rep_id := existing_ellie_rep_id;
  else
    ellie_rep_id := coalesce(existing_ellie_rep_id, legacy_ehwsub_rep_id);

    if ellie_rep_id is not null then
      update public.reps
      set rep_slug = 'ELLIEBEYER'
      where id = ellie_rep_id;
    end if;
  end if;

  if ellie_rep_id is not null then
    update public.reps
    set
      profile_id = coalesce(ellie_profile_id, profile_id),
      rep_name = 'Ellie Beyer',
      handle = 'PepScriptRX',
      rep_identifier = 'SUBREP-ELLIEBEYER',
      commission_rate = 0.45,
      discount_code = 'FLIGHT10',
      discount_amount = 0,
      referral_path = '/EHWSUB',
      payout_email = new_email,
      custom_store_slug = 'EHWSUB',
      brand_name = 'PepScriptRX',
      brand_theme = '{"palette":["#0a1628","#25c7d9","#ffffff"],"style":"Neutral PepScriptRX storefront mirror"}'::jsonb,
      active = true
    where id = ellie_rep_id;
  end if;

  insert into public.checkout_scopes (
    scope_code,
    display_name,
    account_type,
    account_id,
    parent_account_id,
    is_active,
    default_commission_rate,
    notes
  )
  values (
    'ELLIEBEYER',
    'PepScriptRX Partner',
    'rep',
    'ELLIEBEYER',
    null,
    true,
    0.45,
    'Neutral PepScriptRX storefront attribution for /EHWSUB. Public storefront does not expose personal or Empire branding.'
  )
  on conflict (scope_code) do update set
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id,
    is_active = excluded.is_active,
    default_commission_rate = excluded.default_commission_rate,
    notes = excluded.notes,
    updated_at = now();

  update public.checkout_scopes
  set
    is_active = false,
    notes = coalesce(notes, '') || ' Replaced by ELLIEBEYER neutral PepScriptRX attribution scope.'
  where scope_code = 'EHWSUB';

  update public.patient_submissions
  set
    referral_code = 'ELLIEBEYER',
    discount_code = case when discount_code = 'EHWSUB' then 'FLIGHT10' else discount_code end,
    checkout_scope_code = case when checkout_scope_code = 'EHWSUB' then 'ELLIEBEYER' else checkout_scope_code end,
    source_rep = case when source_rep = 'EHWSUB' then 'ELLIEBEYER' else source_rep end,
    store_name = case when store_slug = 'EHWSUB' then 'PepScriptRX' else store_name end
  where referral_code = 'EHWSUB'
     or discount_code = 'EHWSUB'
     or checkout_scope_code = 'EHWSUB'
     or source_rep = 'EHWSUB';

  if to_regclass('public.referral_attributions') is not null then
    update public.referral_attributions
    set
      referral_code = 'ELLIEBEYER',
      discount_code = 'FLIGHT10'
    where referral_code = 'EHWSUB'
       or discount_code = 'EHWSUB';
  end if;

  update public.distributors
  set
    name = 'PepScriptRX',
    portal_name = 'PepScriptRX',
    white_label_enabled = false,
    wholesale_enabled = false,
    updated_at = now()
  where slug = 'ehwsub';

  if to_regclass('public.rep_store_intake_submissions') is not null then
    update public.rep_store_intake_submissions
    set email = new_email,
        updated_at = now()
    where lower(coalesce(email, '')) = lower(old_email);
  end if;
end $$;
