-- Repair Paul Hourani's AACTIVATEDRX rep store and reassert scoped activation RLS.

create or replace function public.is_current_profile_aactivated_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (
        p.id = auth.uid()
        or p.auth_user_id = auth.uid()
        or p.id = public.current_profile_id()
      )
      and lower(coalesce(p.role, '')) in ('rx_plus_admin', 'partner_admin_full')
      and (
        lower(trim(coalesce(p.email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.owner_email, ''))) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
        or lower(trim(coalesce(p.brand_id, ''))) = 'aactivated'
        or upper(trim(coalesce(p.admin_scope, ''))) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
        or lower(trim(coalesce(p.store_slug, ''))) in ('aactivated', 'aactivatedrx')
        or upper(coalesce(p.admin_scope, '') || ' ' || coalesce(p.store_slug, '')) like '%AACTIVATED%'
      )
  );
$$;

create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_current_profile_aactivated_admin()
    or public.is_platform_admin();
$$;

drop policy if exists "aactivated scoped admins insert partner reps" on public.reps;
create policy "aactivated scoped admins insert partner reps"
on public.reps
for insert
to authenticated
with check (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(parent_brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
);

drop policy if exists "aactivated scoped admins update partner reps" on public.reps;
create policy "aactivated scoped admins update partner reps"
on public.reps
for update
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(parent_brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
  )
)
with check (
  public.is_aactivated_partner_ops_admin()
  and (
    lower(coalesce(brand_id, '')) = 'aactivated'
    or lower(coalesce(parent_brand_id, '')) = 'aactivated'
    or lower(coalesce(custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(assigned_store_slug, '')) = 'aactivated'
    or upper(coalesce(brand_name, '')) in ('AACTIVATEDRX', 'AACTIVATED-RX')
    or upper(coalesce(rep_channel, '')) like '%AACTIVATED%'
    or upper(coalesce(rep_tier, '')) like '%AACTIVATED%'
  )
  and (parent_rep_id is null or parent_rep_id <> id)
);

drop policy if exists "aactivated scoped admins manage rep stores" on public.partner_rep_store_settings;
create policy "aactivated scoped admins manage rep stores"
on public.partner_rep_store_settings
for all
to authenticated
using (store_scope = 'AACTIVATEDRX' and public.is_aactivated_partner_ops_admin())
with check (store_scope = 'AACTIVATEDRX' and coalesce(brand_id, 'aactivated') = 'aactivated' and public.is_aactivated_partner_ops_admin());

grant select, insert, update on public.reps to authenticated;
grant select, insert, update on public.partner_rep_store_settings to authenticated;
grant execute on function public.is_current_profile_aactivated_admin() to authenticated;
grant execute on function public.is_aactivated_partner_ops_admin() to authenticated;

do $$
declare
  paul_rep record;
  guy_rep record;
  paul_commission numeric(5,2);
begin
  select *
  into guy_rep
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'GUY60'
    and lower(coalesce(custom_store_slug, '')) = 'aactivated'
  limit 1;

  if not found then
    return;
  end if;

  select *
  into paul_rep
  from public.reps
  where lower(coalesce(rep_name, '')) = 'paul hourani'
     or lower(coalesce(payout_email, '')) = 'phourani@hotmail.com'
     or upper(coalesce(rep_slug, '')) = 'PAULHOURANIAACTIVATEDRXR'
  order by created_at desc
  limit 1;

  if not found then
    return;
  end if;

  paul_commission := round((greatest(0, coalesce(paul_rep.commission_rate, 0)) * 100)::numeric, 2);
  if paul_commission = 0 then
    paul_commission := 40;
  end if;

  update public.reps
  set
    parent_rep_id = coalesce(parent_rep_id, guy_rep.id),
    managed_by_profile_id = coalesce(managed_by_profile_id, guy_rep.profile_id),
    custom_store_slug = 'aactivated',
    assigned_store_slug = 'aactivated',
    brand_id = 'aactivated',
    parent_brand_id = 'aactivated',
    brand_name = 'AACTIVATEDRX',
    rep_tier = 'aactivated_rep',
    rep_channel = 'aactivated_downline',
    referral_path = '/aactivated?rep=' || upper(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
    discount_code = upper(coalesce(nullif(paul_rep.discount_code, ''), paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
    active = true
  where id = paul_rep.id
  returning * into paul_rep;

  insert into public.partner_rep_commission_settings (
    store_scope,
    brand_id,
    partner_admin_id,
    partner_admin_email,
    rep_id,
    rep_email,
    commission_type,
    commission_percent,
    override_percent,
    approval_required,
    approval_status,
    special_note,
    internal_notes,
    created_by,
    updated_by,
    updated_at
  )
  values (
    'AACTIVATEDRX',
    'aactivated',
    guy_rep.profile_id,
    'guy@aactivated.com',
    paul_rep.id,
    paul_rep.payout_email,
    'flat_net_profit',
    paul_commission,
    null,
    false,
    'active',
    'Paul Hourani custom AACTIVATEDRX commission.',
    'Backfilled after rep existed without an active AACTIVATEDRX store settings row.',
    guy_rep.profile_id,
    guy_rep.profile_id,
    now()
  )
  on conflict (store_scope, rep_id) do update set
    brand_id = 'aactivated',
    partner_admin_id = excluded.partner_admin_id,
    partner_admin_email = excluded.partner_admin_email,
    rep_email = excluded.rep_email,
    commission_type = excluded.commission_type,
    commission_percent = excluded.commission_percent,
    override_percent = excluded.override_percent,
    approval_required = false,
    approval_status = 'active',
    special_note = excluded.special_note,
    internal_notes = excluded.internal_notes,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.partner_rep_store_settings (
    store_scope,
    brand_id,
    partner_admin_id,
    partner_admin_email,
    rep_id,
    rep_email,
    rep_name,
    public_display_name,
    store_slug,
    storefront_path,
    pricing_mode,
    features,
    promo_config,
    status,
    activated_at,
    internal_notes,
    created_by,
    updated_by,
    updated_at
  )
  values (
    'AACTIVATEDRX',
    'aactivated',
    guy_rep.profile_id,
    'guy@aactivated.com',
    paul_rep.id,
    paul_rep.payout_email,
    coalesce(paul_rep.rep_name, 'Paul Hourani'),
    coalesce(nullif(paul_rep.handle, ''), paul_rep.rep_name, 'Paul Hourani'),
    lower(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
    '/aactivated?rep=' || upper(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
    'aactivated_default',
    jsonb_build_object('storefront', true, 'cart', true, 'checkout', true, 'promo_links', true, 'rep_portal', true),
    jsonb_build_object(
      'attribution_code', upper(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
      'referral_link', '/aactivated?rep=' || upper(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
      'storefront_link', '/aactivated?rep=' || upper(coalesce(paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
      'discount_code', upper(coalesce(nullif(paul_rep.discount_code, ''), paul_rep.rep_slug, 'PAULHOURANIAACTIVATEDRXR')),
      'commission_percent', paul_commission
    ),
    'active',
    now(),
    'AACTIVATEDRX rep store repaired and activated for Paul Hourani.',
    guy_rep.profile_id,
    guy_rep.profile_id,
    now()
  )
  on conflict (store_scope, rep_id) do update set
    brand_id = 'aactivated',
    partner_admin_id = excluded.partner_admin_id,
    partner_admin_email = excluded.partner_admin_email,
    rep_email = excluded.rep_email,
    rep_name = excluded.rep_name,
    public_display_name = excluded.public_display_name,
    store_slug = excluded.store_slug,
    storefront_path = excluded.storefront_path,
    pricing_mode = excluded.pricing_mode,
    features = excluded.features,
    promo_config = excluded.promo_config,
    status = 'active',
    activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
    disabled_at = null,
    internal_notes = excluded.internal_notes,
    updated_by = excluded.updated_by,
    updated_at = now();

  update public.rep_store_intake_submissions
  set
    source_portal_id = 'aactivated',
    source_portal = coalesce(nullif(source_portal, ''), 'AACTIVATEDRX'),
    source_route = coalesce(nullif(source_route, ''), '/AACTIVATED/rep-intake'),
    parent_store_slug = 'aactivated',
    parent_store_name = 'AACTIVATEDRX',
    partner_admin_email = 'guy@aactivated.com',
    approval_owner_email = 'guy@aactivated.com',
    review_queue = 'aactivated',
    review_admin_code = coalesce(nullif(review_admin_code, ''), 'GUY60'),
    review_admin_name = coalesce(nullif(review_admin_name, ''), 'Guy Griffithe - GUY60'),
    status = 'launched',
    approval_status = 'approved',
    approval_notes = coalesce(nullif(approval_notes, ''), 'Paul Hourani AACTIVATEDRX rep store repaired and activated.'),
    internal_notes = coalesce(nullif(internal_notes, ''), 'Paul Hourani AACTIVATEDRX rep store repaired and activated.')
  where lower(coalesce(full_name, '')) = 'paul hourani'
     or lower(coalesce(email, '')) = 'phourani@hotmail.com'
     or upper(coalesce(desired_rep_code, '')) = upper(coalesce(paul_rep.rep_slug, ''));
end $$;
