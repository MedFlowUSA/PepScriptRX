-- KLOW is a second branded storefront under Rock Phorm.
-- It uses Rock Phorm's existing checkout scope, distributor pricing,
-- and admin ownership. This migration intentionally does not create
-- a separate checkout scope for KLOW.

insert into public.rx_plus_products (
  product_name,
  display_name,
  category,
  strength,
  sku,
  suggested_retail_price,
  retail_price,
  base_cost,
  active,
  visibility_type,
  public_visible,
  partner_visible,
  partner_slug,
  featured,
  image_url,
  description
)
values (
  'Klow Peptide Blend',
  'Klow Peptide Blend 70 mg total',
  'Recovery / Performance / Wellness',
  '70 mg total',
  'ROCKPHORM-KLOW-PEPTIDE-BLEND',
  169,
  169,
  0,
  true,
  'distributor_only',
  false,
  true,
  'rockphorm',
  true,
  '/brands/klow/klow-luxury-bundle.png',
  'KLOW Recovery + Radiance signature recovery and skin-support blend for Rock Phorm.'
)
on conflict (sku) do update set
  product_name = excluded.product_name,
  display_name = excluded.display_name,
  category = excluded.category,
  strength = excluded.strength,
  suggested_retail_price = excluded.suggested_retail_price,
  retail_price = excluded.retail_price,
  active = true,
  visibility_type = excluded.visibility_type,
  public_visible = false,
  partner_visible = true,
  partner_slug = 'rockphorm',
  featured = true,
  image_url = excluded.image_url,
  description = excluded.description,
  updated_at = now();

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate
)
select
  d.id,
  p.id,
  true,
  true,
  169,
  169,
  true,
  0.60
from public.distributors d
join public.rx_plus_products p
  on p.sku = 'ROCKPHORM-KLOW-PEPTIDE-BLEND'
where d.slug = 'rockphorm'
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  featured = true,
  commission_rate = 0.60,
  updated_at = now();

insert into public.partner_store_settings (
  store_slug,
  store_name,
  settings,
  brand_id,
  status,
  custom_url,
  logo_url,
  colors,
  hero_text
)
values (
  'klow',
  'KLOW Recovery + Radiance',
  jsonb_build_object(
    'id', 'klow',
    'slug', 'klow',
    'name', 'KLOW',
    'displayName', 'KLOW Recovery + Radiance',
    'parentBrandId', 'rockphorm',
    'ownerBrandId', 'rockphorm',
    'scopeCode', 'ROCKPHORM',
    'adminCode', 'ROCKPHORM',
    'ownerEmail', 'rick@blueprintadvocate.io',
    'tagline', 'Calm the system. Restore the body. Reveal the glow.',
    'shortDescription', 'Luxury peptide wellness focused on recovery, skin support, restoration, and full-body radiance.',
    'heroImage', '/brands/klow/klow-luxury-bundle.png',
    'ambientImage', '/brands/klow/klow-radiance-hero.png'
  ),
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
  'Luxury peptide wellness focused on recovery, skin support, restoration, and full-body radiance.'
)
on conflict (store_slug) do update set
  store_name = excluded.store_name,
  settings = excluded.settings,
  brand_id = 'rockphorm',
  status = 'active',
  custom_url = excluded.custom_url,
  logo_url = excluded.logo_url,
  colors = excluded.colors,
  hero_text = excluded.hero_text,
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
