-- The Starter Experience tier is $249 for either supported starter option.
update public.aactivated_starter_kit_variations
set promo_price = 249.00,
    savings = greatest(retail_value - 249.00, 0)
where package_id = 'starter-experience-kit'
  and variation_id = 'tirz';

do $$
begin
  if not exists (
    select 1
    from public.aactivated_starter_kit_variations
    where package_id = 'starter-experience-kit'
      and variation_id = 'tirz'
      and promo_price = 249.00
  ) then
    raise exception 'AACTIVATED RX Tirzepatide starter price was not updated';
  end if;
end $$;
