-- Confirm and scope Vanessa Cosio's GLOW admin auth user.
-- Password is intentionally not stored here; it was set through Supabase Auth.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  vanessa_email text := 'vanessacosio@ymail.com';
  vanessa_auth_id uuid;
begin
  select id
    into vanessa_auth_id
  from auth.users
  where lower(coalesce(email, '')) = vanessa_email
  order by created_at desc
  limit 1;

  if vanessa_auth_id is null then
    raise notice 'Vanessa GLOW auth user does not exist yet. Create the auth user first, then rerun this migration.';
    return;
  end if;

  update auth.users
  set
    email = vanessa_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now(),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'full_name', 'Vanessa Cosio',
        'role', 'admin',
        'admin_scope', 'GLOW',
        'store_scope', 'GLOW',
        'store_slug', 'glow',
        'rep_slug', 'GLOW',
        'portal', '/admin?brand=glow',
        'storefront', '/glow',
        'force_password_reset', false
      )
  where id = vanessa_auth_id;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    vanessa_auth_id,
    vanessa_auth_id::text,
    jsonb_build_object('sub', vanessa_auth_id::text, 'email', vanessa_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update set
    identity_data = excluded.identity_data,
    updated_at = now();

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
    vanessa_auth_id,
    vanessa_auth_id,
    vanessa_email,
    'Vanessa Cosio',
    'admin',
    'GLOW',
    'glow',
    vanessa_email,
    now()
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    full_name = excluded.full_name,
    role = 'admin',
    admin_scope = 'GLOW',
    store_slug = 'glow',
    owner_email = excluded.owner_email,
    updated_at = now();

  update public.reps
  set
    profile_id = vanessa_auth_id,
    payout_email = coalesce(nullif(payout_email, ''), vanessa_email),
    updated_at = now()
  where rep_slug = 'GLOW';
end $$;
