-- Extend the existing submission pricing path, without copying its implementation
-- or changing pricing behavior for any other store. Fail closed on schema drift.
do $$
declare
  fn_oid regprocedure := coalesce(
    to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)'),
    to_regprocedure('public.create_public_patient_submission(jsonb)'));
  fn text;
  next_fn text;
  marker text := 'v_distributor_slug := case';
  guard_marker text := 'if v_aactivated_store_slug is not null then';
begin
  if fn_oid is null then raise exception 'Public submission pricing function is missing'; end if;
  select pg_get_functiondef(fn_oid) into fn;
  if position('-- Pure Peptide Labs explicit catalog guard' in fn) > 0 then return; end if;
  if position(marker in fn)=0 or position(guard_marker in fn)=0 then
    raise exception 'Public submission pricing changed; review Pure Peptide Labs extension before applying';
  end if;
  next_fn := replace(fn,marker,$patch$v_distributor_slug := case
    when v_scope_code = 'PUREPEPTIDELABS' then 'purepeptidelabs'$patch$);
  next_fn := replace(next_fn,guard_marker,$patch$
      -- Pure Peptide Labs explicit catalog guard: no fallback to main/other stores.
      if v_distributor_slug = 'purepeptidelabs' and not exists (
        select 1 from public.distributor_products dp
        join public.distributors d on d.id=dp.distributor_id
        join public.rx_plus_products p on p.id=dp.product_id
        where d.slug='purepeptidelabs' and d.is_active=true
          and dp.is_enabled=true and coalesce(dp.enabled,true)=true and p.active=true
          and p.visibility_type in ('public','rx_plus','distributor_only')
          and coalesce(p.partner_slug,'') in ('','purepeptidelabs')
          and coalesce(dp.custom_price,dp.custom_retail_price)>0
          and p.id::text=v_item_id
          and (v_item_sku is null or v_item_sku='' or upper(p.sku)=v_item_sku)
      ) then
        raise exception 'This item is not published for Pure Peptide Labs';
      end if;
      if v_aactivated_store_slug is not null then$patch$);
  if next_fn=fn then raise exception 'Pure Peptide Labs pricing extension did not apply'; end if;
  execute next_fn;
end $$;
