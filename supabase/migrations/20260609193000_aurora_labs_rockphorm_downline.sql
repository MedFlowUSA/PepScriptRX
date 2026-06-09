-- Aurora Labs partner storefront under Rick Diaz / Rock Phorm.
-- This migration is idempotent and does not create or reset Supabase Auth passwords.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text;

alter table public.reps
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null;

do $$
declare
  mike_email text := 'mnsgroup107@gmail.com';
  rick_email text := 'rick@blueprintadvocate.io';
  mike_auth_user_id uuid;
  mike_profile_id uuid;
  mike_rep_id uuid;
  rick_profile_id uuid;
  rick_rep_id uuid;
  rock_custom_price_list jsonb := '[]'::jsonb;
begin
  select id
    into mike_auth_user_id
  from auth.users
  where lower(coalesce(email, '')) = lower(mike_email)
  order by created_at desc
  limit 1;

  select id
    into rick_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = lower(rick_email)
  order by created_at desc
  limit 1;

  select id
    into rick_rep_id
  from public.reps
  where rep_slug = 'ROCKPHORM'
  order by created_at desc
  limit 1;

  select coalesce(custom_price_list, '[]'::jsonb)
    into rock_custom_price_list
  from public.reps
  where rep_slug = 'ROCKPHORM'
  order by created_at desc
  limit 1;

  select id
    into mike_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = lower(mike_email)
  order by created_at desc
  limit 1;

  if mike_profile_id is null and mike_auth_user_id is not null then
    insert into public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      admin_scope,
      store_slug,
      owner_email
    )
    values (
      mike_auth_user_id,
      mike_auth_user_id,
      mike_email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      mike_email
    )
    returning id into mike_profile_id;
  elsif mike_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, mike_auth_user_id),
      email = mike_email,
      full_name = coalesce(nullif(full_name, ''), 'Mike'),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = mike_email,
      updated_at = now()
    where id = mike_profile_id;
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
    mike_profile_id,
    'Mike',
    'Aurora Labs',
    'MIKEAURORA',
    'AURORA',
    'net_profit_after_true_cost',
    0.40,
    0,
    0.60,
    'rockphorm_sub_admin_store',
    'AURORA',
    0,
    '/aurora',
    true,
    60,
    'PayPal Pending',
    null,
    null,
    'rockphorm_downline_admin',
    'aurora',
    'Aurora Labs',
    jsonb_build_object(
      'palette', jsonb_build_array('#f8fffd', '#14b8a6', '#22d3ee', '#0f3758', '#cbd5e1'),
      'style', 'feminine premium clinical research storefront with aurora, teal, aqua, mint, emerald, blue, and silver styling',
      'logo', '/marketing/aurora-logo.png',
      'productImage', '/marketing/aurora-vial.png',
      'parentStore', 'Rock Phorm',
      'trueCostRule', 'customer amount collected minus true landed product fulfillment shipping payment costs',
      'compliance', 'research use only; not for human consumption; not intended to diagnose, treat, cure, or prevent disease'
    ),
    rock_custom_price_list,
    'admin',
    'rockphorm_downline',
    rick_rep_id,
    rick_profile_id,
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
    paypal_link = excluded.paypal_link,
    rep_channel = excluded.rep_channel,
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    custom_price_list = excluded.custom_price_list,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id,
    active = true
  returning id into mike_rep_id;
end $$;

insert into public.distributors (
  name,
  slug,
  portal_name,
  commission_rate,
  is_active,
  white_label_enabled,
  wholesale_enabled
) values (
  'Mike',
  'aurora',
  'Aurora Labs',
  0.40,
  true,
  true,
  false
) on conflict (slug) do update set
  name = excluded.name,
  portal_name = excluded.portal_name,
  commission_rate = excluded.commission_rate,
  is_active = excluded.is_active,
  white_label_enabled = excluded.white_label_enabled,
  wholesale_enabled = excluded.wholesale_enabled,
  updated_at = now();

insert into public.distributor_products (
  distributor_id,
  product_id,
  is_enabled,
  custom_price,
  featured,
  commission_rate
)
select
  aurora.id,
  rock_products.product_id,
  rock_products.is_enabled,
  rock_products.custom_price,
  rock_products.featured,
  0.40
from public.distributor_products rock_products
join public.distributors rock on rock.id = rock_products.distributor_id and rock.slug = 'rockphorm'
join public.distributors aurora on aurora.slug = 'aurora'
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled,
  custom_price = excluded.custom_price,
  featured = excluded.featured,
  commission_rate = excluded.commission_rate,
  updated_at = now();

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
  'AURORA',
  'Aurora Labs',
  'admin',
  'AURORA',
  'ROCKPHORM',
  true,
  0.40,
  'Aurora Labs checkout scope for Mike. Rolls up under Rick Diaz / Rock Phorm. Commission basis: 40% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'
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
