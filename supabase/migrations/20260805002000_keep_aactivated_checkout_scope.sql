-- Keep AACTIVATED storefront orders under the AACTIVATED parent scope even
-- when the browser cart carries an individual rep code as its checkout scope.

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
  'GUY60',
  'AACTIVATED-RX',
  'portal',
  'GUY60',
  null,
  true,
  0.60,
  'AACTIVATED-RX parent checkout scope.'
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

create or replace function public.aactivated_patient_submission_scope_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := public.normalize_checkout_scope_code(new.checkout_scope_code);
  v_rep_hint text := public.normalize_checkout_scope_code(coalesce(new.source_rep, new.referral_code, new.admin_code));
  v_is_known_scope boolean := false;
  v_is_aactivated_rep boolean := false;
  v_haystack text := lower(concat_ws(
    ' ',
    new.checkout_scope_code,
    new.source_rep,
    new.referral_code,
    new.admin_code,
    new.store_slug,
    new.store_name,
    new.source_store,
    new.source_portal,
    new.source_route,
    new.brand_id
  ));
begin
  if v_scope is not null then
    select exists (
      select 1
      from public.checkout_scopes cs
      where cs.scope_code = v_scope
        and cs.is_active = true
    )
    into v_is_known_scope;
  end if;

  if v_rep_hint is not null then
    select exists (
      select 1
      from public.reps r
      where r.active = true
        and upper(r.rep_slug) = v_rep_hint
        and (
          lower(coalesce(r.brand_id, '')) = 'aactivated'
          or lower(coalesce(r.parent_brand_id, '')) = 'aactivated'
          or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
          or lower(coalesce(r.assigned_store_slug, '')) = 'aactivated'
          or upper(coalesce(r.brand_name, '')) like '%AACTIVATED%'
        )
    )
    into v_is_aactivated_rep;
  end if;

  if v_is_aactivated_rep
    or v_haystack ~ '\m(guy60|vitalityins|aactivated|aactivatedrx)\M'
  then
    if not v_is_known_scope or v_scope = 'MAIN' then
      new.checkout_scope_code := 'GUY60';
    end if;

    if lower(coalesce(nullif(new.source_portal, ''), 'main')) in ('main', 'vitalityins') then
      new.source_portal := 'AACTIVATEDRX';
    end if;

    new.store_name := coalesce(nullif(new.store_name, ''), 'AACTIVATED-RX');
    new.source_store := coalesce(nullif(new.source_store, ''), nullif(new.store_slug, ''), 'guy');
  end if;

  return new;
end;
$$;

drop trigger if exists aa_aactivated_patient_submission_scope_guard_trigger on public.patient_submissions;
create trigger aa_aactivated_patient_submission_scope_guard_trigger
before insert or update of checkout_scope_code, source_portal, source_store, source_admin, source_rep, admin_code, store_slug, store_name, referral_code, brand_id
on public.patient_submissions
for each row execute function public.aactivated_patient_submission_scope_guard();

update public.patient_submissions
set
  checkout_scope_code = 'GUY60',
  source_portal = case
    when lower(coalesce(nullif(source_portal, ''), 'main')) in ('main', 'vitalityins') then 'AACTIVATEDRX'
    else source_portal
  end,
  store_name = coalesce(nullif(store_name, ''), 'AACTIVATED-RX'),
  source_store = coalesce(nullif(source_store, ''), nullif(store_slug, ''), 'guy')
where status in ('payment_sent', 'paid', 'fulfilled')
  and (
    upper(coalesce(checkout_scope_code, '')) = 'MAIN'
    or checkout_scope_code is null
    or not exists (
      select 1
      from public.checkout_scopes cs
      where cs.scope_code = upper(coalesce(patient_submissions.checkout_scope_code, ''))
        and cs.is_active = true
    )
  )
  and (
    lower(concat_ws(' ', source_rep, referral_code, admin_code, store_slug, store_name, source_store, source_portal, source_route, brand_id)) like '%aactivated%'
    or lower(concat_ws(' ', source_rep, referral_code, admin_code, store_slug, store_name, source_store, source_portal, source_route, brand_id)) like '%vitalityins%'
    or upper(coalesce(source_rep, referral_code, admin_code, '')) in (
      select upper(r.rep_slug)
      from public.reps r
      where r.active = true
        and (
          lower(coalesce(r.brand_id, '')) = 'aactivated'
          or lower(coalesce(r.parent_brand_id, '')) = 'aactivated'
          or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
          or lower(coalesce(r.assigned_store_slug, '')) = 'aactivated'
          or upper(coalesce(r.brand_name, '')) like '%AACTIVATED%'
        )
    )
  );
