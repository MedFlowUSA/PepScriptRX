-- AACTIVATED-RX expanded partner catalog and admin-only internal pricing support.

alter table public.distributors
  add column if not exists partner_slug text,
  add column if not exists featured boolean not null default false,
  add column if not exists image_url text;

alter table public.rx_plus_products
  add column if not exists display_name text,
  add column if not exists supplier_box_cost numeric(10,2),
  add column if not exists vial_count integer not null default 10,
  add column if not exists base_cost_per_vial numeric(10,2),
  add column if not exists landing_cost_multiplier numeric(6,4) not null default 1.1500,
  add column if not exists true_wholesale_cost_per_vial numeric(10,2),
  add column if not exists retail_price numeric(10,2),
  add column if not exists public_visible boolean not null default false,
  add column if not exists partner_visible boolean not null default true,
  add column if not exists partner_slug text,
  add column if not exists featured boolean not null default false,
  add column if not exists image_url text;

alter table public.distributor_products
  add column if not exists enabled boolean,
  add column if not exists custom_retail_price numeric(10,2),
  add column if not exists internal_wholesale_cost_per_vial numeric(10,2),
  add column if not exists commission_rate numeric(5,4);

update public.distributor_products
set enabled = coalesce(enabled, is_enabled),
    custom_retail_price = coalesce(custom_retail_price, custom_price);

insert into public.distributors (
  name, slug, partner_slug, portal_name, commission_rate, is_active, white_label_enabled, wholesale_enabled
) values (
  'Guy', 'guy', 'aactivated', 'AACTIVATED-RX', 0.6000, true, true, true
) on conflict (slug) do update set
  partner_slug = excluded.partner_slug,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

with catalog(sku, product_name, display_name, category, strength, retail_price, wholesale_cost, featured, description) as (
  values
    ('RXP-GLP-RETA-5', 'Retatrutide', 'Retatrutide 5mg', 'GLP / Weight Management', '5mg', 150.00, 8.63, true, 'Partner catalog GLP option for weight-management review.'),
    ('RXP-GLP-RETA-10', 'Retatrutide', 'Retatrutide 10mg', 'GLP / Weight Management', '10mg', 200.00, 12.65, true, 'Partner catalog GLP option for weight-management review.'),
    ('RXP-GLP-RETA-15', 'Retatrutide', 'Retatrutide 15mg', 'GLP / Weight Management', '15mg', 250.00, 16.10, false, 'Partner catalog GLP option for weight-management review.'),
    ('RXP-GLP-RETA-20', 'Retatrutide', 'Retatrutide 20mg', 'GLP / Weight Management', '20mg', 350.00, 20.70, false, 'Expanded GLP option available through AACTIVATED-RX review.'),
    ('RXP-GLP-TIRZ-10', 'Tirzepatide', 'Tirzepatide 10mg', 'GLP / Weight Management', '10mg', 200.00, 6.90, true, 'GLP/GIP weight-management option available through partner review.'),
    ('RXP-GLP-TIRZ-15', 'Tirzepatide', 'Tirzepatide 15mg', 'GLP / Weight Management', '15mg', 250.00, 9.20, false, 'GLP/GIP weight-management option available through partner review.'),
    ('RXP-GLP-TIRZ-20', 'Tirzepatide', 'Tirzepatide 20mg', 'GLP / Weight Management', '20mg', 350.00, 10.93, false, 'Expanded GLP/GIP option available through AACTIVATED-RX review.'),
    ('RXP-GLP-TIRZ-30', 'Tirzepatide', 'Tirzepatide 30mg', 'GLP / Weight Management', '30mg', 600.00, 15.53, true, 'Higher-strength GLP/GIP partner catalog option.'),
    ('RXP-GLP-TIRZ-60', 'Tirzepatide', 'Tirzepatide 60mg', 'GLP / Weight Management', '60mg', 950.00, 24.15, false, 'Expanded high-strength GLP/GIP partner catalog option.'),
    ('RXP-GLP-CAGRISEMA', 'CagriSema', 'CagriSema', 'GLP / Weight Management', 'Blend', 450.00, 20.70, true, 'Expanded partner catalog blend for weight-management review.'),
    ('RXP-GLP-CAGRI-5', 'Cagrilintide', 'Cagrilintide 5mg', 'GLP / Weight Management', '5mg', 220.00, 13.80, false, 'Partner catalog metabolic-support option for clinical review.'),
    ('RXP-GLP-AOD-5', 'AOD-9604', 'AOD-9604 5mg', 'GLP / Weight Management', '5mg', 119.00, 11.39, false, 'Metabolic-support peptide available through partner review.'),
    ('RXP-GLP-AOD-10', 'AOD-9604', 'AOD-9604 10mg', 'GLP / Weight Management', '10mg', 199.00, 21.28, false, 'Metabolic-support peptide available through partner review.'),
    ('RXP-GROW-HGH-10', 'HGH', 'HGH 10iu', 'Growth / Performance', '10iu', 99.00, 6.33, false, 'Growth and performance support item subject to verification.'),
    ('RXP-GROW-HGH-15', 'HGH', 'HGH 15iu', 'Growth / Performance', '15iu', 149.00, 9.20, false, 'Growth and performance support item subject to verification.'),
    ('RXP-GROW-HGH-24', 'HGH', 'HGH 24iu', 'Growth / Performance', '24iu', 199.00, 13.80, false, 'Growth and performance support item subject to verification.'),
    ('RXP-GROW-HGH-36', 'HGH', 'HGH 36iu', 'Growth / Performance', '36iu', 279.00, 20.13, false, 'Growth and performance support item subject to verification.'),
    ('RXP-GROW-TESA-2', 'Tesamorelin', 'Tesamorelin 2mg', 'Growth / Performance', '2mg', 79.00, 7.48, false, 'Growth-hormone pathway support option for clinical review.'),
    ('RXP-GROW-TESA-5', 'Tesamorelin', 'Tesamorelin 5mg', 'Growth / Performance', '5mg', 129.00, 13.23, false, 'Growth-hormone pathway support option for clinical review.'),
    ('RXP-GROW-TESA-10', 'Tesamorelin', 'Tesamorelin 10mg', 'Growth / Performance', '10mg', 229.00, 23.46, true, 'Growth-hormone pathway support option for clinical review.'),
    ('RXP-GROW-CJCIPA-10', 'CJC + Ipamorelin', 'CJC + Ipamorelin 10mg', 'Growth / Performance', '10mg', 149.00, 12.54, true, 'Performance and recovery support blend for clinical review.'),
    ('RXP-GROW-MK677', 'MK-677', 'MK-677', 'Growth / Performance', 'Standard', 79.00, 3.22, false, 'Growth and performance support item in the partner catalog.'),
    ('RXP-REC-WOLV', 'Wolverine BPC/TB Blend', 'Wolverine BPC/TB Blend', 'Recovery / Repair', 'Blend', 149.00, 12.54, true, 'Recovery blend commonly requested for repair and training support review.'),
    ('RXP-REC-BPC157-10', 'BPC-157', 'BPC-157 10mg', 'Recovery / Repair', '10mg', 99.00, 7.48, false, 'Recovery and repair support peptide available through partner review.'),
    ('RXP-REC-TB500-10', 'TB-500', 'TB-500 10mg', 'Recovery / Repair', '10mg', 169.00, 17.83, false, 'Recovery-support peptide available through partner review.'),
    ('RXP-REC-GHKCU-100', 'GHK-CU', 'GHK-CU 100mg', 'Recovery / Repair', '100mg', 119.00, 6.90, false, 'Repair and skin-support peptide available through partner review.'),
    ('RXP-LONG-MOTSC-10', 'MOTS-C', 'MOTS-C 10mg', 'Longevity / Wellness', '10mg', 129.00, 7.48, false, 'Longevity and mitochondrial-support option for wellness review.'),
    ('RXP-LONG-NAD-100', 'NAD+', 'NAD+ 100iu', 'Longevity / Wellness', '100iu', 69.00, 4.60, false, 'Longevity wellness item available through partner review.'),
    ('RXP-LONG-NAD-500', 'NAD+', 'NAD+ 500iu', 'Longevity / Wellness', '500iu', 119.00, 9.43, true, 'Longevity wellness item available through partner review.'),
    ('RXP-LONG-NAD-1000', 'NAD+', 'NAD+ 1000iu', 'Longevity / Wellness', '1000iu', 179.00, 15.53, false, 'Longevity wellness item available through partner review.'),
    ('RXP-LONG-GLUTA-1500', 'Glutathione', 'Glutathione 1500mg', 'Longevity / Wellness', '1500mg', 179.00, 17.25, false, 'Wellness-support antioxidant option for clinical review.'),
    ('RXP-LONG-EPI-10', 'Epithalon', 'Epithalon 10mg', 'Longevity / Wellness', '10mg', 99.00, 4.03, false, 'Longevity support item available through partner review.'),
    ('RXP-LONG-SS31', 'SS-31', 'SS-31', 'Longevity / Wellness', 'Standard', 399.00, 40.14, false, 'Advanced longevity option subject to availability and approval.'),
    ('RXP-COG-SELANK', 'Selank', 'Selank', 'Cognitive / Wellness', 'Standard', 89.00, 8.28, false, 'Cognitive wellness item available through partner review.'),
    ('RXP-COG-SEMAX', 'Semax', 'Semax', 'Cognitive / Wellness', 'Standard', 89.00, 8.05, false, 'Cognitive wellness item available through partner review.'),
    ('RXP-COG-PT141', 'PT-141', 'PT-141', 'Cognitive / Wellness', 'Standard', 129.00, 7.94, false, 'Wellness support item available through partner review.')
)
insert into public.rx_plus_products (
  sku, product_name, display_name, category, strength, suggested_retail_price, retail_price,
  base_cost, true_wholesale_cost_per_vial, active, visibility_type, public_visible,
  partner_visible, partner_slug, featured, description
)
select
  sku, product_name, display_name, category, strength, retail_price, retail_price,
  0, wholesale_cost, true, 'rx_plus', false,
  true, 'guy', featured, description
from catalog
on conflict (sku) do update set
  product_name = excluded.product_name,
  display_name = excluded.display_name,
  category = excluded.category,
  strength = excluded.strength,
  suggested_retail_price = excluded.suggested_retail_price,
  retail_price = excluded.retail_price,
  true_wholesale_cost_per_vial = excluded.true_wholesale_cost_per_vial,
  active = excluded.active,
  visibility_type = excluded.visibility_type,
  public_visible = excluded.public_visible,
  partner_visible = excluded.partner_visible,
  partner_slug = excluded.partner_slug,
  featured = excluded.featured,
  description = excluded.description,
  updated_at = now();

with catalog(sku, wholesale_cost, featured) as (
  values
    ('RXP-GLP-RETA-5', 8.63, true), ('RXP-GLP-RETA-10', 12.65, true), ('RXP-GLP-RETA-15', 16.10, false),
    ('RXP-GLP-RETA-20', 20.70, false), ('RXP-GLP-TIRZ-10', 6.90, true), ('RXP-GLP-TIRZ-15', 9.20, false),
    ('RXP-GLP-TIRZ-20', 10.93, false), ('RXP-GLP-TIRZ-30', 15.53, true), ('RXP-GLP-TIRZ-60', 24.15, false),
    ('RXP-GLP-CAGRISEMA', 20.70, true), ('RXP-GLP-CAGRI-5', 13.80, false), ('RXP-GLP-AOD-5', 11.39, false),
    ('RXP-GLP-AOD-10', 21.28, false), ('RXP-GROW-HGH-10', 6.33, false), ('RXP-GROW-HGH-15', 9.20, false),
    ('RXP-GROW-HGH-24', 13.80, false), ('RXP-GROW-HGH-36', 20.13, false), ('RXP-GROW-TESA-2', 7.48, false),
    ('RXP-GROW-TESA-5', 13.23, false), ('RXP-GROW-TESA-10', 23.46, true), ('RXP-GROW-CJCIPA-10', 12.54, true),
    ('RXP-GROW-MK677', 3.22, false), ('RXP-REC-WOLV', 12.54, true), ('RXP-REC-BPC157-10', 7.48, false),
    ('RXP-REC-TB500-10', 17.83, false), ('RXP-REC-GHKCU-100', 6.90, false), ('RXP-LONG-MOTSC-10', 7.48, false),
    ('RXP-LONG-NAD-100', 4.60, false), ('RXP-LONG-NAD-500', 9.43, true), ('RXP-LONG-NAD-1000', 15.53, false),
    ('RXP-LONG-GLUTA-1500', 17.25, false), ('RXP-LONG-EPI-10', 4.03, false), ('RXP-LONG-SS31', 40.14, false),
    ('RXP-COG-SELANK', 8.28, false), ('RXP-COG-SEMAX', 8.05, false), ('RXP-COG-PT141', 7.94, false)
)
insert into public.distributor_products (
  distributor_id, product_id, is_enabled, enabled, custom_price, custom_retail_price,
  featured, internal_wholesale_cost_per_vial, commission_rate
)
select
  d.id, p.id, true, true, p.retail_price, p.retail_price,
  c.featured, c.wholesale_cost, 0.6000
from catalog c
join public.rx_plus_products p on p.sku = c.sku
join public.distributors d on d.slug = 'guy'
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured,
  internal_wholesale_cost_per_vial = excluded.internal_wholesale_cost_per_vial,
  commission_rate = excluded.commission_rate,
  updated_at = now();

drop policy if exists "Admins manage rx plus products" on public.rx_plus_products;
drop policy if exists "Admins and rx plus admins manage rx plus products" on public.rx_plus_products;
create policy "Admins and rx plus admins manage rx plus products"
  on public.rx_plus_products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rx_plus_admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rx_plus_admin')));

drop policy if exists "Admins manage distributor products" on public.distributor_products;
drop policy if exists "Admins and rx plus admins manage distributor products" on public.distributor_products;
create policy "Admins and rx plus admins manage distributor products"
  on public.distributor_products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rx_plus_admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rx_plus_admin')));
