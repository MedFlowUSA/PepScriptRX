-- Convert Bryan's BEASTMODE access from partner admin to rep-scoped access.
-- Password creation/reset is intentionally handled outside migrations.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists brand_id text,
  add column if not exists partner_access_level text,
  add column if not exists access_scope text,
  add column if not exists global_admin boolean not null default false,
  add column if not exists super_admin boolean not null default false,
  add column if not exists can_view_all_brands boolean not null default false,
  add column if not exists can_view_all_reps boolean not null default false,
  add column if not exists can_view_all_orders boolean not null default false,
  add column if not exists can_view_all_customers boolean not null default false,
  add column if not exists can_edit_global_catalog boolean not null default false,
  add column if not exists can_edit_global_settings boolean not null default false,
  add column if not exists can_view_platform_financials boolean not null default false,
  add column if not exists can_view_other_partner_financials boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text,
  add column if not exists rep_tier text,
  add column if not exists payout_method text,
  add column if not exists attribution_window_days integer,
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric,
  add column if not exists referral_path text,
  add column if not exists attribution_locked boolean not null default true,
  add column if not exists rep_channel text,
  add column if not exists custom_store_slug text,
  add column if not exists assigned_store_slug text,
  add column if not exists brand_name text,
  add column if not exists brand_id text,
  add column if not exists account_type text,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.partner_brands
set
  owner_email = 'B_dabe@yahoo.com',
  access_level = 'limited',
  capabilities = coalesce(capabilities, '{}'::jsonb) || jsonb_build_object(
    'rep_management', false,
    'rep_dashboard', false,
    'rep_creation', false,
    'referral_codes', false,
    'payouts', false
  ),
  pricing_guardrails = coalesce(pricing_guardrails, '{}'::jsonb) || jsonb_build_object(
    'commission_rate', 0.4,
    'platform_rate', 0.6,
    'basis', 'net_profit_after_true_landed_product_cost',
    'no_downstream_rep_hierarchy', true,
    'owner_account_type', 'rep'
  ),
  updated_at = now()
where brand_id = 'beastmode';

update public.checkout_scopes
set
  account_type = 'rep',
  account_id = 'BEASTMODE',
  parent_account_id = null,
  default_commission_rate = 0.4,
  notes = 'BEASTMODE owner rep scope. No downstream rep hierarchy.',
  updated_at = now()
where scope_code = 'BEASTMODE';

insert into public.reps (
  rep_slug,
  rep_name,
  handle,
  rep_identifier,
  commission_type,
  rep_tier,
  commission_rate,
  payout_email,
  payout_method,
  attribution_window_days,
  discount_code,
  discount_amount,
  referral_path,
  attribution_locked,
  rep_channel,
  custom_store_slug,
  assigned_store_slug,
  brand_name,
  brand_id,
  account_type,
  active,
  updated_at
)
values (
  'BEASTMODE',
  'Bryan',
  'BEASTMODE',
  'BEASTMODE',
  'net_profit_after_true_cost',
  'independent_store_owner',
  0.4,
  'B_dabe@yahoo.com',
  'pepscript',
  30,
  null,
  0,
  '/beastmode',
  true,
  'independent_partner_store',
  'beastmode',
  'beastmode',
  'BEASTMODE Performance Labs',
  'beastmode',
  'rep',
  true,
  now()
)
on conflict (rep_slug) do update set
  rep_name = excluded.rep_name,
  handle = excluded.handle,
  rep_identifier = excluded.rep_identifier,
  commission_type = excluded.commission_type,
  rep_tier = excluded.rep_tier,
  commission_rate = excluded.commission_rate,
  payout_email = excluded.payout_email,
  payout_method = excluded.payout_method,
  attribution_window_days = excluded.attribution_window_days,
  discount_code = excluded.discount_code,
  discount_amount = excluded.discount_amount,
  referral_path = excluded.referral_path,
  attribution_locked = excluded.attribution_locked,
  rep_channel = excluded.rep_channel,
  custom_store_slug = excluded.custom_store_slug,
  assigned_store_slug = excluded.assigned_store_slug,
  brand_name = excluded.brand_name,
  brand_id = excluded.brand_id,
  account_type = excluded.account_type,
  active = true,
  updated_at = now();

delete from public.partner_admin_brand_assignments a
using public.profiles p
where a.profile_id = p.id
  and a.brand_id = 'beastmode'
  and lower(coalesce(p.email, p.owner_email, '')) = 'b_dabe@yahoo.com';

create or replace function public.upsert_beastmode_bryan_owner_profile(
  p_auth_id uuid,
  p_email text,
  p_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bryan_email constant text := 'b_dabe@yahoo.com';
  stored_email constant text := 'B_dabe@yahoo.com';
  target_name text := coalesce(nullif(trim(p_full_name), ''), 'Bryan');
begin
  if p_auth_id is null or lower(coalesce(p_email, '')) <> bryan_email then
    return;
  end if;

  insert into public.profiles (
    id,
    auth_user_id,
    email,
    full_name,
    role,
    admin_scope,
    store_slug,
    owner_email,
    brand_id,
    partner_access_level,
    access_scope,
    global_admin,
    super_admin,
    can_view_all_brands,
    can_view_all_reps,
    can_view_all_orders,
    can_view_all_customers,
    can_edit_global_catalog,
    can_edit_global_settings,
    can_view_platform_financials,
    can_view_other_partner_financials,
    updated_at
  )
  values (
    p_auth_id,
    p_auth_id,
    stored_email,
    target_name,
    'rep',
    'BEASTMODE',
    'beastmode',
    stored_email,
    null,
    null,
    null,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    now()
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    role = 'rep',
    admin_scope = 'BEASTMODE',
    store_slug = 'beastmode',
    owner_email = excluded.owner_email,
    brand_id = null,
    partner_access_level = null,
    access_scope = null,
    global_admin = false,
    super_admin = false,
    can_view_all_brands = false,
    can_view_all_reps = false,
    can_view_all_orders = false,
    can_view_all_customers = false,
    can_edit_global_catalog = false,
    can_edit_global_settings = false,
    can_view_platform_financials = false,
    can_view_other_partner_financials = false,
    updated_at = now();

  update public.reps
  set
    profile_id = p_auth_id,
    rep_name = target_name,
    commission_rate = 0.4,
    payout_email = stored_email,
    active = true,
    updated_at = now()
  where rep_slug = 'BEASTMODE';

  delete from public.partner_admin_brand_assignments
  where profile_id = p_auth_id
    and brand_id = 'beastmode';
end;
$$;

revoke all on function public.upsert_beastmode_bryan_owner_profile(uuid, text, text) from public;

create or replace function public.ensure_beastmode_bryan_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.upsert_beastmode_bryan_owner_profile(
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Bryan')
  );
  return new;
end;
$$;

revoke all on function public.ensure_beastmode_bryan_owner_profile() from public;

drop trigger if exists ensure_beastmode_bryan_owner_profile_on_auth_user on auth.users;
create trigger ensure_beastmode_bryan_owner_profile_on_auth_user
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.ensure_beastmode_bryan_owner_profile();

do $$
declare
  auth_row record;
begin
  for auth_row in
    select id, email, raw_user_meta_data
    from auth.users
    where lower(coalesce(email, '')) = 'b_dabe@yahoo.com'
  loop
    perform public.upsert_beastmode_bryan_owner_profile(
      auth_row.id,
      auth_row.email,
      coalesce(nullif(auth_row.raw_user_meta_data ->> 'full_name', ''), 'Bryan')
    );
  end loop;
end $$;
