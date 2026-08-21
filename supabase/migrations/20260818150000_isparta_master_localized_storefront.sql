-- Isparta Wellness Labs is a PepScriptRX-owned Turkish storefront.
-- It prices through the existing Anatolia/main catalog path, keeps Isparta
-- source attribution, and is never eligible for a partner/rep payout.

insert into public.distributors (
  name, slug, portal_name, commission_rate, is_active, white_label_enabled, wholesale_enabled
)
values (
  'Isparta Wellness Labs', 'isparta', 'Isparta Wellness Labs', 0, true, true, false
)
on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = 0,
  is_active = true,
  white_label_enabled = true,
  wholesale_enabled = false,
  updated_at = now();

insert into public.product_intelligence_store_visibility (
  product_key, store_key, store_name, visible, source
)
select
  p.product_key,
  'isparta',
  'Isparta Wellness Labs',
  coalesce(main_visible.visible, p.active_status = 'active'),
  'main_catalog_mirror'
from public.product_intelligence_products p
left join public.product_intelligence_store_visibility main_visible
  on main_visible.product_key = p.product_key
 and main_visible.store_key = 'main'
on conflict (product_key, store_key) do update set
  store_name = excluded.store_name,
  visible = excluded.visible,
  source = excluded.source;

do $$
begin
  if to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)') is null then
    alter function public.create_public_patient_submission(jsonb)
      rename to create_public_patient_submission_pre_isparta_core;
  end if;
end;
$$;

create or replace function public.create_public_patient_submission(payload jsonb)
returns table (submission_id uuid, public_payment_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := payload;
  v_is_isparta boolean := lower(concat_ws(' ',
    payload->>'store_slug', payload->>'store_name', payload->>'source_store',
    payload->>'source_portal', payload->>'source_route'
  )) like '%isparta%';
  v_result record;
begin
  if v_is_isparta then
    -- The proven master-owned Turkish pricing path. Attribution is restored
    -- immediately after the core RPC creates the order.
    v_payload := jsonb_set(v_payload, '{store_slug}', '"anatolia"'::jsonb, true);
  end if;

  select * into v_result
  from public.create_public_patient_submission_pre_isparta_core(v_payload)
  limit 1;

  if v_is_isparta then
    update public.patient_submissions
    set
      store_slug = 'isparta',
      store_name = 'Isparta Wellness Labs',
      source_store = 'isparta',
      source_portal = 'Isparta Wellness Labs',
      locale = 'tr',
      checkout_scope_code = 'MAIN',
      account_type = 'platform',
      parent_type = 'master_owned_localized_storefront',
      commission_owner = 'main',
      commission_rate = 1.0,
      partner_payout_eligible = false,
      rep_id = null
    where id = v_result.submission_id;
  end if;

  return query select v_result.submission_id, v_result.public_payment_token;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

comment on function public.create_public_patient_submission(jsonb) is
  'Public checkout RPC with Isparta master-owned source attribution and zero partner payout eligibility.';
