-- Private Ginto Wellness Labs rep portal login.
-- Public-facing storefront copy must continue to use only the Ginto Wellness Labs brand.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists payout_email text,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  ginto_email text := 'MARYMICHELLE_NOLASCO@YAHOO.COM';
  ginto_email_normalized text := lower('MARYMICHELLE_NOLASCO@YAHOO.COM');
  ginto_password text := 'Nolasco1!';
  ginto_auth_id uuid;
  ginto_profile_id uuid;
begin
  select id
    into ginto_auth_id
  from auth.users
  where lower(coalesce(email, '')) = ginto_email_normalized
  order by created_at desc
  limit 1;

  if ginto_auth_id is null then
    ginto_auth_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ginto_auth_id,
      'authenticated',
      'authenticated',
      ginto_email,
      extensions.crypt(ginto_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Ginto Wellness Labs',
        'role', 'rep',
        'store_scope', 'GINTO',
        'store_slug', 'ginto',
        'rep_slug', 'GINTO',
        'portal', '/rep',
        'storefront', '/ginto',
        'force_password_reset', false
      ),
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set
      email = ginto_email,
      encrypted_password = extensions.crypt(ginto_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Ginto Wellness Labs',
          'role', 'rep',
          'store_scope', 'GINTO',
          'store_slug', 'ginto',
          'rep_slug', 'GINTO',
          'portal', '/rep',
          'storefront', '/ginto',
          'force_password_reset', false
        )
    where id = ginto_auth_id;
  end if;

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
    ginto_auth_id,
    ginto_auth_id::text,
    jsonb_build_object('sub', ginto_auth_id::text, 'email', ginto_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', ginto_auth_id::text, 'email', ginto_email),
    updated_at = now()
  where user_id = ginto_auth_id
    and provider = 'email';

  select id
    into ginto_profile_id
  from public.profiles
  where auth_user_id = ginto_auth_id
     or lower(coalesce(email, '')) = ginto_email_normalized
  order by
    case when auth_user_id = ginto_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if ginto_profile_id is null then
    ginto_profile_id := ginto_auth_id;

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
      ginto_profile_id,
      ginto_auth_id,
      ginto_email,
      'Ginto Wellness Labs',
      'rep',
      'GINTO',
      'ginto',
      ginto_email,
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = excluded.full_name,
      role = 'rep',
      admin_scope = excluded.admin_scope,
      store_slug = excluded.store_slug,
      owner_email = excluded.owner_email,
      updated_at = now();
  else
    update public.profiles
    set
      auth_user_id = ginto_auth_id,
      email = ginto_email,
      full_name = 'Ginto Wellness Labs',
      role = 'rep',
      admin_scope = 'GINTO',
      store_slug = 'ginto',
      owner_email = ginto_email,
      updated_at = now()
    where id = ginto_profile_id;
  end if;

  update public.reps
  set
    profile_id = ginto_profile_id,
    payout_email = coalesce(payout_email, ginto_email),
    updated_at = now()
  where rep_slug = 'GINTO'
     or custom_store_slug = 'ginto'
     or brand_name = 'Ginto Wellness Labs';
end $$;
