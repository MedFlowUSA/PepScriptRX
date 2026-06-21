-- GLOW Sheer Radiance storefront for Vanessa Cosio.
-- Password creation/reset is intentionally handled through Supabase Auth tooling.
-- Vanessa's Zelle details are internal payout notes only and must not be exposed in public checkout.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists rep_channel text,
  add column if not exists payout_method text,
  add column if not exists payout_email text,
  add column if not exists attribution_window_days integer not null default 60,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists override_percent numeric not null default 0,
  add column if not exists platform_percent numeric not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.distributor_products
  add column if not exists commission_rate numeric(5,4);

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
  'Vanessa Cosio',
  'glow',
  'GLOW',
  0.8000,
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

insert into public.reps (
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
  custom_store_slug,
  brand_name,
  brand_theme,
  account_type,
  parent_type,
  active
)
values (
  'Vanessa Cosio',
  'GLOW',
  'STORE-GLOW',
  'GLOW',
  'net_profit_after_true_cost',
  0.8000,
  0,
  0.2000,
  'partner_admin_store',
  'GLOW',
  0,
  '/glow',
  true,
  60,
  'Manual Zelle payout from main app/admin process only',
  'vanessacosio@ymail.com',
  'premium_beauty_wellness_storefront',
  'glow',
  'GLOW',
  jsonb_build_object(
    'tagline', 'Sheer Radiance',
    'palette', jsonb_build_array('#f6d5d0', '#b8dcd8', '#b88a3d', '#fffaf4', '#2f2527'),
    'style', 'premium female-centered peptide wellness and beauty storefront',
    'logo', '/brands/glow/glow-peptide-complex.png',
    'heroImage', '/brands/glow/glow-luxury-gift.png',
    'payoutNotes', jsonb_build_object(
      'method', 'manual_zelle',
      'recipient', 'Vanessa Cosio',
      'phone', '909-488-8118',
      'publicCheckout', false,
      'paypal', false
    ),
    'commissionRule', '80 percent after true landing cost'
  ),
  'admin',
  'platform',
  true
)
on conflict (rep_slug) do update set
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
  custom_store_slug = excluded.custom_store_slug,
  brand_name = excluded.brand_name,
  brand_theme = excluded.brand_theme,
  account_type = excluded.account_type,
  parent_type = excluded.parent_type,
  active = true,
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
  'GLOW',
  'GLOW Sheer Radiance',
  'admin',
  'GLOW',
  null,
  true,
  0.8000,
  'GLOW storefront for Vanessa Cosio. Commission basis: 80% of net profit after true landing cost. Internal payout only: manual Zelle to Vanessa Cosio at 909-488-8118. Do not expose Zelle in customer checkout and do not use PayPal for Vanessa commission payout.'
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

create temporary table glow_product_seed (
  sku text primary key,
  product_name text not null,
  category text not null,
  strength text not null,
  retail_price numeric not null,
  is_featured boolean not null,
  description text not null
) on commit drop;

insert into glow_product_seed (sku, product_name, category, strength, retail_price, is_featured, description)
values
  ('RXP-REC-GLOW', 'GLOW', 'Beauty & Radiance', '70 mg total', 169, true, 'Signature beauty-focused peptide complex for radiance, skin-focused wellness support, recovery support, and an elevated beauty-from-within routine.'),
  ('RXP-REC-GHKCU-100', 'GHK-Cu', 'Beauty & Radiance', '100mg', 119, true, 'Beauty and skin-support peptide commonly associated with skin quality, cosmetic wellness routines, and repair-focused support.'),
  ('RXP-LONG-GLUTA-1500', 'Glutathione', 'Beauty & Radiance', '1500mg', 179, true, 'Master antioxidant option commonly selected for beauty, wellness, and cellular support routines.'),
  ('RXP-LONG-NAD-500', 'NAD+', 'Energy & Longevity', '500 IU', 119, true, 'Premium longevity and cellular energy support option for energy, clarity, recovery, and healthy aging routines.'),
  ('RXP-LONG-NAD-1000', 'NAD+', 'Energy & Longevity', '1000 IU', 179, true, 'Elevated longevity and cellular energy support option for wellness optimization and fatigue-conscious routines.'),
  ('RXP-REC-KLOW', 'Klow Peptide Blend', 'Beauty & Radiance', 'Blend', 169, true, 'Wellness and recovery support option designed for repair, calm, and whole-body wellness support.'),
  ('RXP-GROW-TESA-10', 'Tesamorelin', 'Body Goals & Metabolic Wellness', '10mg', 229, false, 'Wellness and body-composition support option often selected for advanced metabolic routines.'),
  ('RXP-GLP-AOD-10', 'AOD-9604', 'Body Goals & Metabolic Wellness', '10mg', 199, false, 'Body-composition-focused peptide option commonly selected for metabolic and physique support.'),
  ('RXP-GLP-SEMA-10', 'Semaglutide', 'Body Goals & Metabolic Wellness', '10mg', 99, false, 'Popular metabolic wellness option commonly selected for structured support on a wellness journey.'),
  ('RXP-GLP-TIRZ-30', 'Tirzepatide', 'Body Goals & Metabolic Wellness', '30mg', 600, false, 'Physician-reviewed metabolic wellness option commonly selected for structured body-goal support under appropriate guidance.'),
  ('RXP-GLP-TIRZ-60', 'Tirzepatide', 'Body Goals & Metabolic Wellness', '60mg', 950, false, 'Higher-strength physician-reviewed metabolic wellness option for structured body-goal support under appropriate guidance.'),
  ('RXP-GLP-RETA-15', 'Retatrutide', 'Body Goals & Metabolic Wellness', '15mg', 250, false, 'Advanced metabolic wellness option for customers looking for a physician-reviewed body-goal support pathway.'),
  ('RXP-GLP-CAGRISEMA', 'CagriSema', 'Body Goals & Metabolic Wellness', 'Blend', 450, false, 'Advanced metabolic support blend for customers pursuing a structured, physician-reviewed wellness pathway.'),
  ('RXP-LONG-MOTSC-10', 'MOTS-C', 'Energy & Longevity', '10mg', 129, false, 'Mitochondrial wellness option commonly selected for energy, longevity, and recovery-focused routines.'),
  ('RXP-REC-BPC157-10', 'BPC-157', 'Recovery & Repair', '10mg', 99, false, 'Recovery support peptide commonly selected for repair-focused wellness routines.'),
  ('RXP-REC-TB500-10', 'TB-500', 'Recovery & Repair', '10mg', 169, false, 'Recovery support option commonly selected for mobility, repair, and wellness routines.'),
  ('RXP-REC-WOLV', 'Wolverine Stack', 'Recovery & Repair', 'Blend', 149, false, 'BPC-157 and TB-500 recovery stack commonly selected by advanced wellness customers.'),
  ('RXP-GROW-CJCIPA-10', 'CJC + Ipamorelin', 'Additional Wellness & Performance', '10mg', 149, false, 'Advanced performance and recovery support blend placed lower in the GLOW catalog.'),
  ('RXP-LONG-NAD-100', 'NAD+', 'Energy & Longevity', '100 IU', 69, false, 'Cellular energy support option for wellness-focused routines.'),
  ('RXP-GROW-HGH-10', 'HGH', 'Additional Wellness & Performance', '10iu', 99, false, 'Advanced performance support item subject to verification.'),
  ('RXP-GROW-HGH-15', 'HGH', 'Additional Wellness & Performance', '15iu', 149, false, 'Advanced performance support item subject to verification.'),
  ('RXP-GROW-HGH-24', 'HGH', 'Additional Wellness & Performance', '24iu', 199, false, 'Advanced performance support item subject to verification.'),
  ('RXP-GROW-HGH-36', 'HGH', 'Additional Wellness & Performance', '36iu', 279, false, 'Advanced performance support item subject to verification.'),
  ('RXP-GROW-IGF1-LR3-1', 'IGF-1 LR3', 'Additional Wellness & Performance', '1mg', 199, false, 'Advanced growth and performance support item requiring additional verification.');

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
  description
from glow_product_seed
on conflict (sku) do update set
  active = true,
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
  0.8000
from glow_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'glow'
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
  updated_at = now();

do $$
declare
  glow_rep_id uuid;
  vanessa_auth_id uuid;
begin
  select id into glow_rep_id
  from public.reps
  where rep_slug = 'GLOW'
  limit 1;

  update public.reps
  set
    parent_rep_id = glow_rep_id,
    parent_type = 'glow_downline',
    updated_at = now()
  where rep_slug in ('DEAN50', 'GINTO')
    and glow_rep_id is not null;

  select id into vanessa_auth_id
  from auth.users
  where lower(coalesce(email, '')) = 'vanessacosio@ymail.com'
  order by created_at desc
  limit 1;

  if vanessa_auth_id is not null then
    insert into public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      admin_scope,
      store_slug,
      owner_email,
      updated_at
    )
    values (
      vanessa_auth_id,
      vanessa_auth_id,
      'vanessacosio@ymail.com',
      'Vanessa Cosio',
      'admin',
      'GLOW',
      'glow',
      'vanessacosio@ymail.com',
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = excluded.full_name,
      role = 'admin',
      admin_scope = 'GLOW',
      store_slug = 'glow',
      owner_email = excluded.owner_email,
      updated_at = now();

    update public.reps
    set
      profile_id = vanessa_auth_id,
      updated_at = now()
    where rep_slug = 'GLOW';
  end if;
end $$;

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into function_sql;

  if function_sql is not null and function_sql not like '%then ''glow''%' then
    function_sql := replace(
      function_sql,
      'when v_store_hint like ''%anatolia%'' then ''anatolia''',
      'when v_store_hint like ''%glow%'' or v_scope_code = ''GLOW'' then ''glow''
    when v_store_hint like ''%anatolia%'' then ''anatolia'''
    );

    if function_sql not like '%then ''glow''%' then
      function_sql := replace(
        function_sql,
        'else null',
        'when v_store_hint like ''%glow%'' or v_scope_code = ''GLOW'' then ''glow''
    else null'
      );
    end if;

    execute function_sql;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;

do $$
begin
  if to_regclass('public.product_intelligence_store_visibility') is not null
     and to_regclass('public.product_intelligence_products') is not null then
    insert into public.product_intelligence_store_visibility (
      product_key,
      store_key,
      store_name,
      visible,
      source
    )
    select
      p.product_key,
      'glow',
      'GLOW',
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
  end if;
end $$;
