-- Enable Viltrum Peptide partner admins to create scoped customer discount codes.

alter table public.aactivated_promo_links
  add column if not exists discount_percent numeric(5,2),
  add column if not exists usage_limit integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists promo_kind text not null default 'customer_discount',
  add column if not exists requires_platform_approval boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

create index if not exists aactivated_promo_links_partner_scope_idx
  on public.aactivated_promo_links(store_scope_code, rep_slug, promo_kind, is_active);

update public.partner_brands
set
  capabilities = coalesce(capabilities, '{}'::jsonb) || jsonb_build_object(
    'discounts', true,
    'discount_codes', true,
    'marketing', true
  ),
  pricing_guardrails = coalesce(pricing_guardrails, '{}'::jsonb) || jsonb_build_object(
    'partner_can_create_discount_codes', true,
    'max_partner_discount_percent', 50,
    'discount_code_scope', 'viltrumpeptide'
  ),
  updated_at = now()
where brand_id = 'viltrumpeptide';

drop policy if exists "partner_admin_read_scoped_promo_links" on public.aactivated_promo_links;
create policy "partner_admin_read_scoped_promo_links"
on public.aactivated_promo_links
for select
to authenticated
using (
  public.current_partner_access_level() = 'full'
  and (
    public.partner_has_capability('discount_codes')
    or public.partner_has_capability('discounts')
    or public.partner_has_capability('marketing')
  )
  and public.is_current_partner_brand(null, null, store_scope_code)
);

drop policy if exists "partner_admin_insert_scoped_promo_links" on public.aactivated_promo_links;
create policy "partner_admin_insert_scoped_promo_links"
on public.aactivated_promo_links
for insert
to authenticated
with check (
  public.current_partner_access_level() = 'full'
  and (
    public.partner_has_capability('discount_codes')
    or public.partner_has_capability('discounts')
    or public.partner_has_capability('marketing')
  )
  and public.is_current_partner_brand(null, null, store_scope_code)
  and promo_kind = 'customer_discount'
  and coalesce(requires_platform_approval, false) = false
  and coalesce(approval_status, 'approved') = 'approved'
  and (
    discount_type <> 'percentage'
    or coalesce(discount_percent, 0) between 0.01 and 50
  )
);

drop policy if exists "partner_admin_update_scoped_promo_links" on public.aactivated_promo_links;
create policy "partner_admin_update_scoped_promo_links"
on public.aactivated_promo_links
for update
to authenticated
using (
  public.current_partner_access_level() = 'full'
  and (
    public.partner_has_capability('discount_codes')
    or public.partner_has_capability('discounts')
    or public.partner_has_capability('marketing')
  )
  and public.is_current_partner_brand(null, null, store_scope_code)
)
with check (
  public.current_partner_access_level() = 'full'
  and (
    public.partner_has_capability('discount_codes')
    or public.partner_has_capability('discounts')
    or public.partner_has_capability('marketing')
  )
  and public.is_current_partner_brand(null, null, store_scope_code)
  and promo_kind = 'customer_discount'
  and coalesce(requires_platform_approval, false) = false
  and coalesce(approval_status, 'approved') = 'approved'
  and (
    discount_type <> 'percentage'
    or coalesce(discount_percent, 0) between 0.01 and 50
  )
);

grant select, insert, update on public.aactivated_promo_links to authenticated;
