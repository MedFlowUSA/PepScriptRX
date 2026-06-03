-- Finalize Rick Diaz as Rock Phorm admin owner without creating a duplicate auth user.

create extension if not exists pgcrypto;

do $$
declare
  rick_email text := 'rick@blueprintadvocate.io';
  rick_auth_id uuid;
  rick_profile_id uuid;
begin
  select id
    into rick_auth_id
  from auth.users
  where lower(email) = lower(rick_email)
  order by created_at desc
  limit 1;

  if rick_auth_id is not null then
    update auth.users
    set
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Rick Diaz',
          'role', 'admin',
          'brand_name', 'Rock Phorm',
          'admin_scope', 'ROCKPHORM',
          'store_slug', 'rockphorm'
        ),
      updated_at = now()
    where id = rick_auth_id;
  end if;

  select id
    into rick_profile_id
  from public.profiles
  where (rick_auth_id is not null and auth_user_id = rick_auth_id)
     or lower(coalesce(email, '')) = lower(rick_email)
  order by
    case when rick_auth_id is not null and auth_user_id = rick_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if rick_profile_id is null then
    insert into public.profiles (id, auth_user_id, full_name, email, role)
    values (
      coalesce(rick_auth_id, gen_random_uuid()),
      rick_auth_id,
      'Rick Diaz',
      rick_email,
      'admin'
    )
    returning id into rick_profile_id;
  else
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, rick_auth_id),
      full_name = 'Rick Diaz',
      email = rick_email,
      role = 'admin'
    where id = rick_profile_id;
  end if;

  update public.reps
  set
    active = false,
    discount_code = 'RICK50_RETIRED',
    discount_amount = 0,
    referral_path = '/rockphorm',
    custom_store_slug = null,
    brand_name = 'Rock Phorm legacy personal rep retired',
    rep_channel = 'retired_personal_rep',
    account_type = 'retired_rep',
    parent_type = 'legacy',
    updated_at = now()
  where rep_slug = 'RICK50'
     or (lower(coalesce(payout_email, '')) = lower(rick_email) and rep_slug <> 'ROCKPHORM');

  update public.reps
  set
    profile_id = rick_profile_id,
    rep_name = 'Rick Diaz',
    handle = 'Rock Phorm',
    rep_identifier = 'PLATFORM-ADMIN-ROCKPHORM',
    commission_type = 'net_profit_after_true_cost',
    commission_rate = 0.55,
    override_percent = 0,
    platform_percent = 0.45,
    rep_tier = 'platform_admin_store',
    discount_code = 'ROCKPHORM',
    discount_amount = 0,
    referral_path = '/rockphorm',
    attribution_locked = true,
    attribution_window_days = 60,
    payout_method = 'PepScriptRX Admin Store',
    payout_email = rick_email,
    rep_channel = 'white_label_admin_store',
    custom_store_slug = 'rockphorm',
    brand_name = 'Rock Phorm',
    brand_theme = jsonb_build_object(
      'palette', jsonb_build_array('#030712', '#1d4ed8', '#14b8a6', '#ffffff'),
      'style', 'clean wellness luxury, performance transformation longevity recovery',
      'logo', '/marketing/rockphorm-logo.png',
      'productImage', '/marketing/rockphorm-vial.png',
      'headline', 'Optimize Your Biology',
      'tagline', 'Transform. Optimize. Perform.',
      'trueCostRule', 'customer amount collected minus true landed product fulfillment shipping payment costs'
    ),
    account_type = 'admin',
    parent_type = 'platform',
    active = true,
    updated_at = now()
  where rep_slug = 'ROCKPHORM';

  if not found then
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
      custom_store_slug,
      brand_name,
      brand_theme,
      account_type,
      parent_type,
      active
    ) values (
      rick_profile_id,
      'Rick Diaz',
      'Rock Phorm',
      'PLATFORM-ADMIN-ROCKPHORM',
      'ROCKPHORM',
      'net_profit_after_true_cost',
      0.55,
      0,
      0.45,
      'platform_admin_store',
      'ROCKPHORM',
      0,
      '/rockphorm',
      true,
      60,
      'PepScriptRX Admin Store',
      rick_email,
      'white_label_admin_store',
      'rockphorm',
      'Rock Phorm',
      jsonb_build_object(
        'palette', jsonb_build_array('#030712', '#1d4ed8', '#14b8a6', '#ffffff'),
        'style', 'clean wellness luxury, performance transformation longevity recovery',
        'logo', '/marketing/rockphorm-logo.png',
        'productImage', '/marketing/rockphorm-vial.png',
        'headline', 'Optimize Your Biology',
        'tagline', 'Transform. Optimize. Perform.',
        'trueCostRule', 'customer amount collected minus true landed product fulfillment shipping payment costs'
      ),
      'admin',
      'platform',
      true
    );
  end if;

  if to_regclass('public.checkout_scopes') is not null then
    update public.checkout_scopes
    set
      display_name = 'Rock Phorm',
      account_type = 'admin',
      account_id = 'ROCKPHORM',
      parent_account_id = null,
      is_active = true,
      default_commission_rate = 0.55,
      notes = 'Rock Phorm checkout scope for Rick Diaz. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.',
      updated_at = now()
    where scope_code = 'ROCKPHORM';

    if not found then
      insert into public.checkout_scopes (
        scope_code,
        display_name,
        account_type,
        account_id,
        parent_account_id,
        is_active,
        default_commission_rate,
        notes
      ) values (
        'ROCKPHORM',
        'Rock Phorm',
        'admin',
        'ROCKPHORM',
        null,
        true,
        0.55,
        'Rock Phorm checkout scope for Rick Diaz. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'
      );
    end if;

    update public.checkout_scopes
    set
      is_active = false,
      notes = concat_ws(E'\n', nullif(notes, ''), 'Retired in favor of ROCKPHORM admin scope.'),
      updated_at = now()
    where scope_code = 'RICK50';
  end if;
end $$;

update public.distributors
set
  name = 'Rick Diaz',
  portal_name = 'Rock Phorm',
  commission_rate = 0.55,
  is_active = true,
  white_label_enabled = true,
  wholesale_enabled = false,
  updated_at = now()
where slug = 'rockphorm';

update public.distributor_products dp
set
  commission_rate = 0.55,
  updated_at = now()
from public.distributors d
where dp.distributor_id = d.id
  and d.slug = 'rockphorm';
