-- Backfill server-owned prices for partner catalogs that are rendered from
-- src/data/rxPlus.ts. Public checkout ignores the browser's price and resolves
-- these product IDs from public.products.

with catalog(raw) as (
  values
    ('mark|mark-retatrutide-5mg|Retatrutide|150|Weight Loss / GLP-1'),
    ('mark|mark-retatrutide-10mg|Retatrutide|200|Weight Loss / GLP-1'),
    ('mark|mark-retatrutide-15mg|Retatrutide|250|Weight Loss / GLP-1'),
    ('mark|mark-retatrutide-30mg|Retatrutide|600|Weight Loss / GLP-1'),
    ('mark|mark-tirzepatide-10mg|Tirzepatide|200|Weight Loss / GLP-1'),
    ('mark|mark-tirzepatide-15mg|Tirzepatide|250|Weight Loss / GLP-1'),
    ('mark|mark-tirzepatide-30mg|Tirzepatide|600|Weight Loss / GLP-1'),
    ('mark|mark-semaglutide-10mg|Semaglutide|200|Weight Loss / GLP-1'),
    ('mark|mark-semaglutide-15mg|Semaglutide|250|Weight Loss / GLP-1'),
    ('mark|mark-semaglutide-3mg-oral-30ct|Semaglutide Oral|300|Weight Loss / GLP-1'),
    ('mark|mark-cagrilintide-10mg|Cagrilintide|300|Weight Loss / GLP-1'),
    ('mark|mark-mazdutide|Mazdutide|200|Weight Loss / GLP-1'),
    ('mark|mark-survodutide|Survodutide|200|Weight Loss / GLP-1'),
    ('mark|mark-aod9604-5mg|AOD9604|200|Weight Loss / GLP-1'),
    ('mark|mark-5-amino-1mq|5 Amino-1MQ|200|Weight Loss / GLP-1'),
    ('mark|mark-bpc-157-5mg|BPC-157|150|Recovery / Repair'),
    ('mark|mark-bpc-157-10mg|BPC-157|200|Recovery / Repair'),
    ('mark|mark-tb-500-5mg|TB-500|150|Recovery / Repair'),
    ('mark|mark-tb-500-10mg|TB-500|200|Recovery / Repair'),
    ('mark|mark-wolverine-stack|Wolverine Stack|300|Recovery / Repair'),
    ('mark|mark-glow|GLOW|300|Recovery / Repair'),
    ('mark|mark-klow|KLOW|300|Recovery / Repair'),
    ('mark|mark-kpv|KPV|150|Recovery / Repair'),
    ('mark|mark-ghk-cu-50mg|GHK-CU|200|Recovery / Repair'),
    ('mark|mark-ss-31|SS-31|250|Recovery / Repair'),
    ('mark|mark-cjc-1295|CJC-1295|200|Growth Hormone / Longevity'),
    ('mark|mark-cjc-ipamorelin-10mg|CJC + Ipamorelin|300|Growth Hormone / Longevity'),
    ('mark|mark-ipamorelin-5mg|Ipamorelin|150|Growth Hormone / Longevity'),
    ('mark|mark-kisspeptin-10mg|Kisspeptin|200|Growth Hormone / Longevity'),
    ('mark|mark-mk-677|MK-677|200|Growth Hormone / Longevity'),
    ('mark|mark-igf|IGF|300|Growth Hormone / Longevity'),
    ('mark|mark-tesamorelin-10mg|Tesamorelin|300|Growth Hormone / Longevity'),
    ('mark|mark-sermorelin|Sermorelin|300|Growth Hormone / Longevity'),
    ('mark|mark-hgh-100iu-kit|HGH Kit|600|Growth Hormone / Longevity'),
    ('mark|mark-hgh-150iu-kit|HGH Kit|700|Growth Hormone / Longevity'),
    ('mark|mark-hcg-5000iu|HCG|150|Growth Hormone / Longevity'),
    ('mark|mark-hcg-10000iu|HCG|200|Growth Hormone / Longevity'),
    ('mark|mark-hmg-75iu|HMG|150|Growth Hormone / Longevity'),
    ('mark|mark-nad-plus|NAD+|300|Wellness / Anti-Aging'),
    ('mark|mark-nad-1000mg|NAD+|300|Wellness / Anti-Aging'),
    ('mark|mark-glutathione|Glutathione|300|Wellness / Anti-Aging'),
    ('mark|mark-pt-141|PT-141|200|Wellness / Anti-Aging'),
    ('mark|mark-melanotan-i-10mg|Melanotan I|150|Wellness / Anti-Aging'),
    ('mark|mark-melanotan-ii-10mg|Melanotan II|150|Wellness / Anti-Aging'),
    ('mark|mark-mots-c-10mg|MOTS-C|200|Wellness / Anti-Aging'),
    ('mark|mark-epithalon-10mg|Epithalon|300|Wellness / Anti-Aging'),
    ('mark|mark-semax-10mg|Semax|200|Neuro / Cognitive / Mood'),
    ('mark|mark-selank|Selank|200|Neuro / Cognitive / Mood'),
    ('mark|mark-dsip-2mg|DSIP|150|Neuro / Cognitive / Mood'),
    ('mark|mark-mixing-water|Mixing Water|20|Functional / Supplies'),
    ('mark|mark-needles|Needles|20|Functional / Supplies'),
    ('mark|mark-b12|B12|150|Functional / Supplies'),
    ('robert|warxlabz-reta-10mg|Reta|95|Weight Loss / GLP-1'),
    ('robert|warxlabz-reta-20mg|Reta|160|Weight Loss / GLP-1'),
    ('robert|warxlabz-reta-30mg|Reta|220|Weight Loss / GLP-1'),
    ('robert|warxlabz-reta-50mg|Reta|375|Weight Loss / GLP-1'),
    ('robert|warxlabz-reta-oral-500mcg|Reta Oral|175|Weight Loss / GLP-1'),
    ('robert|warxlabz-tirzepatide-10mg|Tirzepatide|90|Weight Loss / GLP-1'),
    ('robert|warxlabz-tirzepatide-20mg|Tirzepatide|145|Weight Loss / GLP-1'),
    ('robert|warxlabz-tirzepatide-30mg|Tirzepatide|199|Weight Loss / GLP-1'),
    ('robert|warxlabz-tirzepatide-oral-500mcg|Tirzepatide Oral|125|Weight Loss / GLP-1'),
    ('robert|warxlabz-ghk-cu-50mg|GHK-Cu|45|Recovery / Repair'),
    ('robert|warxlabz-ghk-cu-100mg|GHK-Cu|85|Recovery / Repair'),
    ('robert|warxlabz-mots-c-10mg|MOTS-c|65|Wellness / Anti-Aging'),
    ('robert|warxlabz-mots-c-40mg|MOTS-c|150|Wellness / Anti-Aging'),
    ('robert|warxlabz-tesamorelin-10mg|Tesamorelin|100|Growth Hormone / Longevity'),
    ('robert|warxlabz-tesamorelin-20mg|Tesamorelin|185|Growth Hormone / Longevity'),
    ('robert|warxlabz-cjc-ipamorelin-10mg|CJC + Ipamorelin|100|Growth Hormone / Longevity'),
    ('robert|warxlabz-igf-1-lr3-1mg|IGF-1 LR3|150|Growth Hormone / Longevity'),
    ('robert|warxlabz-hgh-kit-100iu|HGH Kit|220|Growth Hormone / Longevity'),
    ('robert|warxlabz-hgh-kit-240iu|HGH Kit|360|Growth Hormone / Longevity'),
    ('robert|warxlabz-hgh-kit-360iu|HGH Kit|500|Growth Hormone / Longevity'),
    ('robert|warxlabz-bpc-157-10mg|BPC-157|65|Recovery / Repair'),
    ('robert|warxlabz-tb-500-10mg|TB-500|70|Recovery / Repair'),
    ('robert|warxlabz-klow-80mg|Klow|125|Recovery / Repair'),
    ('robert|warxlabz-wolverine-stack-10mg|Wolverine Stack|100|Recovery / Repair'),
    ('robert|warxlabz-wolverine-stack-20mg|Wolverine Stack|140|Recovery / Repair'),
    ('robert|warxlabz-nad-1000mg|NAD+|100|Wellness / Anti-Aging'),
    ('robert|warxlabz-lipo-c-b12|Lipo-C B12|100|Wellness / Anti-Aging'),
    ('robert|warxlabz-hcg-10000iu|HCG|125|Growth Hormone / Longevity'),
    ('robert|warxlabz-semax-10mg|Semax|55|Neuro / Cognitive / Mood'),
    ('robert|warxlabz-selank-10mg|Selank|55|Neuro / Cognitive / Mood'),
    ('robert|warxlabz-mt-2-10mg|MT-2|50|Wellness / Anti-Aging'),
    ('robert|warxlabz-pt-141-10mg|PT-141|55|Wellness / Anti-Aging'),
    ('robert|warxlabz-glutathione|Glutathione|90|Wellness / Anti-Aging'),
    ('robert|warxlabz-bac-water-10ml|Bac Water|15|Functional / Supplies'),
    ('robert|warxlabz-bac-water-30ml|Bac Water|25|Functional / Supplies'),
    ('robert|warxlabz-needles-31g-10-pack|Needles 31g|10|Functional / Supplies'),
    ('scott|scott-retatrutide-10mg|Retatrutide|130|GLP / Weight Management'),
    ('scott|scott-retatrutide-15mg|Retatrutide|150|GLP / Weight Management'),
    ('scott|scott-retatrutide-30mg|Retatrutide|180|GLP / Weight Management'),
    ('scott|scott-tirzepatide-10mg|Tirzepatide|200|GLP / Weight Management'),
    ('scott|scott-tirzepatide-15mg|Tirzepatide|250|GLP / Weight Management'),
    ('scott|scott-tirzepatide-30mg|Tirzepatide|600|GLP / Weight Management'),
    ('scott|scott-hgh-somatropin-10iu-10-vials|HGH Somatropin|175|Growth / Performance'),
    ('scott|scott-aod9604-5mg|AOD-9604|50|Recovery / Repair'),
    ('scott|scott-5amino1mq|5-Amino-1MQ|100|Recovery / Repair'),
    ('scott|scott-bpc157-5mg|BPC-157|50|Recovery / Repair'),
    ('scott|scott-bpc157-10mg|BPC-157|60|Recovery / Repair'),
    ('scott|scott-tb500-5mg|TB-500|50|Recovery / Repair'),
    ('scott|scott-tb500-10mg|TB-500|60|Recovery / Repair'),
    ('scott|scott-wolverine-stack|Wolverine Stack|80|Recovery / Repair'),
    ('scott|scott-glow-stack|Glow Stack|120|Recovery / Repair'),
    ('scott|scott-klow-stack|Klow Stack|130|Recovery / Repair'),
    ('scott|scott-ghkcu|GHK-CU|60|Recovery / Repair'),
    ('scott|scott-tesamorelin-10mg|Tesamorelin|70|Recovery / Repair'),
    ('scott|scott-nad-500mg|NAD+|90|Longevity / Wellness'),
    ('scott|scott-glutathione-1500mg|Glutathione|60|Longevity / Wellness'),
    ('scott|scott-mots-c-10mg|MOTS-C|50|Longevity / Wellness'),
    ('scott|scott-bac-water|Bacteriostatic Water|15|Functional / Supplies'),
    ('scott|scott-insulin-needles|Insulin Needles|15|Functional / Supplies')
),
parsed as (
  select
    split_part(raw, '|', 1) as store_key,
    split_part(raw, '|', 2) as product_id,
    split_part(raw, '|', 3) as product_name,
    split_part(raw, '|', 4)::numeric as product_price,
    split_part(raw, '|', 5) as product_category
  from catalog
)
insert into public.products (id, name, price, category, status, display_note, sort_order)
select
  product_id,
  product_name,
  product_price,
  product_category,
  'manual_review',
  case store_key
    when 'mark' then 'Empire Health & Wellness checkout catalog.'
    when 'robert' then 'WarXlabz checkout catalog.'
    else 'Peak Form checkout catalog.'
  end,
  case store_key when 'mark' then 900 when 'robert' then 910 else 920 end
from parsed
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;

-- Alpha Pride intentionally mirrors Empire pricing under its own product IDs.
insert into public.products (id, name, price, category, status, display_note, sort_order)
select
  regexp_replace(id, '^mark-', 'alpha-'),
  name,
  price,
  category,
  status,
  'Alpha Pride Wellness checkout catalog.',
  930
from public.products
where id like 'mark-%'
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;

-- Zenora starts from Empire pricing and then applies its managed overrides.
insert into public.products (id, name, price, category, status, display_note, sort_order)
select
  regexp_replace(id, '^mark-', 'zenora-'),
  case when id = 'mark-glow' then 'Glow Blend' else name end,
  price,
  category,
  status,
  'ZENORA checkout catalog.',
  940
from public.products
where id like 'mark-%'
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;

insert into public.products (id, name, price, category, status, display_note, sort_order)
select
  product_slug,
  product_name,
  coalesce(display_price, retail_price),
  category,
  'manual_review',
  'ZENORA managed checkout catalog.',
  940
from public.store_product_pricing
where store_slug = 'zenora'
  and is_active = true
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;
