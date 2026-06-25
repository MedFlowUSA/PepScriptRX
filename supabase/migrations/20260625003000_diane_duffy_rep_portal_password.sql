-- Update Diane Marie Duffy's Aurora Labs rep portal temporary password.

do $$
declare
  diane_email text := 'queentort333@yahoo.com';
  diane_password text := 'Dufffy1!';
  diane_rep_code text := 'D026FIR';
  diane_auth_id uuid;
begin
  select id
    into diane_auth_id
  from auth.users
  where lower(coalesce(email, '')) = diane_email
  order by created_at desc
  limit 1;

  if diane_auth_id is null then
    diane_auth_id := gen_random_uuid();

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
      diane_auth_id,
      'authenticated',
      'authenticated',
      diane_email,
      extensions.crypt(diane_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Diane Marie Duffy',
        'role', 'rep',
        'store_scope', 'AURORA',
        'store_slug', 'aurora',
        'rep_slug', diane_rep_code,
        'parent_rep_slug', 'AURORA',
        'parent_admin', 'Mike / Aurora Labs',
        'force_password_reset', true
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
      email = diane_email,
      encrypted_password = extensions.crypt(diane_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'full_name', 'Diane Marie Duffy',
          'role', 'rep',
          'store_scope', 'AURORA',
          'store_slug', 'aurora',
          'rep_slug', diane_rep_code,
          'parent_rep_slug', 'AURORA',
          'parent_admin', 'Mike / Aurora Labs',
          'force_password_reset', true
        )
    where id = diane_auth_id;
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
    diane_auth_id,
    diane_auth_id::text,
    jsonb_build_object('sub', diane_auth_id::text, 'email', diane_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update auth.identities
  set
    provider_id = diane_auth_id::text,
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', diane_auth_id::text, 'email', diane_email),
    updated_at = now()
  where user_id = diane_auth_id
    and provider = 'email';

  update public.profiles
  set
    email = diane_email,
    role = 'rep',
    admin_scope = 'AURORA',
    store_slug = 'aurora',
    owner_email = 'mnsgroup107@gmail.com',
    auth_user_id = diane_auth_id,
    updated_at = now()
  where lower(coalesce(email, '')) = diane_email
     or auth_user_id = diane_auth_id
     or id = diane_auth_id;

  update public.reps
  set
    profile_id = coalesce(profile_id, diane_auth_id),
    payout_email = coalesce(nullif(payout_email, ''), diane_email),
    active = true,
    updated_at = now()
  where rep_slug = diane_rep_code
     or rep_identifier = diane_rep_code
     or lower(coalesce(payout_email, '')) = diane_email;
end $$;
