-- Parent partner admins must see orders from storefronts configured as their
-- child brands. Child admins remain scoped to their own store.

create or replace function public.is_current_partner_brand(
  p_brand_id text,
  p_store_slug text default null,
  p_scope_code text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.is_partner_admin()
      and (
        lower(coalesce(p_brand_id, '')) = public.current_partner_brand_id()
        or lower(coalesce(p_store_slug, '')) = (
          select lower(store_slug) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
        or upper(coalesce(p_scope_code, '')) = (
          select upper(scope_code) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
        or exists (
          select 1
          from public.partner_brands child
          where lower(coalesce(child.pricing_guardrails ->> 'parent_brand_id', '')) = public.current_partner_brand_id()
            and child.status = 'active'
            and (
              lower(coalesce(p_brand_id, '')) = lower(child.brand_id)
              or lower(coalesce(p_store_slug, '')) = lower(child.store_slug)
              or upper(coalesce(p_scope_code, '')) = upper(child.scope_code)
            )
        )
        or (
          public.current_partner_brand_id() = 'rockphorm'
          and (
            lower(coalesce(p_brand_id, '')) in ('rockphorm', 'aurora')
            or lower(coalesce(p_store_slug, '')) in ('rockphorm', 'klow', 'aurora')
            or upper(coalesce(p_scope_code, '')) in ('ROCKPHORM', 'AURORA', 'MIKEAURORA')
          )
        )
      )
    )
$$;

create or replace function public.is_partner_submission_id(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.patient_submissions s
      where s.id = p_submission_id
        and public.is_partner_admin()
        and (
          public.is_current_partner_brand(s.brand_id, s.store_slug, s.checkout_scope_code)
          or (s.rep_id is not null and public.is_partner_rep_id(s.rep_id))
          or (
            public.current_partner_brand_id() = 'aactivated'
            and upper(
              coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' ||
              coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' ||
              coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' ||
              coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' ||
              coalesce(s.parent_type, '')
            ) like '%AACTIVATED%'
          )
          or (
            public.current_partner_brand_id() = 'rockphorm'
            and upper(
              coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' ||
              coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' ||
              coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' ||
              coalesce(s.discount_code, '') || ' ' || coalesce(s.commission_owner, '') || ' ' ||
              coalesce(s.parent_type, '')
            ) ~ '(ROCK PHORM|ROCKPHORM|AURORA|KLOW)'
          )
        )
    )
$$;

grant execute on function public.is_current_partner_brand(text, text, text) to authenticated;
grant execute on function public.is_partner_submission_id(uuid) to authenticated;

-- Repair the reported order's parent attribution when its checkout metadata
-- identifies it as AACTIVATED but an older checkout left brand_id incomplete.
update public.patient_submissions s
set brand_id = 'aactivated', updated_at = now()
where s.id = 'a01f0849-7398-4394-80bd-4747f2499df8'::uuid
  and (
    upper(coalesce(s.checkout_scope_code, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or upper(coalesce(s.admin_code, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or upper(coalesce(s.parent_type, '')) like '%AACTIVATED%'
  );
