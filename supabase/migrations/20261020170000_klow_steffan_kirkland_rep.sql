-- Add Steffan Kirkland as a 40% KLOW downline rep under Rock Phorm.
-- Authentication credentials are provisioned separately through Supabase Auth.
do $$
declare
  rock_rep_id uuid;
  rock_profile_id uuid;
  rock_prices jsonb := '[]'::jsonb;
  rock_theme jsonb := '{}'::jsonb;
  auth_id uuid;
  rep_profile_id uuid;
  steffan_rep_id uuid;
begin
  select r.id, r.profile_id, coalesce(r.custom_price_list, '[]'::jsonb), coalesce(r.brand_theme, '{}'::jsonb)
    into rock_rep_id, rock_profile_id, rock_prices, rock_theme
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(r.rep_identifier, '')) = 'ROCKPHORM'
  order by case when upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM' then 0 else 1 end, r.created_at desc
  limit 1;

  if rock_rep_id is null then
    raise exception 'Rock Phorm parent rep ROCKPHORM is required before adding Steffan Kirkland.';
  end if;

  select id into auth_id
  from auth.users
  where lower(coalesce(email, '')) = 'steffankirk@aol.com'
  order by created_at desc
  limit 1;

  if auth_id is not null then
    select id into rep_profile_id
    from public.profiles
    where auth_user_id = auth_id
       or id = auth_id
       or lower(coalesce(email, '')) = 'steffankirk@aol.com'
    order by case when auth_user_id = auth_id or id = auth_id then 0 else 1 end, created_at desc
    limit 1;

    if rep_profile_id is null then
      rep_profile_id := auth_id;
      insert into public.profiles (
        id, auth_user_id, full_name, email, role, admin_scope, store_slug, owner_email, brand_id
      ) values (
        rep_profile_id, auth_id, 'Steffan Kirkland', 'steffankirk@aol.com',
        'rep', 'KLOW', 'klow', 'rick@blueprintadvocate.io', 'rockphorm'
      );
    else
      update public.profiles
      set auth_user_id = auth_id,
          full_name = 'Steffan Kirkland',
          email = 'steffankirk@aol.com',
          role = 'rep',
          admin_scope = 'KLOW',
          store_slug = 'klow',
          owner_email = 'rick@blueprintadvocate.io',
          brand_id = 'rockphorm',
          updated_at = now()
      where id = rep_profile_id;
    end if;
  end if;

  insert into public.reps (
    profile_id, rep_name, handle, rep_identifier, rep_slug,
    commission_type, commission_rate, override_percent, platform_percent,
    rep_tier, discount_code, discount_amount, referral_path,
    attribution_locked, attribution_window_days, payout_method, payout_email,
    payout_preference, payout_status, rep_channel, custom_store_slug,
    brand_name, brand_theme, custom_price_list, account_type, parent_type,
    parent_rep_id, managed_by_profile_id, brand_id, parent_brand_id,
    assigned_store_slug, active
  ) values (
    rep_profile_id, 'Steffan Kirkland', null, 'STEFFAN-KIRKLAND', 'STEFFAN-KIRKLAND',
    'net_profit_after_true_cost', 0.40, 0.20, 0.40,
    'klow_downline_rep', 'STEFFANKLOW', 0, '/klow?rep=STEFFANKLOW',
    true, 60, 'pending', 'steffankirk@aol.com',
    'pending', 'pending', 'klow_downline_rep', 'klow',
    'KLOW Recovery + Radiance',
    rock_theme || jsonb_build_object(
      'parentStore', 'KLOW Recovery + Radiance',
      'parentOrganization', 'Rock Phorm',
      'rollupParent', 'Rick Diaz / Rock Phorm',
      'storefrontLink', '/klow?rep=STEFFANKLOW',
      'repPortal', '/login?portal=rep&brand=klow',
      'referralCode', 'STEFFANKLOW',
      'commissionPercent', 40,
      'parentOverridePercent', 20,
      'platformPercent', 40
    ),
    rock_prices, 'rep', 'klow_downline', rock_rep_id, rock_profile_id,
    'rockphorm', 'rockphorm', 'klow', true
  )
  on conflict (rep_slug) do update set
    profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
    rep_name = excluded.rep_name,
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
    payout_email = excluded.payout_email,
    rep_channel = excluded.rep_channel,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = coalesce(public.reps.brand_theme, '{}'::jsonb) || excluded.brand_theme,
    custom_price_list = coalesce(public.reps.custom_price_list, excluded.custom_price_list),
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    brand_id = excluded.brand_id,
    parent_brand_id = excluded.parent_brand_id,
    assigned_store_slug = excluded.assigned_store_slug,
    active = true,
    updated_at = now()
  returning id into steffan_rep_id;

  insert into public.checkout_scopes (
    scope_code, display_name, account_type, account_id, parent_account_id,
    is_active, default_commission_rate, notes
  ) values (
    'STEFFANKLOW', 'Steffan Kirkland / KLOW', 'rep', 'STEFFAN-KIRKLAND', 'ROCKPHORM',
    true, 0.40,
    'KLOW downline rep. Rep receives 40% net profit; Rock Phorm/KLOW parent override receives 20%; platform share remains 40%.'
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
      store_scope, brand_id, partner_admin_id, partner_admin_email, rep_id,
      rep_email, rep_name, commission_percent, commission_basis,
      parent_override_percent, platform_percent, status, internal_notes
    ) values (
      'KLOW', 'rockphorm', rock_profile_id, 'rick@blueprintadvocate.io', steffan_rep_id,
      'steffankirk@aol.com', 'Steffan Kirkland', 40, 'net_profit_after_true_cost',
      20, 40, 'active',
      'KLOW rep under Rock Phorm. 40% rep allocation is within the existing 60% KLOW pool.'
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
      store_scope, brand_id, partner_admin_id, partner_admin_email, rep_id,
      rep_email, rep_name, public_display_name, store_slug, storefront_path,
      pricing_mode, features, promo_config, status, activated_at, internal_notes
    ) values (
      'KLOW', 'rockphorm', rock_profile_id, 'rick@blueprintadvocate.io', steffan_rep_id,
      'steffankirk@aol.com', 'Steffan Kirkland', 'Steffan Kirkland', 'klow',
      '/klow?rep=STEFFANKLOW', 'rockphorm_klow_pricing',
      jsonb_build_object(
        'storefront', true, 'rep_portal', true, 'checkout_attribution', true,
        'klow_branding', true, 'rockphorm_rollup', true
      ),
      jsonb_build_object(
        'attribution_code', 'STEFFANKLOW',
        'referral_link', '/r/STEFFAN-KIRKLAND',
        'storefront_link', '/klow?rep=STEFFANKLOW',
        'spanish_storefront_link', '/klow-es?rep=STEFFANKLOW',
        'rep_portal', '/login?portal=rep&brand=klow',
        'discount_code', 'STEFFANKLOW',
        'parent_rep_slug', 'ROCKPHORM',
        'parent_store', 'KLOW',
        'rollup_parent', 'Rick Diaz / Rock Phorm',
        'commission_percent', 40,
        'parent_override_percent', 20,
        'platform_percent', 40
      ),
      'active', now(),
      'KLOW rep storefront under Rock Phorm. Uses shared KLOW branding, catalog, pricing, and payout rollup.'
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
