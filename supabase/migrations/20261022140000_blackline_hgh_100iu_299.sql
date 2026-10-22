-- Replace only Blackline's 240 IU HGH listing with the existing 100 IU kit at $299.
do $$
declare store_id uuid; kit_id uuid;
begin
  select id into strict store_id from public.distributors where slug = 'blackline';
  select id into strict kit_id from public.rx_plus_products
  where sku = 'RXP-GROW-HGH-10' and active and strength = '10 IU x 10, 100 IU total';

  insert into public.distributor_products
    (distributor_id, product_id, is_enabled, enabled, custom_price, custom_retail_price, featured, commission_rate)
  values (store_id, kit_id, true, true, 299, 299, true, null)
  on conflict (distributor_id, product_id) do update set
    is_enabled = true, enabled = true, custom_price = 299, custom_retail_price = 299,
    featured = true, updated_at = now();

  update public.distributor_products dp
  set is_enabled = false, enabled = false, featured = false, updated_at = now()
  from public.rx_plus_products p
  where dp.distributor_id = store_id and dp.product_id = p.id and p.sku = 'RXP-MAIN-HGH-240IU-KIT';
end $$;
