-- Add Ebony Williams as an Aurora Labs downline rep under Ray McCalll.
-- Auth users are intentionally not created here. Temporary passwords must be
-- handled only through Supabase Auth/admin tooling or the secure Aurora grant function.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists brand_id text,
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
  add column if not exists brand_id text,
  add column if not exists parent_brand_id text,
  add column if not exists assigned_store_slug text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.partner_rep_commission_settings
  add column if not exists brand_id text,
  add column if not exists rep_name text,
  add column if not exists commission_basis text not null default 'net_profit_after_true_cost',
  add column if not exists parent_override_percent numeric(5,2),
  add column if not exists platform_percent numeric(5,2),
  add column if not exists status text not null default 'active';

alter table if exists public.partner_rep_store_settings
  add column if not exists brand_id text;

do $$
declare
  rock_rep_id uuid;
  aurora_rep_id uuid;
  mike_profile_id uuid;
  ray_rep_id uuid;
  ray_profile_id uuid;
  aurora_prices jsonb := '[]'::jsonb;
  aurora_theme jsonb := '{}'::jsonb;
  ebony_auth_id uuid;
  ebony_profile_id uuid;
  ebony_rep_id uuid;
begin
  select r.id
    into rock_rep_id
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(r.rep_identifier, '')) = 'ROCKPHORM'
     or upper(coalesce(r.brand_name, '')) in ('ROCK PHORM', 'ROCKPHORM')
  order by case when upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM' then 0 else 1 end, r.created_at desc
  limit 1;

  select r.id, r.profile_id, coalesce(r.custom_price_list, '[]'::jsonb), coalesce(r.brand_theme, '{}'::jsonb)
    into aurora_rep_id, mike_profile_id, aurora_prices, aurora_theme
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'AURORA'
     or upper(coalesce(r.rep_identifier, '')) = 'MIKEAURORA'
  order by case when upper(coalesce(r.rep_slug, '')) = 'AURORA' then 0 else 1 end, r.created_at desc
  limit 1;

  select r.id, r.profile_id
    into ray_rep_id, ray_profile_id
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'AURORARM'
     or upper(coalesce(r.rep_identifier, '')) = 'AURORARM'
  order by r.created_at desc
  limit 1;

  if rock_rep_id is null then
    raise exception 'Rock Phorm parent rep ROCKPHORM is required before adding Ebony Williams.';
  end if;

  if aurora_rep_id is null then
    raise exception 'Aurora parent rep AURORA / MIKEAURORA is required before adding Ebony Williams.';
  end if;

  if ray_rep_id is null then
    raise exception 'Ray parent rep AURORARM is required before adding Ebony Williams.';
  end if;

  -- Keep existing Rock Phorm and Aurora commission settings intact. This
  -- migration only repairs Ray's parent pointer and adds Ebony under Ray.
  update public.reps
  set
    parent_rep_id = aurora_rep_id,
    updated_at = now()
  where id = ray_rep_id;

  select id
    into ebony_auth_id
  from auth.users
  where lower(coalesce(email, '')) = 'geetap11@icloud.com'
  order by created_at desc
  limit 1;

  if ebony_auth_id is not null then
    select id
      into ebony_profile_id
    from public.profiles
    where auth_user_id = ebony_auth_id
       or id = ebony_auth_id
       or lower(coalesce(email, '')) = 'geetap11@icloud.com'
       or lower(coalesce(full_name, '')) = 'ebony williams'
       or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = '9097504685'
    order by
      case when auth_user_id = ebony_auth_id or id = ebony_auth_id then 0 else 1 end,
      created_at desc
    limit 1;

    if ebony_profile_id is null then
      ebony_profile_id := ebony_auth_id;

      insert into public.profiles (
        id,
        auth_user_id,
        full_name,
        email,
        phone,
        role,
        admin_scope,
        store_slug,
        owner_email,
        brand_id
      )
      values (
        ebony_profile_id,
        ebony_auth_id,
        'Ebony Williams',
        'geetap11@icloud.com',
        '(909) 750-4685',
        'rep',
        'AURORA',
        'aurora',
        'mnsgroup107@gmail.com',
        'rockphorm'
      );
    else
      update public.profiles
      set
        auth_user_id = ebony_auth_id,
        full_name = 'Ebony Williams',
        email = 'geetap11@icloud.com',
        phone = '(909) 750-4685',
        role = 'rep',
        admin_scope = 'AURORA',
        store_slug = 'aurora',
        owner_email = 'mnsgroup107@gmail.com',
        brand_id = 'rockphorm',
        updated_at = now()
      where id = ebony_profile_id;
    end if;
  end if;

  select id
    into ebony_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'AURORAEW'
     or upper(coalesce(rep_identifier, '')) = 'AURORAEW'
     or lower(coalesce(payout_email, '')) = 'geetap11@icloud.com'
     or lower(coalesce(rep_name, '')) = 'ebony williams'
  order by
    case when upper(coalesce(rep_slug, '')) = 'AURORAEW' then 0 else 1 end,
    created_at desc
  limit 1;

  if ebony_rep_id is null then
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
      brand_id,
      parent_brand_id,
      assigned_store_slug,
      active
    )
    values (
      ebony_profile_id,
      'Ebony Williams',
      'AURORAEW',
      'AURORAEW',
      'AURORAEW',
      'net_profit_after_true_cost',
      0.10,
      0.10,
      0.80,
      'aurora_downline_rep',
      'AURORAEW',
      0,
      '/auroraEW',
      true,
      60,
      'pending',
      'geetap11@icloud.com',
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
        'directParent', 'Ray McCalll',
        'directParentRepSlug', 'AURORARM',
        'rollupParent', 'Rick Diaz / Rock Phorm',
        'contactPhone', '(909) 750-4685',
        'storefrontLink', '/auroraEW',
        'queryStorefrontLink', '/auroralabs?rep=AURORAEW',
        'repPortal', '/login?portal=rep&brand=aurora',
        'referralCode', 'AURORAEW',
        'commissionPercent', 10,
        'parentOverridePercent', 10,
        'platformPercent', 80,
        'hierarchyLevels', jsonb_build_object(
          'ebony', 10,
          'ray', 20,
          'aurora', 40,
          'rockphorm', 65
        )
      ),
      aurora_prices,
      'rep',
      'aurora_ray_downline',
      ray_rep_id,
      coalesce(ray_profile_id, mike_profile_id),
      'rockphorm',
      'aurora',
      'aurora',
      true
    )
    returning id into ebony_rep_id;
  else
    update public.reps
    set
      profile_id = coalesce(ebony_profile_id, profile_id),
      rep_name = 'Ebony Williams',
      handle = 'AURORAEW',
      rep_identifier = 'AURORAEW',
      rep_slug = 'AURORAEW',
      commission_type = 'net_profit_after_true_cost',
      commission_rate = 0.10,
      override_percent = 0.10,
      platform_percent = 0.80,
      rep_tier = 'aurora_downline_rep',
      discount_code = 'AURORAEW',
      discount_amount = 0,
      referral_path = '/auroraEW',
      attribution_locked = true,
      attribution_window_days = 60,
      payout_method = coalesce(nullif(payout_method, ''), 'pending'),
      payout_email = coalesce(nullif(payout_email, ''), 'geetap11@icloud.com'),
      paypal_link = paypal_link,
      paypal_identifier = paypal_identifier,
      payout_preference = coalesce(nullif(payout_preference, ''), 'pending'),
      payout_status = coalesce(nullif(payout_status, ''), 'pending'),
      rep_channel = 'aurora_downline_rep',
      custom_store_slug = 'aurora',
      brand_name = 'Aurora Labs',
      brand_theme = coalesce(brand_theme, '{}'::jsonb) || aurora_theme || jsonb_build_object(
        'parentStore', 'Aurora Labs',
        'parentAdmin', 'Mike',
        'directParent', 'Ray McCalll',
        'directParentRepSlug', 'AURORARM',
        'rollupParent', 'Rick Diaz / Rock Phorm',
        'contactPhone', '(909) 750-4685',
        'storefrontLink', '/auroraEW',
        'queryStorefrontLink', '/auroralabs?rep=AURORAEW',
        'repPortal', '/login?portal=rep&brand=aurora',
        'referralCode', 'AURORAEW',
        'commissionPercent', 10,
        'parentOverridePercent', 10,
        'platformPercent', 80,
        'hierarchyLevels', jsonb_build_object(
          'ebony', 10,
          'ray', 20,
          'aurora', 40,
          'rockphorm', 65
        )
      ),
      custom_price_list = coalesce(custom_price_list, aurora_prices),
      account_type = 'rep',
      parent_type = 'aurora_ray_downline',
      parent_rep_id = ray_rep_id,
      managed_by_profile_id = coalesce(ray_profile_id, mike_profile_id),
      brand_id = 'rockphorm',
      parent_brand_id = 'aurora',
      assigned_store_slug = 'aurora',
      active = true,
      updated_at = now()
    where id = ebony_rep_id;
  end if;

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
    'AURORAEW',
    'Ebony Williams / Aurora Labs',
    'rep',
    'AURORAEW',
    'AURORARM',
    true,
    0.10,
    'Aurora Labs downline rep under Ray McCalll. Existing commission engine pays Ebony 10% and Ray the immediate 10% override; higher Aurora/Rock Phorm rollup remains governed by existing platform/Rock Phorm logic.'
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

  update public.checkout_scopes
  set
    account_type = 'rep',
    account_id = 'AURORARM',
    parent_account_id = 'AURORA',
    is_active = true,
    default_commission_rate = 0.20,
    updated_at = now()
  where upper(coalesce(scope_code, '')) = 'AURORARM';

  if to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      brand_id,
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
      'rockphorm',
      mike_profile_id,
      'mnsgroup107@gmail.com',
      ebony_rep_id,
      'geetap11@icloud.com',
      'Ebony Williams',
      10,
      'net_profit_after_true_cost',
      10,
      80,
      'active',
      'Aurora Labs rep under Ray McCalll. Ebony level 10%; Ray immediate differential override 10%; parent hierarchy metadata remains Ray -> Mike/Aurora -> Rick/Rock Phorm.'
    )
    on conflict (store_scope, rep_id) do update set
      brand_id = excluded.brand_id,
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
      internal_notes
    )
    values (
      'AURORA',
      'rockphorm',
      mike_profile_id,
      'mnsgroup107@gmail.com',
      ebony_rep_id,
      'geetap11@icloud.com',
      'Ebony Williams',
      'Ebony Williams',
      'aurora',
      '/auroraEW',
      'aurora_rockphorm_pricing',
      jsonb_build_object(
        'storefront', true,
        'rep_portal', true,
        'checkout_attribution', true,
        'aurora_branding', true,
        'ray_direct_parent', true,
        'rockphorm_rollup', true
      ),
      jsonb_build_object(
        'attribution_code', 'AURORAEW',
        'referral_link', '/r/AURORAEW',
        'storefront_link', '/auroraEW',
        'query_storefront_link', '/auroralabs?rep=AURORAEW',
        'rep_portal', '/login?portal=rep&brand=aurora',
        'discount_code', 'AURORAEW',
        'parent_rep_slug', 'AURORARM',
        'direct_parent', 'Ray McCalll',
        'parent_store', 'Mike / Aurora Labs',
        'rollup_parent', 'Rick Diaz / Rock Phorm',
        'commission_percent', 10,
        'parent_override_percent', 10,
        'platform_percent', 80,
        'contact_phone', '(909) 750-4685'
      ),
      'active',
      now(),
      'Aurora Labs rep storefront under Ray McCalll. Uses Aurora/Rock Phorm products, pricing, checkout, and centralized payment routing.'
    )
    on conflict (store_scope, rep_id) do update set
      brand_id = excluded.brand_id,
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
