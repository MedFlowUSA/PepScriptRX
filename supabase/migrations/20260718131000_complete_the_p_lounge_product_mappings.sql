-- Complete The P Lounge distributor product mappings for products that already exist
-- in the central catalog but were not attached by the storefront bootstrap migration.

with requested_products(sku, requested_price, featured) as (
  values
    ('RXP-GLP-RETA-30', 349.00, true),
    ('RXP-REC-BPC157-5', 99.00, false),
    ('RXP-REC-TB500-5', 99.00, false),
    ('RXP-GROW-SERM', 129.00, false),
    ('RXP-MAIN-IPA-5', 129.00, false),
    ('RXP-MAIN-HGH-240IU-KIT', 199.00, true),
    ('RXP-ADD-AOD9604-5', 119.00, false),
    ('RXP-ADD-AOD9604-10', 169.00, false),
    ('RXP-ADD-PT141', 119.00, false),
    ('RXP-ADD-MELANOTAN-II', 119.00, false),
    ('RXP-ADD-KISSPEPTIN', 129.00, false),
    ('RXP-IMM-THYMOSIN-A1', 159.00, false),
    ('RXP-ADD-DSIP', 119.00, false),
    ('RXP-IMM-LL37', 149.00, false),
    ('RXP-SUP-BAC-SYR-8', 12.00, false),
    ('RXP-SUP-PEN-KIT', 19.00, false),
    ('RXP-SUP-INS-SYR', 12.00, false)
)
insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  true,
  rp.requested_price,
  rp.requested_price,
  rp.featured,
  0.5500
from requested_products rp
join public.distributors d on d.slug = 'the-p-lounge'
join public.rx_plus_products p on upper(p.sku) = upper(rp.sku)
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured,
  commission_rate = 0.5500,
  updated_at = now();
