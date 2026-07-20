-- Keep Rock Phorm/KLOW catalog aliases pointed at the live stocked inventory buckets.
-- CagriSema currently shares the stocked Cagri inventory bucket used by active
-- storefront catalog rows. KLOW is a 70 mg blend and should not appear out of
-- stock when the active 70 mg blend inventory bucket has stock.

begin;

create or replace function public.resolve_main_inventory_sku(
  product_sku text,
  product_name text,
  product_strength text,
  product_category text default null
)
returns text
language sql
immutable
as $$
  with normalized as (
    select
      lower(concat_ws(' ', product_sku, product_name, product_strength, product_category)) as haystack,
      lower(coalesce(product_strength, '')) as strength_text
  )
  select case
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])60[[:space:]-]*mg([^0-9]|$)' then 'TR60'
    when haystack like '%tirzepatide%' and haystack ~ '(^|[^0-9])30[[:space:]-]*mg([^0-9]|$)' then 'TR30'
    when haystack like '%semaglutide%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'SM10'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])30[[:space:]-]*mg([^0-9]|$)' then 'RXP-GLP-RETA-30'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])20[[:space:]-]*mg([^0-9]|$)' then 'RXP-GLP-RETA-20'
    when haystack like '%retatrutide%' and haystack ~ '(^|[^0-9])15[[:space:]-]*mg([^0-9]|$)' then 'RT15'
    when haystack like '%bac%' and haystack like '%water%' then 'WA10'
    when haystack like '%pen%' and haystack like '%kit%' then 'PNKIT'
    when haystack like '%klow%' then 'RXP-MAIN-GLOW70'
    when haystack like '%cagrisema%' then 'RXP-GLP-CAGRI-10'
    when haystack like '%cagrilintide%' then 'RXP-GLP-CAGRI-10'
    when haystack like '%cjc%' and haystack like '%ipamorelin%' then 'RXP-MAIN-CJCIPA-10'
    when haystack like '%ghk%' and haystack ~ '(^|[^0-9])1000[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GHKCU-1000'
    when haystack like '%ghk%' and haystack ~ '(^|[^0-9])500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GHKCU-500'
    when haystack like '%ghk%' and (haystack like '%100mg%' or haystack like '%100 mg%' or strength_text = 'standard') then 'RXP-MAIN-GHKCU-100'
    when haystack like '%glow%' then 'RXP-MAIN-GLOW70'
    when haystack like '%glutathione%' and haystack ~ '(^|[^0-9])1500[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-GLUTA-1500'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])240[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])24[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-240IU-KIT'
    when (haystack like '%hgh%' or haystack like '%somatropin%') and (haystack ~ '(^|[^0-9])100[[:space:]-]*iu([^0-9]|$)' or haystack ~ '(^|[^0-9])10[[:space:]-]*iu([^0-9]|$)') then 'RXP-MAIN-HGH-100IU-KIT'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-IPA-5'
    when haystack like '%ipamorelin%' and haystack not like '%cjc%' and (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' or strength_text = 'standard') then 'RXP-MAIN-IPA-10'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])40[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-40'
    when haystack like '%mots%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-MOTSC-10'
    when haystack like '%tesamorelin%' and haystack like '%ipamorelin%' and (haystack like '%10/5%' or (haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' and haystack ~ '(^|[^0-9])5[[:space:]-]*mg([^0-9]|$)')) then 'RXP-MAIN-TESAIPA-10-5'
    when haystack like '%tesamorelin%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TESA-10'
    when haystack like '%wolverine%' or haystack like '%bb20%' or haystack like '%bpc/tb%' or (haystack like '%bpc%' and haystack like '%tb%') then 'RXP-MAIN-WOLVERINE-20'
    when haystack like '%bpc-157%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-REC-BPC157-10'
    when haystack like '%tb-500%' and haystack ~ '(^|[^0-9])15[[:space:]-]*mg([^0-9]|$)' then 'RXP-MAIN-TB500-15'
    when haystack like '%tb-500%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-REC-TB500-10'
    when haystack like '%nad%' and haystack ~ '(^|[^0-9])1000[[:space:]-]*(mg|iu)([^0-9]|$)' then 'RXP-LONG-NAD-1000'
    when haystack like '%nad%' and haystack ~ '(^|[^0-9])500[[:space:]-]*(mg|iu)([^0-9]|$)' then 'RXP-LONG-NAD-500'
    when haystack like '%selank%' and haystack ~ '(^|[^0-9])10[[:space:]-]*mg([^0-9]|$)' then 'RXP-NEU-SELANK-10'
    else null
  end
  from normalized;
$$;

grant execute on function public.resolve_main_inventory_sku(text, text, text, text) to anon, authenticated;

comment on function public.resolve_main_inventory_sku(text, text, text, text) is
  'Maps storefront and product-intelligence aliases to the current platform inventory SKU, including Rock Phorm/KLOW Cagri and KLOW blend aliases.';

commit;
