-- Idempotent finalization for Dennis Hernandez / Dean after creating the
-- independent Viltrum Peptide storefront.

update public.reps
set
  rep_name = 'Dennis Hernandez',
  handle = coalesce(nullif(handle, ''), '@deanvenus'),
  commission_type = 'net_profit_share',
  commission_rate = 0.5000,
  discount_code = 'DEAN50',
  discount_amount = coalesce(discount_amount, 10),
  referral_path = '/viltrumpeptide',
  attribution_locked = true,
  attribution_window_days = coalesce(attribution_window_days, 60),
  managed_by_profile_id = null,
  parent_rep_id = null,
  parent_type = 'independent_partner_store',
  brand_id = 'viltrumpeptide',
  parent_brand_id = 'viltrumpeptide',
  assigned_store_slug = 'viltrumpeptide',
  custom_store_slug = 'viltrumpeptide',
  brand_name = 'Viltrum Peptide',
  rep_tier = 'independent_brand_owner',
  rep_channel = 'independent_partner_store',
  account_type = 'admin',
  active = true,
  updated_at = now()
where upper(coalesce(rep_slug, '')) = 'DEAN50';

update public.profiles
set
  role = case when role = 'rx_plus_admin' then role else 'partner_admin_full' end,
  admin_scope = 'VILTRUMPEPTIDE',
  store_slug = 'viltrumpeptide',
  owner_email = coalesce(nullif(owner_email, ''), 'Deanvenus1977@outlook.com'),
  brand_id = 'viltrumpeptide',
  updated_at = now()
where lower(coalesce(email, '')) = 'deanvenus1977@outlook.com'
   or lower(coalesce(full_name, '')) in ('dennis hernandez', 'dean hernandez')
   or id in (
     select profile_id
     from public.reps
     where upper(coalesce(rep_slug, '')) = 'DEAN50'
       and profile_id is not null
   );

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select p.id, 'viltrumpeptide', 'full', 'active'
from public.profiles p
where lower(coalesce(p.email, '')) = 'deanvenus1977@outlook.com'
   or lower(coalesce(p.full_name, '')) in ('dennis hernandez', 'dean hernandez')
   or p.id in (
     select profile_id
     from public.reps
     where upper(coalesce(rep_slug, '')) = 'DEAN50'
       and profile_id is not null
   )
on conflict (profile_id, brand_id) do update set
  access_level = excluded.access_level,
  status = excluded.status;

do $$
declare
  dean_rep_id uuid;
  dean_email text := 'Deanvenus1977@outlook.com';
begin
  select id into dean_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'DEAN50'
  limit 1;

  if dean_rep_id is not null and to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      commission_type,
      commission_percent,
      special_note,
      approval_required,
      approval_status,
      internal_notes,
      brand_id,
      rep_name,
      commission_basis,
      parent_override_percent,
      platform_percent,
      status,
      updated_at
    )
    values (
      'VILTRUMPEPTIDE',
      null,
      dean_email,
      dean_rep_id,
      dean_email,
      'net_profit_share',
      50.00,
      'Dennis Hernandez / Dean receives 50% of net profit after landing cost.',
      false,
      'active',
      'Converted from GLOW downline/back-clone setup to independent Viltrum Peptide storefront.',
      'viltrumpeptide',
      'Dennis Hernandez',
      'net_profit_after_true_cost',
      0.00,
      50.00,
      'active',
      now()
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      commission_type = excluded.commission_type,
      commission_percent = excluded.commission_percent,
      special_note = excluded.special_note,
      approval_required = excluded.approval_required,
      approval_status = excluded.approval_status,
      internal_notes = excluded.internal_notes,
      brand_id = excluded.brand_id,
      rep_name = excluded.rep_name,
      commission_basis = excluded.commission_basis,
      parent_override_percent = excluded.parent_override_percent,
      platform_percent = excluded.platform_percent,
      status = excluded.status,
      updated_at = now();
  end if;

  if dean_rep_id is not null and to_regclass('public.partner_rep_store_settings') is not null then
    insert into public.partner_rep_store_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      rep_name,
      public_display_name,
      store_slug,
      storefront_path,
      product_list_id,
      product_list_name,
      pricing_mode,
      features,
      promo_config,
      status,
      activated_at,
      internal_notes,
      brand_id,
      updated_at
    )
    values (
      'VILTRUMPEPTIDE',
      null,
      dean_email,
      dean_rep_id,
      dean_email,
      'Dennis Hernandez',
      'Viltrum Peptide',
      'viltrumpeptide',
      '/viltrumpeptide',
      null,
      'Standard PepScriptRX Catalog',
      'main_catalog',
      jsonb_build_object('standalone_storefront', true, 'standard_catalog', true),
      jsonb_build_object('discount_code', 'DEAN50', 'tagline', 'Strength Beyond Human'),
      'active',
      now(),
      'Independent Viltrum Peptide storefront; no GLOW downline/back-clone association.',
      'viltrumpeptide',
      now()
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      rep_name = excluded.rep_name,
      public_display_name = excluded.public_display_name,
      store_slug = excluded.store_slug,
      storefront_path = excluded.storefront_path,
      product_list_id = excluded.product_list_id,
      product_list_name = excluded.product_list_name,
      pricing_mode = excluded.pricing_mode,
      features = excluded.features,
      promo_config = excluded.promo_config,
      status = excluded.status,
      activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
      internal_notes = excluded.internal_notes,
      brand_id = excluded.brand_id,
      disabled_at = null,
      updated_at = now();
  end if;
end $$;

update public.patient_submissions
set
  brand_id = 'viltrumpeptide',
  store_slug = 'viltrumpeptide',
  store_name = 'Viltrum Peptide',
  checkout_scope_code = case
    when nullif(checkout_scope_code, '') is null or upper(checkout_scope_code) = 'DEAN50' then 'VILTRUMPEPTIDE'
    else checkout_scope_code
  end,
  source_portal = 'Viltrum Peptide',
  source_store = 'viltrumpeptide',
  source_admin = 'DEAN50',
  source_rep = 'DEAN50',
  admin_code = 'DEAN50',
  commission_owner = 'DEAN50',
  commission_rate = 0.5000,
  partner_payout_eligible = true
where upper(coalesce(referral_code, '')) = 'DEAN50'
   or upper(coalesce(discount_code, '')) = 'DEAN50'
   or upper(coalesce(checkout_scope_code, '')) = 'DEAN50'
   or upper(coalesce(source_rep, '')) = 'DEAN50'
   or upper(coalesce(admin_code, '')) = 'DEAN50';

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is not null and position('VILTRUMPEPTIDE' in fn) = 0 then
    next_fn := replace(
      fn,
      '    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto''',
      '    when v_scope_code = ''VILTRUMPEPTIDE'' or v_store_hint like ''%viltrum%'' or v_store_hint like ''%dean50%'' then ''viltrumpeptide''
    when v_scope_code = ''GINTO'' or v_store_hint like ''%ginto%'' then ''ginto'''
    );

    if next_fn = fn then
      next_fn := replace(
        fn,
        '    else null',
        '    when v_scope_code = ''VILTRUMPEPTIDE'' or v_store_hint like ''%viltrum%'' or v_store_hint like ''%dean50%'' then ''viltrumpeptide''
    else null'
      );
    end if;

    if next_fn = fn then
      raise exception 'Could not patch Viltrum Peptide checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
