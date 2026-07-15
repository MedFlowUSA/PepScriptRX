-- Alpha Pride Wellness customer discount.
-- Keep ALPHAPRIDE as the attribution/scope code; MARK30 is the customer discount code.

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
  alpha_rep_id uuid;
begin
  select id
    into alpha_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'ALPHAPRIDE'
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
  values (
    true,
    'ALPHAPRIDE',
    null,
    'Alpha Pride MARK30 Customer Discount',
    'MARK30',
    0,
    'percentage',
    30,
    'customer_discount',
    null,
    null,
    null,
    0,
    alpha_rep_id,
    'ALPHAPRIDE',
    'alphapride-mark30',
    'Alpha Pride Wellness customer-facing 30% discount. Attribution remains ALPHAPRIDE.',
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

  update public.reps
  set
    brand_theme = coalesce(brand_theme, '{}'::jsonb)
      || jsonb_build_object(
        'customerDiscountCode', 'MARK30',
        'customerDiscountPercent', 30,
        'customerDiscountLabel', '30% off',
        'customerDiscountScope', 'Alpha Pride Wellness storefront'
      ),
    updated_at = now()
  where upper(coalesce(rep_slug, '')) = 'ALPHAPRIDE';
end $$;
