-- Scope Vanessa Cosio's GLOW admin to GLOW-owned records instead of platform-wide admin data.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists updated_at timestamptz not null default now();

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
      and (
        upper(coalesce(p.admin_scope, '')) = 'GLOW'
        or lower(coalesce(p.store_slug, '')) = 'glow'
        or lower(coalesce(p.owner_email, p.email, '')) = 'vanessacosio@ymail.com'
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
     or upper(coalesce(p.admin_scope, '')) = 'GLOW'
     or lower(coalesce(p.store_slug, '')) = 'glow'
  order by p.updated_at desc nulls last, p.created_at desc
  limit 1;

  if vanessa_profile_id is null then
    select u.id
      into vanessa_profile_id
    from auth.users u
    where lower(coalesce(u.email, '')) = vanessa_email
    order by u.created_at desc
    limit 1;
  end if;

  if vanessa_profile_id is null then
    raise notice 'Vanessa GLOW profile/auth user was not found. Skipping GLOW scope tightening.';
    return;
  end if;

  update auth.users
  set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'rx_plus_admin'),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'full_name', 'Vanessa Cosio',
        'role', 'rx_plus_admin',
        'admin_scope', 'GLOW',
        'store_scope', 'GLOW',
        'store_slug', 'glow',
        'rep_slug', 'GLOW',
        'portal', '/admin',
        'storefront', '/glow',
        'force_password_reset', false
      ),
    updated_at = now()
  where id = vanessa_profile_id;

  insert into public.profiles (
    id,
    auth_user_id,
    email,
    full_name,
    role,
    admin_scope,
    store_slug,
    owner_email,
    updated_at
  )
  values (
    vanessa_profile_id,
    vanessa_profile_id,
    vanessa_email,
    'Vanessa Cosio',
    'rx_plus_admin',
    'GLOW',
    'glow',
    vanessa_email,
    now()
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    role = 'rx_plus_admin',
    admin_scope = 'GLOW',
    store_slug = 'glow',
    owner_email = excluded.owner_email,
    updated_at = now();

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
    rep_name = coalesce(nullif(rep_name, ''), 'Vanessa Cosio'),
    payout_email = coalesce(nullif(payout_email, ''), vanessa_email),
    rep_tier = 'glow_admin_distributor',
    rep_channel = 'glow_partner_admin',
    custom_store_slug = 'glow',
    brand_name = 'GLOW Sheer Radiance',
    account_type = 'admin',
    parent_type = null,
    active = true,
    updated_at = now()
  where id = glow_rep_id;

  update public.reps
  set
    managed_by_profile_id = vanessa_profile_id,
    parent_rep_id = coalesce(parent_rep_id, glow_rep_id),
    rep_tier = coalesce(nullif(rep_tier, ''), 'glow_downline_rep'),
    rep_channel = 'glow_downline_rep',
    custom_store_slug = 'glow',
    brand_name = 'GLOW Sheer Radiance',
    account_type = coalesce(nullif(account_type, ''), 'rep'),
    parent_type = 'glow_downline',
    updated_at = now()
  where glow_rep_id is not null
    and id <> glow_rep_id
    and (
      parent_rep_id = glow_rep_id
      or upper(rep_slug) in ('DEAN50', 'GINTO')
      or lower(coalesce(custom_store_slug, '')) = 'glow'
      or upper(coalesce(brand_name, '')) like '%GLOW%'
    );
end $$;

drop policy if exists "rx plus glow admins read managed reps" on public.reps;
create policy "rx plus glow admins read managed reps"
on public.reps
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    id = public.current_rx_plus_parent_rep_id()
    or profile_id = public.current_profile_id()
    or managed_by_profile_id = public.current_profile_id()
    or parent_rep_id = public.current_rx_plus_parent_rep_id()
    or lower(coalesce(custom_store_slug, '')) = 'glow'
    or upper(coalesce(brand_name, '')) like '%GLOW%'
  )
);

drop policy if exists "rx plus glow admins insert managed reps" on public.reps;
create policy "rx plus glow admins insert managed reps"
on public.reps
for insert
to authenticated
with check (
  public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and lower(coalesce(custom_store_slug, '')) = 'glow'
  and upper(coalesce(brand_name, '')) like '%GLOW%'
  and rep_channel = 'glow_downline_rep'
  and parent_rep_id is not null
  and (
    parent_rep_id = public.current_rx_plus_parent_rep_id()
    or exists (
      select 1
      from public.reps parent
      where parent.id = reps.parent_rep_id
        and (
          parent.id = public.current_rx_plus_parent_rep_id()
          or parent.managed_by_profile_id = public.current_profile_id()
        )
        and lower(coalesce(parent.custom_store_slug, '')) = 'glow'
    )
  )
);

drop policy if exists "rx plus glow admins update managed reps" on public.reps;
create policy "rx plus glow admins update managed reps"
on public.reps
for update
to authenticated
using (
  public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and lower(coalesce(custom_store_slug, '')) = 'glow'
)
with check (
  public.is_glow_scoped_admin()
  and managed_by_profile_id = public.current_profile_id()
  and lower(coalesce(custom_store_slug, '')) = 'glow'
  and upper(coalesce(brand_name, '')) like '%GLOW%'
  and rep_channel = 'glow_downline_rep'
  and parent_rep_id is not null
  and (
    parent_rep_id = public.current_rx_plus_parent_rep_id()
    or exists (
      select 1
      from public.reps parent
      where parent.id = reps.parent_rep_id
        and (
          parent.id = public.current_rx_plus_parent_rep_id()
          or parent.managed_by_profile_id = public.current_profile_id()
        )
        and lower(coalesce(parent.custom_store_slug, '')) = 'glow'
    )
  )
);

drop policy if exists "rx plus glow submissions scoped read" on public.patient_submissions;
create policy "rx plus glow submissions scoped read"
on public.patient_submissions
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    upper(coalesce(checkout_scope_code, '')) = 'GLOW'
    or lower(coalesce(store_slug, '')) = 'glow'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(admin_code, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '') || ' ' || coalesce(store_name, '')) like '%GLOW%'
    or rep_id in (
      select r.id
      from public.reps r
      where r.profile_id = public.current_profile_id()
         or r.managed_by_profile_id = public.current_profile_id()
         or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
    )
  )
);

drop policy if exists "rx plus glow submissions scoped update" on public.patient_submissions;
create policy "rx plus glow submissions scoped update"
on public.patient_submissions
for update
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    upper(coalesce(checkout_scope_code, '')) = 'GLOW'
    or lower(coalesce(store_slug, '')) = 'glow'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(admin_code, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '') || ' ' || coalesce(store_name, '')) like '%GLOW%'
    or rep_id in (
      select r.id
      from public.reps r
      where r.profile_id = public.current_profile_id()
         or r.managed_by_profile_id = public.current_profile_id()
         or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
    )
  )
)
with check (
  public.is_glow_scoped_admin()
  and (
    upper(coalesce(checkout_scope_code, '')) = 'GLOW'
    or lower(coalesce(store_slug, '')) = 'glow'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(admin_code, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '') || ' ' || coalesce(store_name, '')) like '%GLOW%'
    or rep_id in (
      select r.id
      from public.reps r
      where r.profile_id = public.current_profile_id()
         or r.managed_by_profile_id = public.current_profile_id()
         or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
    )
  )
);

drop policy if exists "rx plus glow ledger scoped read" on public.commission_ledger;
create policy "rx plus glow ledger scoped read"
on public.commission_ledger
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    exists (
      select 1
      from public.reps r
      where r.id = commission_ledger.rep_id
        and (
          r.profile_id = public.current_profile_id()
          or r.managed_by_profile_id = public.current_profile_id()
          or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
          or lower(coalesce(r.custom_store_slug, '')) = 'glow'
        )
    )
    or exists (
      select 1
      from public.patient_submissions s
      where s.id = commission_ledger.submission_id
        and (
          upper(coalesce(s.checkout_scope_code, '')) = 'GLOW'
          or lower(coalesce(s.store_slug, '')) = 'glow'
          or upper(coalesce(s.source_portal, '') || ' ' || coalesce(s.source_store, '') || ' ' || coalesce(s.source_admin, '') || ' ' || coalesce(s.source_rep, '') || ' ' || coalesce(s.admin_code, '') || ' ' || coalesce(s.referral_code, '') || ' ' || coalesce(s.discount_code, '') || ' ' || coalesce(s.store_name, '')) like '%GLOW%'
        )
    )
  )
);

drop policy if exists "rx plus glow checkout scopes read" on public.checkout_scopes;
create policy "rx plus glow checkout scopes read"
on public.checkout_scopes
for select
to authenticated
using (
  public.is_glow_scoped_admin()
  and (
    upper(scope_code) = 'GLOW'
    or parent_account_id = 'GLOW'
    or lower(coalesce(account_id, '')) = 'glow'
  )
);

grant execute on function public.is_glow_scoped_admin() to authenticated;
