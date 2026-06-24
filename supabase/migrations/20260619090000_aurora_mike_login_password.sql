-- Reassert Aurora Labs / Mike admin login credentials.
-- Requested login:
--   email: MSNGROUP107@GMAIL.COM
--   password: Mike1!
--
-- Store the email normalized for consistent lookup; Supabase email sign-in is
-- case-insensitive for the practical login flow.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  mike_email text := 'msngroup107@gmail.com';
  mike_password text := 'Mike1!';
  previous_email text := 'mnsgroup107@gmail.com';
  mike_auth_id uuid;
  mike_profile_id uuid;
begin
  select id
    into mike_auth_id
  from auth.users
  where lower(coalesce(email, '')) = mike_email
  order by created_at desc
  limit 1;

  if mike_auth_id is null then
    select id
      into mike_auth_id
    from auth.users
    where lower(coalesce(email, '')) = previous_email
    order by created_at desc
    limit 1;
  end if;

  if mike_auth_id is null then
    select auth_user_id
      into mike_auth_id
    from public.profiles
    where role in ('admin', 'rx_plus_admin')
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
        or lower(coalesce(email, '')) in (mike_email, previous_email)
      )
      and auth_user_id is not null
    order by created_at desc
    limit 1;
  end if;

  if mike_auth_id is null then
    mike_auth_id := gen_random_uuid();

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
      mike_auth_id,
      'authenticated',
      'authenticated',
      mike_email,
      extensions.crypt(mike_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Mike',
        'role', 'admin',
        'admin_scope', 'AURORA',
        'store_slug', 'aurora',
        'admin_code', 'MIKEAURORA',
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
      email = mike_email,
      encrypted_password = extensions.crypt(mike_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', coalesce(nullif(raw_user_meta_data->>'full_name', ''), 'Mike'),
          'role', 'admin',
          'admin_scope', 'AURORA',
          'store_slug', 'aurora',
          'admin_code', 'MIKEAURORA',
          'force_password_reset', false
        )
    where id = mike_auth_id;
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
    mike_auth_id,
    mike_auth_id::text,
    jsonb_build_object('sub', mike_auth_id::text, 'email', mike_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    provider_id = mike_auth_id::text,
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', mike_auth_id::text, 'email', mike_email),
    updated_at = now()
  where user_id = mike_auth_id
    and provider = 'email';

  select id
    into mike_profile_id
  from public.profiles
  where auth_user_id = mike_auth_id
     or lower(coalesce(email, '')) in (mike_email, previous_email)
     or (
      role in ('admin', 'rx_plus_admin')
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
      )
    )
  order by
    case when auth_user_id = mike_auth_id then 0 else 1 end,
    case when lower(coalesce(email, '')) = mike_email then 0 else 1 end,
    created_at desc
  limit 1;

  if mike_profile_id is null then
    mike_profile_id := mike_auth_id;

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
      mike_profile_id,
      mike_auth_id,
      mike_email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      mike_email,
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = excluded.owner_email,
      updated_at = now();
  else
    update public.profiles
    set
      auth_user_id = mike_auth_id,
      email = mike_email,
      full_name = coalesce(nullif(full_name, ''), 'Mike'),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = mike_email,
      updated_at = now()
    where id = mike_profile_id;
  end if;

  update public.profiles
  set
    owner_email = mike_email,
    updated_at = now()
  where lower(coalesce(owner_email, '')) in (previous_email, mike_email)
     or (
      lower(coalesce(store_slug, '')) = 'aurora'
      and coalesce(owner_email, '') = ''
    );

  update public.reps
  set
    profile_id = mike_profile_id,
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or (
      account_type = 'admin'
      and lower(coalesce(custom_store_slug, '')) = 'aurora'
      and brand_name = 'Aurora Labs'
    );
end $$;

create or replace function public.ensure_aurora_mike_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'msngroup107@gmail.com' then
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
      new.id,
      new.id,
      lower(new.email),
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      lower(new.email)
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = excluded.owner_email,
      updated_at = now();

    update public.reps
    set
      profile_id = new.id,
      updated_at = now()
    where rep_slug = 'AURORA'
      and (profile_id is null or profile_id = new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_aurora_mike_profile_on_auth_user on auth.users;
create trigger ensure_aurora_mike_profile_on_auth_user
after insert or update of email on auth.users
for each row
execute function public.ensure_aurora_mike_profile();
