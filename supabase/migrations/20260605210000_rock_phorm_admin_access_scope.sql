-- Rock Phorm admin access hardening for Rick Diaz.
-- Keeps the existing auth login, marks Rick as an admin owner, retires legacy
-- personal attribution, and keeps products/checkout tied to ROCKPHORM.

alter table public.profiles
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text;

create index if not exists profiles_admin_scope_idx
  on public.profiles(admin_scope);

create index if not exists profiles_store_slug_idx
  on public.profiles(store_slug);

create or replace function public.is_rockphorm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role = 'admin'
      and (
        lower(p.email) = 'rick@blueprintadvocate.io'
        or upper(coalesce(p.admin_scope, '')) = 'ROCKPHORM'
        or lower(coalesce(p.store_slug, '')) = 'rockphorm'
      )
  );
$$;

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
          'store_slug', 'rockphorm',
          'owner_email', rick_email
        ),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'role', 'admin',
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
    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role,
      admin_scope,
      store_slug,
      owner_email
    )
    values (
      coalesce(rick_auth_id, gen_random_uuid()),
      rick_auth_id,
      'Rick Diaz',
      rick_email,
      'admin',
      'ROCKPHORM',
      'rockphorm',
      rick_email
    )
    returning id into rick_profile_id;
  else
    update public.profiles
    set
      auth_user_id = coalesce(rick_auth_id, auth_user_id),
      full_name = 'Rick Diaz',
      email = rick_email,
      role = 'admin',
      admin_scope = 'ROCKPHORM',
      store_slug = 'rockphorm',
      owner_email = rick_email
    where id = rick_profile_id;
  end if;

  update public.reps
  set
    active = false,
    discount_code = concat(coalesce(rep_slug, 'RICK'), '_RETIRED'),
    discount_amount = 0,
    referral_path = '/rockphorm',
    custom_store_slug = null,
    brand_name = 'Rock Phorm legacy personal rep retired',
    rep_channel = 'retired_personal_rep',
    account_type = 'retired_rep',
    parent_type = 'legacy'
  where rep_slug in ('RICK50', 'RICK', 'RICKDIAZ')
     or (
       lower(coalesce(payout_email, '')) = lower(rick_email)
       and rep_slug <> 'ROCKPHORM'
     );

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
  )
  values (
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
    custom_store_slug = excluded.custom_store_slug,
    brand_name = excluded.brand_name,
    brand_theme = excluded.brand_theme,
    account_type = excluded.account_type,
    parent_type = excluded.parent_type,
    active = true;
end $$;

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
  'ROCKPHORM',
  'Rock Phorm',
  'admin',
  'ROCKPHORM',
  null,
  true,
  0.55,
  'Rock Phorm checkout scope for Rick Diaz. Commission basis: 55% net profit after customer amount collected minus true landed product, fulfillment, shipping, and payment costs.'
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

update public.checkout_scopes
set
  is_active = false,
  notes = concat_ws(E'\n', nullif(notes, ''), 'Retired in favor of ROCKPHORM admin scope.'),
  updated_at = now()
where scope_code in ('RICK50', 'RICK', 'RICKDIAZ');

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
  is_enabled = true,
  updated_at = now()
from public.distributors d
where dp.distributor_id = d.id
  and d.slug = 'rockphorm';
