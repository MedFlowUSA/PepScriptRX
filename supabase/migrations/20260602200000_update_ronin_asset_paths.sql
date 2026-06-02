-- Point Ronin live metadata to the supplied PNG logo and vial artwork.

update public.reps
set brand_theme = coalesce(brand_theme, '{}'::jsonb)
  || jsonb_build_object(
    'logo', '/marketing/ronin-logo.png',
    'productImage', '/marketing/ronin-vial.png'
  )
where rep_slug = 'MGT1111'
   or lower(coalesce(brand_name, '')) = 'ronin'
   or lower(coalesce(custom_store_slug, '')) = 'ronin';
