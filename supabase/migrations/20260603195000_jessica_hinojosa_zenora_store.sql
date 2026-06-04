-- Jessica Hinojosa / ZENORA Precision Wellness & Peptide Therapy storefront.
-- Creates a rep login/profile, JESS8 attribution, Empire parent rollup, and Zenora pricing metadata.

create extension if not exists pgcrypto;

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
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists override_percent numeric not null default 0,
  add column if not exists platform_percent numeric not null default 0;

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

do $$
declare
  jess_email text := 'Jess.hinojosa8@gmail.com';
  jess_password text := 'Jessica1!';
  jess_auth_id uuid;
  jess_profile_id uuid;
  mark_rep_id uuid;
  mark_profile_id uuid;
begin
  select id, profile_id
    into mark_rep_id, mark_profile_id
  from public.reps
  where rep_slug = 'MARK65'
  order by created_at desc
  limit 1;

  select id
    into jess_auth_id
  from auth.users
  where lower(email) = lower(jess_email)
  order by created_at desc
  limit 1;

  if jess_auth_id is null then
    jess_auth_id := gen_random_uuid();

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
      jess_auth_id,
      'authenticated',
      'authenticated',
      jess_email,
      extensions.crypt(jess_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Jessica Hinojosa',
        'phone', '(909) 809-2082',
        'role', 'rep',
        'rep_code', 'JESS8',
        'store_slug', 'zenora',
        'must_change_password', true
      ),
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
      jess_auth_id,
      jess_auth_id::text,
      jsonb_build_object('sub', jess_auth_id::text, 'email', jess_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(jess_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Jessica Hinojosa',
          'phone', '(909) 809-2082',
          'role', 'rep',
          'rep_code', 'JESS8',
          'store_slug', 'zenora',
          'must_change_password', true
        ),
      updated_at = now()
    where id = jess_auth_id;
  end if;

  select id
    into jess_profile_id
  from public.profiles
  where auth_user_id = jess_auth_id
     or lower(coalesce(email, '')) = lower(jess_email)
  order by
    case when auth_user_id = jess_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if jess_profile_id is null then
    jess_profile_id := jess_auth_id;
    insert into public.profiles (id, auth_user_id, full_name, email, phone, role)
    values (jess_profile_id, jess_auth_id, 'Jessica Hinojosa', jess_email, '(909) 809-2082', 'rep');
  else
    update public.profiles
    set
      auth_user_id = jess_auth_id,
      full_name = 'Jessica Hinojosa',
      email = jess_email,
      phone = '(909) 809-2082',
      role = 'rep'
    where id = jess_profile_id;
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
    rep_channel,
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
    jess_profile_id,
    'Jessica Hinojosa',
    'ZENORA',
    'SUBREP-JESS8',
    'JESS8',
    'net_profit_after_true_cost',
    0.45,
    0.20,
    0.35,
    'empire_sub_rep',
    'JESS8',
    0,
    '/zenora',
    true,
    60,
    'Manual PayPal payout',
    jess_email,
    'empire_downline',
    mark_rep_id,
    mark_profile_id,
    'zenora',
    'ZENORA Precision Wellness & Peptide Therapy',
    jsonb_build_object(
      'palette', jsonb_build_array('#050403', '#D4AF37', '#FACC15', '#FFFFFF'),
      'style', 'luxury wellness, concierge peptide therapy, longevity optimization, black and gold premium anti-aging clinic',
      'logo', '/marketing/zenora-logo.jpeg',
      'productImage', '/marketing/zenora-vial.png',
      'parentAdmin', 'MARK65',
      'parentStore', 'Empire Health & Wellness',
      'trueCostRule', 'supplier wholesale cost plus 15 percent landing expense'
    ),
    'rep',
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
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true;

  if to_regclass('public.checkout_scopes') is not null then
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
      'JESS8',
      'ZENORA Precision Wellness & Peptide Therapy',
      'rep',
      'JESS8',
      'MARK65',
      true,
      0.45,
      'Jessica Hinojosa Zenora storefront. Net Profit = retail sale price minus landing cost; landing cost = supplier cost + 15% landing expense. Rolls up under Mark Ayala / Empire Health & Wellness.'
    )
    on conflict (scope_code) do update set
      display_name = excluded.display_name,
      account_type = excluded.account_type,
      account_id = excluded.account_id,
      parent_account_id = excluded.parent_account_id,
      is_active = true,
      default_commission_rate = excluded.default_commission_rate,
      notes = excluded.notes,
      updated_at = now();
  end if;
end $$;

insert into public.distributors (
  name,
  slug,
  portal_name,
  commission_rate,
  is_active,
  white_label_enabled,
  wholesale_enabled
)
values (
  'Jessica Hinojosa',
  'zenora',
  'ZENORA Precision Wellness & Peptide Therapy',
  0.45,
  true,
  true,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

create temp table zenora_product_seed (
  product_slug text,
  product_name text,
  category text,
  retail_price numeric(10,2)
) on commit drop;

insert into zenora_product_seed (product_slug, product_name, category, retail_price)
values
  ('zenora-retatrutide-5mg', 'Retatrutide 5mg', 'Weight Loss / GLP-1', 80),
  ('zenora-retatrutide-10mg', 'Retatrutide 10mg', 'Weight Loss / GLP-1', 100),
  ('zenora-retatrutide-15mg', 'Retatrutide 15mg', 'Weight Loss / GLP-1', 150),
  ('zenora-retatrutide-20mg', 'Retatrutide 20mg', 'Weight Loss / GLP-1', 250),
  ('zenora-retatrutide-30mg', 'Retatrutide 30mg', 'Weight Loss / GLP-1', 350),
  ('zenora-tirzepatide-10mg', 'Tirzepatide 10mg', 'Weight Loss / GLP-1', 100),
  ('zenora-tirzepatide-15mg', 'Tirzepatide 15mg', 'Weight Loss / GLP-1', 150),
  ('zenora-tirzepatide-20mg', 'Tirzepatide 20mg', 'Weight Loss / GLP-1', 200),
  ('zenora-tirzepatide-30mg', 'Tirzepatide 30mg', 'Weight Loss / GLP-1', 350),
  ('zenora-tirzepatide-60mg', 'Tirzepatide 60mg', 'Weight Loss / GLP-1', 600),
  ('zenora-semaglutide-10mg', 'Semaglutide 10mg', 'Weight Loss / GLP-1', 150),
  ('zenora-bpc-157', 'BPC-157', 'Recovery / Repair', 150),
  ('zenora-tb-500', 'TB-500', 'Recovery / Repair', 150),
  ('zenora-bpc-157-tb-500-blend', 'BPC-157 / TB-500 Blend', 'Recovery / Repair', 300),
  ('zenora-nad-plus', 'NAD+', 'Wellness / Anti-Aging', 250),
  ('zenora-glutathione', 'Glutathione', 'Wellness / Anti-Aging', 100),
  ('zenora-ghk-cu', 'GHK-Cu', 'Recovery / Repair', 100),
  ('zenora-glow-blend', 'Glow Blend', 'Recovery / Repair', 300),
  ('zenora-mots-c', 'MOTS-C', 'Wellness / Anti-Aging', 250),
  ('zenora-kisspeptin', 'Kisspeptin', 'Growth Hormone / Longevity', 200),
  ('zenora-selank', 'Selank', 'Neuro / Cognitive / Mood', 200),
  ('zenora-semax', 'Semax', 'Neuro / Cognitive / Mood', 200);

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
  product_name,
  category,
  retail_price,
  retail_price,
  true,
  '/marketing/zenora-vial.png',
  'JESS8',
  'zenora'
from zenora_product_seed
on conflict (store_slug, product_slug) do update set
  product_name = excluded.product_name,
  category = excluded.category,
  retail_price = excluded.retail_price,
  display_price = excluded.display_price,
  is_active = true,
  image_path = excluded.image_path,
  admin_code = excluded.admin_code,
  updated_at = now();
