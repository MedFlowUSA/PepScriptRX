-- Rock Phorm white-label admin storefront for Rick Diaz.

do $$
declare
  rick_email text := 'rick@blueprintadvocate.io';
  rick_profile_id uuid;
  rick_rep_id uuid;
begin
  select id
    into rick_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = lower(rick_email)
  order by created_at desc
  limit 1;

  if rick_profile_id is null then
    insert into public.profiles (email, full_name, role)
    values (rick_email, 'Rick Diaz', 'admin')
    returning id into rick_profile_id;
  else
    update public.profiles
    set
      email = rick_email,
      full_name = coalesce(nullif(full_name, ''), 'Rick Diaz'),
      role = 'admin'
    where id = rick_profile_id;
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
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    account_type,
    parent_type,
    active
  )
  values (
    rick_profile_id,
    'Rick Diaz',
    'Rock Phorm',
    'PLATFORM-ADMIN-ROCKPHORM',
    'ROCKPHORM',
    'net_profit_after_true_cost',
    0.55,
    0,
    0.45,
    'platform_admin_store',
    'ROCKPHORM',
    0,
    '/rockphorm',
    true,
    60,
    'PepScriptRX Admin Store',
    rick_email,
    null,
    'white_label_admin_store',
    'rockphorm',
    'Rock Phorm',
    '{"palette":["#030712","#14b8a6","#22d3ee","#ffffff"],"style":"premium performance wellness brand, dark clinical, teal and cyan accents","logo":"/marketing/rockphorm-logo.png","productImage":"/marketing/rockphorm-vial.png","trueCostRule":"customer amount collected minus true landed product fulfillment shipping payment costs"}'::jsonb,
    '[
      {"id":"rockphorm-retatrutide-15mg","product_name":"Retatrutide","strength":"15mg","category":"GLP / Weight Management","price":168},
      {"id":"rockphorm-retatrutide-30mg","product_name":"Retatrutide","strength":"30mg","category":"GLP / Weight Management","price":298},
      {"id":"rockphorm-tirzepatide-15mg","product_name":"Tirzepatide","strength":"15mg","category":"GLP / Weight Management","price":149},
      {"id":"rockphorm-tirzepatide-30mg","product_name":"Tirzepatide","strength":"30mg","category":"GLP / Weight Management","price":199},
      {"id":"rockphorm-semaglutide-10mg","product_name":"Semaglutide","strength":"10mg","category":"GLP / Weight Management","price":99},
      {"id":"rockphorm-cagrisema","product_name":"CagriSema","strength":"Blend","category":"GLP / Weight Management","price":198},
      {"id":"rockphorm-cagrilintide-5mg","product_name":"Cagrilintide","strength":"5mg","category":"GLP / Weight Management","price":169},
      {"id":"rockphorm-bpc-157-10mg","product_name":"BPC-157","strength":"10mg","category":"Recovery / Performance / Wellness","price":139},
      {"id":"rockphorm-tb-500-10mg","product_name":"TB-500","strength":"10mg","category":"Recovery / Performance / Wellness","price":149},
      {"id":"rockphorm-bpc-157-tb-500-blend","product_name":"BPC-157 / TB-500 Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":159},
      {"id":"rockphorm-nad-plus","product_name":"NAD+","strength":"Standard","category":"Longevity / Wellness","price":149},
      {"id":"rockphorm-glutathione-1500mg","product_name":"Glutathione","strength":"1500mg","category":"Longevity / Wellness","price":149},
      {"id":"rockphorm-ghk-cu-100mg","product_name":"GHK-Cu","strength":"100mg","category":"Recovery / Performance / Wellness","price":129},
      {"id":"rockphorm-glow-peptide-blend","product_name":"Glow Peptide Blend","strength":"Blend","category":"Recovery / Performance / Wellness","price":169},
      {"id":"rockphorm-tesamorelin-10mg","product_name":"Tesamorelin","strength":"10mg","category":"Growth / Performance","price":169},
      {"id":"rockphorm-cjc-1295-ipamorelin","product_name":"CJC-1295 / Ipamorelin","strength":"Blend","category":"Growth / Performance","price":169},
      {"id":"rockphorm-hgh-somatropin","product_name":"HGH / Somatropin","strength":"Standard","category":"Growth / Performance","price":199}
    ]'::jsonb,
    'admin',
    'platform',
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
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true
  returning id into rick_rep_id;
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
  'Rick Diaz',
  'rockphorm',
  'Rock Phorm',
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

create temp table rockphorm_product_seed (
  product_slug text,
  product_name text,
  category text,
  strength text,
  sku text,
  retail_price numeric(10,2),
  is_featured boolean
) on commit drop;

insert into rockphorm_product_seed (product_slug, product_name, category, strength, sku, retail_price, is_featured)
values
  ('rockphorm-retatrutide-15mg', 'Retatrutide', 'GLP / Weight Management', '15mg', 'ROCKPHORM-RETATRUTIDE-15MG', 168, true),
  ('rockphorm-retatrutide-30mg', 'Retatrutide', 'GLP / Weight Management', '30mg', 'ROCKPHORM-RETATRUTIDE-30MG', 298, true),
  ('rockphorm-tirzepatide-15mg', 'Tirzepatide', 'GLP / Weight Management', '15mg', 'ROCKPHORM-TIRZEPATIDE-15MG', 149, true),
  ('rockphorm-tirzepatide-30mg', 'Tirzepatide', 'GLP / Weight Management', '30mg', 'ROCKPHORM-TIRZEPATIDE-30MG', 199, true),
  ('rockphorm-semaglutide-10mg', 'Semaglutide', 'GLP / Weight Management', '10mg', 'ROCKPHORM-SEMAGLUTIDE-10MG', 99, true),
  ('rockphorm-cagrisema', 'CagriSema', 'GLP / Weight Management', 'Blend', 'ROCKPHORM-CAGRISEMA', 198, true),
  ('rockphorm-cagrilintide-5mg', 'Cagrilintide', 'GLP / Weight Management', '5mg', 'ROCKPHORM-CAGRILINTIDE-5MG', 169, true),
  ('rockphorm-bpc-157-10mg', 'BPC-157', 'Recovery / Performance / Wellness', '10mg', 'ROCKPHORM-BPC-157-10MG', 139, true),
  ('rockphorm-tb-500-10mg', 'TB-500', 'Recovery / Performance / Wellness', '10mg', 'ROCKPHORM-TB-500-10MG', 149, false),
  ('rockphorm-bpc-157-tb-500-blend', 'BPC-157 / TB-500 Blend', 'Recovery / Performance / Wellness', 'Blend', 'ROCKPHORM-BPC-157-TB-500-BLEND', 159, true),
  ('rockphorm-nad-plus', 'NAD+', 'Longevity / Wellness', 'Standard', 'ROCKPHORM-NAD-PLUS', 149, false),
  ('rockphorm-glutathione-1500mg', 'Glutathione', 'Longevity / Wellness', '1500mg', 'ROCKPHORM-GLUTATHIONE-1500MG', 149, false),
  ('rockphorm-ghk-cu-100mg', 'GHK-Cu', 'Recovery / Performance / Wellness', '100mg', 'ROCKPHORM-GHK-CU-100MG', 129, false),
  ('rockphorm-glow-peptide-blend', 'Glow Peptide Blend', 'Recovery / Performance / Wellness', 'Blend', 'ROCKPHORM-GLOW-PEPTIDE-BLEND', 169, false),
  ('rockphorm-tesamorelin-10mg', 'Tesamorelin', 'Growth / Performance', '10mg', 'ROCKPHORM-TESAMORELIN-10MG', 169, true),
  ('rockphorm-cjc-1295-ipamorelin', 'CJC-1295 / Ipamorelin', 'Growth / Performance', 'Blend', 'ROCKPHORM-CJC-1295-IPAMORELIN', 169, true),
  ('rockphorm-hgh-somatropin', 'HGH / Somatropin', 'Growth / Performance', 'Standard', 'ROCKPHORM-HGH-SOMATROPIN', 199, false);

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
  'Rock Phorm catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
from rockphorm_product_seed
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
from rockphorm_product_seed s
join public.rx_plus_products p on p.sku = s.sku
join public.distributors d on d.slug = 'rockphorm'
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
  'ROCKPHORM',
  'Rock Phorm',
  'admin',
  'ROCKPHORM',
  null,
  true,
  0.55,
  'Rock Phorm checkout scope for Rick Diaz. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'
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
      store_type = 'White-label platform admin storefront',
      store_brand_name = 'Rock Phorm',
      desired_rep_code = 'ROCKPHORM',
      preferred_color_1 = '#030712',
      preferred_color_2 = '#14b8a6',
      preferred_color_3 = '#22d3ee',
      brand_style_notes = 'Premium performance wellness brand with dark clinical styling and teal/cyan accents.',
      selected_products = (select jsonb_agg(jsonb_build_object('product_name', product_name, 'strength', strength, 'requested_price', retail_price)) from rockphorm_product_seed),
      internal_notes = concat_ws(E'\n', nullif(internal_notes, ''), 'Launched at /rockphorm with ROCKPHORM admin scope. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'),
      updated_at = now()
    where lower(coalesce(email, '')) = lower('rick@blueprintadvocate.io')
       or desired_rep_code = 'ROCKPHORM'
       or lower(coalesce(store_brand_name, '')) = 'rock phorm';

    if not found then
      insert into public.rep_store_intake_submissions (
        status,
        full_name,
        email,
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
        'Rick Diaz',
        'rick@blueprintadvocate.io',
        'PepScriptRX Platform',
        'ROCKPHORM',
        'White-label platform admin storefront',
        'Rock Phorm',
        'Logo supplied',
        '#030712',
        '#14b8a6',
        '#22d3ee',
        'Premium performance wellness brand with dark clinical styling and teal/cyan accents.',
        (select jsonb_agg(jsonb_build_object('product_name', product_name, 'strength', strength, 'requested_price', retail_price)) from rockphorm_product_seed),
        'Launched at /rockphorm with ROCKPHORM admin scope. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'
      );
    end if;
  end if;
end $$;
