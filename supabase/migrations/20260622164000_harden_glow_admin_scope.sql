-- Harden Vanessa Cosio's GLOW admin scope.
-- GLOW admins are scoped partner admins, not global/platform admins.

alter table public.profiles
  add column if not exists brand_id text,
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
  add column if not exists can_view_other_partner_financials boolean not null default false;

alter table public.reps
  add column if not exists brand_id text,
  add column if not exists parent_brand_id text,
  add column if not exists assigned_store_slug text;

create index if not exists profiles_brand_id_idx on public.profiles(lower(brand_id));
create index if not exists profiles_access_scope_idx on public.profiles(lower(access_scope));
create index if not exists reps_brand_scope_idx on public.reps(lower(brand_id), lower(parent_brand_id), lower(assigned_store_slug));

create or replace function public.is_glow_scoped_admin()
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
      and p.role = 'rx_plus_admin'
      and lower(coalesce(p.email, p.owner_email, '')) = 'vanessacosio@ymail.com'
      and upper(coalesce(p.admin_scope, '')) = 'GLOW'
      and lower(coalesce(p.store_slug, '')) = 'glow'
      and lower(coalesce(p.brand_id, 'glow')) = 'glow'
      and lower(coalesce(p.access_scope, 'glow_only')) = 'glow_only'
      and coalesce(p.global_admin, false) = false
      and coalesce(p.super_admin, false) = false
      and coalesce(p.can_view_all_brands, false) = false
      and coalesce(p.can_view_all_reps, false) = false
      and coalesce(p.can_view_all_orders, false) = false
      and coalesce(p.can_view_all_customers, false) = false
      and coalesce(p.can_edit_global_catalog, false) = false
      and coalesce(p.can_edit_global_settings, false) = false
      and coalesce(p.can_view_platform_financials, false) = false
      and coalesce(p.can_view_other_partner_financials, false) = false
  );
$$;

create or replace function public.current_glow_parent_rep_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.reps r
  where r.profile_id = public.current_profile_id()
    and upper(coalesce(r.rep_slug, '')) = 'GLOW'
    and lower(coalesce(r.custom_store_slug, r.assigned_store_slug, '')) = 'glow'
  limit 1
$$;

create or replace function public.is_glow_rep_id(p_rep_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reps r
    where r.id = p_rep_id
      and not (
        upper(coalesce(r.rep_slug, '')) = any(array[
          'AACTIVATEDRX','AACTIVATED','GUY60','JUJUAN','ISAAC','ADONIS','AAMIR',
          'WENDYCREATES54','OMGBILLY','MARK65','GABE50','JERRY45','ROCKPHORM',
          'AURORA','MIKEAURORA','ALPHAPRIDE','AGPRIME','RONIN','ZENORA'
        ]::text[])
        or lower(coalesce(r.custom_store_slug, '')) = any(array[
          'aactivated','empirehealth','ehwsub','optimax','rockphorm','aurora',
          'alphapride','agprime','ronin','zenora','physiopeptides'
        ]::text[])
        or upper(coalesce(r.brand_name, '')) like '%AACTIVATED%'
        or upper(coalesce(r.brand_name, '')) like '%ROCK PHORM%'
        or upper(coalesce(r.brand_name, '')) like '%AURORA%'
        or upper(coalesce(r.brand_name, '')) like '%EMPIRE%'
        or upper(coalesce(r.brand_name, '')) like '%OPTIMAX%'
      )
      and (
        upper(coalesce(r.rep_slug, '')) in ('GLOW', 'DEAN50', 'GINTO')
        or lower(coalesce(r.brand_id, '')) = 'glow'
        or lower(coalesce(r.parent_brand_id, '')) = 'glow'
        or lower(coalesce(r.assigned_store_slug, '')) = 'glow'
        or lower(coalesce(r.custom_store_slug, '')) = 'glow'
        or (
          public.is_glow_scoped_admin()
          and r.managed_by_profile_id = public.current_profile_id()
          and r.parent_rep_id = public.current_glow_parent_rep_id()
          and r.rep_channel = 'glow_downline_rep'
        )
      )
  );
$$;

create or replace function public.is_glow_submission_id(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patient_submissions s
    where s.id = p_submission_id
      and not (
        upper(coalesce(s.checkout_scope_code, '')) in ('AACTIVATED', 'AACTIVATEDRX', 'GUY60', 'VITALITYINS')
        or lower(coalesce(s.store_slug, '')) = 'aactivated'
        or upper(coalesce(s.source_portal, '')) like '%AACTIVATED%'
        or upper(coalesce(s.source_store, '')) like '%AACTIVATED%'
        or upper(coalesce(s.store_name, '')) like '%AACTIVATED%'
        or upper(coalesce(s.source_admin, s.source_rep, s.admin_code, s.referral_code, '')) = any(array[
          'GUY60','AACTIVATED','AACTIVATEDRX','JUJUAN','ISAAC','ADONIS','AAMIR',
          'WENDYCREATES54','OMGBILLY','MARK65','GABE50','JERRY45','ROCKPHORM',
          'AURORA','MIKEAURORA'
        ]::text[])
      )
      and (
        upper(coalesce(s.checkout_scope_code, '')) = 'GLOW'
        or lower(coalesce(s.store_slug, '')) = 'glow'
        or upper(coalesce(s.source_store, '')) = 'GLOW'
        or upper(coalesce(s.source_admin, '')) = 'GLOW'
        or upper(coalesce(s.source_rep, '')) = 'GLOW'
        or upper(coalesce(s.admin_code, '')) = 'GLOW'
        or upper(coalesce(s.referral_code, '')) in ('GLOW', 'DEAN50', 'GINTO')
        or upper(coalesce(s.discount_code, '')) = 'GLOW&SAVE25'
        or (s.rep_id is not null and public.is_glow_rep_id(s.rep_id))
      )
  );
$$;

do $$
declare
  vanessa_email text := 'vanessacosio@ymail.com';
  vanessa_profile_id uuid;
  glow_rep_id uuid;
begin
  select p.id
    into vanessa_profile_id
  from public.profiles p
  where lower(coalesce(p.email, p.owner_email, '')) = vanessa_email
     or (upper(coalesce(p.admin_scope, '')) = 'GLOW' and lower(coalesce(p.store_slug, '')) = 'glow')
  order by p.updated_at desc nulls last, p.created_at desc
  limit 1;

  if vanessa_profile_id is null then
    raise notice 'Vanessa GLOW profile was not found. Skipping data ownership repair.';
    return;
  end if;

  update public.profiles
  set
    role = 'rx_plus_admin',
    admin_scope = 'GLOW',
    store_slug = 'glow',
    owner_email = vanessa_email,
    brand_id = 'glow',
    access_scope = 'glow_only',
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
  where id = vanessa_profile_id;

  update auth.users
  set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'rx_plus_admin'),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'full_name', 'Vanessa Cosio',
        'role', 'rx_plus_admin',
        'admin_scope', 'GLOW',
        'brand_id', 'glow',
        'store_slug', 'glow',
        'access_scope', 'glow_only',
        'global_admin', false,
        'super_admin', false,
        'can_view_all_brands', false,
        'can_view_all_reps', false,
        'can_view_all_orders', false,
        'can_view_all_customers', false,
        'can_edit_global_catalog', false,
        'can_edit_global_settings', false,
        'can_view_platform_financials', false,
        'can_view_other_partner_financials', false,
        'portal', '/admin',
        'storefront', '/glow'
      ),
    updated_at = now()
  where id = (select coalesce(auth_user_id, id) from public.profiles where id = vanessa_profile_id);

  select id
    into glow_rep_id
  from public.reps
  where upper(rep_slug) = 'GLOW'
  limit 1;

  update public.reps
  set
    profile_id = vanessa_profile_id,
    managed_by_profile_id = null,
    parent_rep_id = null,
    custom_store_slug = 'glow',
    brand_id = 'glow',
    parent_brand_id = null,
    assigned_store_slug = 'glow',
    brand_name = 'GLOW Sheer Radiance',
    rep_tier = 'glow_admin_distributor',
    rep_channel = 'glow_partner_admin',
    account_type = 'admin',
    parent_type = null,
    active = true,
    updated_at = now()
  where id = glow_rep_id;

  update public.reps
  set
    managed_by_profile_id = vanessa_profile_id,
    parent_rep_id = glow_rep_id,
    custom_store_slug = 'glow',
    brand_id = 'glow',
    parent_brand_id = 'glow',
    assigned_store_slug = 'glow',
    brand_name = 'GLOW Sheer Radiance',
    rep_tier = 'glow_downline_rep',
    rep_channel = 'glow_downline_rep',
    account_type = 'rep',
    parent_type = 'glow_downline',
    active = true,
    updated_at = now()
  where glow_rep_id is not null
    and upper(rep_slug) in ('DEAN50', 'GINTO');

  update public.reps
  set
    managed_by_profile_id = null,
    parent_rep_id = case when parent_rep_id = glow_rep_id then null else parent_rep_id end,
    brand_id = case when lower(coalesce(brand_id, '')) = 'glow' then null else brand_id end,
    parent_brand_id = case when lower(coalesce(parent_brand_id, '')) = 'glow' then null else parent_brand_id end,
    assigned_store_slug = case when lower(coalesce(assigned_store_slug, '')) = 'glow' then null else assigned_store_slug end,
    custom_store_slug = case when lower(coalesce(custom_store_slug, '')) = 'glow' then null else custom_store_slug end,
    updated_at = now()
  where glow_rep_id is not null
    and upper(coalesce(rep_slug, '')) = any(array[
      'AACTIVATEDRX','AACTIVATED','GUY60','JUJUAN','ISAAC','ADONIS','AAMIR',
      'WENDYCREATES54','OMGBILLY','MARK65','GABE50','JERRY45','ROCKPHORM',
      'AURORA','MIKEAURORA','ALPHAPRIDE','AGPRIME','RONIN','ZENORA'
    ]::text[])
    and (
      managed_by_profile_id = vanessa_profile_id
      or parent_rep_id = glow_rep_id
      or lower(coalesce(brand_id, parent_brand_id, assigned_store_slug, custom_store_slug, '')) = 'glow'
    );
end $$;

create or replace function public.is_aactivated_partner_ops_admin()
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
      and not public.is_glow_scoped_admin()
      and (
        public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin')
        or (
          lower(p.email) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
          and p.role = 'rx_plus_admin'
        )
      )
  );
$$;

drop policy if exists "rx plus admins read managed reps" on public.reps;
create policy "rx plus admins read managed reps"
on public.reps for select
using (
  public.current_role() = 'rx_plus_admin'
  and not public.is_glow_scoped_admin()
  and (
    managed_by_profile_id = public.current_profile_id()
    or id = public.current_rx_plus_parent_rep_id()
  )
);

drop policy if exists "rx plus admins insert managed reps" on public.reps;
create policy "rx plus admins insert managed reps"
on public.reps for insert
with check (
  public.current_role() = 'rx_plus_admin'
  and not public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and parent_rep_id = public.current_rx_plus_parent_rep_id()
  and rep_channel = 'rx_plus_downline'
);

drop policy if exists "rx plus admins update managed reps" on public.reps;
create policy "rx plus admins update managed reps"
on public.reps for update
using (
  public.current_role() = 'rx_plus_admin'
  and not public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
)
with check (
  public.current_role() = 'rx_plus_admin'
  and not public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and parent_rep_id = public.current_rx_plus_parent_rep_id()
  and rep_channel = 'rx_plus_downline'
);

drop policy if exists "rx plus glow admins read managed reps" on public.reps;
create policy "rx plus glow admins read managed reps"
on public.reps
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and public.is_glow_rep_id(id)
);

drop policy if exists "rx plus glow admins insert managed reps" on public.reps;
create policy "rx plus glow admins insert managed reps"
on public.reps
for insert
to authenticated
with check (
  public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and parent_rep_id = public.current_glow_parent_rep_id()
  and rep_channel = 'glow_downline_rep'
  and lower(coalesce(brand_id, parent_brand_id, assigned_store_slug, custom_store_slug, '')) = 'glow'
  and upper(coalesce(rep_slug, '')) <> all(array[
    'AACTIVATEDRX','AACTIVATED','GUY60','JUJUAN','ISAAC','ADONIS','AAMIR',
    'WENDYCREATES54','OMGBILLY','MARK65','GABE50','JERRY45','ROCKPHORM',
    'AURORA','MIKEAURORA','ALPHAPRIDE','AGPRIME','RONIN','ZENORA'
  ]::text[])
);

drop policy if exists "rx plus glow admins update managed reps" on public.reps;
create policy "rx plus glow admins update managed reps"
on public.reps
for update
to authenticated
using (
  public.is_glow_scoped_admin()
  and public.is_glow_rep_id(id)
  and upper(coalesce(rep_slug, '')) <> 'GLOW'
)
with check (
  public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and parent_rep_id = public.current_glow_parent_rep_id()
  and rep_channel = 'glow_downline_rep'
  and lower(coalesce(brand_id, parent_brand_id, assigned_store_slug, custom_store_slug, '')) = 'glow'
);

drop policy if exists "rx plus glow submissions scoped read" on public.patient_submissions;
create policy "rx plus glow submissions scoped read"
on public.patient_submissions
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and public.is_glow_submission_id(id)
);

drop policy if exists "rx plus glow submissions scoped update" on public.patient_submissions;
create policy "rx plus glow submissions scoped update"
on public.patient_submissions
for update
to authenticated
using (
  public.is_glow_scoped_admin()
  and public.is_glow_submission_id(id)
)
with check (
  public.is_glow_scoped_admin()
  and public.is_glow_submission_id(id)
);

drop policy if exists "rx plus glow ledger scoped read" on public.commission_ledger;
create policy "rx plus glow ledger scoped read"
on public.commission_ledger
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    public.is_glow_rep_id(rep_id)
    or public.is_glow_submission_id(submission_id)
  )
);

drop policy if exists "rx plus glow checkout scopes read" on public.checkout_scopes;
create policy "rx plus glow checkout scopes read"
on public.checkout_scopes
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and upper(scope_code) = 'GLOW'
);

drop policy if exists "rx plus aactivated submissions scoped read" on public.patient_submissions;
create policy "rx plus aactivated submissions scoped read"
on public.patient_submissions
for select
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '')) like '%AACTIVATED%'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
);

drop policy if exists "rx plus aactivated submissions scoped update" on public.patient_submissions;
create policy "rx plus aactivated submissions scoped update"
on public.patient_submissions
for update
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
)
with check (
  public.is_aactivated_partner_ops_admin()
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
);

drop policy if exists "rx plus aactivated ledger scoped read" on public.commission_ledger;
create policy "rx plus aactivated ledger scoped read"
on public.commission_ledger
for select
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    exists (
      select 1
      from public.reps r
      where r.id = commission_ledger.rep_id
        and (
          r.rep_slug = 'GUY60'
          or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
          or r.managed_by_profile_id = public.current_profile_id()
          or lower(coalesce(r.payout_email, '')) in ('guy@aactivated.com', 'bossiquitinc@gmail.com')
          or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
        )
    )
    or exists (
      select 1
      from public.patient_submissions s
      where s.id = commission_ledger.submission_id
        and (
          s.checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
          or lower(coalesce(s.store_slug, '')) = 'aactivated'
          or coalesce(s.source_admin, s.source_rep, s.admin_code, s.referral_code) = 'GUY60'
        )
    )
  )
);

drop policy if exists "rx plus aactivated checkout scopes read" on public.checkout_scopes;
create policy "rx plus aactivated checkout scopes read"
on public.checkout_scopes
for select
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and (
    scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or parent_account_id = 'GUY60'
    or exists (
      select 1
      from public.reps r
      where r.rep_slug = checkout_scopes.account_id
        and lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
    )
  )
);

drop policy if exists "rx plus manage aactivated store settings" on public.partner_store_settings;
create policy "rx plus manage aactivated store settings"
on public.partner_store_settings
for all
to authenticated
using (
  public.is_aactivated_partner_ops_admin()
  and store_slug = 'aactivated'
)
with check (
  public.is_aactivated_partner_ops_admin()
  and store_slug = 'aactivated'
);

drop policy if exists "admin_manage_aactivated_promo_links" on public.aactivated_promo_links;
create policy "admin_manage_aactivated_promo_links"
on public.aactivated_promo_links
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
);

drop policy if exists "admin_read_portal_age_leads" on public.portal_age_lead_captures;
create policy "admin_read_portal_age_leads"
on public.portal_age_lead_captures
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
);

drop policy if exists "glow_read_portal_age_leads" on public.portal_age_lead_captures;
create policy "glow_read_portal_age_leads"
on public.portal_age_lead_captures
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    lower(coalesce(portal_id, '')) = 'glow'
    or lower(coalesce(portal_path, path, '')) like '%/glow%'
    or upper(coalesce(discount_code, '')) = 'GLOW&SAVE25'
  )
);

drop policy if exists "admin_read_abandoned_leads" on public.abandoned_leads;
create policy "admin_read_abandoned_leads"
on public.abandoned_leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
);

drop policy if exists "admin_update_abandoned_leads" on public.abandoned_leads;
create policy "admin_update_abandoned_leads"
on public.abandoned_leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.role in ('admin', 'rx_plus_admin')
      and not public.is_glow_scoped_admin()
  )
);

drop policy if exists "glow_read_abandoned_leads" on public.abandoned_leads;
create policy "glow_read_abandoned_leads"
on public.abandoned_leads
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    upper(coalesce(source_scope, checkout_scope_code, '')) = 'GLOW'
    or lower(coalesce(source_portal, source_route, source_path, '')) like '%glow%'
    or upper(coalesce(rep_code, '')) in ('GLOW', 'DEAN50', 'GINTO')
    or upper(coalesce(discount_code, '')) = 'GLOW&SAVE25'
  )
);

drop policy if exists "Admins and rx plus admins manage rx plus products" on public.rx_plus_products;
create policy "Admins and rx plus admins manage rx plus products"
on public.rx_plus_products
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        p.role = 'admin'
        or (p.role = 'rx_plus_admin' and not public.is_glow_scoped_admin())
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        p.role = 'admin'
        or (p.role = 'rx_plus_admin' and not public.is_glow_scoped_admin())
      )
  )
);

drop policy if exists "Admins and rx plus admins manage distributor products" on public.distributor_products;
create policy "Admins and rx plus admins manage distributor products"
on public.distributor_products
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        p.role = 'admin'
        or (p.role = 'rx_plus_admin' and not public.is_glow_scoped_admin())
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and (
        p.role = 'admin'
        or (p.role = 'rx_plus_admin' and not public.is_glow_scoped_admin())
      )
  )
);

drop policy if exists "glow admins manage glow distributor products" on public.distributor_products;
create policy "glow admins manage glow distributor products"
on public.distributor_products
for all
to authenticated
using (
  public.is_glow_scoped_admin()
  and exists (
    select 1
    from public.distributors d
    where d.id = distributor_products.distributor_id
      and d.slug = 'glow'
  )
)
with check (
  public.is_glow_scoped_admin()
  and exists (
    select 1
    from public.distributors d
    where d.id = distributor_products.distributor_id
      and d.slug = 'glow'
  )
);

grant execute on function public.is_glow_scoped_admin() to authenticated;
grant execute on function public.current_glow_parent_rep_id() to authenticated;
grant execute on function public.is_glow_rep_id(uuid) to authenticated;
grant execute on function public.is_glow_submission_id(uuid) to authenticated;
