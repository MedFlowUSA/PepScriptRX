-- Reassert Aurora Labs compensation under Rock Phorm.
-- Mike / Aurora admin: 40% of net profit after true landed cost.
-- Aurora downline reps may not exceed Aurora's 40% parent comp.

alter table public.reps
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  aurora_rate numeric := 0.40;
begin
  update public.reps
  set
    commission_type = 'net_profit_after_true_cost',
    commission_rate = aurora_rate,
    override_percent = 0,
    platform_percent = 1 - aurora_rate,
    rep_tier = 'rockphorm_sub_admin_store',
    account_type = 'admin',
    parent_type = 'rockphorm_downline',
    active = true,
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or (
      custom_store_slug = 'aurora'
      and brand_name = 'Aurora Labs'
      and account_type = 'admin'
    );

  update public.reps
  set
    commission_rate = least(coalesce(commission_rate, aurora_rate), aurora_rate),
    platform_percent = greatest(0, 1 - least(coalesce(commission_rate, aurora_rate), aurora_rate)),
    override_percent = coalesce(override_percent, 0),
    parent_type = coalesce(parent_type, 'aurora_downline'),
    updated_at = now()
  where coalesce(rep_slug, '') <> 'AURORA'
    and (
      parent_type = 'aurora_downline'
      or rep_tier = 'aurora_downline_rep'
      or rep_channel = 'aurora_downline_rep'
      or (
        custom_store_slug = 'aurora'
        and brand_name = 'Aurora Labs'
        and account_type = 'rep'
      )
    )
    and coalesce(commission_rate, 0) > aurora_rate;

  update public.distributors
  set commission_rate = aurora_rate
  where slug = 'aurora';

  update public.distributor_products dp
  set commission_rate = aurora_rate
  from public.distributors d
  where dp.distributor_id = d.id
    and d.slug = 'aurora';

  update public.checkout_scopes
  set
    parent_account_id = 'ROCKPHORM',
    default_commission_rate = aurora_rate,
    notes = 'Aurora Labs checkout scope for Mike. Rolls up under Rick Diaz / Rock Phorm. Commission basis: 40% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.',
    updated_at = now()
  where scope_code = 'AURORA';
end $$;
