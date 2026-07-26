-- SAVE10 customer discount for KLOW and Rock Phorm storefronts.
-- Customer discount only; attribution, commission ownership, and payout routing remain unchanged.

alter table public.aactivated_promo_links
  add column if not exists discount_type text not null default 'fixed_amount',
  add column if not exists discount_percent numeric(5,2),
  add column if not exists promo_kind text not null default 'customer_discount',
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists usage_limit integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists rep_id uuid references public.reps(id) on delete set null,
  add column if not exists rep_slug text,
  add column if not exists min_subtotal numeric not null default 0,
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists requires_platform_approval boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

do $$
declare
  rockphorm_rep_id uuid;
begin
  select id
    into rockphorm_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(discount_code, '')) = 'ROCKPHORM'
  order by created_at asc
  limit 1;

  insert into public.aactivated_promo_links (
    is_active,
    store_scope_code,
    product_id,
    promo_title,
    discount_code,
    discount_amount,
    discount_type,
    discount_percent,
    promo_kind,
    starts_at,
    expires_at,
    usage_limit,
    uses_count,
    rep_id,
    rep_slug,
    link_slug,
    notes,
    requires_platform_approval,
    approval_status,
    approved_at,
    updated_at
  )
  values
    (
      true,
      'KLOW',
      null,
      'KLOW SAVE10 Customer Discount',
      'SAVE10',
      0,
      'percentage',
      10,
      'customer_discount',
      null,
      null,
      null,
      0,
      rockphorm_rep_id,
      'ROCKPHORM',
      'klow-save10',
      'KLOW customer-facing 10% discount. Attribution and commissions remain with the active KLOW/Rock Phorm checkout scope.',
      false,
      'approved',
      now(),
      now()
    ),
    (
      true,
      'ROCKPHORM',
      null,
      'Rock Phorm SAVE10 Customer Discount',
      'SAVE10',
      0,
      'percentage',
      10,
      'customer_discount',
      null,
      null,
      null,
      0,
      rockphorm_rep_id,
      'ROCKPHORM',
      'rockphorm-save10',
      'Rock Phorm customer-facing 10% discount. Attribution and commissions remain with the active Rock Phorm checkout scope.',
      false,
      'approved',
      now(),
      now()
    )
  on conflict (link_slug) do update set
    is_active = true,
    store_scope_code = excluded.store_scope_code,
    product_id = excluded.product_id,
    promo_title = excluded.promo_title,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    discount_type = excluded.discount_type,
    discount_percent = excluded.discount_percent,
    promo_kind = excluded.promo_kind,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    usage_limit = excluded.usage_limit,
    rep_id = excluded.rep_id,
    rep_slug = excluded.rep_slug,
    notes = excluded.notes,
    requires_platform_approval = false,
    approval_status = 'approved',
    approved_at = coalesce(public.aactivated_promo_links.approved_at, now()),
    disabled_by = null,
    disabled_at = null,
    updated_at = now();

  update public.partner_rep_store_settings prs
  set
    promo_config = coalesce(prs.promo_config, '{}'::jsonb)
      || jsonb_build_object(
        'customer_discount_code', 'SAVE10',
        'customer_discount_percent', 10
      ),
    internal_notes = trim(coalesce(prs.internal_notes, '') || E'\nSAVE10 enabled as a 10% KLOW/Rock Phorm customer discount.'),
    updated_at = now()
  where upper(coalesce(prs.store_scope, '')) in ('KLOW', 'ROCKPHORM');
end $$;
