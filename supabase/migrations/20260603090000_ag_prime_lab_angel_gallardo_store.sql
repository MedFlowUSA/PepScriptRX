-- AG Prime Lab / Angel Gallardo storefront under Mark Ayala / Empire Health & Wellness.
-- Split of net profit after true cost: Angel 45%, Mark override 20%, PepScriptRX platform 35%.
-- True cost is supplier wholesale cost plus 15% landing cost before commissions.

create extension if not exists pgcrypto;

alter table public.reps
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text,
  add column if not exists override_percent numeric,
  add column if not exists platform_percent numeric,
  add column if not exists rep_tier text,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean default false,
  add column if not exists attribution_window_days integer default 30,
  add column if not exists payout_method text,
  add column if not exists paypal_link text,
  add column if not exists rep_channel text,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb,
  add column if not exists active boolean default true;

alter table public.distributor_products
  add column if not exists commission_rate numeric(5,4);

do $$
declare
  angel_email text := 'legacystrengthco@gmail.com';
  angel_password text := 'Angel1!';
  angel_auth_id uuid;
  angel_profile_id uuid;
  angel_rep_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
  ag_price_list jsonb := '[
    {"id":"agprime-retatrutide-10mg","product_name":"Retatrutide","strength":"10mg","category":"GLP / Weight Management","price":229},
    {"id":"agprime-retatrutide-20mg","product_name":"Retatrutide","strength":"20mg","category":"GLP / Weight Management","price":299},
    {"id":"agprime-retatrutide-30mg","product_name":"Retatrutide","strength":"30mg","category":"GLP / Weight Management","price":349},
    {"id":"agprime-tirzepatide-10mg","product_name":"Tirzepatide","strength":"10mg","category":"GLP / Weight Management","price":129},
    {"id":"agprime-tirzepatide-20mg","product_name":"Tirzepatide","strength":"20mg","category":"GLP / Weight Management","price":169},
    {"id":"agprime-tirzepatide-30mg","product_name":"Tirzepatide","strength":"30mg","category":"GLP / Weight Management","price":199},
    {"id":"agprime-semaglutide-10mg","product_name":"Semaglutide","strength":"10mg","category":"GLP / Weight Management","price":99},
    {"id":"agprime-bpc-157-5mg","product_name":"BPC-157","strength":"5mg","category":"Recovery / Performance / Wellness","price":99},
    {"id":"agprime-bpc-157-10mg","product_name":"BPC-157","strength":"10mg","category":"Recovery / Performance / Wellness","price":139},
    {"id":"agprime-tb-500-5mg","product_name":"TB-500","strength":"5mg","category":"Recovery / Performance / Wellness","price":99},
    {"id":"agprime-tb-500-10mg","product_name":"TB-500","strength":"10mg","category":"Recovery / Performance / Wellness","price":149},
    {"id":"agprime-bpc-157-tb-500-blend","product_name":"BPC-157 / TB-500 Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":159},
    {"id":"agprime-nad-plus","product_name":"NAD+","strength":"Standard","category":"Recovery / Performance / Wellness","price":149},
    {"id":"agprime-glutathione-1500mg","product_name":"Glutathione","strength":"1500mg","category":"Recovery / Performance / Wellness","price":149},
    {"id":"agprime-ghk-cu-100mg","product_name":"GHK-Cu","strength":"100mg","category":"Recovery / Performance / Wellness","price":129},
    {"id":"agprime-glow-peptide-blend","product_name":"Glow Peptide Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":169},
    {"id":"agprime-tesamorelin-5mg","product_name":"Tesamorelin","strength":"5mg","category":"Recovery / Performance / Wellness","price":149},
    {"id":"agprime-tesamorelin-10mg","product_name":"Tesamorelin","strength":"10mg","category":"Recovery / Performance / Wellness","price":199},
    {"id":"agprime-sermorelin","product_name":"Sermorelin","strength":"Standard","category":"Recovery / Performance / Wellness","price":129},
    {"id":"agprime-ipamorelin","product_name":"Ipamorelin","strength":"Standard","category":"Recovery / Performance / Wellness","price":129},
    {"id":"agprime-cjc-1295-ipamorelin","product_name":"CJC-1295 / Ipamorelin","strength":"Blend","category":"Recovery / Performance / Wellness","price":169},
    {"id":"agprime-hgh-somatropin","product_name":"HGH / Somatropin","strength":"Standard","category":"Recovery / Performance / Wellness","price":199},
    {"id":"agprime-aod-9604-10mg","product_name":"AOD-9604","strength":"10mg","category":"Additional Catalog / Optional","price":169},
    {"id":"agprime-melanotan-ii","product_name":"Melanotan II","strength":"Standard","category":"Additional Catalog / Optional","price":119},
    {"id":"agprime-mots-c-10mg","product_name":"MOTS-c","strength":"10mg","category":"Additional Catalog / Optional","price":149},
    {"id":"agprime-selank","product_name":"Selank","strength":"Standard","category":"Additional Catalog / Optional","price":119},
    {"id":"agprime-semax","product_name":"Semax","strength":"Standard","category":"Additional Catalog / Optional","price":119},
    {"id":"agprime-bac-water-syringe-kit","product_name":"BAC Water + 8-Pack Syringe Kit","strength":"Kit","category":"Functional / Supplies","price":12},
    {"id":"agprime-reusable-pen-kit","product_name":"Reusable Pen Kit","strength":"Kit","category":"Functional / Supplies","price":19},
    {"id":"agprime-insulin-syringe-pack","product_name":"Insulin Syringe Pack","strength":"Pack","category":"Functional / Supplies","price":12}
  ]'::jsonb;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  limit 1;

  if mark_rep_id is null then
    raise exception 'Cannot create AG Prime Lab because MARK65 rep was not found.';
  end if;

  update public.profiles
  set role = 'rx_plus_admin'
  where id = mark_profile_id;

  select id
    into angel_auth_id
  from auth.users
  where lower(email) = lower(angel_email)
  order by created_at desc
  limit 1;

  if angel_auth_id is null then
    angel_auth_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      angel_auth_id,
      'authenticated',
      'authenticated',
      angel_email,
      extensions.crypt(angel_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Angel Gallardo","brand":"AG Prime Lab"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      angel_auth_id,
      angel_auth_id::text,
      jsonb_build_object('sub', angel_auth_id::text, 'email', angel_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  select id
    into angel_profile_id
  from public.profiles
  where auth_user_id = angel_auth_id
     or lower(coalesce(email, '')) = lower(angel_email)
  order by created_at desc
  limit 1;

  if angel_profile_id is null then
    angel_profile_id := angel_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      angel_profile_id,
      angel_auth_id,
      'Angel Gallardo',
      angel_email,
      '626-529-6681',
      'rep'
    );
  else
    update public.profiles
    set
      auth_user_id = angel_auth_id,
      full_name = 'Angel Gallardo',
      email = angel_email,
      phone = '626-529-6681',
      role = 'rep'
    where id = angel_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_name,
    handle,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    override_percent,
    platform_percent,
    rep_tier,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    paypal_link,
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    active
  )
  values (
    angel_profile_id,
    'Angel Gallardo',
    'AG Prime Lab',
    'EMPIRE-DOWNLINE-AGPRIME45',
    'AGPRIME45',
    'net_profit_after_true_cost',
    0.45,
    0.20,
    0.35,
    'empire_sub_rep',
    'AGPRIME45',
    0,
    '/agprimelab',
    true,
    60,
    'Manual PayPal payout',
    'A13gallardo@gmail.com',
    null,
    'empire_downline',
    mark_rep_id,
    mark_profile_id,
    'agprimelab',
    'AG Prime Lab',
    '{"palette":["#ffffff","#0f172a","#94a3b8","#0068d9"],"style":"clean modern performance recovery lab-grade premium","logo":"/marketing/ag-prime-lab-logo.png","productImage":"/marketing/ag-prime-lab-vial.png","tagline":"Recover Better. - Perform Stronger.","trueCostRule":"supplier wholesale cost plus 15% landing cost"}'::jsonb,
    ag_price_list,
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    override_percent = excluded.override_percent,
    platform_percent = excluded.platform_percent,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    paypal_link = excluded.paypal_link,
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
    active = true
  returning id into angel_rep_id;
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
  'Angel Gallardo',
  'agprime',
  'AG Prime Lab',
  0.45,
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

create temp table ag_prime_product_seed (
  product_slug text,
  product_name text,
  category text,
  strength text,
  sku text,
  retail_price numeric(10,2),
  is_featured boolean
) on commit drop;

insert into ag_prime_product_seed (product_slug, product_name, category, strength, sku, retail_price, is_featured)
values
  ('agprime-retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'AGPRIME-RETATRUTIDE-10MG', 229, true),
  ('agprime-retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'AGPRIME-RETATRUTIDE-20MG', 299, true),
  ('agprime-retatrutide-30mg', 'Retatrutide', 'GLP / Weight Management', '30mg', 'AGPRIME-RETATRUTIDE-30MG', 349, true),
  ('agprime-tirzepatide-10mg', 'Tirzepatide', 'GLP / Weight Management', '10mg', 'AGPRIME-TIRZEPATIDE-10MG', 129, true),
  ('agprime-tirzepatide-20mg', 'Tirzepatide', 'GLP / Weight Management', '20mg', 'AGPRIME-TIRZEPATIDE-20MG', 169, true),
  ('agprime-tirzepatide-30mg', 'Tirzepatide', 'GLP / Weight Management', '30mg', 'AGPRIME-TIRZEPATIDE-30MG', 199, true),
  ('agprime-semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'AGPRIME-SEMAGLUTIDE-10MG', 99, true),
  ('agprime-bpc-157-5mg', 'BPC-157', 'Recovery / Performance / Wellness', '5mg', 'AGPRIME-BPC-157-5MG', 99, true),
  ('agprime-bpc-157-10mg', 'BPC-157', 'Recovery / Performance / Wellness', '10mg', 'AGPRIME-BPC-157-10MG', 139, true),
  ('agprime-tb-500-5mg', 'TB-500', 'Recovery / Performance / Wellness', '5mg', 'AGPRIME-TB-500-5MG', 99, false),
  ('agprime-tb-500-10mg', 'TB-500', 'Recovery / Performance / Wellness', '10mg', 'AGPRIME-TB-500-10MG', 149, false),
  ('agprime-bpc-157-tb-500-blend', 'BPC-157 / TB-500 Blend', 'Recovery / Performance / Wellness', 'Blend', 'AGPRIME-BPC-157-TB-500-BLEND', 159, true),
  ('agprime-nad-plus', 'NAD+', 'Recovery / Performance / Wellness', 'Standard', 'AGPRIME-NAD-PLUS', 149, false),
  ('agprime-glutathione-1500mg', 'Glutathione', 'Recovery / Performance / Wellness', '1500mg', 'AGPRIME-GLUTATHIONE-1500MG', 149, false),
  ('agprime-ghk-cu-100mg', 'GHK-Cu', 'Recovery / Performance / Wellness', '100mg', 'AGPRIME-GHK-CU-100MG', 129, false),
  ('agprime-glow-peptide-blend', 'Glow Peptide Blend', 'Recovery / Performance / Wellness', 'Blend', 'AGPRIME-GLOW-PEPTIDE-BLEND', 169, false),
  ('agprime-tesamorelin-5mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '5mg', 'AGPRIME-TESAMORELIN-5MG', 149, false),
  ('agprime-tesamorelin-10mg', 'Tesamorelin', 'Recovery / Performance / Wellness', '10mg', 'AGPRIME-TESAMORELIN-10MG', 199, true),
  ('agprime-sermorelin', 'Sermorelin', 'Recovery / Performance / Wellness', 'Standard', 'AGPRIME-SERMORELIN', 129, false),
  ('agprime-ipamorelin', 'Ipamorelin', 'Recovery / Performance / Wellness', 'Standard', 'AGPRIME-IPAMORELIN', 129, false),
  ('agprime-cjc-1295-ipamorelin', 'CJC-1295 / Ipamorelin', 'Recovery / Performance / Wellness', 'Blend', 'AGPRIME-CJC-1295-IPAMORELIN', 169, true),
  ('agprime-hgh-somatropin', 'HGH / Somatropin', 'Recovery / Performance / Wellness', 'Standard', 'AGPRIME-HGH-SOMATROPIN', 199, false),
  ('agprime-aod-9604-10mg', 'AOD-9604', 'Additional Catalog / Optional', '10mg', 'AGPRIME-AOD-9604-10MG', 169, false),
  ('agprime-melanotan-ii', 'Melanotan II', 'Additional Catalog / Optional', 'Standard', 'AGPRIME-MELANOTAN-II', 119, false),
  ('agprime-mots-c-10mg', 'MOTS-c', 'Additional Catalog / Optional', '10mg', 'AGPRIME-MOTS-C-10MG', 149, false),
  ('agprime-selank', 'Selank', 'Additional Catalog / Optional', 'Standard', 'AGPRIME-SELANK', 119, false),
  ('agprime-semax', 'Semax', 'Additional Catalog / Optional', 'Standard', 'AGPRIME-SEMAX', 119, false),
  ('agprime-bac-water-syringe-kit', 'BAC Water + 8-Pack Syringe Kit', 'Functional / Supplies', 'Kit', 'AGPRIME-BAC-WATER-SYRINGE-KIT', 12, false),
  ('agprime-reusable-pen-kit', 'Reusable Pen Kit', 'Functional / Supplies', 'Kit', 'AGPRIME-REUSABLE-PEN-KIT', 19, false),
  ('agprime-insulin-syringe-pack', 'Insulin Syringe Pack', 'Functional / Supplies', 'Pack', 'AGPRIME-INSULIN-SYRINGE-PACK', 12, false);

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
  'AG Prime Lab catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
from ag_prime_product_seed
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
  0.45
from ag_prime_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'agprime'
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
  updated_at = now();

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
  'AGPRIME45',
  'AG Prime Lab',
  'rep',
  'AGPRIME45',
  'MARK65',
  true,
  0.45,
  'AG Prime Lab checkout scope for Angel Gallardo under Mark Ayala / Empire Health & Wellness. Angel receives 45% of net profit after supplier wholesale cost plus 15% landing cost. Mark receives Empire downline override.'
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
  'ANGEL45',
  'AG Prime Lab / Angel Gallardo Alias',
  'rep',
  'AGPRIME45',
  'MARK65',
  true,
  0.45,
  'Alias checkout scope for AG Prime Lab. Prefer AGPRIME45 for public storefront attribution.'
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

do $$
begin
  if to_regclass('public.rep_store_intake_submissions') is not null then
    update public.rep_store_intake_submissions
    set
      status = 'reviewing',
      store_type = 'Rep storefront under Empire Health & Wellness',
      store_brand_name = 'AG Prime Lab',
      desired_rep_code = 'AGPRIME45',
      paypal_account = 'A13gallardo@gmail.com',
      parent_rep_or_admin_name = 'Mark Ayala / Empire Health & Wellness',
      preferred_color_1 = 'white',
      preferred_color_2 = 'black',
      preferred_color_3 = 'silver / electric blue',
      brand_style_notes = 'Clean, modern, performance, recovery, lab-grade, premium. Tagline: Recover Better. - Perform Stronger.',
      updated_at = now()
    where lower(coalesce(email, '')) = lower('legacystrengthco@gmail.com')
       or desired_rep_code in ('AGPRIME45', 'ANGEL45')
       or lower(coalesce(store_brand_name, '')) = 'ag prime lab';

    if not found then
      insert into public.rep_store_intake_submissions (
        status,
        full_name,
        email,
        phone,
        paypal_account,
        parent_rep_or_admin_name,
        desired_rep_code,
        store_type,
        store_brand_name,
        logo_needed,
        preferred_color_1,
        preferred_color_2,
        preferred_color_3,
        brand_style_notes,
        selected_products,
        internal_notes
      )
      values (
        'reviewing',
        'Angel Gallardo',
        'legacystrengthco@gmail.com',
        '626-529-6681',
        'A13gallardo@gmail.com',
        'Mark Ayala / Empire Health & Wellness',
        'AGPRIME45',
        'Rep storefront under Empire Health & Wellness',
        'AG Prime Lab',
        'Logo supplied',
        'white',
        'black',
        'silver / electric blue',
        'Clean, modern, performance, recovery, lab-grade, premium. Tagline: Recover Better. - Perform Stronger.',
        (select jsonb_agg(jsonb_build_object('product_name', product_name, 'strength', strength, 'requested_price', retail_price)) from ag_prime_product_seed),
        'AG Prime Lab storefront configured at /agprimelab. Angel receives 45% net-profit commission after true cost; MARK65 is the Empire parent scope.'
      );
    end if;
  end if;
end $$;
