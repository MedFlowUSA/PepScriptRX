-- Ensure paid Rock Phorm orders are visible in Rick Diaz's commission ledger.
-- Payment handlers now resolve scope-owned rows to the ROCKPHORM rep; this
-- backfills already-paid orders that were captured before that resolver existed.

update public.checkout_scopes
set
  display_name = 'Rock Phorm',
  account_type = 'admin',
  account_id = 'ROCKPHORM',
  parent_account_id = null,
  is_active = true,
  default_commission_rate = 0.60,
  notes = 'Rock Phorm checkout scope for Rick Diaz. Commission basis: 60% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.',
  updated_at = now()
where upper(coalesce(scope_code, '')) = 'ROCKPHORM';

with rockphorm_rep as (
  select id, coalesce(rep_name, 'Rock Phorm') as rep_name
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
     or upper(coalesce(brand_name, '')) like '%ROCKPHORM%'
  order by case when upper(coalesce(rep_slug, '')) = 'ROCKPHORM' then 0 else 1 end, created_at
  limit 1
),
rockphorm_paid_orders as (
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
    and (
      lower(coalesce(s.payment_status, '')) = 'paid'
      or lower(coalesce(s.status, '')) in ('paid', 'fulfilled')
      or s.paid_at is not null
    )
),
ledger_basis as (
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
    coalesce(
      max(cl.status) filter (where cl.commission_role in ('rep_commission_owner', 'scope_commission_owner')),
      'pending'
    ) as status
  from rockphorm_paid_orders s
  cross join rockphorm_rep r
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
  0.60,
  round((coalesce(margin, 0) * 0.60)::numeric, 2),
  'rep_commission_owner',
  rep_name,
  status
from ledger_basis
where rep_id is not null
on conflict (submission_id, rep_id, commission_role) do update set
  gross_sale = excluded.gross_sale,
  margin = excluded.margin,
  commission_rate = 0.60,
  commission_amount = excluded.commission_amount,
  owner_label = excluded.owner_label,
  status = excluded.status;
