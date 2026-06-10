-- Update main-admin inventory and Product Intelligence costs from supplier price list.
-- Formula: supplier box / 10 = per vial cost, except HGH rows where supplier cost is per kit.
-- Total landed cost = per vial or kit cost * 1.15.

with supplier_seed(
  product_id,
  product_key,
  sku,
  supplier_match,
  supplier_box_cost,
  units_per_box,
  unit_cost,
  total_landed_cost,
  retail_price,
  supplier_note
) as (
  values
    (
      'cagrisema',
      'cagrisema',
      'RXP-MAIN-CAGRISEMA-48',
      'CS10 Cagrilintide 5mg + Semaglutide 5mg, 10mg total',
      180.00,
      10,
      18.00,
      20.70,
      179.00,
      'Supplier match: CS10 Cagrilintide 5mg + Semaglutide 5mg, 10mg total. Supplier sheet lists 10mg total, not 4.8mg total; CS10 is the closest available supplier match unless a true 4.8mg CagriSema SKU is later added. Landed cost uses 1.15 multiplier.'
    ),
    (
      'cjc-ipamorelin-10mg',
      'cjc-ipamorelin-10mg',
      'RXP-MAIN-CJCIPA-10',
      'CP10 CJC No DAC 5mg + IPA 5mg',
      109.00,
      10,
      10.90,
      12.54,
      149.00,
      'Supplier match: CP10 CJC No DAC 5mg + IPA 5mg. Supplier box $109 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'ghk-cu-100mg',
      'ghk-cu-100mg',
      'RXP-MAIN-GHKCU-100',
      'CU100',
      60.00,
      10,
      6.00,
      6.90,
      119.00,
      'Supplier match: CU100. Supplier box $60 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'glow-glom-70mg',
      'glow-glom-70mg',
      'RXP-MAIN-GLOW-GLOM-70',
      'GLOW70 / BBG70',
      219.00,
      10,
      21.90,
      25.19,
      179.00,
      'Supplier match: GLOW70 / BBG70. Supplier box $219 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'glutathione-1500mg',
      'glutathione-1500mg',
      'RXP-MAIN-GLUTA-1500',
      'GTT1500',
      150.00,
      10,
      15.00,
      17.25,
      139.00,
      'Supplier match: GTT1500. Supplier box $150 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'hgh-somatropin-100iu-kit',
      'hgh-somatropin-100iu-kit',
      'RXP-MAIN-HGH-100IU-KIT',
      'H10, 10 IU x 10 vials',
      55.00,
      1,
      55.00,
      63.25,
      349.00,
      'Supplier match: H10, 10 IU x 10 vials. Supplier kit cost $55. Landed cost uses 1.15 multiplier.'
    ),
    (
      'hgh-somatropin-240iu-kit',
      'hgh-somatropin-240iu-kit',
      'RXP-MAIN-HGH-240IU-KIT',
      'H24, 24 IU x 10 vials',
      120.00,
      1,
      120.00,
      138.00,
      699.00,
      'Supplier match: H24, 24 IU x 10 vials. Supplier kit cost $120. Landed cost uses 1.15 multiplier.'
    ),
    (
      'ipamorelin-10mg',
      'ipamorelin-10mg',
      'RXP-MAIN-IPA-10',
      'IPA10',
      70.00,
      10,
      7.00,
      8.05,
      129.00,
      'Supplier match: IPA10. Supplier box $70 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'ipamorelin-5mg',
      'ipamorelin-5mg',
      'RXP-MAIN-IPA-5',
      'IPA5',
      37.00,
      10,
      3.70,
      4.26,
      89.00,
      'Supplier match: IPA5. Supplier box $37 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'mots-c-10mg',
      'mots-c-10mg',
      'RXP-MAIN-MOTSC-10',
      'MS10',
      65.00,
      10,
      6.50,
      7.48,
      129.00,
      'Supplier match: MS10. Supplier box $65 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'tesamorelin-10mg',
      'tesamorelin-10mg',
      'RXP-MAIN-TESA-10',
      'TSM10',
      204.00,
      10,
      20.40,
      23.46,
      159.00,
      'Supplier match: TSM10. Supplier box $204 / 10 vials. Landed cost uses 1.15 multiplier.'
    ),
    (
      'wolverine-stack',
      'wolverine-bpc-tb',
      'RXP-MAIN-WOLVERINE-20',
      'BB20',
      189.00,
      10,
      18.90,
      21.74,
      149.00,
      'Supplier match: BB20. Supplier box $189 / 10 vials. Landed cost uses 1.15 multiplier.'
    )
)
update public.inventory_items i
set
  base_total_cost = s.supplier_box_cost,
  base_cost_per_vial = s.unit_cost,
  allocated_shipping_per_vial = round(s.total_landed_cost - s.unit_cost, 2),
  allocated_label_per_vial = 0,
  true_landed_cost_per_vial = s.total_landed_cost,
  retail_price = s.retail_price,
  notes = case
    when coalesce(i.notes, '') ilike '%' || s.supplier_match || '%'
      then i.notes
    when nullif(trim(coalesce(i.notes, '')), '') is null
      then s.supplier_note
    else i.notes || ' ' || s.supplier_note
  end,
  updated_at = now()
from supplier_seed s
where i.sku = s.sku;

with supplier_seed(
  product_key,
  sku,
  supplier_match,
  supplier_box_cost,
  units_per_box,
  retail_price,
  supplier_note
) as (
  values
    ('cagrisema', 'RXP-MAIN-CAGRISEMA-48', 'CS10 Cagrilintide 5mg + Semaglutide 5mg, 10mg total', 180.00, 10, 179.00, 'Supplier match: CS10 Cagrilintide 5mg + Semaglutide 5mg, 10mg total. Supplier sheet lists 10mg total, not 4.8mg total; CS10 is the closest available supplier match unless a true 4.8mg CagriSema SKU is later added. Landed cost uses 1.15 multiplier.'),
    ('cjc-ipamorelin-10mg', 'RXP-MAIN-CJCIPA-10', 'CP10 CJC No DAC 5mg + IPA 5mg', 109.00, 10, 149.00, 'Supplier match: CP10 CJC No DAC 5mg + IPA 5mg. Supplier box $109 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('ghk-cu-100mg', 'RXP-MAIN-GHKCU-100', 'CU100', 60.00, 10, 119.00, 'Supplier match: CU100. Supplier box $60 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('glow-glom-70mg', 'RXP-MAIN-GLOW-GLOM-70', 'GLOW70 / BBG70', 219.00, 10, 179.00, 'Supplier match: GLOW70 / BBG70. Supplier box $219 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('glutathione-1500mg', 'RXP-MAIN-GLUTA-1500', 'GTT1500', 150.00, 10, 139.00, 'Supplier match: GTT1500. Supplier box $150 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('hgh-somatropin-100iu-kit', 'RXP-MAIN-HGH-100IU-KIT', 'H10, 10 IU x 10 vials', 55.00, 1, 349.00, 'Supplier match: H10, 10 IU x 10 vials. Supplier kit cost $55. Landed cost uses 1.15 multiplier.'),
    ('hgh-somatropin-240iu-kit', 'RXP-MAIN-HGH-240IU-KIT', 'H24, 24 IU x 10 vials', 120.00, 1, 699.00, 'Supplier match: H24, 24 IU x 10 vials. Supplier kit cost $120. Landed cost uses 1.15 multiplier.'),
    ('ipamorelin-10mg', 'RXP-MAIN-IPA-10', 'IPA10', 70.00, 10, 129.00, 'Supplier match: IPA10. Supplier box $70 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('ipamorelin-5mg', 'RXP-MAIN-IPA-5', 'IPA5', 37.00, 10, 89.00, 'Supplier match: IPA5. Supplier box $37 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('mots-c-10mg', 'RXP-MAIN-MOTSC-10', 'MS10', 65.00, 10, 129.00, 'Supplier match: MS10. Supplier box $65 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('tesamorelin-10mg', 'RXP-MAIN-TESA-10', 'TSM10', 204.00, 10, 159.00, 'Supplier match: TSM10. Supplier box $204 / 10 vials. Landed cost uses 1.15 multiplier.'),
    ('wolverine-bpc-tb', 'RXP-MAIN-WOLVERINE-20', 'BB20', 189.00, 10, 149.00, 'Supplier match: BB20. Supplier box $189 / 10 vials. Landed cost uses 1.15 multiplier.')
)
update public.product_intelligence_products p
set
  sku = s.sku,
  units_per_box = s.units_per_box,
  supplier_box_cost = s.supplier_box_cost,
  current_retail_price = s.retail_price,
  notes = case
    when coalesce(p.notes, '') ilike '%' || s.supplier_match || '%'
      then p.notes
    when nullif(trim(coalesce(p.notes, '')), '') is null
      then s.supplier_note
    else p.notes || ' ' || s.supplier_note
  end,
  updated_at = now()
from supplier_seed s
where p.product_key = s.product_key;

with supplier_seed(product_id, retail_price) as (
  values
    ('cagrisema', 179.00),
    ('cjc-ipamorelin-10mg', 149.00),
    ('ghk-cu-100mg', 119.00),
    ('glow-glom-70mg', 179.00),
    ('glutathione-1500mg', 139.00),
    ('hgh-somatropin-100iu-kit', 349.00),
    ('hgh-somatropin-240iu-kit', 699.00),
    ('ipamorelin-10mg', 129.00),
    ('ipamorelin-5mg', 89.00),
    ('mots-c-10mg', 129.00),
    ('tesamorelin-10mg', 159.00),
    ('wolverine-stack', 149.00)
)
update public.products p
set
  price = s.retail_price,
  updated_at = now()
from supplier_seed s
where p.id = s.product_id;
