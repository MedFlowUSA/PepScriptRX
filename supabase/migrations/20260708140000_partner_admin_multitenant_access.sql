-- True multi-tenant partner admin foundation.
-- Partner admins are scoped by brand_id/store_slug. Platform admins retain
-- global access; partner admins never receive global cost, payout setting, or
-- payment credential permissions through these policies.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'patient', 'customer', 'client',
    'rep', 'representative', 'affiliate',
    'physician', 'fulfillment',
    'admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited',
    'distributor', 'owner', 'platform_admin', 'master_admin', 'super_admin'
  ));

alter table public.profiles
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
  add column if not exists brand_id text,
  add column if not exists parent_brand_id text,
  add column if not exists assigned_store_slug text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.patient_submissions
  add column if not exists brand_id text;

alter table public.partner_store_settings
  add column if not exists brand_id text,
  add column if not exists status text not null default 'active',
  add column if not exists custom_url text,
  add column if not exists colors jsonb not null default '{}'::jsonb,
  add column if not exists hero_text text,
  add column if not exists logo_url text;

alter table public.partner_rep_commission_settings
  add column if not exists brand_id text,
  add column if not exists rep_name text,
  add column if not exists commission_basis text not null default 'net_profit_after_true_cost',
  add column if not exists parent_override_percent numeric(5,2),
  add column if not exists platform_percent numeric(5,2),
  add column if not exists status text not null default 'active';

alter table public.partner_product_lists
  add column if not exists brand_id text;

alter table public.partner_product_list_items
  add column if not exists brand_id text;

alter table public.partner_rep_store_settings
  add column if not exists brand_id text;

alter table public.partner_feature_requests
  add column if not exists brand_id text;

alter table public.partner_rep_setup_audit
  add column if not exists brand_id text;

create index if not exists profiles_partner_scope_idx
  on public.profiles(lower(coalesce(brand_id, '')), lower(coalesce(store_slug, '')), lower(coalesce(admin_scope, '')));

create index if not exists reps_partner_scope_idx
  on public.reps(lower(coalesce(brand_id, '')), lower(coalesce(parent_brand_id, '')), lower(coalesce(assigned_store_slug, custom_store_slug, '')));

create index if not exists patient_submissions_partner_scope_idx
  on public.patient_submissions(lower(coalesce(brand_id, '')), lower(coalesce(store_slug, '')), upper(coalesce(checkout_scope_code, '')));

create table if not exists public.partner_brands (
  brand_id text primary key,
  store_slug text not null unique,
  store_name text not null,
  scope_code text not null unique,
  owner_email text,
  access_level text not null default 'limited' check (access_level in ('full', 'limited')),
  logo_url text,
  colors jsonb not null default '{}'::jsonb,
  hero_text text,
  custom_url text,
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  capabilities jsonb not null default '{}'::jsonb,
  pricing_guardrails jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_admin_brand_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  brand_id text not null references public.partner_brands(brand_id) on delete cascade,
  access_level text not null check (access_level in ('full', 'limited')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  unique (profile_id, brand_id)
);

create table if not exists public.partner_marketing_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null references public.partner_brands(brand_id) on delete cascade,
  store_slug text not null,
  asset_name text not null,
  asset_type text not null default 'asset',
  storage_path text not null,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_marketing_links (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null references public.partner_brands(brand_id) on delete cascade,
  store_slug text not null,
  link_label text not null,
  link_url text not null,
  discount_code text,
  rep_id uuid references public.reps(id) on delete set null,
  qr_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  brand_id text,
  store_slug text,
  actor_profile_id uuid,
  actor_email text,
  action text not null,
  target_table text,
  target_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.partner_brands enable row level security;
alter table public.partner_admin_brand_assignments enable row level security;
alter table public.partner_marketing_assets enable row level security;
alter table public.partner_marketing_links enable row level security;
alter table public.partner_admin_audit_log enable row level security;

grant select, insert, update on public.partner_brands to authenticated;
grant select, insert, update on public.partner_admin_brand_assignments to authenticated;
grant select, insert, update, delete on public.partner_marketing_assets to authenticated;
grant select, insert, update, delete on public.partner_marketing_links to authenticated;
grant select, insert on public.partner_admin_audit_log to authenticated;

insert into public.partner_brands (
  brand_id,
  store_slug,
  store_name,
  scope_code,
  owner_email,
  access_level,
  logo_url,
  colors,
  hero_text,
  custom_url,
  status,
  capabilities,
  pricing_guardrails
)
values
  (
    'aactivated',
    'aactivated',
    'AACTIVATED RX',
    'AACTIVATEDRX',
    'guy@aactivated.com',
    'full',
    '/marketing/aactivated-rx-logo-v2.png',
    jsonb_build_object('primary', '#0f766e', 'accent', '#14b8a6', 'background', '#ffffff'),
    'AACTIVATED RX partner storefront.',
    '/AACTIVATED',
    'active',
    jsonb_build_object(
      'storefront', true,
      'products', true,
      'pricing_overrides', true,
      'discount_codes', true,
      'rep_management', true,
      'team_overrides', true,
      'orders_customers', true,
      'payouts', true,
      'marketing', true
    ),
    jsonb_build_object('min_margin_percent', 20, 'max_discount_percent', 35)
  ),
  (
    'aurora',
    'aurora',
    'Aurora Labs',
    'AURORA',
    'mnsgroup107@gmail.com',
    'limited',
    '/marketing/aurora-logo.png',
    jsonb_build_object('primary', '#0891b2', 'accent', '#10b981', 'background', '#ffffff'),
    'Aurora Labs partner storefront.',
    '/aurora',
    'active',
    jsonb_build_object(
      'storefront', false,
      'products', false,
      'pricing_overrides', false,
      'discount_codes', false,
      'rep_management', true,
      'team_overrides', false,
      'orders_customers', true,
      'payouts', true,
      'marketing', true
    ),
    jsonb_build_object('pricing_locked_to_platform', true)
  ),
  ('glow', 'glow', 'GLOW Sheer Radiance', 'GLOW', 'vanessacosio@ymail.com', 'limited', '/brands/glow/glow-peptide-complex.png', '{}'::jsonb, null, '/glow', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('ginto', 'ginto', 'Ginto Wellness Labs', 'GINTO', null, 'limited', '/brands/ginto/ginto-logo.png', '{}'::jsonb, null, '/ginto', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('rockphorm', 'rockphorm', 'Rock Phorm', 'ROCKPHORM', 'rick@blueprintadvocate.io', 'full', '/marketing/rockphorm-logo.png', '{}'::jsonb, null, '/rockphorm', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('empirehealth', 'empirehealth', 'Empire Health & Wellness', 'EMPIREHEALTH', null, 'limited', '/marketing/empire-health-wellness-logo.png', '{}'::jsonb, null, '/EmpireHealth&Wellness', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('ronin', 'ronin', 'Ronin', 'RONIN', null, 'limited', '/marketing/ronin-logo.png', '{}'::jsonb, null, '/ronin', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('alphapride', 'alphapride', 'Alpha Pride', 'ALPHAPRIDE', null, 'limited', '/marketing/alphapride-logo-readable.png', '{}'::jsonb, null, '/alphapride', 'inactive', '{}'::jsonb, '{}'::jsonb),
  ('beastmode', 'beastmode', 'BeastMode', 'BEASTMODE', null, 'limited', null, '{}'::jsonb, null, null, 'inactive', '{}'::jsonb, '{}'::jsonb)
on conflict (brand_id) do update set
  store_slug = excluded.store_slug,
  store_name = excluded.store_name,
  scope_code = excluded.scope_code,
  owner_email = excluded.owner_email,
  access_level = excluded.access_level,
  logo_url = excluded.logo_url,
  colors = excluded.colors,
  hero_text = excluded.hero_text,
  custom_url = excluded.custom_url,
  status = excluded.status,
  capabilities = excluded.capabilities,
  pricing_guardrails = excluded.pricing_guardrails,
  updated_at = now();

update public.profiles
set
  role = 'partner_admin_full',
  brand_id = 'aactivated',
  partner_access_level = 'full',
  access_scope = 'brand_only',
  admin_scope = 'AACTIVATEDRX',
  store_slug = 'aactivated',
  owner_email = coalesce(owner_email, email),
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
  updated_at = now()
where lower(coalesce(email, owner_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
   or (upper(coalesce(admin_scope, '')) in ('AACTIVATED', 'AACTIVATEDRX') and lower(coalesce(store_slug, '')) = 'aactivated');

update public.profiles
set
  role = 'partner_admin_limited',
  brand_id = 'aurora',
  partner_access_level = 'limited',
  access_scope = 'brand_only',
  admin_scope = 'AURORA',
  store_slug = 'aurora',
  owner_email = 'mnsgroup107@gmail.com',
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
  updated_at = now()
where lower(coalesce(email, owner_email, '')) in ('mnsgroup107@gmail.com', 'msngroup107@gmail.com')
   or (upper(coalesce(admin_scope, '')) = 'AURORA' and lower(coalesce(store_slug, '')) = 'aurora');

insert into public.partner_admin_brand_assignments (profile_id, brand_id, access_level, status)
select id, brand_id, partner_access_level, 'active'
from public.profiles
where brand_id in ('aactivated', 'aurora')
  and partner_access_level in ('full', 'limited')
on conflict (profile_id, brand_id) do update set
  access_level = excluded.access_level,
  status = 'active';

update public.reps
set
  brand_id = 'aactivated',
  parent_brand_id = nullif(parent_brand_id, ''),
  assigned_store_slug = 'aactivated',
  custom_store_slug = coalesce(custom_store_slug, 'aactivated'),
  updated_at = now()
where upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX')
   or lower(coalesce(custom_store_slug, '')) = 'aactivated'
   or upper(coalesce(brand_name, '')) like '%AACTIVATED%';

update public.reps
set
  brand_id = 'aurora',
  parent_brand_id = coalesce(nullif(parent_brand_id, ''), 'aurora'),
  assigned_store_slug = 'aurora',
  custom_store_slug = coalesce(custom_store_slug, 'aurora'),
  updated_at = now()
where upper(coalesce(rep_slug, '')) in ('AURORA', 'MIKEAURORA', 'AURORAJL', 'MEGDEL', 'D026FIR', 'AURORAET', 'AURORATO', 'AURORAGE')
   or lower(coalesce(custom_store_slug, '')) = 'aurora'
   or upper(coalesce(brand_name, '')) like '%AURORA%';

update public.patient_submissions
set brand_id = 'aactivated'
where brand_id is null
  and (
    upper(coalesce(checkout_scope_code, '')) in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '')) like '%AACTIVATED%'
  );

update public.patient_submissions
set brand_id = 'aurora'
where brand_id is null
  and (
    upper(coalesce(checkout_scope_code, '')) = 'AURORA'
    or lower(coalesce(store_slug, '')) = 'aurora'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '')) like '%AURORA%'
  );

update public.partner_store_settings set brand_id = 'aactivated' where lower(store_slug) = 'aactivated' and brand_id is null;
update public.partner_rep_commission_settings set brand_id = lower(store_scope) where brand_id is null and lower(store_scope) in ('aactivated', 'aurora', 'glow');
update public.partner_rep_commission_settings set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';
update public.partner_product_lists set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';
update public.partner_product_list_items set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';
update public.partner_rep_store_settings set brand_id = lower(store_scope) where brand_id is null and lower(store_scope) in ('aactivated', 'aurora', 'glow');
update public.partner_rep_store_settings set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';
update public.partner_feature_requests set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';
update public.partner_rep_setup_audit set brand_id = 'aactivated' where brand_id is null and upper(store_scope) = 'AACTIVATEDRX';

insert into storage.buckets (id, name, public)
values ('partner-marketing-assets', 'partner-marketing-assets', true)
on conflict (id) do update set public = true;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and lower(coalesce(p.role, '')) in ('admin', 'owner', 'platform_admin', 'master_admin', 'super_admin')
      and nullif(trim(coalesce(p.brand_id, '')), '') is null
      and nullif(trim(coalesce(p.store_slug, '')), '') is null
      and nullif(trim(coalesce(p.admin_scope, '')), '') is null
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(coalesce(p.role, '')) in ('admin', 'owner', 'platform_admin', 'master_admin', 'super_admin')
      and nullif(trim(coalesce(p.brand_id, '')), '') is null
      and nullif(trim(coalesce(p.store_slug, '')), '') is null
      and nullif(trim(coalesce(p.admin_scope, '')), '') is null
      then 'admin'
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid() or p.auth_user_id = auth.uid()
  order by case when p.auth_user_id = auth.uid() then 0 else 1 end, p.created_at desc
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
$$;

create or replace function public.current_partner_brand_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.brand_id
      from public.partner_admin_brand_assignments a
      join public.profiles p on p.id = a.profile_id
      where (p.id = auth.uid() or p.auth_user_id = auth.uid())
        and a.status = 'active'
      order by a.assigned_at desc
      limit 1
    ),
    (
      select lower(nullif(trim(p.brand_id), ''))
      from public.profiles p
      where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      limit 1
    ),
    (
      select b.brand_id
      from public.profiles p
      join public.partner_brands b
        on lower(coalesce(p.store_slug, '')) = lower(b.store_slug)
        or upper(coalesce(p.admin_scope, '')) = upper(b.scope_code)
        or lower(coalesce(p.owner_email, p.email, '')) = lower(coalesce(b.owner_email, ''))
      where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      limit 1
    )
  )
$$;

create or replace function public.current_partner_access_level()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then 'platform'
    else coalesce(
      (
        select a.access_level
        from public.partner_admin_brand_assignments a
        join public.profiles p on p.id = a.profile_id
        where (p.id = auth.uid() or p.auth_user_id = auth.uid())
          and a.status = 'active'
        order by a.assigned_at desc
        limit 1
      ),
      (
        select case
          when p.role = 'partner_admin_full' or p.partner_access_level = 'full' or p.role = 'rx_plus_admin' then 'full'
          when p.role = 'partner_admin_limited' or p.partner_access_level = 'limited' then 'limited'
          else null
        end
        from public.profiles p
        where (p.id = auth.uid() or p.auth_user_id = auth.uid())
        limit 1
      )
    )
  end
$$;

create or replace function public.is_partner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_partner_access_level() in ('full', 'limited')
     and public.current_partner_brand_id() is not null
$$;

create or replace function public.partner_has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.partner_brands b
      where b.brand_id = public.current_partner_brand_id()
        and b.status = 'active'
        and coalesce((b.capabilities ->> p_capability)::boolean, false)
    )
$$;

create or replace function public.is_current_partner_brand(p_brand_id text, p_store_slug text default null, p_scope_code text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.is_partner_admin()
      and (
        lower(coalesce(p_brand_id, '')) = public.current_partner_brand_id()
        or lower(coalesce(p_store_slug, '')) = (
          select lower(store_slug) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
        or upper(coalesce(p_scope_code, '')) = (
          select upper(scope_code) from public.partner_brands where brand_id = public.current_partner_brand_id()
        )
      )
    )
$$;

create or replace function public.is_partner_rep_id(p_rep_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.reps r
      join public.partner_brands b on b.brand_id = public.current_partner_brand_id()
      where r.id = p_rep_id
        and (
          lower(coalesce(r.brand_id, '')) = b.brand_id
          or lower(coalesce(r.parent_brand_id, '')) = b.brand_id
          or lower(coalesce(r.assigned_store_slug, r.custom_store_slug, '')) = lower(b.store_slug)
          or upper(coalesce(r.rep_slug, '')) = upper(b.scope_code)
          or upper(coalesce(r.brand_name, '')) like '%' || upper(b.store_name) || '%'
        )
    )
$$;

create or replace function public.is_partner_submission_id(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.patient_submissions s
      join public.partner_brands b on b.brand_id = public.current_partner_brand_id()
      where s.id = p_submission_id
        and (
          lower(coalesce(s.brand_id, '')) = b.brand_id
          or lower(coalesce(s.store_slug, '')) = lower(b.store_slug)
          or upper(coalesce(s.checkout_scope_code, '')) = upper(b.scope_code)
          or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '')) like '%' || upper(b.scope_code) || '%'
          or (s.rep_id is not null and public.is_partner_rep_id(s.rep_id))
        )
    )
$$;

create or replace function public.audit_partner_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor record;
  row_brand text;
  row_store text;
begin
  select id, email into actor
  from public.profiles
  where id = public.current_profile_id()
  limit 1;

  row_brand := coalesce(to_jsonb(new)->>'brand_id', to_jsonb(old)->>'brand_id', public.current_partner_brand_id());
  row_store := coalesce(to_jsonb(new)->>'store_slug', to_jsonb(old)->>'store_slug');

  insert into public.partner_admin_audit_log (
    brand_id,
    store_slug,
    actor_profile_id,
    actor_email,
    action,
    target_table,
    target_id,
    old_value,
    new_value
  )
  values (
    row_brand,
    row_store,
    actor.id,
    actor.email,
    tg_op,
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_partner_store_settings_changes on public.partner_store_settings;
create trigger audit_partner_store_settings_changes
after insert or update or delete on public.partner_store_settings
for each row execute function public.audit_partner_admin_change();

drop trigger if exists audit_partner_rep_commission_changes on public.partner_rep_commission_settings;
create trigger audit_partner_rep_commission_changes
after insert or update or delete on public.partner_rep_commission_settings
for each row execute function public.audit_partner_admin_change();

drop trigger if exists audit_partner_rep_store_changes on public.partner_rep_store_settings;
create trigger audit_partner_rep_store_changes
after insert or update or delete on public.partner_rep_store_settings
for each row execute function public.audit_partner_admin_change();

drop trigger if exists audit_partner_marketing_asset_changes on public.partner_marketing_assets;
create trigger audit_partner_marketing_asset_changes
after insert or update or delete on public.partner_marketing_assets
for each row execute function public.audit_partner_admin_change();

drop trigger if exists audit_partner_marketing_link_changes on public.partner_marketing_links;
create trigger audit_partner_marketing_link_changes
after insert or update or delete on public.partner_marketing_links
for each row execute function public.audit_partner_admin_change();

create or replace function public.is_aactivated_partner_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.current_partner_brand_id() = 'aactivated'
      and public.current_partner_access_level() = 'full'
    )
$$;

create or replace function public.is_aactivated_price_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.current_partner_brand_id() = 'aactivated'
      and public.current_partner_access_level() = 'full'
    )
$$;

drop policy if exists "platform admins manage partner brands" on public.partner_brands;
create policy "platform admins manage partner brands"
on public.partner_brands
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "partner admins read own brand" on public.partner_brands;
create policy "partner admins read own brand"
on public.partner_brands
for select
to authenticated
using (brand_id = public.current_partner_brand_id());

drop policy if exists "platform admins manage partner assignments" on public.partner_admin_brand_assignments;
create policy "platform admins manage partner assignments"
on public.partner_admin_brand_assignments
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "partner admins read own assignments" on public.partner_admin_brand_assignments;
create policy "partner admins read own assignments"
on public.partner_admin_brand_assignments
for select
to authenticated
using (profile_id = public.current_profile_id());

drop policy if exists "partner admins read brand profiles" on public.profiles;
create policy "partner admins read brand profiles"
on public.profiles
for select
to authenticated
using (
  public.is_platform_admin()
  or id = public.current_profile_id()
  or (
    public.partner_has_capability('rep_management')
    and lower(coalesce(brand_id, '')) = public.current_partner_brand_id()
  )
);

drop policy if exists "partner admins read scoped reps" on public.reps;
create policy "partner admins read scoped reps"
on public.reps
for select
to authenticated
using (
  public.partner_has_capability('rep_management')
  and public.is_partner_rep_id(id)
);

drop policy if exists "partner admins insert scoped reps" on public.reps;
create policy "partner admins insert scoped reps"
on public.reps
for insert
to authenticated
with check (
  public.partner_has_capability('rep_management')
  and lower(coalesce(brand_id, parent_brand_id, assigned_store_slug, custom_store_slug, '')) = public.current_partner_brand_id()
);

drop policy if exists "partner admins update scoped reps" on public.reps;
create policy "partner admins update scoped reps"
on public.reps
for update
to authenticated
using (
  public.partner_has_capability('rep_management')
  and public.is_partner_rep_id(id)
)
with check (
  public.partner_has_capability('rep_management')
  and (
    public.is_partner_rep_id(id)
    or lower(coalesce(brand_id, parent_brand_id, assigned_store_slug, custom_store_slug, '')) = public.current_partner_brand_id()
  )
);

drop policy if exists "partner admins read scoped submissions" on public.patient_submissions;
create policy "partner admins read scoped submissions"
on public.patient_submissions
for select
to authenticated
using (
  public.partner_has_capability('orders_customers')
  and public.is_partner_submission_id(id)
);

drop policy if exists "partner admins read scoped ledger" on public.commission_ledger;
create policy "partner admins read scoped ledger"
on public.commission_ledger
for select
to authenticated
using (
  public.partner_has_capability('payouts')
  and (
    public.is_partner_rep_id(rep_id)
    or public.is_partner_submission_id(submission_id)
  )
);

drop policy if exists "platform admins manage checkout scopes" on public.checkout_scopes;
create policy "platform admins manage checkout scopes"
on public.checkout_scopes
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "partner admins read scoped checkout scopes" on public.checkout_scopes;
create policy "partner admins read scoped checkout scopes"
on public.checkout_scopes
for select
to authenticated
using (
  public.partner_has_capability('rep_management')
  and exists (
    select 1
    from public.partner_brands b
    where b.brand_id = public.current_partner_brand_id()
      and (
        upper(checkout_scopes.scope_code) = upper(b.scope_code)
        or upper(coalesce(checkout_scopes.parent_account_id, '')) = upper(b.scope_code)
        or exists (
          select 1
          from public.reps r
          where upper(r.rep_slug) = upper(checkout_scopes.account_id)
            and public.is_partner_rep_id(r.id)
        )
      )
  )
);

drop policy if exists "partner admins manage scoped checkout scopes" on public.checkout_scopes;
create policy "partner admins manage scoped checkout scopes"
on public.checkout_scopes
for all
to authenticated
using (
  public.partner_has_capability('rep_management')
  and exists (
    select 1
    from public.partner_brands b
    where b.brand_id = public.current_partner_brand_id()
      and (
        upper(checkout_scopes.scope_code) = upper(b.scope_code)
        or upper(coalesce(checkout_scopes.parent_account_id, '')) = upper(b.scope_code)
        or exists (
          select 1
          from public.reps r
          where upper(r.rep_slug) = upper(checkout_scopes.account_id)
            and public.is_partner_rep_id(r.id)
        )
      )
  )
)
with check (
  public.partner_has_capability('rep_management')
  and exists (
    select 1
    from public.partner_brands b
    where b.brand_id = public.current_partner_brand_id()
      and (
        upper(coalesce(checkout_scopes.parent_account_id, '')) = upper(b.scope_code)
        or upper(coalesce(checkout_scopes.account_id, '')) = upper(b.scope_code)
        or exists (
          select 1
          from public.reps r
          where upper(r.rep_slug) = upper(checkout_scopes.account_id)
            and public.is_partner_rep_id(r.id)
        )
      )
  )
);

drop policy if exists "partner admins read scoped store settings" on public.partner_store_settings;
create policy "partner admins read scoped store settings"
on public.partner_store_settings
for select
to authenticated
using (
  public.is_current_partner_brand(brand_id, store_slug, null)
);

drop policy if exists "platform admins manage partner store settings" on public.partner_store_settings;
create policy "platform admins manage partner store settings"
on public.partner_store_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage partner commission settings" on public.partner_rep_commission_settings;
create policy "platform admins manage partner commission settings"
on public.partner_rep_commission_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage partner product lists" on public.partner_product_lists;
create policy "platform admins manage partner product lists"
on public.partner_product_lists
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage partner product list items" on public.partner_product_list_items;
create policy "platform admins manage partner product list items"
on public.partner_product_list_items
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage partner rep stores" on public.partner_rep_store_settings;
create policy "platform admins manage partner rep stores"
on public.partner_rep_store_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage partner feature requests" on public.partner_feature_requests;
create policy "platform admins manage partner feature requests"
on public.partner_feature_requests
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "full partner admins manage scoped store settings" on public.partner_store_settings;
create policy "full partner admins manage scoped store settings"
on public.partner_store_settings
for all
to authenticated
using (
  public.partner_has_capability('storefront')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, store_slug, null)
)
with check (
  public.partner_has_capability('storefront')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, store_slug, null)
);

drop policy if exists "partner admins manage scoped commission settings" on public.partner_rep_commission_settings;
create policy "partner admins manage scoped commission settings"
on public.partner_rep_commission_settings
for all
to authenticated
using (
  public.partner_has_capability('rep_management')
  and public.is_current_partner_brand(brand_id, null, store_scope)
)
with check (
  public.partner_has_capability('rep_management')
  and public.is_current_partner_brand(brand_id, null, store_scope)
  and coalesce(commission_percent, 0) between 0 and 70
);

drop policy if exists "full partner admins manage product lists" on public.partner_product_lists;
create policy "full partner admins manage product lists"
on public.partner_product_lists
for all
to authenticated
using (
  public.partner_has_capability('products')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, null, store_scope)
)
with check (
  public.partner_has_capability('products')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, null, store_scope)
);

drop policy if exists "full partner admins manage product list items" on public.partner_product_list_items;
create policy "full partner admins manage product list items"
on public.partner_product_list_items
for all
to authenticated
using (
  public.partner_has_capability('products')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, null, store_scope)
)
with check (
  public.partner_has_capability('products')
  and public.current_partner_access_level() = 'full'
  and public.is_current_partner_brand(brand_id, null, store_scope)
);

drop policy if exists "partner admins manage rep stores" on public.partner_rep_store_settings;
create policy "partner admins manage rep stores"
on public.partner_rep_store_settings
for all
to authenticated
using (
  public.partner_has_capability('rep_management')
  and public.is_current_partner_brand(brand_id, store_slug, store_scope)
)
with check (
  public.partner_has_capability('rep_management')
  and public.is_current_partner_brand(brand_id, store_slug, store_scope)
);

drop policy if exists "partner admins manage feature requests" on public.partner_feature_requests;
create policy "partner admins manage feature requests"
on public.partner_feature_requests
for all
to authenticated
using (
  public.is_current_partner_brand(brand_id, null, store_scope)
)
with check (
  public.is_current_partner_brand(brand_id, null, store_scope)
);

drop policy if exists "partner admins read setup audit" on public.partner_rep_setup_audit;
create policy "partner admins read setup audit"
on public.partner_rep_setup_audit
for select
to authenticated
using (
  public.is_current_partner_brand(brand_id, null, store_scope)
);

drop policy if exists "partner admins insert setup audit" on public.partner_rep_setup_audit;
create policy "partner admins insert setup audit"
on public.partner_rep_setup_audit
for insert
to authenticated
with check (
  public.is_current_partner_brand(brand_id, null, store_scope)
);

drop policy if exists "full aactivated admins manage aactivated prices" on public.aactivated_store_product_prices;
create policy "full aactivated admins manage aactivated prices"
on public.aactivated_store_product_prices
for all
to authenticated
using (
  public.is_platform_admin()
  or (
    public.current_partner_brand_id() = 'aactivated'
    and public.current_partner_access_level() = 'full'
    and store_slug = 'aactivated'
  )
)
with check (
  public.is_platform_admin()
  or (
    public.current_partner_brand_id() = 'aactivated'
    and public.current_partner_access_level() = 'full'
    and store_slug = 'aactivated'
  )
);

drop policy if exists "partner admins manage marketing assets" on public.partner_marketing_assets;
create policy "partner admins manage marketing assets"
on public.partner_marketing_assets
for all
to authenticated
using (
  public.partner_has_capability('marketing')
  and public.is_current_partner_brand(brand_id, store_slug, null)
)
with check (
  public.partner_has_capability('marketing')
  and public.is_current_partner_brand(brand_id, store_slug, null)
);

drop policy if exists "partner admins manage marketing links" on public.partner_marketing_links;
create policy "partner admins manage marketing links"
on public.partner_marketing_links
for all
to authenticated
using (
  public.partner_has_capability('marketing')
  and public.is_current_partner_brand(brand_id, store_slug, null)
)
with check (
  public.partner_has_capability('marketing')
  and public.is_current_partner_brand(brand_id, store_slug, null)
);

drop policy if exists "platform admins read partner audit" on public.partner_admin_audit_log;
create policy "platform admins read partner audit"
on public.partner_admin_audit_log
for select
to authenticated
using (
  public.is_platform_admin()
  or lower(coalesce(brand_id, '')) = public.current_partner_brand_id()
);

drop policy if exists "partner admins insert partner audit" on public.partner_admin_audit_log;
create policy "partner admins insert partner audit"
on public.partner_admin_audit_log
for insert
to authenticated
with check (
  public.is_platform_admin()
  or lower(coalesce(brand_id, '')) = public.current_partner_brand_id()
);

drop policy if exists "partner marketing assets scoped upload" on storage.objects;
create policy "partner marketing assets scoped upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'partner-marketing-assets'
  and (
    public.is_platform_admin()
    or (
      public.partner_has_capability('marketing')
      and split_part(name, '/', 1) = public.current_partner_brand_id()
    )
  )
);

drop policy if exists "partner marketing assets scoped read" on storage.objects;
create policy "partner marketing assets scoped read"
on storage.objects
for select
to authenticated, anon
using (
  bucket_id = 'partner-marketing-assets'
);

drop policy if exists "partner marketing assets scoped update" on storage.objects;
create policy "partner marketing assets scoped update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'partner-marketing-assets'
  and (
    public.is_platform_admin()
    or (
      public.partner_has_capability('marketing')
      and split_part(name, '/', 1) = public.current_partner_brand_id()
    )
  )
)
with check (
  bucket_id = 'partner-marketing-assets'
  and (
    public.is_platform_admin()
    or (
      public.partner_has_capability('marketing')
      and split_part(name, '/', 1) = public.current_partner_brand_id()
    )
  )
);

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_partner_brand_id() to authenticated;
grant execute on function public.current_partner_access_level() to authenticated;
grant execute on function public.is_partner_admin() to authenticated;
grant execute on function public.partner_has_capability(text) to authenticated;
grant execute on function public.is_current_partner_brand(text, text, text) to authenticated;
grant execute on function public.is_partner_rep_id(uuid) to authenticated;
grant execute on function public.is_partner_submission_id(uuid) to authenticated;
