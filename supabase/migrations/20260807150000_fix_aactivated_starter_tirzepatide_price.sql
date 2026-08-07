-- The Starter Experience tier is $249 for either supported starter option.
update public.aactivated_starter_kit_variations
set promo_price = 249.00,
    savings = greatest(retail_value - 249.00, 0)
where lower(variation_name) like 'tirzepatide starter%'
  and package_id in (
    select package_id
    from public.aactivated_starter_kit_packages
    where package_tier = 'starter_experience'
  );

do $$
begin
  if not exists (
    select 1
    from public.aactivated_starter_kit_variations
    where lower(variation_name) like 'tirzepatide starter%'
      and package_id in (
        select package_id
        from public.aactivated_starter_kit_packages
        where package_tier = 'starter_experience'
      )
      and promo_price = 249.00
  ) then
    raise exception 'AACTIVATED RX Tirzepatide starter price was not updated';
  end if;
end $$;
