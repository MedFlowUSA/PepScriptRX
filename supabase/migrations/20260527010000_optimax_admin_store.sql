-- Gabriel Martinez / Optimax Peptide Therapy admin storefront.
-- Internal share is stored for ledger calculations only; public storefronts show retail pricing only.

create extension if not exists pgcrypto;

alter table public.patient_submissions
  add column if not exists admin_code text,
  add column if not exists store_slug text,
  add column if not exists store_name text,
  add column if not exists account_type text,
  add column if not exists parent_type text;

alter table public.reps
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists rep_channel text,
  add column if not exists payout_method text,
  add column if not exists attribution_window_days integer not null default 60,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb,
  add column if not exists account_type text,
  add column if not exists parent_type text;

alter table public.distributor_products
  add column if not exists commission_rate numeric(5,4);

create table if not exists public.store_product_pricing (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  product_name text not null,
  category text not null,
  retail_price numeric(10,2) not null,
  display_price numeric(10,2),
  is_active boolean not null default true,
  image_path text,
  admin_code text not null,
  store_slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_slug, product_slug)
);

alter table public.store_product_pricing enable row level security;

drop policy if exists "Admins manage store product pricing" on public.store_product_pricing;
create policy "Admins manage store product pricing"
  on public.store_product_pricing for all
  using (
    exists (
      select 1 from public.profiles p
      where (p.id = auth.uid() or p.auth_user_id = auth.uid())
        and p.role in ('admin', 'rx_plus_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where (p.id = auth.uid() or p.auth_user_id = auth.uid())
        and p.role in ('admin', 'rx_plus_admin')
    )
  );

drop trigger if exists store_product_pricing_touch_updated_at on public.store_product_pricing;
create trigger store_product_pricing_touch_updated_at
before update on public.store_product_pricing
for each row execute function public.touch_updated_at();

do $$
declare
  gabriel_email text := 'gmart36@gmail.com';
  gabriel_auth_id uuid;
  gabriel_profile_id uuid;
begin
  select id into gabriel_auth_id
  from auth.users
  where lower(email) = lower(gabriel_email)
  order by created_at desc
  limit 1;

  select id into gabriel_profile_id
  from public.profiles
  where (gabriel_auth_id is not null and auth_user_id = gabriel_auth_id)
     or lower(coalesce(email, '')) = lower(gabriel_email)
     or lower(coalesce(full_name, '')) = 'gabriel martinez'
  order by
    case when gabriel_auth_id is not null and auth_user_id = gabriel_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if gabriel_profile_id is null and gabriel_auth_id is not null then
    gabriel_profile_id := gabriel_auth_id;
    insert into public.profiles (id, auth_user_id, full_name, email, role)
    values (gabriel_profile_id, gabriel_auth_id, 'Gabriel Martinez', gabriel_email, 'admin');
  elsif gabriel_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, gabriel_auth_id),
      full_name = 'Gabriel Martinez',
      email = coalesce(nullif(email, ''), gabriel_email),
      role = 'admin'
    where id = gabriel_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_name,
    handle,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    rep_tier,
    rep_channel,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    account_type,
    parent_type,
    active
  )
  values (
    gabriel_profile_id,
    'Gabriel Martinez',
    'Gabe',
    'GABE50',
    'GABE50',
    'internal_admin_share',
    0.55,
    'admin_store',
    'admin_store',
    'GABE50',
    0,
    '/optimax-peptide-therapy',
    true,
    60,
    'PepScriptRX Platform Admin Store',
    gabriel_email,
    null,
    null,
    'optimax-peptide-therapy',
    'Optimax Peptide Therapy',
    '{"palette":["#061425","#0c5f76","#19c7d9","#7bdc2a","#ffffff"],"style":"premium wellness biotech athletic optimization"}'::jsonb,
    'admin',
    'platform',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    rep_tier = excluded.rep_tier,
    rep_channel = excluded.rep_channel,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    parent_rep_id = null,
    managed_by_profile_id = null,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true;
end $$;

insert into public.distributors (
  name,
  slug,
  portal_name,
  commission_rate,
  is_active,
  white_label_enabled,
  wholesale_enabled
) values (
  'Gabriel Martinez',
  'optimax',
  'Optimax Peptide Therapy',
  0.55,
  true,
  true,
  false
) on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

create temp table optimax_product_seed (
  product_slug text,
  product_name text,
  category text,
  strength text,
  sku text,
  retail_price numeric(10,2),
  is_featured boolean
) on commit drop;

insert into optimax_product_seed (product_slug, product_name, category, strength, sku, retail_price, is_featured)
values
  ('optimax-retatrutide-5mg', 'Retatrutide', 'GLP / Weight Management', '5mg', 'OPT-RETATRUTIDE-5MG', 119, true),
  ('optimax-retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'OPT-RETATRUTIDE-10MG', 169, true),
  ('optimax-retatrutide-15mg', 'Retatrutide', 'GLP / Weight Management', '15mg', 'OPT-RETATRUTIDE-15MG', 229, true),
  ('optimax-retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'OPT-RETATRUTIDE-20MG', 289, true),
  ('optimax-retatrutide-30mg', 'Retatrutide', 'GLP / Weight Management', '30mg', 'OPT-RETATRUTIDE-30MG', 379, true),
  ('optimax-tirzepatide-10mg', 'Tirzepatide', 'GLP / Weight Management', '10mg', 'OPT-TIRZEPATIDE-10MG', 109, true),
  ('optimax-tirzepatide-15mg', 'Tirzepatide', 'GLP / Weight Management', '15mg', 'OPT-TIRZEPATIDE-15MG', 149, true),
  ('optimax-tirzepatide-20mg', 'Tirzepatide', 'GLP / Weight Management', '20mg', 'OPT-TIRZEPATIDE-20MG', 189, true),
  ('optimax-tirzepatide-30mg', 'Tirzepatide', 'GLP / Weight Management', '30mg', 'OPT-TIRZEPATIDE-30MG', 259, true),
  ('optimax-tirzepatide-60mg', 'Tirzepatide', 'GLP / Weight Management', '60mg', 'OPT-TIRZEPATIDE-60MG', 429, true),
  ('optimax-semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'OPT-SEMAGLUTIDE-10MG', 99, true),
  ('optimax-cagrisema', 'CagriSema', 'GLP / Weight Management', 'Blend', 'OPT-CAGRISEMA', 299, true),
  ('optimax-cagrilintide-5mg', 'Cagrilintide', 'GLP / Weight Management', '5mg', 'OPT-CAGRILINTIDE-5MG', 179, true),
  ('optimax-bpc-157', 'BPC-157', 'Recovery / Performance / Wellness', 'Standard', 'OPT-BPC-157', 89, false),
  ('optimax-tb-500', 'TB-500', 'Recovery / Performance / Wellness', 'Standard', 'OPT-TB-500', 99, false),
  ('optimax-bpc-157-tb-500-blend', 'BPC-157 / TB-500 Blend', 'Recovery / Performance / Wellness', 'Blend', 'OPT-BPC-157-TB-500-BLEND', 129, true),
  ('optimax-nad-plus', 'NAD+', 'Recovery / Performance / Wellness', 'Standard', 'OPT-NAD-PLUS', 119, false),
  ('optimax-glutathione', 'Glutathione', 'Recovery / Performance / Wellness', 'Standard', 'OPT-GLUTATHIONE', 79, false),
  ('optimax-ghk-cu', 'GHK-Cu', 'Recovery / Performance / Wellness', 'Standard', 'OPT-GHK-CU', 119, false),
  ('optimax-glow-peptide-blend', 'Glow Peptide Blend', 'Recovery / Performance / Wellness', 'Blend', 'OPT-GLOW-PEPTIDE-BLEND', 139, false),
  ('optimax-tesamorelin', 'Tesamorelin', 'Recovery / Performance / Wellness', 'Standard', 'OPT-TESAMORELIN', 179, false),
  ('optimax-sermorelin', 'Sermorelin', 'Recovery / Performance / Wellness', 'Standard', 'OPT-SERMORELIN', 129, false),
  ('optimax-ipamorelin', 'Ipamorelin', 'Recovery / Performance / Wellness', 'Standard', 'OPT-IPAMORELIN', 109, false),
  ('optimax-cjc-1295-ipamorelin', 'CJC-1295 / Ipamorelin', 'Recovery / Performance / Wellness', 'Blend', 'OPT-CJC-1295-IPAMORELIN', 149, false),
  ('optimax-hgh-somatropin', 'HGH / Somatropin', 'Recovery / Performance / Wellness', 'Standard', 'OPT-HGH-SOMATROPIN', 399, false),
  ('optimax-aod-9604', 'AOD-9604', 'Additional Catalog / Optional', 'Standard', 'OPT-AOD-9604', 129, false),
  ('optimax-pt-141', 'PT-141', 'Additional Catalog / Optional', 'Standard', 'OPT-PT-141', 109, false),
  ('optimax-melanotan-ii', 'Melanotan II', 'Additional Catalog / Optional', 'Standard', 'OPT-MELANOTAN-II', 89, false),
  ('optimax-epitalon', 'Epitalon', 'Additional Catalog / Optional', 'Standard', 'OPT-EPITALON', 119, false),
  ('optimax-mots-c', 'MOTS-c', 'Additional Catalog / Optional', 'Standard', 'OPT-MOTS-C', 159, false),
  ('optimax-ss-31', 'SS-31', 'Additional Catalog / Optional', 'Standard', 'OPT-SS-31', 169, false),
  ('optimax-kisspeptin', 'Kisspeptin', 'Additional Catalog / Optional', 'Standard', 'OPT-KISSPEPTIN', 149, false),
  ('optimax-thymosin-alpha-1', 'Thymosin Alpha-1', 'Additional Catalog / Optional', 'Standard', 'OPT-THYMOSIN-ALPHA-1', 149, false),
  ('optimax-dsip', 'DSIP', 'Additional Catalog / Optional', 'Standard', 'OPT-DSIP', 119, false),
  ('optimax-selank', 'Selank', 'Additional Catalog / Optional', 'Standard', 'OPT-SELANK', 109, false),
  ('optimax-semax', 'Semax', 'Additional Catalog / Optional', 'Standard', 'OPT-SEMAX', 109, false),
  ('optimax-ll-37', 'LL-37', 'Additional Catalog / Optional', 'Standard', 'OPT-LL-37', 179, false);

insert into public.rx_plus_products (
  product_name,
  category,
  strength,
  sku,
  suggested_retail_price,
  base_cost,
  active,
  visibility_type,
  description
)
select
  product_name,
  category,
  strength,
  sku,
  retail_price,
  0,
  true,
  'distributor_only',
  'Optimax Peptide Therapy catalog item. Products and availability may vary. All requests are reviewed before fulfillment.'
from optimax_product_seed
on conflict (sku) do update set
  product_name = excluded.product_name,
  category = excluded.category,
  strength = excluded.strength,
  suggested_retail_price = excluded.suggested_retail_price,
  active = true,
  visibility_type = excluded.visibility_type,
  description = excluded.description,
  updated_at = now();

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  s.retail_price,
  s.is_featured,
  0.55
from optimax_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'optimax'
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
  updated_at = now();

insert into public.store_product_pricing (
  product_slug,
  product_name,
  category,
  retail_price,
  display_price,
  is_active,
  image_path,
  admin_code,
  store_slug
)
select
  product_slug,
  case
    when strength in ('Standard', 'Blend') then product_name
    else product_name || ' ' || strength
  end,
  category,
  retail_price,
  retail_price,
  true,
  '/marketing/optimax-vial.png',
  'GABE50',
  'optimax-peptide-therapy'
from optimax_product_seed
on conflict (store_slug, product_slug) do update set
  product_name = excluded.product_name,
  category = excluded.category,
  retail_price = excluded.retail_price,
  display_price = excluded.display_price,
  is_active = excluded.is_active,
  image_path = excluded.image_path,
  admin_code = excluded.admin_code,
  updated_at = now();

create or replace function public.create_public_patient_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := coalesce(nullif(payload->>'id', '')::uuid, gen_random_uuid());
begin
  insert into public.patient_submissions (
    id,
    full_name,
    email,
    phone,
    rep_id,
    medication,
    current_dose,
    current_price,
    state,
    date_of_birth,
    current_pharmacy,
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_speed,
    shipping_cost,
    referral_code,
    discount_code,
    discount_amount,
    status,
    quoted_price,
    product_id,
    product_name,
    product_category,
    product_type,
    selected_addons,
    is_accessory_only,
    submission_type,
    inquiry_notes,
    order_number,
    order_items,
    order_total,
    admin_code,
    store_slug,
    store_name,
    account_type,
    parent_type,
    tracking_url
  )
  values (
    new_id,
    nullif(payload->>'full_name', ''),
    nullif(payload->>'email', ''),
    nullif(payload->>'phone', ''),
    nullif(payload->>'rep_id', '')::uuid,
    nullif(payload->>'medication', ''),
    nullif(payload->>'current_dose', ''),
    nullif(payload->>'current_price', '')::numeric,
    nullif(payload->>'state', ''),
    nullif(payload->>'date_of_birth', '')::date,
    nullif(payload->>'current_pharmacy', ''),
    nullif(payload->>'shipping_address', ''),
    nullif(payload->>'shipping_city', ''),
    nullif(payload->>'shipping_state', ''),
    nullif(payload->>'shipping_zip', ''),
    coalesce(nullif(payload->>'shipping_speed', ''), 'standard'),
    coalesce(nullif(payload->>'shipping_cost', '')::numeric, 0),
    nullif(payload->>'referral_code', ''),
    nullif(payload->>'discount_code', ''),
    coalesce(nullif(payload->>'discount_amount', '')::numeric, 0),
    coalesce(nullif(payload->>'status', ''), 'new_submission'),
    nullif(payload->>'quoted_price', '')::numeric,
    nullif(payload->>'product_id', ''),
    nullif(payload->>'product_name', ''),
    nullif(payload->>'product_category', ''),
    nullif(payload->>'product_type', ''),
    coalesce(payload->'selected_addons', '[]'::jsonb),
    coalesce((payload->>'is_accessory_only')::boolean, false),
    coalesce(nullif(payload->>'submission_type', ''), 'savings_check'),
    nullif(payload->>'inquiry_notes', ''),
    nullif(payload->>'order_number', ''),
    coalesce(payload->'order_items', '[]'::jsonb),
    nullif(payload->>'order_total', '')::numeric,
    nullif(payload->>'admin_code', ''),
    nullif(payload->>'store_slug', ''),
    nullif(payload->>'store_name', ''),
    nullif(payload->>'account_type', ''),
    nullif(payload->>'parent_type', ''),
    nullif(payload->>'tracking_url', '')
  );

  return new_id;
end;
$$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
