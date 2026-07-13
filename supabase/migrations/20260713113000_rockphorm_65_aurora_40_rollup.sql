-- Rock Phorm earns 65% of net profit after landing cost.
-- Aurora remains a 40% downline under Rock Phorm, leaving a 25% Rock Phorm override.

do $$
declare
  rock_rep_id uuid;
begin
  select id
  into rock_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
     or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
  order by case when upper(coalesce(rep_slug, '')) = 'ROCKPHORM' then 0 else 1 end, created_at
  limit 1;

  update public.reps
  set
    commission_rate = 0.65,
    override_percent = 0,
    platform_percent = 0.35,
    updated_at = now()
  where id = rock_rep_id
     or upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
     or upper(coalesce(brand_name, '')) like '%ROCKPHORM%';

  update public.reps
  set
    commission_rate = 0.40,
    override_percent = 0.25,
    platform_percent = 0.35,
    parent_rep_id = rock_rep_id,
    updated_at = now()
  where upper(coalesce(rep_slug, '')) in ('AURORA', 'MIKEAURORA')
     or upper(coalesce(brand_name, '')) like '%AURORA%';

  update public.reps
  set
    override_percent = 0.25,
    platform_percent = 0.35,
    updated_at = now()
  where parent_rep_id = rock_rep_id
    and abs(coalesce(commission_rate, 0) - 0.40) < 0.0001;
end $$;

update public.checkout_scopes
set
  display_name = 'Rock Phorm',
  account_type = 'admin',
  account_id = 'ROCKPHORM',
  parent_account_id = null,
  is_active = true,
  default_commission_rate = 0.65,
  notes = 'Rock Phorm checkout scope for Rick Diaz. Commission basis: 65% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.',
  updated_at = now()
where upper(coalesce(scope_code, '')) = 'ROCKPHORM';

update public.checkout_scopes
set
  account_type = 'rep',
  account_id = coalesce(nullif(account_id, ''), 'AURORA'),
  parent_account_id = 'ROCKPHORM',
  is_active = true,
  default_commission_rate = 0.40,
  notes = 'Aurora Labs checkout scope. Aurora earns 40% net profit after landing cost and rolls up under Rock Phorm with a 25% parent override.',
  updated_at = now()
where upper(coalesce(scope_code, '')) in ('AURORA', 'MIKEAURORA');

update public.distributors
set
  commission_rate = 0.65,
  updated_at = now()
where lower(coalesce(slug, '')) = 'rockphorm';

update public.distributor_products dp
set
  commission_rate = 0.65,
  updated_at = now()
from public.distributors d
where dp.distributor_id = d.id
  and lower(coalesce(d.slug, '')) = 'rockphorm';

update public.partner_store_settings
set
  settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object(
      'commissionRate', 0.65,
      'parentOverrideRate', 0.25,
      'platformRate', 0.35,
      'commissionBasis', 'net_profit_after_landing_cost'
    ),
  updated_at = now()
where lower(coalesce(store_slug, '')) in ('rockphorm', 'klow', 'aurora');

with rock_rep as (
  select id, coalesce(rep_name, 'Rock Phorm') as rep_name
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
  order by created_at
  limit 1
),
rock_orders as (
  select s.*
  from public.patient_submissions s
  where (
      upper(coalesce(s.checkout_scope_code, '')) = 'ROCKPHORM'
      or lower(coalesce(s.store_slug, '')) in ('rockphorm', 'klow')
      or lower(coalesce(s.source_store, '')) in ('rockphorm', 'klow')
      or lower(coalesce(s.source_route, '')) like '%/rockphorm%'
      or lower(coalesce(s.source_route, '')) like '%/klow%'
      or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%ROCKPHORM%'
      or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' || coalesce(s.parent_type, '')) like '%ROCK PHORM%'
      or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.parent_type, '')) like '%KLOW%'
    )
    and not (
      upper(coalesce(s.checkout_scope_code, '')) in ('AURORA', 'MIKEAURORA')
      or lower(coalesce(s.store_slug, '')) = 'aurora'
      or lower(coalesce(s.source_store, '')) = 'aurora'
      or lower(coalesce(s.source_route, '')) like '%/aurora%'
      or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '')) like '%AURORA%'
    )
    and (
      lower(coalesce(s.payment_status, '')) = 'paid'
      or lower(coalesce(s.status, '')) in ('paid', 'fulfilled')
      or s.paid_at is not null
    )
),
rock_basis as (
  select
    s.id as submission_id,
    r.id as rep_id,
    r.rep_name,
    coalesce(max(cl.gross_sale), max(s.order_total), max(s.quoted_price), 0) as gross_sale,
    coalesce(
      max(cl.margin),
      greatest(
        coalesce(max(s.quoted_price), max(s.order_total), 0)
        - coalesce(max(s.discount_amount), 0)
        - coalesce(max(s.cost_of_goods), 0),
        0
      )
    ) as margin,
    coalesce(max(cl.status), 'pending') as status
  from rock_orders s
  cross join rock_rep r
  left join public.commission_ledger cl on cl.submission_id = s.id
  group by s.id, r.id, r.rep_name
)
insert into public.commission_ledger (
  submission_id,
  rep_id,
  gross_sale,
  margin,
  commission_rate,
  commission_amount,
  commission_role,
  owner_label,
  status
)
select
  submission_id,
  rep_id,
  gross_sale,
  margin,
  0.65,
  round((coalesce(margin, 0) * 0.65)::numeric, 2),
  'rep_commission_owner',
  rep_name,
  status
from rock_basis
where rep_id is not null
on conflict (submission_id, rep_id, commission_role) do update set
  gross_sale = excluded.gross_sale,
  margin = excluded.margin,
  commission_rate = 0.65,
  commission_amount = excluded.commission_amount,
  owner_label = excluded.owner_label,
  status = excluded.status;

with rock_rep as (
  select id, coalesce(rep_name, 'Rock Phorm') as rep_name
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
  order by created_at
  limit 1
),
aurora_orders as (
  select s.*
  from public.patient_submissions s
    where (
      upper(coalesce(s.checkout_scope_code, '')) in ('AURORA', 'MIKEAURORA')
      or lower(coalesce(s.store_slug, '')) = 'aurora'
      or lower(coalesce(s.source_store, '')) = 'aurora'
      or lower(coalesce(s.source_route, '')) like '%/aurora%'
      or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '')) like '%AURORA%'
    )
    and (
      lower(coalesce(s.payment_status, '')) = 'paid'
      or lower(coalesce(s.status, '')) in ('paid', 'fulfilled')
      or s.paid_at is not null
    )
),
aurora_basis as (
  select
    s.id as submission_id,
    r.id as rep_id,
    r.rep_name,
    coalesce(max(cl.gross_sale), max(s.order_total), max(s.quoted_price), 0) as gross_sale,
    coalesce(
      max(cl.margin),
      greatest(
        coalesce(max(s.quoted_price), max(s.order_total), 0)
        - coalesce(max(s.discount_amount), 0)
        - coalesce(max(s.cost_of_goods), 0),
        0
      )
    ) as margin,
    coalesce(max(cl.status), 'pending') as status
  from aurora_orders s
  cross join rock_rep r
  left join public.commission_ledger cl on cl.submission_id = s.id
  group by s.id, r.id, r.rep_name
)
insert into public.commission_ledger (
  submission_id,
  rep_id,
  gross_sale,
  margin,
  commission_rate,
  commission_amount,
  commission_role,
  owner_label,
  status
)
select
  submission_id,
  rep_id,
  gross_sale,
  margin,
  0.25,
  round((coalesce(margin, 0) * 0.25)::numeric, 2),
  'override_owner',
  rep_name,
  status
from aurora_basis
where rep_id is not null
on conflict (submission_id, rep_id, commission_role) do update set
  gross_sale = excluded.gross_sale,
  margin = excluded.margin,
  commission_rate = 0.25,
  commission_amount = excluded.commission_amount,
  owner_label = excluded.owner_label,
  status = excluded.status;
