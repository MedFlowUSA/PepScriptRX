-- Explicit user request: match Radiance's live tirzepatide prices (2026-10-01).
-- Radiance lists only 10mg, 15mg, and 30mg. Do not infer other strengths' prices.
-- Preserve product records, publication flags, commission rates and other stores.
do $$
declare changed integer;
begin
  update public.distributor_products dp
  set custom_price=prices.retail,custom_retail_price=prices.retail,updated_at=now()
  from public.distributors d, public.rx_plus_products p,
    (values ('RXP-GLP-TIRZ-10','10mg',140::numeric),
            ('RXP-GLP-TIRZ-15','15mg',175::numeric),
            ('RXP-GLP-TIRZ-30','30mg',275::numeric)) prices(sku,strength,retail)
  where dp.distributor_id=d.id and d.slug='purepeptidelabs'
    and dp.product_id=p.id and p.sku=prices.sku and p.strength=prices.strength;
  get diagnostics changed=row_count;
  if changed<>3 then
    raise exception 'Expected three existing Pure tirzepatide assignments; found %',changed;
  end if;
end $$;
