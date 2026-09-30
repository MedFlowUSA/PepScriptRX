-- Only publish shared RXP catalog identities, not partner-specific copies.
-- Preserve all distinct shared strengths, pack sizes and variants, with live retail prices.
begin;
create or replace view public.powered316_catalog with (security_barrier=true) as
with ranked as (
  select p.*,row_number() over (
    partition by regexp_replace(lower(trim(p.product_name)),'[^a-z0-9]+','','g'),
      regexp_replace(lower(trim(coalesce(p.strength,''))),'[[:space:]]+','','g')
    order by case when p.sku like 'RXP-ADD-%' then 1 else 0 end,p.sku,p.id
  ) as storefront_rank
  from public.rx_plus_products p
  where p.active=true and p.visibility_type in ('public','rx_plus','distributor_only')
    and p.sku like 'RXP-%'
)
select p.id,p.sku,coalesce(p.display_name,p.product_name) as product_name,p.strength,p.category,p.description,
  p.retail_price,p.suggested_retail_price
from ranked p where p.storefront_rank=1;

-- A stale cart cannot check out a removed partner copy under the 316 brand.
do $$
declare
  fn_oid regprocedure := to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)');
  fn text;
  old_clause text := 'and i.checkout_allowed=true;';
  new_clause text := 'and i.checkout_allowed=true
          and exists (select 1 from public.powered316_catalog catalog where catalog.id=p.id);';
begin
  if fn_oid is null then raise exception '316 checkout core is missing'; end if;
  select pg_get_functiondef(fn_oid) into fn;
  if position(new_clause in fn)>0 then return; end if;
  if position('-- POWERED316 authoritative retail' in fn)=0
    or (length(fn)-length(replace(fn,old_clause,'')))/length(old_clause)<>1 then
    raise exception '316 checkout guard changed; review before applying';
  end if;
  execute replace(fn,old_clause,new_clause);
end $$;
commit;
