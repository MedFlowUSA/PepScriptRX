-- Ray McCalll is an Aurora Labs downline rep. Keep Ray at 20% while
-- preserving Mike / Aurora as the 40% parent account.

update public.reps
set
  commission_type = 'net_profit_after_true_cost',
  commission_rate = 0.20,
  override_percent = 0.20,
  account_type = 'rep',
  parent_type = 'aurora_downline',
  rep_channel = 'aurora_downline_rep',
  rep_tier = 'aurora_downline_rep',
  custom_store_slug = 'aurora',
  brand_name = 'Aurora Labs',
  active = true,
  updated_at = now()
where upper(coalesce(rep_slug, '')) = 'AURORARM';

update public.checkout_scopes
set
  account_type = 'rep',
  parent_account_id = 'AURORA',
  is_active = true,
  default_commission_rate = 0.20,
  updated_at = now()
where upper(coalesce(scope_code, '')) = 'AURORARM';

update public.partner_rep_commission_settings
set
  commission_percent = 20,
  commission_basis = 'net_profit_after_true_cost',
  parent_override_percent = 20,
  status = 'active',
  updated_at = now()
where upper(coalesce(store_scope, '')) = 'AURORA'
  and (
    lower(coalesce(rep_email, '')) = 'rayslaoffice@gmail.com'
    or rep_id in (
      select id
      from public.reps
      where upper(coalesce(rep_slug, '')) = 'AURORARM'
    )
  );
