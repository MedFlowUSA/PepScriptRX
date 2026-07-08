-- KLOW is a second branded storefront under Rock Phorm.
-- It uses Rock Phorm's existing checkout scope, distributor pricing,
-- and admin ownership. This migration intentionally does not create
-- a separate checkout scope for KLOW.

insert into public.rx_plus_products (
  product_slug,
  product_name,
  category,
  strength,
  sku,
  retail_price,
  display_price,
  base_cost,
  active,
  visibility_type,
  partner_slug,
  image_url,
  description
)
values (
  'rockphorm-klow-peptide-blend',
  'Klow Peptide Blend',
  'Recovery / Performance / Wellness',
  '70 mg total',
  'ROCKPHORM-KLOW-PEPTIDE-BLEND',
  169,
  169,
  0,
  true,
  'distributor_only',
  'rockphorm',
  '/brands/klow/klow-luxury-bundle.png',
  'KLOW Recovery + Radiance signature recovery and skin-support blend for Rock Phorm.'
)
on conflict (product_slug) do update set
  product_name = excluded.product_name,
  category = excluded.category,
  strength = excluded.strength,
  sku = excluded.sku,
  retail_price = excluded.retail_price,
  display_price = excluded.display_price,
  active = true,
  visibility_type = excluded.visibility_type,
  partner_slug = 'rockphorm',
  image_url = excluded.image_url,
  description = excluded.description,
  updated_at = now();

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  169,
  169,
  true,
  0.60
from public.distributors d
join public.rx_plus_products p
  on p.product_slug = 'rockphorm-klow-peptide-blend'
where d.slug = 'rockphorm'
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = true,
  commission_rate = 0.60,
  updated_at = now();

insert into public.partner_store_settings (
  store_slug,
  store_name,
  owner_email,
  admin_code,
  brand_id,
  status,
  custom_url,
  logo_url,
  colors,
  hero_text,
  brand_style_notes
)
values (
  'klow',
  'KLOW Recovery + Radiance',
  'rick@blueprintadvocate.io',
  'ROCKPHORM',
  'rockphorm',
  'active',
  '/klow',
  '/brands/klow/klow-logo-wall.png',
  jsonb_build_object(
    'primary', '#B89B72',
    'secondary', '#1B120D',
    'accent', '#D7C09A',
    'gold', '#C7A45D',
    'background', '#080605',
    'surface', '#14100C',
    'text', '#F8F1E7'
  ),
  'Luxury peptide wellness focused on recovery, skin support, restoration, and full-body radiance.',
  'KLOW is Rock Phorm''s second luxury storefront brand with recovery-radiance positioning.'
)
on conflict (store_slug) do update set
  store_name = excluded.store_name,
  owner_email = excluded.owner_email,
  admin_code = excluded.admin_code,
  brand_id = 'rockphorm',
  status = 'active',
  custom_url = excluded.custom_url,
  logo_url = excluded.logo_url,
  colors = excluded.colors,
  hero_text = excluded.hero_text,
  brand_style_notes = excluded.brand_style_notes,
  updated_at = now();

do $$
declare
  fn text;
  next_fn text;
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is null then
    raise exception 'create_public_patient_submission(jsonb) was not found';
  end if;

  if position('v_store_hint like ''%klow%''' in fn) = 0 then
    next_fn := replace(
      fn,
      'when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      'when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' or v_store_hint like ''%klow%'' then ''rockphorm'''
    );

    if next_fn = fn then
      raise exception 'Could not patch KLOW checkout pricing mapping';
    end if;

    execute next_fn;
  end if;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
