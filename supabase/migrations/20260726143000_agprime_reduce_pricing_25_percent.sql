-- Reduce AG Prime Lab retail pricing by approximately 25%.
-- Explicit target prices keep this migration deterministic and align checkout
-- with the local storefront fallback catalog.

with requested_prices(sku, price) as (
  values
    ('AGPRIME-RETATRUTIDE-10MG', 172::numeric),
    ('AGPRIME-RETATRUTIDE-20MG', 224::numeric),
    ('AGPRIME-RETATRUTIDE-30MG', 262::numeric),
    ('AGPRIME-TIRZEPATIDE-10MG', 97::numeric),
    ('AGPRIME-TIRZEPATIDE-20MG', 127::numeric),
    ('AGPRIME-TIRZEPATIDE-30MG', 149::numeric),
    ('AGPRIME-SEMAGLUTIDE-10MG', 74::numeric),
    ('AGPRIME-BPC-157-5MG', 74::numeric),
    ('AGPRIME-BPC-157-10MG', 104::numeric),
    ('AGPRIME-TB-500-5MG', 74::numeric),
    ('AGPRIME-TB-500-10MG', 112::numeric),
    ('AGPRIME-BPC-157-TB-500-BLEND', 119::numeric),
    ('AGPRIME-NAD-PLUS', 112::numeric),
    ('AGPRIME-GLUTATHIONE-1500MG', 112::numeric),
    ('AGPRIME-GHK-CU-100MG', 97::numeric),
    ('AGPRIME-GLOW-PEPTIDE-BLEND', 127::numeric),
    ('AGPRIME-TESAMORELIN-5MG', 112::numeric),
    ('AGPRIME-TESAMORELIN-10MG', 149::numeric),
    ('AGPRIME-SERMORELIN', 97::numeric),
    ('AGPRIME-IPAMORELIN', 97::numeric),
    ('AGPRIME-CJC-1295-IPAMORELIN', 127::numeric),
    ('AGPRIME-HGH-SOMATROPIN', 149::numeric),
    ('AGPRIME-AOD-9604-10MG', 127::numeric),
    ('AGPRIME-MELANOTAN-II', 89::numeric),
    ('AGPRIME-MOTS-C-10MG', 112::numeric),
    ('AGPRIME-SELANK', 89::numeric),
    ('AGPRIME-SEMAX', 89::numeric),
    ('AGPRIME-BAC-WATER-SYRINGE-KIT', 9::numeric),
    ('AGPRIME-REUSABLE-PEN-KIT', 14::numeric),
    ('AGPRIME-INSULIN-SYRINGE-PACK', 9::numeric)
)
update public.rx_plus_products p
set
  suggested_retail_price = rp.price,
  retail_price = rp.price,
  updated_at = now()
from requested_prices rp
where upper(p.sku) = rp.sku;

with requested_prices(sku, price) as (
  values
    ('AGPRIME-RETATRUTIDE-10MG', 172::numeric),
    ('AGPRIME-RETATRUTIDE-20MG', 224::numeric),
    ('AGPRIME-RETATRUTIDE-30MG', 262::numeric),
    ('AGPRIME-TIRZEPATIDE-10MG', 97::numeric),
    ('AGPRIME-TIRZEPATIDE-20MG', 127::numeric),
    ('AGPRIME-TIRZEPATIDE-30MG', 149::numeric),
    ('AGPRIME-SEMAGLUTIDE-10MG', 74::numeric),
    ('AGPRIME-BPC-157-5MG', 74::numeric),
    ('AGPRIME-BPC-157-10MG', 104::numeric),
    ('AGPRIME-TB-500-5MG', 74::numeric),
    ('AGPRIME-TB-500-10MG', 112::numeric),
    ('AGPRIME-BPC-157-TB-500-BLEND', 119::numeric),
    ('AGPRIME-NAD-PLUS', 112::numeric),
    ('AGPRIME-GLUTATHIONE-1500MG', 112::numeric),
    ('AGPRIME-GHK-CU-100MG', 97::numeric),
    ('AGPRIME-GLOW-PEPTIDE-BLEND', 127::numeric),
    ('AGPRIME-TESAMORELIN-5MG', 112::numeric),
    ('AGPRIME-TESAMORELIN-10MG', 149::numeric),
    ('AGPRIME-SERMORELIN', 97::numeric),
    ('AGPRIME-IPAMORELIN', 97::numeric),
    ('AGPRIME-CJC-1295-IPAMORELIN', 127::numeric),
    ('AGPRIME-HGH-SOMATROPIN', 149::numeric),
    ('AGPRIME-AOD-9604-10MG', 127::numeric),
    ('AGPRIME-MELANOTAN-II', 89::numeric),
    ('AGPRIME-MOTS-C-10MG', 112::numeric),
    ('AGPRIME-SELANK', 89::numeric),
    ('AGPRIME-SEMAX', 89::numeric),
    ('AGPRIME-BAC-WATER-SYRINGE-KIT', 9::numeric),
    ('AGPRIME-REUSABLE-PEN-KIT', 14::numeric),
    ('AGPRIME-INSULIN-SYRINGE-PACK', 9::numeric)
)
update public.distributor_products dp
set
  custom_price = rp.price,
  custom_retail_price = rp.price,
  updated_at = now()
from public.distributors d
join public.rx_plus_products p on true
join requested_prices rp on upper(p.sku) = rp.sku
where dp.distributor_id = d.id
  and dp.product_id = p.id
  and d.slug = 'agprime';
