-- Rock Phorm owns KLOW and financially parents Aurora downline visibility.
-- Keep KLOW out of separate payout ownership while allowing Rock Phorm admin
-- to see child storefronts, Aurora reps, and related orders/ledger rows.

update public.partner_brands
set
  access_level = 'full',
  status = 'active',
  capabilities = jsonb_build_object(
    'storefront', true,
    'products', true,
    'pricing_overrides', true,
    'discount_codes', true,
    'rep_management', true,
    'team_overrides', true,
    'orders_customers', true,
    'payouts', true,
    'marketing', true
  ),
  pricing_guardrails = jsonb_build_object('min_margin_percent', 20, 'max_discount_percent', 35),
  updated_at = now()
where brand_id = 'rockphorm';

update public.profiles
set
  role = case when role = 'rx_plus_admin' then role else 'partner_admin_full' end,
  brand_id = 'rockphorm',
  partner_access_level = 'full',
  access_scope = 'brand_family',
  admin_scope = 'ROCKPHORM',
  store_slug = 'rockphorm',
  owner_email = coalesce(owner_email, email),
  global_admin = false,
  super_admin = false,
  can_view_all_brands = false,
  can_view_all_reps = false,
  can_view_all_orders = false,
  can_view_all_customers = false,
  can_edit_global_catalog = false,
  can_edit_global_settings = false,
  can_view_platform_financials = false,
  can_view_other_partner_financials = false,
  updated_at = now()
where lower(coalesce(email, owner_email, '')) = 'rick@blueprintadvocate.io'
   or (upper(coalesce(admin_scope, '')) = 'ROCKPHORM' and lower(coalesce(store_slug, '')) = 'rockphorm');

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select id, 'rockphorm', 'full', 'active'
from public.profiles
where lower(coalesce(email, owner_email, '')) = 'rick@blueprintadvocate.io'
   or (upper(coalesce(admin_scope, '')) = 'ROCKPHORM' and lower(coalesce(store_slug, '')) = 'rockphorm')
on conflict (profile_id, brand_id) do update set
  access_level = 'full',
  status = 'active';

update public.partner_store_settings
set brand_id = 'rockphorm',
    updated_at = now()
where lower(store_slug) in ('rockphorm', 'klow');

update public.reps
set
  brand_id = 'rockphorm',
  parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'rockphorm'),
  assigned_store_slug = 'rockphorm',
  custom_store_slug = coalesce(custom_store_slug, 'rockphorm'),
  updated_at = now()
where upper(coalesce(rep_slug, '')) in ('ROCKPHORM', 'RICKDIAZ')
   or lower(coalesce(custom_store_slug, '')) = 'rockphorm'
   or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
   or upper(coalesce(brand_name, '')) like '%ROCKPHORM%';

update public.reps
set
  brand_id = 'aurora',
  parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'aurora'),
  assigned_store_slug = 'aurora',
  custom_store_slug = coalesce(custom_store_slug, 'aurora'),
  updated_at = now()
where upper(coalesce(rep_slug, '')) in ('AURORA', 'MIKEAURORA', 'AURORAJL', 'MEGDEL', 'D026FIR', 'AURORAET', 'AURORATO', 'AURORAGE')
   or lower(coalesce(custom_store_slug, '')) = 'aurora'
   or upper(coalesce(brand_name, '')) like '%AURORA%';

create or replace function public.is_current_partner_brand(p_brand_id text, p_store_slug text default null, p_scope_code text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.is_partner_admin()
      and (
        lower(coalesce(p_brand_id, '')) = public.current_partner_brand_id()
        or lower(coalesce(p_store_slug, '')) = (
          select lower(store_slug) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
        or upper(coalesce(p_scope_code, '')) = (
          select upper(scope_code) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
        or (
          public.current_partner_brand_id() = 'rockphorm'
          and (
            lower(coalesce(p_brand_id, '')) in ('rockphorm', 'aurora')
            or lower(coalesce(p_store_slug, '')) in ('rockphorm', 'klow', 'aurora')
            or upper(coalesce(p_scope_code, '')) in ('ROCKPHORM', 'AURORA', 'MIKEAURORA')
          )
        )
      )
    )
$$;

create or replace function public.is_partner_rep_id(p_rep_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.reps r
      join public.partner_brands b on b.brand_id = public.current_partner_brand_id()
      where r.id = p_rep_id
        and (
          lower(coalesce(r.brand_id, '')) = b.brand_id
          or lower(coalesce(r.parent_brand_id, '')) = b.brand_id
          or lower(coalesce(r.assigned_store_slug, r.custom_store_slug, '')) = lower(b.store_slug)
          or upper(coalesce(r.rep_slug, '')) = upper(b.scope_code)
          or upper(coalesce(r.brand_name, '')) like '%' || upper(b.store_name) || '%'
          or (
            b.brand_id = 'rockphorm'
            and (
              lower(coalesce(r.brand_id, '')) in ('rockphorm', 'aurora')
              or lower(coalesce(r.parent_brand_id, '')) in ('rockphorm', 'aurora')
              or lower(coalesce(r.assigned_store_slug, r.custom_store_slug, '')) in ('rockphorm', 'klow', 'aurora')
              or upper(coalesce(r.rep_slug, '')) in ('ROCKPHORM', 'AURORA', 'MIKEAURORA')
              or upper(coalesce(r.brand_name, '') || ' ' || coalesce(r.rep_channel, '') || ' ' || coalesce(r.rep_tier, '')) like '%ROCK PHORM%'
              or upper(coalesce(r.brand_name, '') || ' ' || coalesce(r.rep_channel, '') || ' ' || coalesce(r.rep_tier, '')) like '%ROCKPHORM%'
              or upper(coalesce(r.brand_name, '') || ' ' || coalesce(r.rep_channel, '') || ' ' || coalesce(r.rep_tier, '')) like '%AURORA%'
              or upper(coalesce(r.brand_name, '') || ' ' || coalesce(r.rep_channel, '') || ' ' || coalesce(r.rep_tier, '')) like '%KLOW%'
            )
          )
        )
    )
$$;

create or replace function public.is_partner_submission_id(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.patient_submissions s
      join public.partner_brands b on b.brand_id = public.current_partner_brand_id()
      where s.id = p_submission_id
        and (
          lower(coalesce(s.brand_id, '')) = b.brand_id
          or lower(coalesce(s.store_slug, '')) = lower(b.store_slug)
          or upper(coalesce(s.checkout_scope_code, '')) = upper(b.scope_code)
          or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '')) like '%' || upper(b.scope_code) || '%'
          or (s.rep_id is not null and public.is_partner_rep_id(s.rep_id))
          or (
            b.brand_id = 'rockphorm'
            and (
              lower(coalesce(s.brand_id, '')) in ('rockphorm', 'aurora')
              or lower(coalesce(s.store_slug, '')) in ('rockphorm', 'klow', 'aurora')
              or upper(coalesce(s.checkout_scope_code, '')) in ('ROCKPHORM', 'AURORA', 'MIKEAURORA')
              or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%ROCK PHORM%'
              or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%ROCKPHORM%'
              or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%AURORA%'
              or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%KLOW%'
            )
          )
        )
    )
$$;

grant execute on function public.is_current_partner_brand(text, text, text) to authenticated;
grant execute on function public.is_partner_rep_id(uuid) to authenticated;
grant execute on function public.is_partner_submission_id(uuid) to authenticated;
