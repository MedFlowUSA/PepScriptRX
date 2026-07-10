-- KLOW is Rock Phorm's secondary storefront, not an independent payout owner.
-- Keep all KLOW order attribution and payout metadata financially owned by Rock Phorm.

update public.reps
set
  commission_rate = 0.60,
  platform_percent = 0.40,
  brand_id = 'rockphorm',
  parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'rockphorm'),
  assigned_store_slug = 'rockphorm',
  custom_store_slug = coalesce(custom_store_slug, 'rockphorm'),
  updated_at = now()
where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
   or lower(coalesce(custom_store_slug, '')) = 'rockphorm'
   or upper(coalesce(brand_name, '')) like '%ROCK PHORM%'
   or upper(coalesce(brand_name, '')) like '%ROCKPHORM%';

update public.checkout_scopes
set
  display_name = 'Rock Phorm',
  account_type = 'admin',
  account_id = 'ROCKPHORM',
  parent_account_id = null,
  is_active = true,
  default_commission_rate = 0.60,
  notes = 'Rock Phorm checkout scope for Rick Diaz. Commission basis: 60% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs. KLOW orders use this same Rock Phorm payout owner.',
  updated_at = now()
where scope_code = 'ROCKPHORM';

update public.distributors
set
  commission_rate = 0.60,
  updated_at = now()
where slug = 'rockphorm';

update public.distributor_products dp
set
  commission_rate = 0.60,
  updated_at = now()
from public.distributors d
where dp.distributor_id = d.id
  and d.slug = 'rockphorm';

update public.partner_store_settings
set
  brand_id = 'rockphorm',
  store_name = 'KLOW Recovery + Radiance',
  settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object(
      'parentBrandId', 'rockphorm',
      'ownerBrandId', 'rockphorm',
      'commissionSource', 'rockphorm',
      'commissionOwner', 'rockphorm',
      'payoutOwner', 'rockphorm',
      'scopeCode', 'ROCKPHORM',
      'adminCode', 'ROCKPHORM',
      'commissionRate', 0.60
    ),
  updated_at = now()
where lower(store_slug) = 'klow';

update public.patient_submissions
set
  brand_id = 'rockphorm',
  store_slug = 'klow',
  store_name = 'KLOW Recovery + Radiance',
  checkout_scope_code = 'ROCKPHORM',
  source_store = 'klow',
  source_admin = 'ROCKPHORM',
  source_rep = coalesce(nullif(source_rep, ''), 'ROCKPHORM'),
  admin_code = 'ROCKPHORM',
  account_type = coalesce(nullif(account_type, ''), 'admin'),
  parent_type = 'rockphorm_secondary_brand',
  commission_owner = 'rockphorm',
  commission_rate = 0.60,
  partner_payout_eligible = true,
  updated_at = now()
where lower(coalesce(store_slug, '')) = 'klow'
   or lower(coalesce(source_store, '')) = 'klow'
   or lower(coalesce(source_route, '')) like '%/klow%'
   or upper(coalesce(source_portal, '') || ' ' || coalesce(store_name, '') || ' ' || coalesce(parent_type, '')) like '%KLOW%';

with rockphorm_rep as (
  select id, coalesce(rep_name, 'Rock Phorm') as rep_name
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
  order by created_at
  limit 1
),
klow_orders as (
  select s.*
  from public.patient_submissions s
  where lower(coalesce(s.store_slug, '')) = 'klow'
     or lower(coalesce(s.source_store, '')) = 'klow'
     or lower(coalesce(s.source_route, '')) like '%/klow%'
     or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.parent_type, '')) like '%KLOW%'
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
  from klow_orders s
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

update public.commission_ledger cl
set status = 'reversed'
from public.patient_submissions s
where cl.submission_id = s.id
  and (
    lower(coalesce(s.store_slug, '')) = 'klow'
    or lower(coalesce(s.source_store, '')) = 'klow'
    or lower(coalesce(s.source_route, '')) like '%/klow%'
    or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.store_name, '') || ' ' || coalesce(s.parent_type, '')) like '%KLOW%'
  )
  and cl.commission_role = 'scope_commission_owner';

do $$
declare
  fn text;
  next_fn text;
  brand_expr text := '    case
      when lower(coalesce(nullif(payload->>''store_slug'', ''''), nullif(payload->>''source_store'', ''''), '''')) = ''klow''
        or lower(coalesce(payload->>''source_route'', '''')) like ''%/klow%''
        or lower(coalesce(payload->>''source_portal'', '''')) like ''%klow%''
        or lower(coalesce(payload->>''parent_type'', '''')) = ''rockphorm_secondary_brand''
      then ''rockphorm''
      else nullif(payload->>''brand_id'', '''')
    end,';
begin
  select pg_get_functiondef('public.create_public_patient_submission(jsonb)'::regprocedure)
  into fn;

  if fn is null then
    raise exception 'create_public_patient_submission(jsonb) was not found';
  end if;

  next_fn := fn;

  if position('nullif(payload->>''brand_id'', '''')' in next_fn) = 0 then
    next_fn := replace(
      next_fn,
      '    cost_of_goods,
    admin_code,',
      '    cost_of_goods,
    brand_id,
    admin_code,'
    );

    next_fn := replace(
      next_fn,
      '    coalesce(v_cost_of_goods, 0),
    nullif(payload->>''admin_code'', ''''),',
      '    coalesce(v_cost_of_goods, 0),
' || brand_expr || '
    nullif(payload->>''admin_code'', ''''),'
    );
  end if;

  if position('v_store_hint like ''%klow%''' in next_fn) = 0 then
    next_fn := replace(
      next_fn,
      'when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' then ''rockphorm''',
      'when v_scope_code = ''ROCKPHORM'' or v_store_hint like ''%rock%'' or v_store_hint like ''%klow%'' then ''rockphorm'''
    );
  end if;

  if next_fn = fn then
    return;
  end if;

  execute next_fn;
end $$;

revoke all on function public.create_public_patient_submission(jsonb) from public;
grant execute on function public.create_public_patient_submission(jsonb) to anon, authenticated;
