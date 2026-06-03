-- Vyigenix Pharmaceuticals / John Paul Theis admin storefront under Mark Ayala / Empire Health & Wellness.
-- John receives 50% of net profit after true landed cost. True landed cost is supplier cost plus 15%.
-- Mark/Empire remains the parent hierarchy scope for visibility and override logic.

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
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists active boolean default true;

alter table public.distributor_products
  add column if not exists commission_rate numeric(5,4);

do $$
declare
  john_email text := 'VyigenixPharma@proton.me';
  john_password text := 'JPT123!';
  john_auth_id uuid;
  john_profile_id uuid;
  john_rep_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
  vyigenix_price_list jsonb := '[
    {"id":"vyigenix-retatrutide-10mg","product_name":"Retatrutide","strength":"10mg","category":"GLP / Weight Management","price":229},
    {"id":"vyigenix-retatrutide-20mg","product_name":"Retatrutide","strength":"20mg","category":"GLP / Weight Management","price":299},
    {"id":"vyigenix-tirzepatide-10mg","product_name":"Tirzepatide","strength":"10mg","category":"GLP / Weight Management","price":129},
    {"id":"vyigenix-tirzepatide-20mg","product_name":"Tirzepatide","strength":"20mg","category":"GLP / Weight Management","price":169},
    {"id":"vyigenix-semaglutide-10mg","product_name":"Semaglutide","strength":"10mg","category":"GLP / Weight Management","price":99},
    {"id":"vyigenix-cagrilintide-5mg","product_name":"Cagrilintide","strength":"5mg","category":"GLP / Weight Management","price":179},
    {"id":"vyigenix-bpc-157-10mg","product_name":"BPC-157","strength":"10mg","category":"Recovery / Performance / Wellness","price":139},
    {"id":"vyigenix-tb-500-10mg","product_name":"TB-500","strength":"10mg","category":"Recovery / Performance / Wellness","price":149},
    {"id":"vyigenix-bpc-157-tb-500-blend","product_name":"BPC-157 / TB-500 Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":159},
    {"id":"vyigenix-nad-plus","product_name":"NAD+","strength":"Standard","category":"Recovery / Performance / Wellness","price":149},
    {"id":"vyigenix-glutathione-1500mg","product_name":"Glutathione","strength":"1500mg","category":"Recovery / Performance / Wellness","price":149},
    {"id":"vyigenix-ghk-cu-100mg","product_name":"GHK-Cu","strength":"100mg","category":"Recovery / Performance / Wellness","price":129},
    {"id":"vyigenix-glow-peptide-blend","product_name":"Glow Peptide Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":169},
    {"id":"vyigenix-tesamorelin-10mg","product_name":"Tesamorelin","strength":"10mg","category":"Growth / Performance","price":199},
    {"id":"vyigenix-sermorelin","product_name":"Sermorelin","strength":"Standard","category":"Growth / Performance","price":129},
    {"id":"vyigenix-cjc-1295-ipamorelin","product_name":"CJC-1295 / Ipamorelin","strength":"Blend","category":"Growth / Performance","price":169},
    {"id":"vyigenix-hgh-somatropin","product_name":"HGH / Somatropin","strength":"Standard","category":"Growth / Performance","price":199}
  ]'::jsonb;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  limit 1;

  if mark_rep_id is null then
    raise exception 'Cannot create Vyigenix Pharmaceuticals because MARK65 rep was not found.';
  end if;

  update public.profiles
  set role = 'rx_plus_admin'
  where id = mark_profile_id;

  select id
    into john_auth_id
  from auth.users
  where lower(email) = lower(john_email)
  order by created_at desc
  limit 1;

  if john_auth_id is null then
    john_auth_id := gen_random_uuid();

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
      john_auth_id,
      'authenticated',
      'authenticated',
      john_email,
      extensions.crypt(john_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"John Paul Theis","brand":"Vyigenix Pharmaceuticals"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(john_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"John Paul Theis","brand":"Vyigenix Pharmaceuticals"}'::jsonb
    where id = john_auth_id;
  end if;

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
    john_auth_id,
    john_auth_id::text,
    jsonb_build_object('sub', john_auth_id::text, 'email', john_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  select id
    into john_profile_id
  from public.profiles
  where auth_user_id = john_auth_id
     or lower(coalesce(email, '')) = lower(john_email)
  order by created_at desc
  limit 1;

  if john_profile_id is null then
    john_profile_id := john_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      john_profile_id,
      john_auth_id,
      'John Paul Theis',
      john_email,
      '3108711532',
      'rx_plus_admin'
    );
  else
    update public.profiles
    set
      auth_user_id = john_auth_id,
      full_name = 'John Paul Theis',
      email = john_email,
      phone = '3108711532',
      role = 'rx_plus_admin'
    where id = john_profile_id;
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
    account_type,
    parent_type,
    active
  )
  values (
    john_profile_id,
    'John Paul Theis',
    'Vyigenix Pharmaceuticals',
    'EMPIRE-ADMIN-VYIGENIX',
    'VYIGENIX',
    'net_profit_after_true_cost',
    0.50,
    0.20,
    0.30,
    'empire_admin_store',
    'VYIGENIX',
    0,
    '/vyigenix',
    true,
    60,
    'PepScriptRX Admin Store',
    john_email,
    null,
    'white_label_admin_store',
    mark_rep_id,
    mark_profile_id,
    'vyigenix',
    'Vyigenix Pharmaceuticals',
    '{"palette":["#25C7D9","#111111","#FFFFFF"],"style":"modern luxury wellness brand, clean medical aesthetic, premium clinical, minimalist","logo":"/marketing/vyigenix-logo.png","productImage":"/marketing/vyigenix-vial.png","trueCostRule":"supplier cost plus 15% true landing cost adjustment"}'::jsonb,
    vyigenix_price_list,
    'admin',
    'empire_downline',
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
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true
  returning id into john_rep_id;
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
  'John Paul Theis',
  'vyigenix',
  'Vyigenix Pharmaceuticals',
  0.50,
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

create temp table vyigenix_product_seed (
  product_slug text,
  product_name text,
  category text,
  strength text,
  sku text,
  retail_price numeric(10,2),
  is_featured boolean
) on commit drop;

insert into vyigenix_product_seed (product_slug, product_name, category, strength, sku, retail_price, is_featured)
values
  ('vyigenix-retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'VYIGENIX-RETATRUTIDE-10MG', 229, true),
  ('vyigenix-retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'VYIGENIX-RETATRUTIDE-20MG', 299, true),
  ('vyigenix-tirzepatide-10mg', 'Tirzepatide', 'GLP / Weight Management', '10mg', 'VYIGENIX-TIRZEPATIDE-10MG', 129, true),
  ('vyigenix-tirzepatide-20mg', 'Tirzepatide', 'GLP / Weight Management', '20mg', 'VYIGENIX-TIRZEPATIDE-20MG', 169, true),
  ('vyigenix-semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'VYIGENIX-SEMAGLUTIDE-10MG', 99, true),
  ('vyigenix-cagrilintide-5mg', 'Cagrilintide', 'GLP / Weight Management', '5mg', 'VYIGENIX-CAGRILINTIDE-5MG', 179, true),
  ('vyigenix-bpc-157-10mg', 'BPC-157', 'Recovery / Performance / Wellness', '10mg', 'VYIGENIX-BPC-157-10MG', 139, true),
  ('vyigenix-tb-500-10mg', 'TB-500', 'Recovery / Performance / Wellness', '10mg', 'VYIGENIX-TB-500-10MG', 149, true),
  ('vyigenix-bpc-157-tb-500-blend', 'BPC-157 / TB-500 Blend', 'Recovery / Performance / Wellness', 'Blend', 'VYIGENIX-BPC-157-TB-500-BLEND', 159, true),
  ('vyigenix-nad-plus', 'NAD+', 'Recovery / Performance / Wellness', 'Standard', 'VYIGENIX-NAD-PLUS', 149, false),
  ('vyigenix-glutathione-1500mg', 'Glutathione', 'Recovery / Performance / Wellness', '1500mg', 'VYIGENIX-GLUTATHIONE-1500MG', 149, false),
  ('vyigenix-ghk-cu-100mg', 'GHK-Cu', 'Recovery / Performance / Wellness', '100mg', 'VYIGENIX-GHK-CU-100MG', 129, false),
  ('vyigenix-glow-peptide-blend', 'Glow Peptide Blend', 'Recovery / Performance / Wellness', 'Blend', 'VYIGENIX-GLOW-PEPTIDE-BLEND', 169, false),
  ('vyigenix-tesamorelin-10mg', 'Tesamorelin', 'Growth / Performance', '10mg', 'VYIGENIX-TESAMORELIN-10MG', 199, true),
  ('vyigenix-sermorelin', 'Sermorelin', 'Growth / Performance', 'Standard', 'VYIGENIX-SERMORELIN', 129, false),
  ('vyigenix-cjc-1295-ipamorelin', 'CJC-1295 / Ipamorelin', 'Growth / Performance', 'Blend', 'VYIGENIX-CJC-1295-IPAMORELIN', 169, true),
  ('vyigenix-hgh-somatropin', 'HGH / Somatropin', 'Growth / Performance', 'Standard', 'VYIGENIX-HGH-SOMATROPIN', 199, false);

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
  'Vyigenix Pharmaceuticals catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
from vyigenix_product_seed
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
  0.50
from vyigenix_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'vyigenix'
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
  'VYIGENIX',
  'Vyigenix Pharmaceuticals',
  'admin',
  'VYIGENIX',
  'MARK65',
  true,
  0.50,
  'Vyigenix Pharmaceuticals checkout scope for John Paul Theis under Mark Ayala / Empire Health & Wellness. John receives 50% of net profit after supplier cost plus 15% true landing cost adjustment. Mark/Empire parent hierarchy remains active.'
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
      status = 'launched',
      store_type = 'White-label admin storefront under Empire Health & Wellness',
      store_brand_name = 'Vyigenix Pharmaceuticals',
      desired_rep_code = 'VYIGENIX',
      parent_rep_or_admin_name = 'Mark Ayala / Empire Health & Wellness',
      preferred_color_1 = '#25C7D9',
      preferred_color_2 = '#111111',
      preferred_color_3 = '#FFFFFF',
      brand_style_notes = 'Modern luxury wellness brand, clean medical aesthetic, dark/black/white with cyan-blue accents, premium clinical feel, minimalist layout.',
      selected_products = (select jsonb_agg(jsonb_build_object('product_name', product_name, 'strength', strength, 'requested_price', retail_price)) from vyigenix_product_seed),
      internal_notes = concat_ws(E'\n', nullif(internal_notes, ''), 'Launched at /vyigenix with VYIGENIX admin scope. Commission basis: 50% net profit after supplier cost plus 15% true landing cost adjustment. Parent hierarchy: MARK65 / Empire Health & Wellness.'),
      updated_at = now()
    where lower(coalesce(email, '')) = lower('VyigenixPharma@proton.me')
       or desired_rep_code = 'VYIGENIX'
       or lower(coalesce(store_brand_name, '')) = 'vyigenix pharmaceuticals';

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
        'launched',
        'John Paul Theis',
        'VyigenixPharma@proton.me',
        '3108711532',
        null,
        'Mark Ayala / Empire Health & Wellness',
        'VYIGENIX',
        'White-label admin storefront under Empire Health & Wellness',
        'Vyigenix Pharmaceuticals',
        'Logo supplied',
        '#25C7D9',
        '#111111',
        '#FFFFFF',
        'Modern luxury wellness brand, clean medical aesthetic, dark/black/white with cyan-blue accents, premium clinical feel, minimalist layout.',
        (select jsonb_agg(jsonb_build_object('product_name', product_name, 'strength', strength, 'requested_price', retail_price)) from vyigenix_product_seed),
        'Launched at /vyigenix with VYIGENIX admin scope. Commission basis: 50% net profit after supplier cost plus 15% true landing cost adjustment. Parent hierarchy: MARK65 / Empire Health & Wellness.'
      );
    end if;
  end if;
end $$;
