-- User approved matching the 37 products and displayed prices at /glow on
-- 2026-09-28. Snapshot getDistributorProducts('glow'), including normalized HGH.
-- Reuse existing records; modify only Pure assignments and its checkout guard.
create temporary table pure_glow_reference (
  sku text primary key, strength text not null, retail_price numeric not null,
  featured boolean not null
) on commit drop;
insert into pure_glow_reference values
  ('RXP-GLP-RETA-5','5mg',150,false),
  ('RXP-GLP-RETA-10','10mg',200,false),
  ('RXP-GLP-RETA-15','15mg',250,false),
  ('RXP-GLP-RETA-20','20mg',350,false),
  ('RXP-GLP-TIRZ-10','10mg',200,false),
  ('RXP-GLP-TIRZ-15','15mg',250,false),
  ('RXP-GLP-TIRZ-20','20mg',350,false),
  ('RXP-GLP-TIRZ-30','30mg',600,false),
  ('RXP-GLP-TIRZ-60','60mg',950,false),
  ('RXP-GLP-SEMA-10','10mg',99,false),
  ('RXP-GLP-CAGRISEMA','Blend',450,false),
  ('RXP-GLP-CAGRI-5','5mg',220,false),
  ('RXP-GLP-AOD-5','5mg',119,false),
  ('RXP-GLP-AOD-10','10mg',199,false),
  ('RXP-GROW-HGH-10','10 IU x 10, 100 IU total',285,false),
  ('RXP-GROW-TESA-2','2mg',79,false),
  ('RXP-GROW-TESA-5','5mg',129,false),
  ('RXP-GROW-TESA-10','10mg',229,false),
  ('RXP-GROW-CJCIPA-10','10mg',149,false),
  ('RXP-GROW-MK677','Standard',79,false),
  ('RXP-REC-WOLV','Blend',149,false),
  ('RXP-REC-GLOW','Blend',169,true),
  ('RXP-REC-KLOW','Blend',169,true),
  ('RXP-REC-BPC157-10','10mg',99,false),
  ('RXP-REC-TB500-10','10mg',169,false),
  ('RXP-REC-GHKCU-100','100mg',119,true),
  ('RXP-LONG-MOTSC-10','10mg',129,false),
  ('RXP-LONG-NAD-100','100iu',69,false),
  ('RXP-LONG-NAD-500','500iu',119,true),
  ('RXP-LONG-NAD-1000','1000iu',179,true),
  ('RXP-LONG-GLUTA-1500','1500mg',179,true),
  ('RXP-LONG-EPI-10','10mg',99,false),
  ('RXP-LONG-SS31','Standard',399,false),
  ('RXP-COG-SELANK','Standard',89,false),
  ('RXP-COG-SEMAX','Standard',89,false),
  ('RXP-COG-PT141','Standard',129,false),
  ('RXP-GROW-IGF1-LR3-1','1mg',199,false);

do $$
declare
  fn_oid regprocedure := coalesce(
    to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)'),
    to_regprocedure('public.create_public_patient_submission(jsonb)'));
  fn text;
  old_guard text := 'and coalesce(p.partner_slug,'''') in ('''',''purepeptidelabs'')';
  approved_skus text;
begin
  if not exists (select 1 from public.distributors where slug='purepeptidelabs'
    and is_active=true and commission_rate=0.6000) then
    raise exception 'Pure Peptide Labs direct owner configuration is missing';
  end if;
  if (select count(*) from pure_glow_reference s join public.rx_plus_products p on p.sku=s.sku
      where p.active=true and p.visibility_type in ('public','rx_plus','distributor_only')
        and coalesce(p.partner_slug,'') in ('','guy','purepeptidelabs')
        and p.strength=s.strength) <> 37 then
    raise exception 'Approved GLOW catalog changed; review existing records before publication';
  end if;

  select pg_get_functiondef(fn_oid) into fn;
  if fn is null or position('-- Pure Peptide Labs explicit catalog guard' in fn)=0 then
    raise exception 'Pure Peptide Labs checkout guard is missing';
  end if;
  if position('-- Pure Peptide Labs approved GLOW selection' in fn)=0 then
    if position(old_guard in fn)=0 or
      (length(fn)-length(replace(fn,old_guard,'')))/length(old_guard) <> 1 then
      raise exception 'Pure checkout guard changed; review before patching';
    end if;
    select string_agg(quote_literal(sku),',' order by sku) into approved_skus from pure_glow_reference;
    fn := replace(fn,old_guard,
      '-- Pure Peptide Labs approved GLOW selection (2026-09-28).' || chr(10) ||
      '          and (coalesce(p.partner_slug,'''') in ('''',''purepeptidelabs'')' ||
      ' or (p.partner_slug=''guy'' and p.sku in (' || approved_skus || ')))');
    execute fn;
  end if;
end $$;

insert into public.distributor_products (
  distributor_id,product_id,is_enabled,enabled,custom_price,custom_retail_price,featured,commission_rate
)
select d.id,p.id,true,true,s.retail_price,s.retail_price,s.featured,0.6000
from pure_glow_reference s
join public.rx_plus_products p on p.sku=s.sku
join public.distributors d on d.slug='purepeptidelabs'
on conflict (distributor_id,product_id) do update set
  is_enabled=excluded.is_enabled,enabled=excluded.enabled,
  custom_price=excluded.custom_price,custom_retail_price=excluded.custom_retail_price,
  featured=excluded.featured,commission_rate=excluded.commission_rate,updated_at=now();
