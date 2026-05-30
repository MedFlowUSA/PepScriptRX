-- Rename Ellie Beyer's public storefront/scope from a personal-name slug to EHWSUB.

do $$
declare
  old_rep_id uuid;
  new_rep_id uuid;
begin
  select id into old_rep_id from public.reps where rep_slug = 'ELLIEBEYER' limit 1;
  select id into new_rep_id from public.reps where rep_slug = 'EHWSUB' limit 1;

  if old_rep_id is not null and new_rep_id is null then
    update public.reps
    set
      rep_slug = 'EHWSUB',
      rep_identifier = 'SUBREP-EHWSUB',
      discount_code = 'EHWSUB',
      referral_path = '/EHWSUB',
      custom_store_slug = 'EHWSUB',
      brand_name = 'Empire Health & Wellness'
    where id = old_rep_id;
  elsif old_rep_id is not null and new_rep_id is not null and old_rep_id <> new_rep_id then
    update public.patient_submissions set rep_id = new_rep_id where rep_id = old_rep_id;
    update public.commission_ledger set rep_id = new_rep_id where rep_id = old_rep_id;
    delete from public.reps where id = old_rep_id;
  end if;
end $$;

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
  'Ellie Beyer / Empire Health & Wellness',
  'rep',
  'EHWSUB',
  'MARK65',
  true,
  0.45,
  'Neutral Empire Health & Wellness sub-rep checkout scope for Ellie Beyer.'
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
  notes = coalesce(notes, '') || ' Replaced by EHWSUB.'
where scope_code = 'ELLIEBEYER';

update public.distributors
set
  slug = 'ehwsub',
  portal_name = 'Empire Health & Wellness',
  commission_rate = 0.45,
  is_active = true,
  updated_at = now()
where slug = 'ellie'
  and not exists (select 1 from public.distributors where slug = 'ehwsub');
