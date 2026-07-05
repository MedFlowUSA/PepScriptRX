-- Correct Aurora Labs / Mike admin login email.
-- Requested login:
--   email: MNSGROUP107@GMAIL.COM
--   password: Mike1!
--
-- A previous correction used MSNGROUP107@GMAIL.COM. This migration normalizes
-- Aurora/Mike ownership back to MNSGROUP107@GMAIL.COM while keeping lookups
-- tolerant of the transposed email.

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
  correct_email text := 'mnsgroup107@gmail.com';
  transposed_email text := 'msngroup107@gmail.com';
  mike_password text := 'Mike1!';
  correct_auth_id uuid;
  transposed_auth_id uuid;
  target_auth_id uuid;
  mike_profile_id uuid;
begin
  select id
    into correct_auth_id
  from auth.users
  where lower(coalesce(email, '')) = correct_email
  order by created_at desc
  limit 1;

  select id
    into transposed_auth_id
  from auth.users
  where lower(coalesce(email, '')) = transposed_email
  order by created_at desc
  limit 1;

  target_auth_id := coalesce(correct_auth_id, transposed_auth_id);

  if target_auth_id is null then
    select auth_user_id
      into target_auth_id
    from public.profiles
    where role in ('admin', 'rx_plus_admin')
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
        or lower(coalesce(email, '')) in (correct_email, transposed_email)
      )
      and auth_user_id is not null
    order by created_at desc
    limit 1;
  end if;

  if target_auth_id is null then
    target_auth_id := gen_random_uuid();

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
      target_auth_id,
      'authenticated',
      'authenticated',
      correct_email,
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
  elsif correct_auth_id is null then
    update auth.users
    set
      email = correct_email,
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
    where id = target_auth_id;
  else
    update auth.users
    set
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
    where id = target_auth_id;
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
    target_auth_id,
    target_auth_id::text,
    jsonb_build_object('sub', target_auth_id::text, 'email', correct_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    provider_id = target_auth_id::text,
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', target_auth_id::text, 'email', correct_email),
    updated_at = now()
  where user_id = target_auth_id
    and provider = 'email';

  select id
    into mike_profile_id
  from public.profiles
  where auth_user_id = target_auth_id
     or lower(coalesce(email, '')) in (correct_email, transposed_email)
     or (
      role in ('admin', 'rx_plus_admin')
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
      )
    )
  order by
    case when auth_user_id = target_auth_id then 0 else 1 end,
    case when lower(coalesce(email, '')) = correct_email then 0 else 1 end,
    created_at desc
  limit 1;

  if mike_profile_id is null then
    mike_profile_id := target_auth_id;

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
      target_auth_id,
      correct_email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      correct_email,
      now()
    );
  else
    update public.profiles
    set
      auth_user_id = target_auth_id,
      email = correct_email,
      full_name = coalesce(nullif(full_name, ''), 'Mike'),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = correct_email,
      updated_at = now()
    where id = mike_profile_id;
  end if;

  update public.profiles
  set
    owner_email = correct_email,
    updated_at = now()
  where lower(coalesce(owner_email, '')) in (correct_email, transposed_email)
     or lower(coalesce(email, '')) in (correct_email, transposed_email)
     or lower(coalesce(store_slug, '')) = 'aurora';

  update public.reps
  set
    profile_id = mike_profile_id,
    payout_email = case
      when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then correct_email
      else payout_email
    end,
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or (
      account_type = 'admin'
      and lower(coalesce(custom_store_slug, '')) = 'aurora'
      and brand_name = 'Aurora Labs'
    );

  update public.partner_rep_commission_settings
  set
    partner_admin_email = correct_email,
    updated_at = now()
  where lower(coalesce(partner_admin_email, '')) in (correct_email, transposed_email)
     or store_scope = 'AURORA';

  update public.partner_rep_store_settings
  set
    partner_admin_email = correct_email,
    updated_at = now()
  where lower(coalesce(partner_admin_email, '')) in (correct_email, transposed_email)
     or store_scope = 'AURORA';
end $$;

create or replace function public.ensure_aurora_mike_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) in ('mnsgroup107@gmail.com', 'msngroup107@gmail.com') then
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
      'mnsgroup107@gmail.com',
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      'mnsgroup107@gmail.com'
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
      payout_email = case
        when rep_slug = 'AURORA' or rep_identifier = 'MIKEAURORA' then 'mnsgroup107@gmail.com'
        else payout_email
      end,
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
