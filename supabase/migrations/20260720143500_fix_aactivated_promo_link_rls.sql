-- Allow scoped AACTIVATED admins to manage only AACTIVATED backend promo links.

create or replace function public.is_current_profile_aactivated_discount_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.profiles p
      where (
          p.id = auth.uid()
          or p.auth_user_id = auth.uid()
          or p.id = public.current_profile_id()
        )
        and lower(coalesce(p.role, '')) in ('rx_plus_admin', 'partner_admin_full', 'partner_admin_limited')
        and (
          lower(trim(coalesce(p.email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
          or lower(trim(coalesce(p.owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
          or lower(trim(coalesce(p.brand_id, ''))) = 'aactivated'
          or upper(trim(coalesce(p.admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
          or lower(trim(coalesce(p.store_slug, ''))) in ('aactivated', 'aactivatedrx')
          or upper(coalesce(p.admin_scope, '') || ' ' || coalesce(p.store_slug, '')) like '%AACTIVATED%'
        )
    )
    or (
      public.current_partner_brand_id() = 'aactivated'
      and public.current_partner_access_level() in ('full', 'limited')
      and (
        public.partner_has_capability('discount_codes')
        or public.partner_has_capability('discounts')
        or public.partner_has_capability('marketing')
      )
    )
$$;

create or replace function public.is_aactivated_promo_scope(p_scope_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select upper(trim(coalesce(p_scope_code, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
$$;

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
    'discount_code_scope', 'aactivated'
  ),
  updated_at = now()
where brand_id = 'aactivated';

drop policy if exists "aactivated_scoped_admins_manage_promo_links" on public.aactivated_promo_links;
create policy "aactivated_scoped_admins_manage_promo_links"
on public.aactivated_promo_links
for all
to authenticated
using (
  public.is_current_profile_aactivated_discount_admin()
  and public.is_aactivated_promo_scope(store_scope_code)
)
with check (
  public.is_current_profile_aactivated_discount_admin()
  and public.is_aactivated_promo_scope(store_scope_code)
);

grant select, insert, update on public.aactivated_promo_links to authenticated;
grant execute on function public.is_current_profile_aactivated_discount_admin() to authenticated;
grant execute on function public.is_aactivated_promo_scope(text) to authenticated;
