-- Clarify Rock Phorm product strengths/variant labels without changing pricing,
-- inventory, enablement, or commission settings.

with rockphorm_owned as (
  select p.id, lower(coalesce(p.product_name, '') || ' ' || coalesce(p.display_name, '') || ' ' || coalesce(p.strength, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.description, '')) as haystack
  from public.rx_plus_products p
  where coalesce(p.partner_slug, '') = 'rockphorm'
     or p.sku ilike 'ROCKPHORM-%'
)
update public.rx_plus_products p
set
  product_name = case
    when r.haystack like '%wolverine%' or (r.haystack like '%bpc-157%' and r.haystack like '%tb-500%') then 'Wolverine Stack'
    when r.haystack like '%glow%' or r.haystack like '%glom%' then 'Glow Stack'
    when r.haystack like '%hgh%' or r.haystack like '%somatropin%' then 'HGH / Somatropin'
    else p.product_name
  end,
  strength = case
    when r.haystack like '%wolverine%' or (r.haystack like '%bpc-157%' and r.haystack like '%tb-500%') then 'BPC-157 10 mg + TB-500 10 mg, 20 mg total'
    when r.haystack like '%nad%' then '1000 mg'
    when r.haystack like '%glow%' or r.haystack like '%glom%' then '70 mg total'
    when r.haystack like '%cagrisema%' then '2.4 mg + 2.4 mg, 4.8 mg total'
    when r.haystack like '%cjc%' and r.haystack like '%ipamorelin%' then '5 mg + 5 mg, 10 mg total'
    when (r.haystack like '%hgh%' or r.haystack like '%somatropin%') and (r.haystack like '%10%' or r.haystack like '%100%') then '10 IU x 10, 100 IU total'
    when r.haystack like '%hgh%' or r.haystack like '%somatropin%' then '24 IU x 10, 240 IU total'
    else p.strength
  end,
  display_name = case
    when r.haystack like '%wolverine%' or (r.haystack like '%bpc-157%' and r.haystack like '%tb-500%') then 'Wolverine Stack BPC-157 10 mg + TB-500 10 mg, 20 mg total'
    when r.haystack like '%nad%' then 'NAD+ 1000 mg'
    when r.haystack like '%glow%' or r.haystack like '%glom%' then 'Glow Stack 70 mg total'
    when r.haystack like '%cagrisema%' then 'CagriSema 2.4 mg + 2.4 mg, 4.8 mg total'
    when r.haystack like '%cjc%' and r.haystack like '%ipamorelin%' then 'CJC-1295 / Ipamorelin 5 mg + 5 mg, 10 mg total'
    when (r.haystack like '%hgh%' or r.haystack like '%somatropin%') and (r.haystack like '%10%' or r.haystack like '%100%') then 'HGH / Somatropin 10 IU x 10, 100 IU total'
    when r.haystack like '%hgh%' or r.haystack like '%somatropin%' then 'HGH / Somatropin 24 IU x 10, 240 IU total'
    else p.display_name
  end,
  description = case
    when r.haystack like '%wolverine%' or (r.haystack like '%bpc-157%' and r.haystack like '%tb-500%')
      then 'Rock Phorm BPC-157 10 mg + TB-500 10 mg blend, 20 mg total bottle. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.'
    else p.description
  end,
  updated_at = now()
from rockphorm_owned r
where p.id = r.id
  and (
    r.haystack like '%wolverine%'
    or (r.haystack like '%bpc-157%' and r.haystack like '%tb-500%')
    or r.haystack like '%nad%'
    or r.haystack like '%glow%'
    or r.haystack like '%glom%'
    or r.haystack like '%cagrisema%'
    or (r.haystack like '%cjc%' and r.haystack like '%ipamorelin%')
    or r.haystack like '%hgh%'
    or r.haystack like '%somatropin%'
  );

update public.product_intelligence_products
set
  product_name = 'Wolverine Stack',
  scientific_name = 'BPC-157 / TB-500 Blend',
  strength = 'BPC-157 10 mg + TB-500 10 mg, 20 mg total',
  components = array['BPC-157 10 mg', 'TB-500 10 mg'],
  updated_at = now()
where product_key in ('wolverine-bpc-tb', 'wolverine-20');

update public.product_intelligence_products
set
  product_name = 'CJC-1295 / Ipamorelin',
  scientific_name = 'CJC-1295 / Ipamorelin Blend',
  strength = '5 mg + 5 mg, 10 mg total',
  components = array['CJC-1295 5 mg', 'Ipamorelin 5 mg'],
  updated_at = now()
where product_key = 'cjc-ipamorelin-10mg';

update public.product_intelligence_products
set
  strength = '2.4 mg + 2.4 mg, 4.8 mg total',
  components = array['Cagrilintide 2.4 mg', 'Semaglutide 2.4 mg'],
  updated_at = now()
where product_key = 'cagrisema';

update public.product_intelligence_products
set
  product_name = 'Glow Stack',
  strength = '70 mg total',
  updated_at = now()
where product_key = 'glow-peptide-blend';
