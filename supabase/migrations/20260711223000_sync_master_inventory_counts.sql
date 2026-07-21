-- Sync master PepScriptRX inventory counts from the 2026-07-11 inventory report.
-- This migration only updates inventory quantity/status fields on existing SKUs.
-- It intentionally does not create products, create SKUs, or change pricing/catalog data.

begin;

with report_counts (
  sku,
  report_product,
  report_strength,
  location_breakdown,
  report_total_qty
) as (
  values
    ('RT15', 'Retatrutide', '15 mg', 'LA: 26', 26),
    ('TR30', 'Tirzepatide', '30 mg', 'LA: 2', 2),
    ('SM10', 'Semaglutide', '10 mg', 'Redlands: 20', 20),
    ('WA10', 'BAC Water', '10 mL', 'LA: 37; Redlands: 92', 129),
    ('RXP-MAIN-WOLVERINE-20', 'Wolverine Stack / BB20', '20 mg blend', 'LA Wolverine Stack: 20; LA BB20: 9; Redlands BB20 / Wolverine Stack: 9', 38),
    ('RXP-MAIN-GLOW70', 'Glow', '70 mg', 'LA: 8; Redlands: 14', 22),
    ('RXP-MAIN-CJCIPA-10', 'CJC-1295 No DAC / Ipamorelin', '5 mg + 5 mg, 10 mg total', 'LA: 10', 10),
    ('RXP-MAIN-GLUTA-1500', 'Glutathione', '1500 mg', 'Redlands: 6', 6),
    ('RXP-MAIN-HGH-100IU-KIT', 'HGH Kit', '100 IU', 'Redlands: 2', 2),
    ('RXP-MAIN-TESA-10', 'Tesamorelin', '10 mg', 'Redlands: 5', 5),
    ('RXP-REC-BPC157-10', 'BPC-157', '10 mg', 'Redlands: 10', 10),
    ('RXP-LONG-NAD-500', 'NAD+', '500 mg', 'Redlands: 30', 30),
    ('RXP-LONG-NAD-1000', 'NAD+', '1000 mg', 'Redlands: 1', 1),
    ('RXP-GLP-RETA-20', 'Retatrutide', '20 mg', 'Redlands: 34', 34),
    ('RXP-GLP-RETA-30', 'Retatrutide', '30 mg', 'Redlands: 6', 6),
    ('RXP-GLP-CAGRI-10', 'Cagrilintide', '10 mg', 'Redlands: 10', 10)
)
update public.inventory_items i
set
  current_qty = r.report_total_qty,
  stock_status = case
    when r.report_total_qty <= 0 and coalesce(i.allow_special_order, true) then 'special_order'
    when r.report_total_qty <= 0 then 'out_of_stock'
    when r.report_total_qty <= coalesce(i.low_stock_threshold, i.reorder_level, 3) then 'low_stock'
    else 'in_stock'
  end,
  updated_at = now()
from report_counts r
where upper(i.sku) = upper(r.sku);

do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('RT15', 'Retatrutide', '15 mg', 'LA: 26', 26),
        ('TR30', 'Tirzepatide', '30 mg', 'LA: 2', 2),
        ('SM10', 'Semaglutide', '10 mg', 'Redlands: 20', 20),
        ('WA10', 'BAC Water', '10 mL', 'LA: 37; Redlands: 92', 129),
        ('RXP-MAIN-WOLVERINE-20', 'Wolverine Stack / BB20', '20 mg blend', 'LA Wolverine Stack: 20; LA BB20: 9; Redlands BB20 / Wolverine Stack: 9', 38),
        ('RXP-MAIN-GLOW70', 'Glow', '70 mg', 'LA: 8; Redlands: 14', 22),
        ('RXP-MAIN-CJCIPA-10', 'CJC-1295 No DAC / Ipamorelin', '5 mg + 5 mg, 10 mg total', 'LA: 10', 10),
        ('RXP-MAIN-GLUTA-1500', 'Glutathione', '1500 mg', 'Redlands: 6', 6),
        ('RXP-MAIN-HGH-100IU-KIT', 'HGH Kit', '100 IU', 'Redlands: 2', 2),
        ('RXP-MAIN-TESA-10', 'Tesamorelin', '10 mg', 'Redlands: 5', 5),
        ('RXP-REC-BPC157-10', 'BPC-157', '10 mg', 'Redlands: 10', 10),
        ('RXP-LONG-NAD-500', 'NAD+', '500 mg', 'Redlands: 30', 30),
        ('RXP-LONG-NAD-1000', 'NAD+', '1000 mg', 'Redlands: 1', 1),
        ('RXP-GLP-RETA-20', 'Retatrutide', '20 mg', 'Redlands: 34', 34),
        ('RXP-GLP-RETA-30', 'Retatrutide', '30 mg', 'Redlands: 6', 6),
        ('RXP-GLP-CAGRI-10', 'Cagrilintide', '10 mg', 'Redlands: 10', 10)
    ) as r(sku, report_product, report_strength, location_breakdown, report_total_qty)
    where not exists (
      select 1
      from public.inventory_items i
      where upper(i.sku) = upper(r.sku)
    )
  loop
    raise notice 'Inventory sync skipped missing inventory_items SKU %. Product: %, strength: %, qty: %, locations: %',
      rec.sku,
      rec.report_product,
      rec.report_strength,
      rec.report_total_qty,
      rec.location_breakdown;
  end loop;

  for rec in
    select *
    from (
      values
        ('TB-500', '15 mg', 30, 'Redlands: 30', 'Existing catalog/inventory match is TB-500 10 mg, not 15 mg.'),
        ('GHK-Cu', '1000 mg', 9, 'Redlands: 9', 'Existing main inventory match is GHK-Cu 100 mg, not 1000 mg.'),
        ('GHK-Cu', '500 mg', 19, 'Redlands: 19', 'Existing main inventory match is GHK-Cu 100 mg, not 500 mg.'),
        ('Tesamorelin / Ipamorelin', '10/5 mg', 8, 'Redlands: 8', 'No exact existing central inventory SKU for this combination strength.'),
        ('MOTS-c', '40 mg', 8, 'Redlands: 8', 'Existing main inventory match is MOTS-C 10 mg, not 40 mg.'),
        ('Selank', '10 mg', 10, 'Redlands: 10', 'Existing catalog SKU is standard Selank; no exact 10 mg central inventory SKU found.')
    ) as u(report_product, report_strength, report_total_qty, location_breakdown, review_reason)
  loop
    raise notice 'Inventory report row left unmatched for review. Product: %, strength: %, qty: %, locations: %, reason: %',
      rec.report_product,
      rec.report_strength,
      rec.report_total_qty,
      rec.location_breakdown,
      rec.review_reason;
  end loop;
end $$;

commit;
