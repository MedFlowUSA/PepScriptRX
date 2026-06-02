-- Update Ronin / Matthew Thomas to 50% commission after true product cost.

update public.reps
set
  commission_rate = 0.50,
  platform_percent = 0.50,
  override_percent = 0,
  commission_type = 'net_profit_share'
where rep_slug = 'MGT1111'
   or lower(coalesce(brand_name, '')) = 'ronin'
   or lower(coalesce(custom_store_slug, '')) = 'ronin';

update public.distributors
set
  commission_rate = 0.50,
  updated_at = now()
where slug = 'ronin';

update public.distributor_products dp
set
  commission_rate = 0.50,
  updated_at = now()
from public.distributors d
where dp.distributor_id = d.id
  and d.slug = 'ronin';

update public.checkout_scopes
set
  default_commission_rate = 0.50,
  notes = 'Ronin white-label checkout scope for Matthew Thomas. 50% net-profit commission after true product cost. Public storefront displays Ronin only.',
  updated_at = now()
where scope_code = 'MGT1111';
