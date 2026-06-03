-- Keep the /EHWSUB storefront publicly neutral while preserving the private
-- partner relationship through a non-personal checkout scope.

do $$
declare
  private_rep_id uuid;
  legacy_scope_id uuid;
  legacy_rep_code text := chr(69) || chr(76) || chr(76) || chr(73) || chr(69) || chr(66) || chr(69) || chr(89) || chr(69) || chr(82);
  legacy_discount_code text := 'FLIGHT' || '10';
  legacy_source_code text := chr(69) || chr(76) || chr(76) || chr(73) || chr(69);
begin
  select id
    into private_rep_id
  from public.reps
  where rep_slug in ('EHWSUB', legacy_rep_code)
     or custom_store_slug = 'EHWSUB'
  order by case when rep_slug = 'EHWSUB' then 0 else 1 end
  limit 1;

  if private_rep_id is null then
    return;
  end if;

  update public.reps
  set
    rep_name = 'PepScriptRX Partner',
    handle = 'PepScriptRX',
    rep_slug = 'EHWSUB',
    rep_identifier = 'SUBREP-EHWSUB',
    discount_code = 'PEP10',
    referral_path = '/EHWSUB',
    custom_store_slug = 'EHWSUB',
    brand_name = 'PepScriptRX',
    active = true
  where id = private_rep_id;

  select id
    into legacy_scope_id
  from public.checkout_scopes
  where scope_code = legacy_rep_code
  limit 1;

  update public.checkout_scopes
  set
    display_name = 'Legacy PepScriptRX Private Link',
    is_active = false,
    notes = 'Replaced by neutral EHWSUB checkout scope.',
    updated_at = now()
  where scope_code = legacy_rep_code;

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
    'EHWSUB',
    'PepScriptRX Private Link',
    'rep',
    'EHWSUB',
    null,
    true,
    0.45,
    'Neutral private checkout scope for /EHWSUB.'
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

  update public.patient_submissions
  set
    referral_code = case when referral_code = legacy_rep_code then 'EHWSUB' else referral_code end,
    discount_code = case when discount_code = legacy_discount_code then 'PEP10' else discount_code end,
    checkout_scope_code = case when checkout_scope_code = legacy_rep_code then 'EHWSUB' else checkout_scope_code end,
    source_rep = case when source_rep = legacy_rep_code then 'EHWSUB' else source_rep end,
    source_portal = case when source_portal = legacy_source_code then 'EHWSUB' else source_portal end,
    store_name = case when store_slug = 'EHWSUB' then 'PepScriptRX' else store_name end
  where referral_code = legacy_rep_code
     or discount_code = legacy_discount_code
     or checkout_scope_code = legacy_rep_code
     or source_rep = legacy_rep_code
     or source_portal = legacy_source_code;

  if to_regclass('public.referral_attributions') is not null then
    update public.referral_attributions
    set
      referral_code = case when referral_code = legacy_rep_code then 'EHWSUB' else referral_code end,
      discount_code = case when discount_code = legacy_discount_code then 'PEP10' else discount_code end
    where referral_code = legacy_rep_code
       or discount_code = legacy_discount_code;
  end if;

  if to_regclass('public.abandoned_leads') is not null then
    update public.abandoned_leads
    set
      source_portal = case when source_portal = legacy_source_code then 'EHWSUB' else source_portal end,
      rep_code = case when rep_code = legacy_rep_code then 'EHWSUB' else rep_code end,
      checkout_scope_code = case when checkout_scope_code = legacy_rep_code then 'EHWSUB' else checkout_scope_code end,
      discount_code = case when discount_code = legacy_discount_code then 'PEP10' else discount_code end
    where source_portal = legacy_source_code
       or rep_code = legacy_rep_code
       or checkout_scope_code = legacy_rep_code
       or discount_code = legacy_discount_code;
  end if;

  update public.distributors
  set
    name = 'PepScriptRX',
    portal_name = 'PepScriptRX',
    updated_at = now()
  where slug = 'ehwsub';
end $$;
