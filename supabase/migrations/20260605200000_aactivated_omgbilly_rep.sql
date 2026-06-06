-- William Paige / OMGBILLY rep storefront under AACTIVATEDRX.

alter table public.reps
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists override_percent numeric(5,4) not null default 0,
  add column if not exists platform_percent numeric(5,4) not null default 0.35,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists paypal_link text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb;

do $$
declare
  billy_email text := 'billpaige@live.com';
  billy_phone text := '5626761653';
  billy_auth_id uuid;
  billy_profile_id uuid;
  billy_rep_id uuid;
  guy_profile_id uuid;
  guy_rep_id uuid;
begin
  select id, profile_id
    into guy_rep_id, guy_profile_id
  from public.reps
  where rep_slug = 'GUY60'
  limit 1;

  select id
    into billy_auth_id
  from auth.users
  where lower(email) = lower(billy_email)
  order by created_at desc
  limit 1;

  select id
    into billy_profile_id
  from public.profiles
  where (billy_auth_id is not null and auth_user_id = billy_auth_id)
     or lower(coalesce(email, '')) = lower(billy_email)
  order by
    case when billy_auth_id is not null and auth_user_id = billy_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if billy_auth_id is not null and billy_profile_id is null then
    billy_profile_id := billy_auth_id;
    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      billy_profile_id,
      billy_auth_id,
      'William Paige',
      billy_email,
      billy_phone,
      'rep'
    );
  elsif billy_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(billy_auth_id, auth_user_id),
      full_name = 'William Paige',
      email = billy_email,
      phone = billy_phone,
      role = 'rep'
    where id = billy_profile_id;
  end if;

  insert into public.reps (
    profile_id,
    rep_name,
    handle,
    rep_identifier,
    rep_slug,
    commission_type,
    commission_rate,
    override_percent,
    platform_percent,
    rep_tier,
    discount_code,
    discount_amount,
    referral_path,
    attribution_locked,
    attribution_window_days,
    payout_method,
    payout_email,
    rep_channel,
    parent_rep_id,
    managed_by_profile_id,
    custom_store_slug,
    brand_name,
    brand_theme,
    active
  )
  values (
    billy_profile_id,
    'William Paige',
    'OMGBILLY',
    'AACTIVATED-OMGBILLY',
    'OMGBILLY',
    'net_profit_share',
    0.50,
    0,
    0.50,
    'aactivated_rep',
    'OMGBILLY',
    10,
    '/r/OMGBILLY',
    true,
    60,
    'Email: billpaige@live.com',
    billy_email,
    'aactivated_downline',
    guy_rep_id,
    guy_profile_id,
    'aactivated',
    'AACTIVATEDRX',
    '{"palette":["#031924","#25c7d9","#ffffff"],"style":"AACTIVATEDRX downline storefront"}'::jsonb,
    true
  )
  on conflict (rep_slug) do update set
    profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
    rep_name = excluded.rep_name,
    handle = excluded.handle,
    rep_identifier = excluded.rep_identifier,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    override_percent = excluded.override_percent,
    platform_percent = excluded.platform_percent,
    rep_tier = excluded.rep_tier,
    discount_code = excluded.discount_code,
    discount_amount = excluded.discount_amount,
    referral_path = excluded.referral_path,
    attribution_locked = excluded.attribution_locked,
    attribution_window_days = excluded.attribution_window_days,
    payout_method = excluded.payout_method,
    payout_email = excluded.payout_email,
    rep_channel = excluded.rep_channel,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    active = true;

  select id
    into billy_rep_id
  from public.reps
  where rep_slug = 'OMGBILLY'
  limit 1;

  insert into public.checkout_scopes (
    scope_code,
    display_name,
    account_type,
    account_id,
    parent_account_id,
    is_active,
    default_commission_rate,
    notes
  )
  values (
    'OMGBILLY',
    'OMGBILLY / William Paige',
    'rep',
    'OMGBILLY',
    'GUY60',
    true,
    0.50,
    'AACTIVATEDRX downline rep checkout scope. William Paige receives 50% net-profit commission after true product cost.'
  )
  on conflict (scope_code) do update set
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id,
    is_active = excluded.is_active,
    default_commission_rate = excluded.default_commission_rate,
    notes = excluded.notes,
    updated_at = now();

  insert into public.partner_rep_commission_settings (
    store_scope,
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
    internal_notes
  )
  values (
    'AACTIVATEDRX',
    guy_profile_id,
    'guy@aactivated.com',
    billy_rep_id,
    billy_email,
    'flat_net_profit',
    50,
    0,
    false,
    'active',
    'William Paige / OMGBILLY receives 50% net-profit commission.',
    'Parent store AACTIVATEDRX. Parent rep GUY60. Approval owner Guy Griffithe.'
  )
  on conflict (store_scope, rep_id) do update set
    partner_admin_id = excluded.partner_admin_id,
    partner_admin_email = excluded.partner_admin_email,
    rep_email = excluded.rep_email,
    commission_type = excluded.commission_type,
    commission_percent = excluded.commission_percent,
    override_percent = excluded.override_percent,
    approval_required = excluded.approval_required,
    approval_status = excluded.approval_status,
    special_note = excluded.special_note,
    internal_notes = excluded.internal_notes,
    updated_at = now();

  insert into public.partner_rep_store_settings (
    store_scope,
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
    internal_notes
  )
  values (
    'AACTIVATEDRX',
    guy_profile_id,
    'guy@aactivated.com',
    billy_rep_id,
    billy_email,
    'William Paige',
    'OMGBILLY',
    'OMGBILLY',
    '/AACTIVATED?rep=OMGBILLY',
    'aactivated_default',
    '{"storefront":true,"rep_portal":true,"checkout_attribution":true}'::jsonb,
    '{"attribution_code":"OMGBILLY","referral_link":"/r/OMGBILLY","storefront_link":"/AACTIVATED?rep=OMGBILLY","discount_code":"OMGBILLY"}'::jsonb,
    'active',
    now(),
    'AACTIVATEDRX rep storefront for William Paige approved by Guy Griffithe.'
  )
  on conflict (store_scope, rep_id) do update set
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
    status = excluded.status,
    activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
    disabled_at = null,
    internal_notes = excluded.internal_notes,
    updated_at = now();

  insert into public.partner_rep_setup_audit (
    store_scope,
    actor_email,
    action,
    target_table,
    target_id,
    rep_id,
    new_value,
    audit_notes
  )
  values (
    'AACTIVATEDRX',
    'guy@aactivated.com',
    'rep_store_activated',
    'partner_rep_store_settings',
    billy_rep_id,
    billy_rep_id,
    jsonb_build_object(
      'rep_slug', 'OMGBILLY',
      'rep_email', billy_email,
      'storefront_link', '/AACTIVATED?rep=OMGBILLY',
      'referral_link', '/r/OMGBILLY',
      'commission_percent', 50
    ),
    'OMGBILLY AACTIVATEDRX rep storefront and 50% commission configuration seeded.'
  );
end $$;

drop policy if exists "rx plus aactivated checkout scopes read" on public.checkout_scopes;
create policy "rx plus aactivated checkout scopes read"
on public.checkout_scopes
for select
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and (
    scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or parent_account_id = 'GUY60'
    or exists (
      select 1
      from public.reps r
      where r.rep_slug = checkout_scopes.account_id
        and (
          r.parent_rep_id = public.current_rx_plus_parent_rep_id()
          or r.managed_by_profile_id = public.current_profile_id()
          or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
        )
    )
  )
);
