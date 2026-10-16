-- Route Pure's published catalog through the existing platform Stripe setup,
-- as requested by the platform owner. Match the existing sub-store convention.
-- Do not alter master products, pricing, commissions, or other distributors.
do $$
declare
  eligible_count integer;
begin
  select count(*) into eligible_count
  from public.distributor_products dp
  join public.distributors d on d.id = dp.distributor_id
  join public.rx_plus_products p on p.id = dp.product_id
  where d.slug = 'purepeptidelabs' and d.is_active
    and dp.is_enabled and dp.enabled and p.active;

  if eligible_count <> 37 then
    raise exception 'Expected 37 published Pure products, found %; review catalog before enabling Stripe', eligible_count;
  end if;

  update public.distributor_products dp
  set processor_eligibility = 'stripe_approved', updated_at = now()
  from public.distributors d, public.rx_plus_products p
  where dp.distributor_id = d.id and dp.product_id = p.id
    and d.slug = 'purepeptidelabs' and d.is_active
    and dp.is_enabled and dp.enabled and p.active
    and dp.processor_eligibility is distinct from 'stripe_approved';
end $$;
