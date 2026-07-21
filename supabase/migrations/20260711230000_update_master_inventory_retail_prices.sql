-- Fill retail_price for all master inventory items from the 2026-07-11 report.
-- This updates only inventory_items.retail_price and does not change storefront
-- product prices, descriptions, commissions, or catalog configuration.

begin;

with retail_seed (
  sku,
  retail_price,
  retail_source
) as (
  values
    ('RT15', 279.00, 'Main product retail: Retatrutide 15mg Vial'),
    ('TR30', 199.00, 'Main product retail: Tirzepatide 30mg Vial'),
    ('SM10', 99.00, 'Main product retail: Semaglutide 10mg Vial'),
    ('WA10', 12.00, 'Main product retail: BAC Water + 8-Pack Syringe Kit'),
    ('RXP-MAIN-WOLVERINE-20', 149.00, 'Main product retail: Wolverine Stack / BB20'),
    ('RXP-MAIN-GLOW70', 179.00, 'Main product retail: Glow Stack 70mg'),
    ('RXP-MAIN-CJCIPA-10', 149.00, 'Main product retail: CJC-1295 / Ipamorelin 10mg'),
    ('RXP-MAIN-GLUTA-1500', 139.00, 'Main product retail: Glutathione 1500mg'),
    ('RXP-MAIN-HGH-100IU-KIT', 349.00, 'Main product retail: HGH / Somatropin 100 IU kit'),
    ('RXP-MAIN-TESA-10', 159.00, 'Main product retail: Tesamorelin 10mg'),
    ('RXP-REC-BPC157-10', 99.00, 'Rx Plus suggested retail: BPC-157 10mg'),
    ('RXP-LONG-NAD-500', 119.00, 'Rx Plus suggested retail: NAD+ 500'),
    ('RXP-LONG-NAD-1000', 179.00, 'Rx Plus suggested retail: NAD+ 1000'),
    ('RXP-GLP-RETA-20', 350.00, 'Rx Plus suggested retail: Retatrutide 20mg'),
    ('RXP-GLP-RETA-30', 349.00, 'Rep intake suggested retail: Retatrutide 30mg'),
    ('RXP-GLP-CAGRI-10', 300.00, 'Existing storefront retail: Cagrilintide 10mg'),
    ('RXP-MAIN-TB500-15', 150.00, 'Catalog family fallback retail: TB-500'),
    ('RXP-MAIN-GHKCU-1000', 119.00, 'Catalog family fallback retail: GHK-Cu 100mg main retail'),
    ('RXP-MAIN-GHKCU-500', 119.00, 'Catalog family fallback retail: GHK-Cu 100mg main retail'),
    ('RXP-MAIN-TESAIPA-10-5', 248.00, 'Component fallback retail: Tesamorelin 10mg + Ipamorelin 5mg'),
    ('RXP-MAIN-MOTSC-40', 150.00, 'Existing storefront retail: MOTS-c 40mg'),
    ('RXP-NEU-SELANK-10', 55.00, 'Existing storefront retail: Selank 10mg')
)
update public.inventory_items i
set
  retail_price = s.retail_price,
  updated_at = now()
from retail_seed s
where upper(i.sku) = upper(s.sku);

do $$
declare
  rec record;
begin
  for rec in
    select s.*
    from (
      values
        ('RT15', 279.00, 'Main product retail: Retatrutide 15mg Vial'),
        ('TR30', 199.00, 'Main product retail: Tirzepatide 30mg Vial'),
        ('SM10', 99.00, 'Main product retail: Semaglutide 10mg Vial'),
        ('WA10', 12.00, 'Main product retail: BAC Water + 8-Pack Syringe Kit'),
        ('RXP-MAIN-WOLVERINE-20', 149.00, 'Main product retail: Wolverine Stack / BB20'),
        ('RXP-MAIN-GLOW70', 179.00, 'Main product retail: Glow Stack 70mg'),
        ('RXP-MAIN-CJCIPA-10', 149.00, 'Main product retail: CJC-1295 / Ipamorelin 10mg'),
        ('RXP-MAIN-GLUTA-1500', 139.00, 'Main product retail: Glutathione 1500mg'),
        ('RXP-MAIN-HGH-100IU-KIT', 349.00, 'Main product retail: HGH / Somatropin 100 IU kit'),
        ('RXP-MAIN-TESA-10', 159.00, 'Main product retail: Tesamorelin 10mg'),
        ('RXP-REC-BPC157-10', 99.00, 'Rx Plus suggested retail: BPC-157 10mg'),
        ('RXP-LONG-NAD-500', 119.00, 'Rx Plus suggested retail: NAD+ 500'),
        ('RXP-LONG-NAD-1000', 179.00, 'Rx Plus suggested retail: NAD+ 1000'),
        ('RXP-GLP-RETA-20', 350.00, 'Rx Plus suggested retail: Retatrutide 20mg'),
        ('RXP-GLP-RETA-30', 349.00, 'Rep intake suggested retail: Retatrutide 30mg'),
        ('RXP-GLP-CAGRI-10', 300.00, 'Existing storefront retail: Cagrilintide 10mg'),
        ('RXP-MAIN-TB500-15', 150.00, 'Catalog family fallback retail: TB-500'),
        ('RXP-MAIN-GHKCU-1000', 119.00, 'Catalog family fallback retail: GHK-Cu 100mg main retail'),
        ('RXP-MAIN-GHKCU-500', 119.00, 'Catalog family fallback retail: GHK-Cu 100mg main retail'),
        ('RXP-MAIN-TESAIPA-10-5', 248.00, 'Component fallback retail: Tesamorelin 10mg + Ipamorelin 5mg'),
        ('RXP-MAIN-MOTSC-40', 150.00, 'Existing storefront retail: MOTS-c 40mg'),
        ('RXP-NEU-SELANK-10', 55.00, 'Existing storefront retail: Selank 10mg')
    ) as s(sku, retail_price, retail_source)
    where not exists (
      select 1
      from public.inventory_items i
      where upper(i.sku) = upper(s.sku)
    )
  loop
    raise notice 'Retail price skipped missing inventory_items SKU %. Retail %, source: %',
      rec.sku,
      rec.retail_price,
      rec.retail_source;
  end loop;
end $$;

commit;
