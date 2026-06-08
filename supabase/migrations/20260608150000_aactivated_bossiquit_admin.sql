-- James Wiggins / BOSSIQUIT AACTIVATEDRX scoped admin login.
-- Temporary password: Aactivated2026!

do $$
declare
  james_email text := 'bossiquitinc@gmail.com';
  james_password text := 'Aactivated2026!';
  james_auth_id uuid;
  james_profile_id uuid;
  james_rep_id uuid;
  guy_profile_id uuid;
  guy_rep_id uuid;
begin
  select id, profile_id
    into guy_rep_id, guy_profile_id
  from public.reps
  where rep_slug = 'GUY60'
  limit 1;

  if guy_rep_id is null then
    raise exception 'Cannot create BOSSIQUIT AACTIVATEDRX admin because GUY60 parent rep was not found.';
  end if;

  select id
    into james_auth_id
  from auth.users
  where lower(email) = lower(james_email)
  order by created_at desc
  limit 1;

  if james_auth_id is null then
    james_auth_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      james_auth_id,
      'authenticated',
      'authenticated',
      james_email,
      extensions.crypt(james_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"],"role":"rx_plus_admin"}'::jsonb,
      '{"full_name":"James Wiggins","role":"rx_plus_admin","store_scope":"AACTIVATEDRX","admin_code":"BOSSIQUIT","approval_owner_email":"guy@aactivated.com","force_password_reset":true}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(james_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"],"role":"rx_plus_admin"}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"full_name":"James Wiggins","role":"rx_plus_admin","store_scope":"AACTIVATEDRX","admin_code":"BOSSIQUIT","approval_owner_email":"guy@aactivated.com","force_password_reset":true}'::jsonb
    where id = james_auth_id;
  end if;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    james_auth_id,
    james_auth_id::text,
    jsonb_build_object('sub', james_auth_id::text, 'email', james_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  select id
    into james_profile_id
  from public.profiles
  where auth_user_id = james_auth_id
     or lower(coalesce(email, '')) = lower(james_email)
  order by
    case when auth_user_id = james_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if james_profile_id is null then
    james_profile_id := james_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role
    )
    values (
      james_profile_id,
      james_auth_id,
      'James Wiggins',
      james_email,
      null,
      'rx_plus_admin'
    );
  else
    update public.profiles
    set
      auth_user_id = james_auth_id,
      full_name = 'James Wiggins',
      email = james_email,
      role = 'rx_plus_admin'
    where id = james_profile_id;
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
    account_type,
    parent_type,
    active
  )
  values (
    james_profile_id,
    'James Wiggins',
    'BOSSIQUIT',
    'AACTIVATED-ADMIN-BOSSIQUIT',
    'BOSSIQUIT',
    'aactivated_scoped_admin',
    0,
    0,
    0,
    'aactivated_scoped_admin',
    'BOSSIQUIT',
    0,
    '/AACTIVATED?admin=BOSSIQUIT',
    true,
    60,
    'Email: bossiquitinc@gmail.com',
    james_email,
    'aactivated_partner_admin',
    guy_rep_id,
    guy_profile_id,
    'aactivated',
    'AACTIVATEDRX',
    '{"palette":["#031924","#25c7d9","#ffffff"],"style":"AACTIVATEDRX scoped admin"}'::jsonb,
    'admin',
    'aactivated_downline_admin',
    true
  )
  on conflict (rep_slug) do update set
    profile_id = excluded.profile_id,
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
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true;

  select id
    into james_rep_id
  from public.reps
  where rep_slug = 'BOSSIQUIT'
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
    'BOSSIQUIT',
    'BOSSIQUIT / James Wiggins AACTIVATEDRX Admin',
    'admin',
    'BOSSIQUIT',
    'GUY60',
    true,
    0,
    'AACTIVATEDRX scoped admin under Guy approval owner. Admin login only; no rep commission by default.'
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
    james_rep_id,
    james_email,
    'James Wiggins',
    'BOSSIQUIT',
    'bossiquit',
    '/admin/rx-plus',
    'aactivated_admin_scope',
    '{"admin_portal":true,"partner_tools":true,"rep_management":true,"product_management":true,"promo_management":true,"checkout_attribution":true}'::jsonb,
    '{"admin_code":"BOSSIQUIT","approval_owner_email":"guy@aactivated.com","rep_portal":"/rep","admin_portal":"/admin/rx-plus"}'::jsonb,
    'active',
    now(),
    'AACTIVATEDRX scoped admin for James Wiggins. Guy Griffithe remains approval owner.'
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
    actor_id,
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
    guy_profile_id,
    'guy@aactivated.com',
    'scoped_admin_login_created',
    'profiles',
    james_profile_id,
    james_rep_id,
    jsonb_build_object(
      'profile_id', james_profile_id,
      'rep_id', james_rep_id,
      'admin_code', 'BOSSIQUIT',
      'email', james_email,
      'role', 'rx_plus_admin',
      'approval_owner_email', 'guy@aactivated.com'
    ),
    'James Wiggins / BOSSIQUIT created as an AACTIVATEDRX scoped admin under Guy approval owner.'
  );
end $$;

create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.reps r on r.profile_id = p.id
    where p.id = public.current_profile_id()
      and (
        public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin')
        or (
          p.role = 'rx_plus_admin'
          and (
            lower(p.email) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
            or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
            or upper(coalesce(r.brand_name, '')) = 'AACTIVATEDRX'
            or upper(coalesce(r.rep_channel, '')) = 'AACTIVATED_PARTNER_ADMIN'
          )
        )
      )
  );
$$;
