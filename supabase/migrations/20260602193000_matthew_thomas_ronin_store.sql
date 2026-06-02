-- Matthew Thomas / Ronin white-label storefront launch.

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
  add column if not exists parent_rep_id uuid references public.reps(id),
  add column if not exists managed_by_profile_id uuid references public.profiles(id),
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb,
  add column if not exists active boolean default true;

alter table public.distributor_products
  add column if not exists commission_rate numeric(5,4);

do $$
declare
  matt_email text := 'matt.gray.thomas@gmail.com';
  matt_password text := 'Matt1!';
  matt_auth_id uuid;
  matt_profile_id uuid;
  ronin_price_list jsonb := '[
    {"id":"ronin-retatrutide-10mg","product_name":"Retatrutide","strength":"10mg","category":"GLP / Weight Management","price":229},
    {"id":"ronin-retatrutide-20mg","product_name":"Retatrutide","strength":"20mg","category":"GLP / Weight Management","price":299},
    {"id":"ronin-bpc-157-10mg","product_name":"BPC-157","strength":"10mg","category":"Recovery / Repair","price":139},
    {"id":"ronin-tb-500-10mg","product_name":"TB-500","strength":"10mg","category":"Recovery / Repair","price":149},
    {"id":"ronin-tesamorelin-10mg","product_name":"Tesamorelin","strength":"10mg","category":"Growth / Performance","price":199},
    {"id":"ronin-sermorelin","product_name":"Sermorelin","strength":"Standard","category":"Growth / Performance","price":129},
    {"id":"ronin-ipamorelin","product_name":"Ipamorelin","strength":"Standard","category":"Growth / Performance","price":129},
    {"id":"ronin-cjc-1295-ipamorelin","product_name":"CJC-1295 / Ipamorelin","strength":"Blend","category":"Growth / Performance","price":169},
    {"id":"ronin-hgh-somatropin","product_name":"HGH / Somatropin","strength":"Standard","category":"Growth / Performance","price":199},
    {"id":"ronin-mots-c-10mg","product_name":"MOTS-c","strength":"10mg","category":"Longevity / Wellness","price":149},
    {"id":"ronin-bac-water-syringe-kit","product_name":"BAC Water + 8-Pack Syringe Kit","strength":"Kit","category":"Functional / Supplies","price":12},
    {"id":"ronin-insulin-syringe-pack","product_name":"Insulin Syringe Pack","strength":"Pack","category":"Functional / Supplies","price":12}
  ]'::jsonb;
begin
  select id
    into matt_auth_id
  from auth.users
  where lower(email) = lower(matt_email)
  order by created_at desc
  limit 1;

  if matt_auth_id is null then
    matt_auth_id := gen_random_uuid();

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
      matt_auth_id,
      'authenticated',
      'authenticated',
      matt_email,
      extensions.crypt(matt_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Matthew Thomas","brand":"Ronin"}'::jsonb,
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
      matt_auth_id,
      matt_auth_id::text,
      jsonb_build_object('sub', matt_auth_id::text, 'email', matt_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  select id
    into matt_profile_id
  from public.profiles
  where auth_user_id = matt_auth_id
     or lower(coalesce(email, '')) = lower(matt_email)
  order by created_at desc
  limit 1;

  if matt_profile_id is null then
    matt_profile_id := matt_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    values (
      matt_profile_id,
      matt_auth_id,
      'Matthew Thomas',
      matt_email,
      'rx_plus_admin'
    );
  else
    update public.profiles
    set
      auth_user_id = matt_auth_id,
      full_name = 'Matthew Thomas',
      email = matt_email,
      role = 'rx_plus_admin'
    where id = matt_profile_id;
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
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    active
  )
  values (
    matt_profile_id,
    'Matthew Thomas',
    'Ronin',
    'WHITE-LABEL-MGT1111',
    'MGT1111',
    'net_profit_share',
    0.45,
    0,
    0.55,
    'white_label_admin',
    'MGT1111',
    0,
    '/ronin',
    true,
    60,
    'Manual PayPal payout',
    'Elise@getcookieco.com',
    null,
    'white_label',
    matt_profile_id,
    'ronin',
    'Ronin',
    '{"palette":["#030305","#ffffff","#991b1b","#cbd5e1"],"style":"Japanese samurai minimalist founder gym brand disciplined premium","logo":"/marketing/ronin-logo.svg","productImage":"/marketing/ronin-vial.svg"}'::jsonb,
    ronin_price_list,
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
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
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
  'Matthew Thomas',
  'ronin',
  'Ronin',
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

create temp table ronin_product_seed (
  product_slug text,
  product_name text,
  category text,
  strength text,
  sku text,
  retail_price numeric(10,2),
  is_featured boolean
) on commit drop;

insert into ronin_product_seed (product_slug, product_name, category, strength, sku, retail_price, is_featured)
values
  ('ronin-retatrutide-10mg', 'Retatrutide', 'GLP / Weight Management', '10mg', 'RONIN-RETATRUTIDE-10MG', 229, true),
  ('ronin-retatrutide-20mg', 'Retatrutide', 'GLP / Weight Management', '20mg', 'RONIN-RETATRUTIDE-20MG', 299, true),
  ('ronin-bpc-157-10mg', 'BPC-157', 'Recovery / Repair', '10mg', 'RONIN-BPC-157-10MG', 139, true),
  ('ronin-tb-500-10mg', 'TB-500', 'Recovery / Repair', '10mg', 'RONIN-TB-500-10MG', 149, true),
  ('ronin-tesamorelin-10mg', 'Tesamorelin', 'Growth / Performance', '10mg', 'RONIN-TESAMORELIN-10MG', 199, true),
  ('ronin-sermorelin', 'Sermorelin', 'Growth / Performance', 'Standard', 'RONIN-SERMORELIN', 129, true),
  ('ronin-ipamorelin', 'Ipamorelin', 'Growth / Performance', 'Standard', 'RONIN-IPAMORELIN', 129, true),
  ('ronin-cjc-1295-ipamorelin', 'CJC-1295 / Ipamorelin', 'Growth / Performance', 'Blend', 'RONIN-CJC-1295-IPAMORELIN', 169, true),
  ('ronin-hgh-somatropin', 'HGH / Somatropin', 'Growth / Performance', 'Standard', 'RONIN-HGH-SOMATROPIN', 199, false),
  ('ronin-mots-c-10mg', 'MOTS-c', 'Longevity / Wellness', '10mg', 'RONIN-MOTS-C-10MG', 149, false),
  ('ronin-bac-water-syringe-kit', 'BAC Water + 8-Pack Syringe Kit', 'Functional / Supplies', 'Kit', 'RONIN-BAC-WATER-SYRINGE-KIT', 12, false),
  ('ronin-insulin-syringe-pack', 'Insulin Syringe Pack', 'Functional / Supplies', 'Pack', 'RONIN-INSULIN-SYRINGE-PACK', 12, false);

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
  'Ronin catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
from ronin_product_seed
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
from ronin_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'ronin'
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
  'MGT1111',
  'Ronin',
  'rep',
  'MGT1111',
  null,
  true,
  0.45,
  'Ronin white-label checkout scope for Matthew Thomas. Public storefront displays Ronin only.'
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
      store_type = 'White-label storefront',
      store_brand_name = 'Ronin',
      desired_rep_code = 'MGT1111',
      paypal_account = 'Elise@getcookieco.com',
      preferred_color_1 = 'black',
      preferred_color_2 = 'white',
      preferred_color_3 = 'red / silver',
      brand_style_notes = 'Japanese samurai, minimalist, founder/gym brand, disciplined and premium',
      updated_at = now()
    where lower(coalesce(email, '')) = lower('matt.gray.thomas@gmail.com')
       or desired_rep_code = 'MGT1111'
       or lower(coalesce(store_brand_name, '')) = 'ronin';

    if not found then
      insert into public.rep_store_intake_submissions (
        status,
        full_name,
        email,
        paypal_account,
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
        'Matthew Thomas',
        'matt.gray.thomas@gmail.com',
        'Elise@getcookieco.com',
        'MGT1111',
        'White-label storefront',
        'Ronin',
        'Logo supplied',
        'black',
        'white',
        'red / silver',
        'Japanese samurai, minimalist, founder/gym brand, disciplined and premium',
        '[
          {"product_name":"Retatrutide","strength":"10mg","requested_price":229},
          {"product_name":"Retatrutide","strength":"20mg","requested_price":299},
          {"product_name":"BPC-157","strength":"10mg","requested_price":139},
          {"product_name":"TB-500","strength":"10mg","requested_price":149},
          {"product_name":"Tesamorelin","strength":"10mg","requested_price":199},
          {"product_name":"Sermorelin","strength":"Standard","requested_price":129},
          {"product_name":"Ipamorelin","strength":"Standard","requested_price":129},
          {"product_name":"CJC-1295 / Ipamorelin","strength":"Blend","requested_price":169},
          {"product_name":"HGH / Somatropin","strength":"Standard","requested_price":199},
          {"product_name":"MOTS-c","strength":"10mg","requested_price":149},
          {"product_name":"BAC Water + 8-Pack Syringe Kit","strength":"Kit","requested_price":12},
          {"product_name":"Insulin Syringe Pack","strength":"Pack","requested_price":12}
        ]'::jsonb,
        'Ronin white-label storefront launched at /ronin with MGT1111 checkout attribution.'
      );
    end if;
  end if;
end $$;
