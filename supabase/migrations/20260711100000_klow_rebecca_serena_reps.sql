-- Add Rebecca Almanza and Serena "Nikki" Brisson as KLOW reps.
-- Auth users are intentionally not created here: temporary passwords must be
-- provided only through Supabase Auth/admin tooling or the secure KLOW grant function.

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

update public.partner_store_settings
set
  brand_id = 'rockphorm',
  store_name = 'KLOW Recovery + Radiance',
  settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object(
      'parentBrandId', 'rockphorm',
      'ownerBrandId', 'rockphorm',
      'commissionSource', 'rockphorm',
      'payoutOwner', 'rockphorm',
      'scopeCode', 'ROCKPHORM',
      'brandScopeCode', 'KLOW',
      'commissionRate', 0.60
    ),
  updated_at = now()
where lower(store_slug) = 'klow';

do $$
declare
  rock_rep_id uuid;
  rock_profile_id uuid;
  rock_prices jsonb := '[]'::jsonb;
  rock_theme jsonb := '{}'::jsonb;
  rep_record record;
  auth_id uuid;
  rep_profile_id uuid;
  new_rep_id uuid;
begin
  select r.id, r.profile_id, coalesce(r.custom_price_list, '[]'::jsonb), coalesce(r.brand_theme, '{}'::jsonb)
    into rock_rep_id, rock_profile_id, rock_prices, rock_theme
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM'
     or upper(coalesce(r.rep_identifier, '')) = 'ROCKPHORM'
  order by case when upper(coalesce(r.rep_slug, '')) = 'ROCKPHORM' then 0 else 1 end, r.created_at desc
  limit 1;

  if rock_rep_id is null then
    raise exception 'Rock Phorm parent rep ROCKPHORM is required before adding KLOW reps.';
  end if;

  update public.reps
  set
    commission_rate = 0.60,
    platform_percent = 0.40,
    brand_id = 'rockphorm',
    parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'rockphorm'),
    assigned_store_slug = 'rockphorm',
    custom_store_slug = coalesce(custom_store_slug, 'rockphorm'),
    updated_at = now()
  where id = rock_rep_id;

  for rep_record in
    select *
    from (
      values
        (
          'Rebecca Almanza',
          null::text,
          '@beckybeckibecks',
          'Becca.almanza86@gmail.com',
          '+1 (909) 344-4975',
          'REBECCA-ALMANZA',
          'REBECCAKLOW',
          '/klow?rep=REBECCAKLOW'
        ),
        (
          'Serena Brisson',
          'Nikki Brisson',
          '@nikkibrisson27',
          'Nikkibrisson45@gmail.com',
          '+1 (909) 810-7172',
          'SERENA-BRISSON',
          'NIKKIKLOW',
          '/klow?rep=NIKKIKLOW'
        )
    ) as reps_to_seed(rep_name, alternate_name, social_handle, email, phone, rep_slug, referral_code, storefront_path)
  loop
    auth_id := null;
    rep_profile_id := null;
    new_rep_id := null;

    select id
      into auth_id
    from auth.users
    where lower(coalesce(email, '')) = lower(rep_record.email)
    order by created_at desc
    limit 1;

    if auth_id is not null then
      select id
        into rep_profile_id
      from public.profiles
      where auth_user_id = auth_id
         or id = auth_id
         or lower(coalesce(email, '')) = lower(rep_record.email)
      order by
        case when auth_user_id = auth_id or id = auth_id then 0 else 1 end,
        created_at desc
      limit 1;

      if rep_profile_id is null then
        rep_profile_id := auth_id;
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
          rep_profile_id,
          auth_id,
          rep_record.rep_name,
          lower(rep_record.email),
          rep_record.phone,
          'rep',
          'KLOW',
          'klow',
          'rick@blueprintadvocate.io',
          'rockphorm'
        );
      else
        update public.profiles
        set
          auth_user_id = auth_id,
          full_name = rep_record.rep_name,
          email = lower(rep_record.email),
          phone = rep_record.phone,
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
      rep_profile_id,
      rep_record.rep_name,
      rep_record.social_handle,
      rep_record.rep_slug,
      rep_record.rep_slug,
      'net_profit_after_true_cost',
      0.40,
      0.20,
      0.40,
      'klow_downline_rep',
      rep_record.referral_code,
      0,
      rep_record.storefront_path,
      true,
      60,
      'pending',
      lower(rep_record.email),
      null,
      null,
      'pending',
      'pending',
      'klow_downline_rep',
      'klow',
      'KLOW Recovery + Radiance',
      rock_theme || jsonb_build_object(
        'parentStore', 'KLOW Recovery + Radiance',
        'parentOrganization', 'Rock Phorm',
        'rollupParent', 'Rick Diaz / Rock Phorm',
        'alternateName', rep_record.alternate_name,
        'socialUsername', rep_record.social_handle,
        'contactPhone', rep_record.phone,
        'storefrontLink', rep_record.storefront_path,
        'repPortal', '/login?portal=rep&brand=klow',
        'referralCode', rep_record.referral_code,
        'commissionPercent', 40,
        'parentOverridePercent', 20,
        'platformPercent', 40
      ),
      rock_prices,
      'rep',
      'klow_downline',
      rock_rep_id,
      rock_profile_id,
      'rockphorm',
      'rockphorm',
      'klow',
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
      payout_method = coalesce(nullif(public.reps.payout_method, ''), excluded.payout_method),
      payout_email = coalesce(nullif(public.reps.payout_email, ''), excluded.payout_email),
      paypal_link = public.reps.paypal_link,
      paypal_identifier = public.reps.paypal_identifier,
      payout_preference = coalesce(nullif(public.reps.payout_preference, ''), excluded.payout_preference),
      payout_status = coalesce(nullif(public.reps.payout_status, ''), excluded.payout_status),
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
    returning id into new_rep_id;

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
      rep_record.referral_code,
      rep_record.rep_name || ' / KLOW',
      'rep',
      rep_record.rep_slug,
      'ROCKPHORM',
      true,
      0.40,
      'KLOW downline rep. Rep receives 40% net profit. Rock Phorm/KLOW parent override receives 20% so the KLOW pool remains 60%, with platform share preserved at 40%.'
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
        'KLOW',
        'rockphorm',
        rock_profile_id,
        'rick@blueprintadvocate.io',
        new_rep_id,
        lower(rep_record.email),
        rep_record.rep_name,
        40,
        'net_profit_after_true_cost',
        20,
        40,
        'active',
        'KLOW rep under Rock Phorm. Rep receives 40%; Rock Phorm/KLOW parent override receives 20%; platform share remains 40%.'
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
        'KLOW',
        'rockphorm',
        rock_profile_id,
        'rick@blueprintadvocate.io',
        new_rep_id,
        lower(rep_record.email),
        rep_record.rep_name,
        coalesce(rep_record.alternate_name, rep_record.rep_name),
        'klow',
        rep_record.storefront_path,
        'rockphorm_klow_pricing',
        jsonb_build_object(
          'storefront', true,
          'rep_portal', true,
          'checkout_attribution', true,
          'klow_branding', true,
          'rockphorm_rollup', true
        ),
        jsonb_build_object(
          'attribution_code', rep_record.referral_code,
          'referral_link', '/r/' || rep_record.rep_slug,
          'storefront_link', rep_record.storefront_path,
          'rep_portal', '/login?portal=rep&brand=klow',
          'discount_code', rep_record.referral_code,
          'parent_rep_slug', 'ROCKPHORM',
          'parent_store', 'KLOW',
          'rollup_parent', 'Rick Diaz / Rock Phorm',
          'commission_percent', 40,
          'parent_override_percent', 20,
          'platform_percent', 40,
          'social_username', rep_record.social_handle,
          'alternate_name', rep_record.alternate_name,
          'contact_phone', rep_record.phone
        ),
        'active',
        now(),
        'KLOW rep storefront under Rock Phorm. Uses KLOW branding and Rock Phorm payout rollup.'
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
  end loop;
end $$;
