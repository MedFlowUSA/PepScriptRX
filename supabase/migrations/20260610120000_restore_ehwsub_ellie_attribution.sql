-- Restore EHWSUB as Ellie Beyer's rep storefront instead of a neutral
-- PepScriptRX mirror.

do $$
declare
  ellie_rep_id uuid;
begin
  select id
    into ellie_rep_id
  from public.reps
  where rep_slug = 'EHWSUB'
     or custom_store_slug = 'EHWSUB'
  order by case when rep_slug = 'EHWSUB' then 0 else 1 end
  limit 1;

  if ellie_rep_id is not null then
    update public.reps
    set
      rep_name = 'Ellie Beyer',
      handle = 'Ellie Beyer',
      rep_slug = 'EHWSUB',
      rep_identifier = 'SUBREP-EHWSUB',
      discount_code = 'PEP10',
      referral_path = '/EHWSUB',
      custom_store_slug = 'EHWSUB',
      brand_name = 'Ellie',
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
    'EHWSUB',
    'Ellie Beyer',
    'rep',
    'EHWSUB',
    null,
    true,
    0.45,
    'Ellie Beyer checkout scope for /EHWSUB.'
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

  update public.distributors
  set
    name = 'Ellie Beyer',
    portal_name = 'Ellie',
    updated_at = now()
  where slug = 'ehwsub';

  update public.patient_submissions
  set store_name = 'Ellie'
  where store_name = 'PepScriptRX'
    and (
      referral_code = 'EHWSUB'
      or checkout_scope_code = 'EHWSUB'
      or source_rep = 'EHWSUB'
      or lower(coalesce(store_slug, '')) = 'ehwsub'
    );
end $$;
