-- Seed requested main-admin product and inventory placeholders.
-- New products are inactive/out-of-stock by default and are not assigned to
-- distributor/storefront catalogs.

with seed(
  product_id,
  sku,
  display_label,
  product_name,
  technical_name,
  aka_names,
  strength,
  total_amount,
  unit,
  category,
  retail_price,
  sort_order,
  description
) as (
  values
    (
      'wolverine-stack',
      'RXP-MAIN-WOLVERINE-20',
      'Wolverine Stack - BPC-157 10 mg + TB-500 10 mg, 20 mg total',
      'Wolverine Stack',
      'BPC-157 / TB-500 Blend',
      array['BPC-157 + TB-500']::text[],
      'BPC-157 10 mg + TB-500 10 mg',
      '20',
      'mg',
      'Recovery / Repair',
      149,
      10100,
      'BPC-157 10 mg + TB-500 10 mg blend, 20 mg total.'
    ),
    (
      'glow-glom-70mg',
      'RXP-MAIN-GLOW-GLOM-70',
      'Glow / GloM - 70 mg total',
      'Glow / GloM',
      'BPC-157 / TB-500 / GHK-Cu Blend',
      array['Glow Stack', 'GloM']::text[],
      '70 mg total',
      '70',
      'mg',
      'Glow / Beauty / Wellness',
      179,
      10110,
      'Glow/GloM blend, 70 mg total.'
    ),
    (
      'cjc-ipamorelin-10mg',
      'RXP-MAIN-CJCIPA-10',
      'CJC-1295 / Ipamorelin - 5 mg + 5 mg, 10 mg total',
      'CJC-1295 / Ipamorelin',
      'CJC-1295 / Ipamorelin Blend',
      array['CJC/Ipa', 'CJC + Ipamorelin']::text[],
      '5 mg + 5 mg, 10 mg total',
      '10',
      'mg',
      'Optimization / Performance',
      149,
      10120,
      'CJC-1295 5 mg + Ipamorelin 5 mg blend, 10 mg total.'
    ),
    (
      'ipamorelin-5mg',
      'RXP-MAIN-IPA-5',
      'Ipamorelin - 5 mg',
      'Ipamorelin',
      'Ipamorelin',
      array[]::text[],
      '5 mg',
      '5',
      'mg',
      'Optimization / Performance',
      89,
      10130,
      'Ipamorelin 5 mg.'
    ),
    (
      'ipamorelin-10mg',
      'RXP-MAIN-IPA-10',
      'Ipamorelin - 10 mg',
      'Ipamorelin',
      'Ipamorelin',
      array[]::text[],
      '10 mg',
      '10',
      'mg',
      'Optimization / Performance',
      129,
      10140,
      'Ipamorelin 10 mg.'
    ),
    (
      'hgh-somatropin-100iu-kit',
      'RXP-MAIN-HGH-100IU-KIT',
      'HGH / Somatropin - 10 IU x 10, 100 IU total',
      'HGH / Somatropin',
      'Somatropin',
      array['Somatropin', 'HGH Kit']::text[],
      '10 IU x 10, 100 IU total',
      '100',
      'IU',
      'Premium / Optimization',
      349,
      10150,
      '10-count HGH/Somatropin kit: 10 IU per vial, 100 IU total.'
    ),
    (
      'hgh-somatropin-240iu-kit',
      'RXP-MAIN-HGH-240IU-KIT',
      'HGH / Somatropin - 24 IU x 10, 240 IU total',
      'HGH / Somatropin',
      'Somatropin',
      array['Somatropin', 'HGH Kit']::text[],
      '24 IU x 10, 240 IU total',
      '240',
      'IU',
      'Premium / Optimization',
      699,
      10160,
      '10-count HGH/Somatropin kit: 24 IU per vial, 240 IU total.'
    ),
    (
      'ghk-cu-100mg',
      'RXP-MAIN-GHKCU-100',
      'GHK-Cu - 100 mg',
      'GHK-Cu',
      'Copper Tripeptide-1 / GHK-Cu',
      array['Copper Peptide']::text[],
      '100 mg',
      '100',
      'mg',
      'Glow / Wellness',
      119,
      10170,
      'GHK-Cu 100 mg.'
    ),
    (
      'glutathione-1500mg',
      'RXP-MAIN-GLUTA-1500',
      'Glutathione - 1500 mg',
      'Glutathione',
      'L-Glutathione',
      array[]::text[],
      '1500 mg',
      '1500',
      'mg',
      'Wellness / Antioxidant Support',
      139,
      10180,
      'Glutathione 1500 mg.'
    ),
    (
      'mots-c-10mg',
      'RXP-MAIN-MOTSC-10',
      'MOTS-C - 10 mg',
      'MOTS-C',
      'Mitochondrial-Derived Peptide MOTS-C',
      array[]::text[],
      '10 mg',
      '10',
      'mg',
      'Energy / Performance',
      129,
      10190,
      'MOTS-C 10 mg.'
    ),
    (
      'tesamorelin-10mg',
      'RXP-MAIN-TESA-10',
      'Tesamorelin - 10 mg',
      'Tesamorelin',
      'Tesamorelin Acetate',
      array[]::text[],
      '10 mg',
      '10',
      'mg',
      'Optimization / Performance',
      159,
      10200,
      'Tesamorelin 10 mg.'
    ),
    (
      'cagrisema',
      'RXP-MAIN-CAGRISEMA-48',
      'CagriSema - 2.4 mg + 2.4 mg, 4.8 mg total',
      'CagriSema',
      'Cagrilintide / Semaglutide Blend',
      array['Cagrilintide + Semaglutide']::text[],
      '2.4 mg + 2.4 mg, 4.8 mg total',
      '4.8',
      'mg',
      'Weight Management',
      179,
      10210,
      'Cagrilintide 2.4 mg + Semaglutide 2.4 mg blend, 4.8 mg total.'
    )
)
insert into public.products (
  id,
  name,
  price,
  category,
  status,
  product_type,
  requires_prescription_upload,
  requires_receipt_upload,
  requires_dob,
  requires_physician_review,
  display_note,
  sort_order
)
select
  product_id,
  display_label,
  retail_price,
  category,
  'inactive',
  'manual_review',
  false,
  false,
  true,
  false,
  'Seeded from main product intelligence update. Inactive placeholder; enable manually when inventory is ready.',
  sort_order
from seed
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  product_type = coalesce(public.products.product_type, excluded.product_type),
  requires_prescription_upload = public.products.requires_prescription_upload,
  requires_receipt_upload = public.products.requires_receipt_upload,
  requires_dob = public.products.requires_dob,
  requires_physician_review = public.products.requires_physician_review,
  display_note = case
    when public.products.display_note is null or public.products.display_note = ''
      then excluded.display_note
    when public.products.display_note ilike '%Seeded from main product intelligence update%'
      then public.products.display_note
    else public.products.display_note || ' Seeded from main product intelligence update.'
  end,
  sort_order = public.products.sort_order,
  updated_at = now();

with seed(
  product_id,
  sku,
  display_label,
  product_name,
  technical_name,
  aka_names,
  strength,
  total_amount,
  unit,
  category,
  retail_price,
  sort_order,
  description
) as (
  values
    ('wolverine-stack', 'RXP-MAIN-WOLVERINE-20', 'Wolverine Stack - BPC-157 10 mg + TB-500 10 mg, 20 mg total', 'Wolverine Stack', 'BPC-157 / TB-500 Blend', array['BPC-157 + TB-500']::text[], 'BPC-157 10 mg + TB-500 10 mg, 20 mg total', '20', 'mg', 'Recovery / Repair', 149, 10100, 'BPC-157 10 mg + TB-500 10 mg blend, 20 mg total.'),
    ('glow-glom-70mg', 'RXP-MAIN-GLOW-GLOM-70', 'Glow / GloM - 70 mg total', 'Glow / GloM', 'BPC-157 / TB-500 / GHK-Cu Blend', array['Glow Stack', 'GloM']::text[], '70 mg total', '70', 'mg', 'Glow / Beauty / Wellness', 179, 10110, 'Glow/GloM blend, 70 mg total.'),
    ('cjc-ipamorelin-10mg', 'RXP-MAIN-CJCIPA-10', 'CJC-1295 / Ipamorelin - 5 mg + 5 mg, 10 mg total', 'CJC-1295 / Ipamorelin', 'CJC-1295 / Ipamorelin Blend', array['CJC/Ipa', 'CJC + Ipamorelin']::text[], '5 mg + 5 mg, 10 mg total', '10', 'mg', 'Optimization / Performance', 149, 10120, 'CJC-1295 5 mg + Ipamorelin 5 mg blend, 10 mg total.'),
    ('ipamorelin-5mg', 'RXP-MAIN-IPA-5', 'Ipamorelin - 5 mg', 'Ipamorelin', 'Ipamorelin', array[]::text[], '5 mg', '5', 'mg', 'Optimization / Performance', 89, 10130, 'Ipamorelin 5 mg.'),
    ('ipamorelin-10mg', 'RXP-MAIN-IPA-10', 'Ipamorelin - 10 mg', 'Ipamorelin', 'Ipamorelin', array[]::text[], '10 mg', '10', 'mg', 'Optimization / Performance', 129, 10140, 'Ipamorelin 10 mg.'),
    ('hgh-somatropin-100iu-kit', 'RXP-MAIN-HGH-100IU-KIT', 'HGH / Somatropin - 10 IU x 10, 100 IU total', 'HGH / Somatropin', 'Somatropin', array['Somatropin', 'HGH Kit']::text[], '10 IU x 10, 100 IU total', '100', 'IU', 'Premium / Optimization', 349, 10150, '10-count HGH/Somatropin kit: 10 IU per vial, 100 IU total.'),
    ('hgh-somatropin-240iu-kit', 'RXP-MAIN-HGH-240IU-KIT', 'HGH / Somatropin - 24 IU x 10, 240 IU total', 'HGH / Somatropin', 'Somatropin', array['Somatropin', 'HGH Kit']::text[], '24 IU x 10, 240 IU total', '240', 'IU', 'Premium / Optimization', 699, 10160, '10-count HGH/Somatropin kit: 24 IU per vial, 240 IU total.'),
    ('ghk-cu-100mg', 'RXP-MAIN-GHKCU-100', 'GHK-Cu - 100 mg', 'GHK-Cu', 'Copper Tripeptide-1 / GHK-Cu', array['Copper Peptide']::text[], '100 mg', '100', 'mg', 'Glow / Wellness', 119, 10170, 'GHK-Cu 100 mg.'),
    ('glutathione-1500mg', 'RXP-MAIN-GLUTA-1500', 'Glutathione - 1500 mg', 'Glutathione', 'L-Glutathione', array[]::text[], '1500 mg', '1500', 'mg', 'Wellness / Antioxidant Support', 139, 10180, 'Glutathione 1500 mg.'),
    ('mots-c-10mg', 'RXP-MAIN-MOTSC-10', 'MOTS-C - 10 mg', 'MOTS-C', 'Mitochondrial-Derived Peptide MOTS-C', array[]::text[], '10 mg', '10', 'mg', 'Energy / Performance', 129, 10190, 'MOTS-C 10 mg.'),
    ('tesamorelin-10mg', 'RXP-MAIN-TESA-10', 'Tesamorelin - 10 mg', 'Tesamorelin', 'Tesamorelin Acetate', array[]::text[], '10 mg', '10', 'mg', 'Optimization / Performance', 159, 10200, 'Tesamorelin 10 mg.'),
    ('cagrisema', 'RXP-MAIN-CAGRISEMA-48', 'CagriSema - 2.4 mg + 2.4 mg, 4.8 mg total', 'CagriSema', 'Cagrilintide / Semaglutide Blend', array['Cagrilintide + Semaglutide']::text[], '2.4 mg + 2.4 mg, 4.8 mg total', '4.8', 'mg', 'Weight Management', 179, 10210, 'Cagrilintide 2.4 mg + Semaglutide 2.4 mg blend, 4.8 mg total.')
)
insert into public.inventory_items (
  sku,
  product_name,
  strength,
  starting_qty,
  current_qty,
  base_total_cost,
  base_cost_per_vial,
  allocated_shipping_per_vial,
  allocated_label_per_vial,
  true_landed_cost_per_vial,
  retail_price,
  reorder_level,
  active,
  notes
)
select
  sku,
  product_name,
  strength,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  retail_price,
  3,
  false,
  'Seeded from main product intelligence update. Out-of-stock inactive placeholder; enable manually when inventory is ready.'
from seed
on conflict (sku) do update set
  product_name = excluded.product_name,
  strength = excluded.strength,
  retail_price = excluded.retail_price,
  notes = case
    when public.inventory_items.notes is null or public.inventory_items.notes = ''
      then excluded.notes
    when public.inventory_items.notes ilike '%Seeded from main product intelligence update%'
      then public.inventory_items.notes
    else public.inventory_items.notes || ' Seeded from main product intelligence update.'
  end,
  updated_at = now();

with seed(
  product_key,
  product_name,
  scientific_name,
  sku,
  category,
  strength,
  current_retail_price,
  description,
  typical_use_case,
  components,
  sort_order
) as (
  values
    ('wolverine-bpc-tb', 'Wolverine Stack', 'BPC-157 / TB-500 Blend', 'RXP-MAIN-WOLVERINE-20', 'Recovery / Repair', 'BPC-157 10 mg + TB-500 10 mg, 20 mg total', 149, 'BPC-157 10 mg + TB-500 10 mg blend, 20 mg total.', 'Recovery and repair blend.', array['BPC-157', 'TB-500']::text[], 10100),
    ('glow-glom-70mg', 'Glow / GloM', 'BPC-157 / TB-500 / GHK-Cu Blend', 'RXP-MAIN-GLOW-GLOM-70', 'Glow / Beauty / Wellness', '70 mg total', 179, 'Glow/GloM blend, 70 mg total.', 'Glow, beauty, and wellness blend.', array['BPC-157', 'TB-500', 'GHK-Cu']::text[], 10110),
    ('cjc-ipamorelin-10mg', 'CJC-1295 / Ipamorelin', 'CJC-1295 / Ipamorelin Blend', 'RXP-MAIN-CJCIPA-10', 'Optimization / Performance', '5 mg + 5 mg, 10 mg total', 149, 'CJC-1295 5 mg + Ipamorelin 5 mg blend, 10 mg total.', 'Optimization and performance review.', array['CJC-1295', 'Ipamorelin']::text[], 10120),
    ('ipamorelin-5mg', 'Ipamorelin', 'Ipamorelin', 'RXP-MAIN-IPA-5', 'Optimization / Performance', '5 mg', 89, 'Ipamorelin 5 mg.', 'Optimization and performance review.', array[]::text[], 10130),
    ('ipamorelin-10mg', 'Ipamorelin', 'Ipamorelin', 'RXP-MAIN-IPA-10', 'Optimization / Performance', '10 mg', 129, 'Ipamorelin 10 mg.', 'Optimization and performance review.', array[]::text[], 10140),
    ('hgh-somatropin-100iu-kit', 'HGH / Somatropin', 'Somatropin', 'RXP-MAIN-HGH-100IU-KIT', 'Premium / Optimization', '10 IU x 10, 100 IU total', 349, '10-count HGH/Somatropin kit: 10 IU per vial, 100 IU total.', 'Premium optimization review.', array['Somatropin', 'HGH Kit']::text[], 10150),
    ('hgh-somatropin-240iu-kit', 'HGH / Somatropin', 'Somatropin', 'RXP-MAIN-HGH-240IU-KIT', 'Premium / Optimization', '24 IU x 10, 240 IU total', 699, '10-count HGH/Somatropin kit: 24 IU per vial, 240 IU total.', 'Premium optimization review.', array['Somatropin', 'HGH Kit']::text[], 10160),
    ('ghk-cu-100mg', 'GHK-Cu', 'Copper Tripeptide-1 / GHK-Cu', 'RXP-MAIN-GHKCU-100', 'Glow / Wellness', '100 mg', 119, 'GHK-Cu 100 mg.', 'Glow and wellness review.', array['Copper Peptide']::text[], 10170),
    ('glutathione-1500mg', 'Glutathione', 'L-Glutathione', 'RXP-MAIN-GLUTA-1500', 'Wellness / Antioxidant Support', '1500 mg', 139, 'Glutathione 1500 mg.', 'Wellness and antioxidant support review.', array[]::text[], 10180),
    ('mots-c-10mg', 'MOTS-C', 'Mitochondrial-Derived Peptide MOTS-C', 'RXP-MAIN-MOTSC-10', 'Energy / Performance', '10 mg', 129, 'MOTS-C 10 mg.', 'Energy and performance review.', array[]::text[], 10190),
    ('tesamorelin-10mg', 'Tesamorelin', 'Tesamorelin Acetate', 'RXP-MAIN-TESA-10', 'Optimization / Performance', '10 mg', 159, 'Tesamorelin 10 mg.', 'Optimization and performance review.', array[]::text[], 10200),
    ('cagrisema', 'CagriSema', 'Cagrilintide / Semaglutide Blend', 'RXP-MAIN-CAGRISEMA-48', 'Weight Management', '2.4 mg + 2.4 mg, 4.8 mg total', 179, 'Cagrilintide 2.4 mg + Semaglutide 2.4 mg blend, 4.8 mg total.', 'Weight management review.', array['Cagrilintide', 'Semaglutide']::text[], 10210)
)
insert into public.product_intelligence_products (
  product_key,
  product_name,
  scientific_name,
  sku,
  category,
  strength,
  units_per_box,
  supplier_box_cost,
  current_retail_price,
  active_status,
  description,
  typical_use_case,
  components,
  notes,
  sort_order
)
select
  product_key,
  product_name,
  scientific_name,
  sku,
  category,
  strength,
  1,
  null,
  current_retail_price,
  'inactive',
  description,
  typical_use_case,
  components,
  'Seeded from main product intelligence update.',
  sort_order
from seed
on conflict (product_key) do update set
  product_name = excluded.product_name,
  scientific_name = excluded.scientific_name,
  sku = public.product_intelligence_products.sku,
  category = excluded.category,
  strength = excluded.strength,
  current_retail_price = excluded.current_retail_price,
  description = excluded.description,
  typical_use_case = excluded.typical_use_case,
  components = excluded.components,
  notes = case
    when public.product_intelligence_products.notes is null or public.product_intelligence_products.notes = ''
      then excluded.notes
    when public.product_intelligence_products.notes ilike '%Seeded from main product intelligence update%'
      then public.product_intelligence_products.notes
    else public.product_intelligence_products.notes || ' Seeded from main product intelligence update.'
  end,
  sort_order = excluded.sort_order,
  updated_at = now();

with alias_seed(product_key, alias) as (
  values
    ('wolverine-bpc-tb', 'BPC-157 + TB-500'),
    ('glow-glom-70mg', 'Glow Stack'),
    ('glow-glom-70mg', 'GloM'),
    ('cjc-ipamorelin-10mg', 'CJC/Ipa'),
    ('cjc-ipamorelin-10mg', 'CJC + Ipamorelin'),
    ('hgh-somatropin-100iu-kit', 'Somatropin'),
    ('hgh-somatropin-100iu-kit', 'HGH Kit'),
    ('hgh-somatropin-240iu-kit', 'Somatropin'),
    ('hgh-somatropin-240iu-kit', 'HGH Kit'),
    ('ghk-cu-100mg', 'Copper Peptide'),
    ('cagrisema', 'Cagrilintide + Semaglutide')
)
insert into public.product_intelligence_aliases (product_key, alias)
select product_key, alias
from alias_seed
on conflict (product_key, alias) do nothing;
