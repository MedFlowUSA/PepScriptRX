-- Add Ray McCalll as an Aurora Labs downline rep under Mike / Aurora Labs.
-- Auth users are intentionally not created here. Temporary passwords must be
-- provided only through Supabase Auth/admin tooling or the secure Edge Function.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists attribution_window_days integer not null default 60,
  add column if not exists payout_method text,
  add column if not exists paypal_link text,
  add column if not exists paypal_identifier text,
  add column if not exists payout_preference text,
  add column if not exists payout_status text,
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists override_percent numeric(5,4) not null default 0,
  add column if not exists platform_percent numeric(5,4) not null default 0.35,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_theme jsonb,
  add column if not exists custom_price_list jsonb,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.partner_rep_commission_settings
  add column if not exists rep_name text,
  add column if not exists commission_basis text not null default 'net_profit_after_true_cost',
  add column if not exists parent_override_percent numeric(5,2),
  add column if not exists platform_percent numeric(5,2),
  add column if not exists status text not null default 'active';

do $$
declare
  aurora_rep_id uuid;
  mike_profile_id uuid;
  aurora_prices jsonb := '[]'::jsonb;
  aurora_theme jsonb := '{}'::jsonb;
  ray_auth_id uuid;
  ray_profile_id uuid;
  ray_rep_id uuid;
begin
  select r.id, r.profile_id, coalesce(r.custom_price_list, '[]'::jsonb), coalesce(r.brand_theme, '{}'::jsonb)
    into aurora_rep_id, mike_profile_id, aurora_prices, aurora_theme
  from public.reps r
  where r.rep_slug = 'AURORA'
     or r.rep_identifier = 'MIKEAURORA'
  order by case when r.rep_slug = 'AURORA' then 0 else 1 end, r.created_at desc
  limit 1;

  if aurora_rep_id is null then
    raise exception 'Aurora parent rep AURORA / MIKEAURORA is required before adding Ray McCalll.';
  end if;

  select id
    into ray_auth_id
  from auth.users
  where lower(coalesce(email, '')) = 'rayslaoffice@gmail.com'
  order by created_at desc
  limit 1;

  if ray_auth_id is not null then
    select id
      into ray_profile_id
    from public.profiles
    where auth_user_id = ray_auth_id
       or id = ray_auth_id
       or lower(coalesce(email, '')) = 'rayslaoffice@gmail.com'
    order by
      case when auth_user_id = ray_auth_id or id = ray_auth_id then 0 else 1 end,
      created_at desc
    limit 1;

    if ray_profile_id is null then
      ray_profile_id := ray_auth_id;

      insert into public.profiles (
        id,
        auth_user_id,
        full_name,
        email,
        phone,
        role,
        admin_scope,
        store_slug,
        owner_email
      )
      values (
        ray_profile_id,
        ray_auth_id,
        'Ray McCalll',
        'rayslaoffice@gmail.com',
        '714 801 2834',
        'rep',
        'AURORA',
        'aurora',
        'mnsgroup107@gmail.com'
      );
    else
      update public.profiles
      set
        auth_user_id = ray_auth_id,
        full_name = 'Ray McCalll',
        email = 'rayslaoffice@gmail.com',
        phone = '714 801 2834',
        role = 'rep',
        admin_scope = 'AURORA',
        store_slug = 'aurora',
        owner_email = 'mnsgroup107@gmail.com',
        updated_at = now()
      where id = ray_profile_id;
    end if;
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
    paypal_link,
    paypal_identifier,
    payout_preference,
    payout_status,
    rep_channel,
    custom_store_slug,
    brand_name,
    brand_theme,
    custom_price_list,
    account_type,
    parent_type,
    parent_rep_id,
    managed_by_profile_id,
    active
  )
  values (
    ray_profile_id,
    'Ray McCalll',
    'AURORARM',
    'AURORARM',
    'AURORARM',
    'net_profit_after_true_cost',
    0.20,
    0.20,
    0.60,
    'aurora_downline_rep',
    'AURORARM',
    0,
    '/aurora/McCall',
    true,
    60,
    'pending',
    null,
    null,
    null,
    'pending',
    'pending',
    'aurora_downline_rep',
    'aurora',
    'Aurora Labs',
    aurora_theme || jsonb_build_object(
      'parentStore', 'Aurora Labs',
      'parentAdmin', 'Mike',
      'rollupParent', 'Rick Diaz / Rock Phorm',
      'contactPhone', '714 801 2834',
      'storefrontLink', '/aurora/McCall',
      'queryStorefrontLink', '/auroralabs?rep=AURORARM',
      'repPortal', '/login?portal=rep&brand=aurora',
      'payoutMethod', 'pending',
      'payoutPreference', 'pending',
      'payoutStatus', 'pending',
      'paypalIdentifier', null
    ),
    aurora_prices,
    'rep',
    'aurora_downline',
    aurora_rep_id,
    mike_profile_id,
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
    payout_email = public.reps.payout_email,
    paypal_link = null,
    paypal_identifier = excluded.paypal_identifier,
    payout_preference = excluded.payout_preference,
    payout_status = excluded.payout_status,
    rep_channel = excluded.rep_channel,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = coalesce(public.reps.brand_theme, '{}'::jsonb) || excluded.brand_theme,
    custom_price_list = coalesce(public.reps.custom_price_list, excluded.custom_price_list),
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    active = true,
    updated_at = now()
  returning id into ray_rep_id;

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
    'AURORARM',
    'Ray McCalll / Aurora Labs',
    'rep',
    'AURORARM',
    'AURORA',
    true,
    0.20,
    'Aurora Labs downline rep. Rep receives 20% net profit. Parent attribution stays under Mike / Aurora Labs and rolls up under Rick Diaz / Rock Phorm.'
  )
  on conflict (scope_code) do update set
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id,
    is_active = true,
    default_commission_rate = excluded.default_commission_rate,
    notes = excluded.notes,
    updated_at = now();

  if to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      rep_name,
      commission_percent,
      commission_basis,
      parent_override_percent,
      platform_percent,
      status,
      internal_notes
    )
    values (
      'AURORA',
      mike_profile_id,
      'mnsgroup107@gmail.com',
      ray_rep_id,
      'rayslaoffice@gmail.com',
      'Ray McCalll',
      20,
      'net_profit_after_true_cost',
      20,
      60,
      'active',
      'Aurora Labs rep sub-store. Customer checkout remains centralized; payout metadata is pending unless explicitly provided.'
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      rep_name = excluded.rep_name,
      commission_percent = excluded.commission_percent,
      commission_basis = excluded.commission_basis,
      parent_override_percent = excluded.parent_override_percent,
      platform_percent = excluded.platform_percent,
      status = 'active',
      internal_notes = excluded.internal_notes,
      updated_at = now();
  end if;

  if to_regclass('public.partner_rep_store_settings') is not null then
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
      'AURORA',
      mike_profile_id,
      'mnsgroup107@gmail.com',
      ray_rep_id,
      'rayslaoffice@gmail.com',
      'Ray McCalll',
      'Ray McCalll',
      'aurora',
      '/aurora/McCall',
      'aurora_rockphorm_pricing',
      jsonb_build_object(
        'storefront', true,
        'rep_portal', true,
        'checkout_attribution', true,
        'aurora_branding', true,
        'rockphorm_rollup', true
      ),
      jsonb_build_object(
        'attribution_code', 'AURORARM',
        'referral_link', '/r/AURORARM',
        'storefront_link', '/aurora/McCall',
        'query_storefront_link', '/auroralabs?rep=AURORARM',
        'rep_portal', '/login?portal=rep&brand=aurora',
        'discount_code', 'AURORARM',
        'parent_rep_slug', 'AURORA',
        'parent_admin', 'Mike / Aurora Labs',
        'rollup_parent', 'Rick Diaz / Rock Phorm',
        'commission_percent', 20,
        'contact_phone', '714 801 2834',
        'payoutMethod', 'pending',
        'payoutPreference', 'pending',
        'payoutStatus', 'pending',
        'paypalIdentifier', null
      ),
      'active',
      now(),
      'Aurora Labs rep storefront under Mike / Aurora Labs. Uses centralized customer checkout and Rock Phorm/Aurora pricing.'
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
      status = 'active',
      activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
      internal_notes = excluded.internal_notes,
      updated_at = now();
  end if;
end $$;
