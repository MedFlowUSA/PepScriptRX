-- Aurora Labs rep sub-stores under Mike / Aurora Labs.
-- Auth users are intentionally not created here: temporary passwords must be
-- provided through Supabase Auth/admin tooling or the secure Edge Function.

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

do $$
declare
  aurora_rep_id uuid;
  mike_profile_id uuid;
  aurora_prices jsonb := '[]'::jsonb;
  aurora_theme jsonb := '{}'::jsonb;
  rep_record record;
  auth_id uuid;
  profile_id uuid;
  rep_id uuid;
begin
  select id, profile_id, coalesce(custom_price_list, '[]'::jsonb), coalesce(brand_theme, '{}'::jsonb)
    into aurora_rep_id, mike_profile_id, aurora_prices, aurora_theme
  from public.reps
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
  order by case when rep_slug = 'AURORA' then 0 else 1 end, created_at desc
  limit 1;

  if aurora_rep_id is null then
    raise exception 'Aurora parent rep AURORA / MIKEAURORA is required before adding Aurora sub-stores.';
  end if;

  for rep_record in
    select *
    from (
      values
        ('Jermaine Lusk', 'Dustylatv@gmail.com', '(323) 632-2813', 'AURORAJL', '/auroraJL', 'pending', null::text, 'pending', 'pending'),
        ('Megan Delgado', 'Delgado.megan@yahoo.com', '909-969-0243', 'MEGDEL', '/auroraMD', 'pending', null::text, 'pending', 'pending'),
        ('Diane Marie Duffy', 'queentort333@yahoo.com', '(775) 513-8384', 'D026FIR', '/auroraDD', 'paypal', 'Dianeduffy333', 'pay_directly', 'provided_pending_verification'),
        ('Edwiena L Thompson', 'wienathompson@gmail.com', '909-714-9808', 'AURORAET', '/auroraET', 'pending', null::text, 'pending', 'pending'),
        ('Thomas KeJohnna Owens', 'SuccessExpressPromos@gmail.com', '909-332-4253', 'AURORATO', '/auroraTO', 'pending', null::text, 'pending', 'pending'),
        ('Gabriela Espinoza', 'Espinoza.gabriela13@gmail.com', '(626) 362-5614', 'AURORAGE', '/auroraGE', 'pending', null::text, 'pending', 'pending')
    ) as reps_to_seed(rep_name, email, phone, rep_code, storefront_path, payout_method, paypal_identifier, payout_preference, payout_status)
  loop
    auth_id := null;
    profile_id := null;
    rep_id := null;

    select id
      into auth_id
    from auth.users
    where lower(coalesce(email, '')) = lower(rep_record.email)
    order by created_at desc
    limit 1;

    if auth_id is not null then
      select id
        into profile_id
      from public.profiles
      where auth_user_id = auth_id
         or id = auth_id
         or lower(coalesce(email, '')) = lower(rep_record.email)
      order by
        case when auth_user_id = auth_id or id = auth_id then 0 else 1 end,
        created_at desc
      limit 1;

      if profile_id is null then
        profile_id := auth_id;
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
          profile_id,
          auth_id,
          rep_record.rep_name,
          lower(rep_record.email),
          rep_record.phone,
          'rep',
          'AURORA',
          'aurora',
          'mnsgroup107@gmail.com'
        );
      else
        update public.profiles
        set
          auth_user_id = auth_id,
          full_name = rep_record.rep_name,
          email = lower(rep_record.email),
          phone = rep_record.phone,
          role = 'rep',
          admin_scope = 'AURORA',
          store_slug = 'aurora',
          owner_email = 'mnsgroup107@gmail.com',
          updated_at = now()
        where id = profile_id;
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
      profile_id,
      rep_record.rep_name,
      rep_record.rep_code,
      rep_record.rep_code,
      rep_record.rep_code,
      'net_profit_after_true_cost',
      0.20,
      0.20,
      0.60,
      'aurora_downline_rep',
      rep_record.rep_code,
      0,
      rep_record.storefront_path,
      true,
      60,
      rep_record.payout_method,
      case when rep_record.payout_method = 'paypal' then null else null end,
      null,
      rep_record.paypal_identifier,
      rep_record.payout_preference,
      rep_record.payout_status,
      'aurora_downline_rep',
      'aurora',
      'Aurora Labs',
      aurora_theme || jsonb_build_object(
        'parentStore', 'Aurora Labs',
        'parentAdmin', 'Mike',
        'rollupParent', 'Rick Diaz / Rock Phorm',
        'contactPhone', rep_record.phone,
        'storefrontLink', rep_record.storefront_path,
        'queryStorefrontLink', '/auroralabs?rep=' || rep_record.rep_code,
        'repPortal', '/login?portal=rep&brand=aurora',
        'payoutMethod', rep_record.payout_method,
        'payoutPreference', rep_record.payout_preference,
        'payoutStatus', rep_record.payout_status,
        'paypalIdentifier', rep_record.paypal_identifier
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
      payout_method = case
        when public.reps.rep_slug = 'D026FIR' then coalesce(nullif(public.reps.payout_method, ''), excluded.payout_method)
        else excluded.payout_method
      end,
      payout_email = public.reps.payout_email,
      paypal_link = null,
      paypal_identifier = case
        when public.reps.rep_slug = 'D026FIR' then coalesce(public.reps.paypal_identifier, excluded.paypal_identifier)
        else excluded.paypal_identifier
      end,
      payout_preference = case
        when public.reps.rep_slug = 'D026FIR' then coalesce(public.reps.payout_preference, excluded.payout_preference)
        else excluded.payout_preference
      end,
      payout_status = case
        when public.reps.rep_slug = 'D026FIR' then coalesce(public.reps.payout_status, excluded.payout_status)
        else excluded.payout_status
      end,
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
    returning id into rep_id;

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
      rep_record.rep_code,
      rep_record.rep_name || ' / Aurora Labs',
      'rep',
      rep_record.rep_code,
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
        rep_id,
        lower(rep_record.email),
        rep_record.rep_name,
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
        rep_id,
        lower(rep_record.email),
        rep_record.rep_name,
        rep_record.rep_name,
        'aurora',
        rep_record.storefront_path,
        'aurora_rockphorm_pricing',
        jsonb_build_object(
          'storefront', true,
          'rep_portal', true,
          'checkout_attribution', true,
          'aurora_branding', true,
          'rockphorm_rollup', true
        ),
        jsonb_build_object(
          'attribution_code', rep_record.rep_code,
          'referral_link', '/r/' || rep_record.rep_code,
          'storefront_link', rep_record.storefront_path,
          'query_storefront_link', '/auroralabs?rep=' || rep_record.rep_code,
          'rep_portal', '/login?portal=rep&brand=aurora',
          'discount_code', rep_record.rep_code,
          'parent_rep_slug', 'AURORA',
          'parent_admin', 'Mike / Aurora Labs',
          'rollup_parent', 'Rick Diaz / Rock Phorm',
          'commission_percent', 20,
          'contact_phone', rep_record.phone,
          'payoutMethod', rep_record.payout_method,
          'payoutPreference', rep_record.payout_preference,
          'payoutStatus', rep_record.payout_status,
          'paypalIdentifier', rep_record.paypal_identifier
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
  end loop;

  update public.checkout_scopes
  set
    parent_account_id = 'ROCKPHORM',
    default_commission_rate = 0.40,
    is_active = true,
    notes = 'Aurora Labs checkout scope for Mike. Rolls up under Rick Diaz / Rock Phorm. Commission basis: 40% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.',
    updated_at = now()
  where scope_code = 'AURORA';
end $$;
