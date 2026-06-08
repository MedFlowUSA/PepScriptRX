-- AACTIVATED main page Top 10 ranking.
-- Storefront and admin pricing manager both read featured + sort_order from this table.

with ranked(product_id, sort_order) as (
  values
    ('retatrutide-10mg', 10),
    ('tirzepatide-30mg', 20),
    ('wolverine-bpc-tb', 30),
    ('nad-500iu', 40),
    ('tesamorelin-10mg', 50),
    ('cjc-ipamorelin-10mg', 60),
    ('semaglutide-10mg', 70),
    ('glow-peptide-blend', 80),
    ('klow-peptide-blend', 90),
    ('igf-1-lr3-1mg', 100)
)
update public.aactivated_store_product_prices p
set
  featured = true,
  sort_order = ranked.sort_order,
  is_active = true,
  updated_at = now()
from ranked
where p.store_slug = 'aactivated'
  and p.product_id = ranked.product_id;

update public.aactivated_store_product_prices p
set
  featured = false,
  updated_at = now()
where p.store_slug = 'aactivated'
  and p.product_id not in (
    'retatrutide-10mg',
    'tirzepatide-30mg',
    'wolverine-bpc-tb',
    'nad-500iu',
    'tesamorelin-10mg',
    'cjc-ipamorelin-10mg',
    'semaglutide-10mg',
    'glow-peptide-blend',
    'klow-peptide-blend',
    'igf-1-lr3-1mg'
  )
  and p.featured = true;
