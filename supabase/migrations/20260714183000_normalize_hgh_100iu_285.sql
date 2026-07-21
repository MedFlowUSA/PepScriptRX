-- Normalize the shared HGH/Somatropin offering app-wide.
-- Every storefront should show one HGH / Somatropin item:
-- 10 IU x 10, 100 IU total at $285 retail.

do $$
declare
  v_name text := 'HGH / Somatropin';
  v_strength text := '10 IU x 10, 100 IU total';
  v_display_name text := 'HGH / Somatropin 10 IU x 10, 100 IU total';
  v_description text := 'HGH / Somatropin 10 IU x 10 kit, 100 IU total. Availability, suitability, and fulfillment are subject to verification.';
begin
  update public.rx_plus_products
  set
    product_name = v_name,
    display_name = v_display_name,
    strength = v_strength,
    suggested_retail_price = 285,
    retail_price = 285,
    description = v_description,
    active = case
      when upper(sku) in ('RXP-GROW-HGH-15', 'RXP-GROW-HGH-24', 'RXP-GROW-HGH-36') then false
      else true
    end,
    updated_at = now()
  where lower(concat_ws(' ', product_name, display_name, strength, sku, description)) like any (array['%hgh%', '%somatropin%']);

  update public.distributor_products dp
  set
    custom_price = 285,
    custom_retail_price = 285,
    is_enabled = case
      when upper(p.sku) in ('RXP-GROW-HGH-15', 'RXP-GROW-HGH-24', 'RXP-GROW-HGH-36') then false
      else true
    end,
    enabled = case
      when upper(p.sku) in ('RXP-GROW-HGH-15', 'RXP-GROW-HGH-24', 'RXP-GROW-HGH-36') then false
      else true
    end,
    updated_at = now()
  from public.rx_plus_products p
  where dp.product_id = p.id
    and lower(concat_ws(' ', p.product_name, p.display_name, p.strength, p.sku, p.description)) like any (array['%hgh%', '%somatropin%']);

  update public.store_product_pricing
  set
    product_name = v_name,
    retail_price = 285,
    display_price = 285,
    is_active = case
      when lower(product_slug) in ('hgh-15iu', 'hgh-24iu', 'hgh-36iu')
        or lower(product_slug) like '%150iu%'
        or lower(product_slug) like '%240iu%'
        or lower(product_slug) like '%360iu%'
        then false
      else true
    end,
    updated_at = now()
  where lower(concat_ws(' ', product_slug, product_name, category)) like any (array['%hgh%', '%somatropin%']);

  update public.aactivated_store_product_prices
  set
    product_name = v_name,
    retail_price = 285,
    sale_price = null,
    is_active = case
      when lower(product_id) in ('hgh-15iu', 'hgh-24iu', 'hgh-36iu') then false
      else true
    end,
    product_note = v_strength,
    updated_at = now()
  where lower(concat_ws(' ', product_id, product_name, product_note)) like any (array['%hgh%', '%somatropin%']);

  update public.product_intelligence_products
  set
    product_name = v_name,
    scientific_name = 'Somatropin',
    strength = v_strength,
    current_retail_price = 285,
    active_status = case
      when lower(product_key) in ('hgh-15iu', 'hgh-24iu', 'hgh-36iu')
        or upper(sku) in ('RXP-GROW-HGH-15', 'RXP-GROW-HGH-24', 'RXP-GROW-HGH-36')
        then 'inactive'
      else 'active'
    end,
    description = v_description,
    updated_at = now()
  where lower(concat_ws(' ', product_key, product_name, scientific_name, strength, sku, description)) like any (array['%hgh%', '%somatropin%']);

  update public.inventory_items
  set
    product_name = v_name,
    strength = v_strength,
    retail_price = 285,
    active = case
      when upper(sku) in ('RXP-GROW-HGH-15', 'RXP-GROW-HGH-24', 'RXP-GROW-HGH-36') then false
      else active
    end,
    notes = coalesce(notes, v_description),
    updated_at = now()
  where lower(concat_ws(' ', sku, product_name, strength, notes)) like any (array['%hgh%', '%somatropin%']);
end $$;
