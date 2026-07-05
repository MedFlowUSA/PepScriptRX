-- Scope Gabriel Martinez / Optimax Peptide Therapy to partner-admin access only.
-- Passwords are intentionally not stored here; auth credentials are managed separately.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  optimax_email text := 'gmart36@gmail.com';
  optimax_auth_id uuid;
  optimax_profile_id uuid;
begin
  select id
    into optimax_auth_id
  from auth.users
  where lower(coalesce(email, '')) = optimax_email
  order by created_at desc
  limit 1;

  if optimax_auth_id is not null then
    update auth.users
    set
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'rx_plus_admin'),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Gabriel Martinez',
          'role', 'rx_plus_admin',
          'admin_scope', 'OPTIMAX',
          'store_scope', 'OPTIMAX',
          'store_slug', 'optimax-peptide-therapy',
          'admin_code', 'GABE50',
          'force_password_reset', false
        ),
      updated_at = now()
    where id = optimax_auth_id;
  end if;

  select id
    into optimax_profile_id
  from public.profiles
  where (optimax_auth_id is not null and auth_user_id = optimax_auth_id)
     or lower(coalesce(email, '')) = optimax_email
     or lower(coalesce(owner_email, '')) = optimax_email
     or (
      upper(coalesce(admin_scope, '')) = 'OPTIMAX'
      and lower(coalesce(store_slug, '')) in ('optimax', 'optimax-peptide-therapy')
    )
  order by
    case when optimax_auth_id is not null and auth_user_id = optimax_auth_id then 0 else 1 end,
    case when lower(coalesce(email, '')) = optimax_email then 0 else 1 end,
    created_at desc
  limit 1;

  if optimax_profile_id is null and optimax_auth_id is not null then
    optimax_profile_id := optimax_auth_id;

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
      optimax_profile_id,
      optimax_auth_id,
      optimax_email,
      'Gabriel Martinez',
      'rx_plus_admin',
      'OPTIMAX',
      'optimax-peptide-therapy',
      optimax_email,
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'rx_plus_admin',
      admin_scope = 'OPTIMAX',
      store_slug = 'optimax-peptide-therapy',
      owner_email = excluded.owner_email,
      updated_at = now();
  elsif optimax_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(auth_user_id, optimax_auth_id),
      email = optimax_email,
      full_name = coalesce(nullif(full_name, ''), 'Gabriel Martinez'),
      role = 'rx_plus_admin',
      admin_scope = 'OPTIMAX',
      store_slug = 'optimax-peptide-therapy',
      owner_email = optimax_email,
      updated_at = now()
    where id = optimax_profile_id;
  end if;

  update public.reps
  set
    profile_id = coalesce(optimax_profile_id, profile_id),
    rep_name = coalesce(nullif(rep_name, ''), 'Gabriel Martinez'),
    custom_store_slug = 'optimax-peptide-therapy',
    brand_name = 'Optimax Peptide Therapy',
    account_type = 'admin',
    parent_type = 'platform',
    active = true,
    updated_at = now()
  where upper(coalesce(rep_slug, '')) = 'GABE50'
     or lower(coalesce(payout_email, '')) = optimax_email;
end $$;
