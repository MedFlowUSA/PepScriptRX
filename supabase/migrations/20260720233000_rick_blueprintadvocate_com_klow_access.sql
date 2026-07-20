-- Make Rick's current Blueprint Advocate email the primary Rock Phorm/KLOW
-- admin identity while preserving access for any existing historical profile.

update public.partner_brands
set
  owner_email = 'rick@blueprintadvocate.com',
  updated_at = now()
where brand_id = 'rockphorm'
   or lower(store_slug) in ('rockphorm', 'klow')
   or upper(scope_code) in ('ROCKPHORM', 'KLOW');

update public.partner_store_settings
set
  settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object('ownerEmail', 'rick@blueprintadvocate.com'),
  updated_at = now()
where lower(store_slug) in ('rockphorm', 'klow')
   or brand_id = 'rockphorm';

update public.profiles
set
  role = case
    when role in ('admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited', 'owner', 'platform_admin', 'super_admin')
      then role
    else 'partner_admin_full'
  end,
  email = case
    when lower(coalesce(email, '')) = 'rick@blueprintadvocate.io'
      then 'rick@blueprintadvocate.com'
    else email
  end,
  brand_id = 'rockphorm',
  partner_access_level = 'full',
  access_scope = 'brand_only',
  admin_scope = 'ROCKPHORM',
  store_slug = 'rockphorm',
  owner_email = 'rick@blueprintadvocate.com',
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
where lower(coalesce(email, owner_email, '')) in ('rick@blueprintadvocate.com', 'rick@blueprintadvocate.io')
   or (upper(coalesce(admin_scope, '')) = 'ROCKPHORM' and lower(coalesce(store_slug, '')) = 'rockphorm');

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select id, 'rockphorm', 'full', 'active'
from public.profiles
where lower(coalesce(email, owner_email, '')) in ('rick@blueprintadvocate.com', 'rick@blueprintadvocate.io')
   or (upper(coalesce(admin_scope, '')) = 'ROCKPHORM' and lower(coalesce(store_slug, '')) = 'rockphorm')
on conflict (profile_id, brand_id) do update set
  access_level = 'full',
  status = 'active';

update public.reps
set
  payout_email = case
    when upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
      or lower(coalesce(custom_store_slug, assigned_store_slug, '')) = 'rockphorm'
      or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
      or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
      then 'rick@blueprintadvocate.com'
    else payout_email
  end,
  brand_id = case
    when upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
      or lower(coalesce(custom_store_slug, assigned_store_slug, '')) in ('rockphorm', 'klow')
      or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
      or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
      or upper(coalesce(brand_name, '')) like '%KLOW%'
      then 'rockphorm'
    else brand_id
  end,
  parent_brand_id = case
    when lower(coalesce(custom_store_slug, assigned_store_slug, '')) = 'klow'
      or upper(coalesce(brand_name, '')) like '%KLOW%'
      then 'rockphorm'
    else parent_brand_id
  end,
  assigned_store_slug = case
    when lower(coalesce(custom_store_slug, assigned_store_slug, '')) = 'klow'
      or upper(coalesce(brand_name, '')) like '%KLOW%'
      then 'klow'
    when upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
      or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
      or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
      then 'rockphorm'
    else assigned_store_slug
  end,
  updated_at = now()
where lower(coalesce(payout_email, '')) in ('rick@blueprintadvocate.com', 'rick@blueprintadvocate.io')
   or upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
   or lower(coalesce(custom_store_slug, assigned_store_slug, '')) in ('rockphorm', 'klow')
   or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
   or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
   or upper(coalesce(brand_name, '')) like '%KLOW%';
