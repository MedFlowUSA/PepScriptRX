-- Create/link AACTIVATEDRX rep portal auth users with the requested temporary password.
-- Temporary password for each listed rep: Aactivated2026!

do $$
declare
  temp_password text := 'Aactivated2026!';
  rep_auth_id uuid;
  rep_profile_id uuid;
  seeded_rep_id uuid;
  rep_row record;
begin
  for rep_row in
    select *
    from (
      values
        ('Anthony Davis', 'adavis30430@gmail.com', 'ADONIS'),
        ('Aamir Paige', 'prehziii@gmail.com', 'AAMIR'),
        ('Isaac Muniz', '2legitbusiness@gmail.com', '2LEGIT'),
        ('Wendy Meyer', 'wmeyer0312@gmail.com', 'WENDYCREATES54'),
        ('Jujuan Gailey', 'jujuangailey@gmail.com', 'JUJUAN'),
        ('Caylee Powers', 'luckyyou024@gmail.com', 'POWERS')
    ) as reps_to_auth(rep_name, rep_email, rep_slug)
  loop
    select id
      into rep_auth_id
    from auth.users
    where lower(email) = lower(rep_row.rep_email)
    order by created_at desc
    limit 1;

    if rep_auth_id is null then
      rep_auth_id := gen_random_uuid();

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
        rep_auth_id,
        'authenticated',
        'authenticated',
        rep_row.rep_email,
        extensions.crypt(temp_password, extensions.gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'full_name', rep_row.rep_name,
          'role', 'rep',
          'store_scope', 'AACTIVATEDRX',
          'rep_slug', rep_row.rep_slug,
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
        encrypted_password = extensions.crypt(temp_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now(),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object(
          'full_name', rep_row.rep_name,
          'role', 'rep',
          'store_scope', 'AACTIVATEDRX',
          'rep_slug', rep_row.rep_slug,
          'force_password_reset', true
        )
      where id = rep_auth_id;
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
      rep_auth_id,
      rep_auth_id::text,
      jsonb_build_object('sub', rep_auth_id::text, 'email', rep_row.rep_email),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;

    select id
      into rep_profile_id
    from public.profiles
    where auth_user_id = rep_auth_id
       or lower(coalesce(email, '')) = lower(rep_row.rep_email)
    order by
      case when auth_user_id = rep_auth_id then 0 else 1 end,
      created_at desc
    limit 1;

    if rep_profile_id is null then
      rep_profile_id := rep_auth_id;

      insert into public.profiles (
        id,
        auth_user_id,
        full_name,
        email,
        phone,
        role
      )
      values (
        rep_profile_id,
        rep_auth_id,
        rep_row.rep_name,
        rep_row.rep_email,
        null,
        'rep'
      );
    else
      update public.profiles
      set
        auth_user_id = rep_auth_id,
        full_name = rep_row.rep_name,
        email = rep_row.rep_email,
        role = 'rep'
      where id = rep_profile_id;
    end if;

    update public.reps
    set
      profile_id = rep_profile_id,
      payout_email = rep_row.rep_email,
      active = true
    where rep_slug = rep_row.rep_slug
    returning id into seeded_rep_id;

    update public.partner_rep_store_settings
    set
      rep_email = rep_row.rep_email,
      status = 'active',
      disabled_at = null,
      updated_at = now()
    where rep_id = seeded_rep_id
      and store_scope = 'AACTIVATEDRX';

    insert into public.partner_rep_setup_audit (
      store_scope,
      actor_email,
      action,
      target_table,
      target_id,
      rep_id,
      new_value,
      audit_notes
    )
    values (
      'AACTIVATEDRX',
      'system',
      'rep_portal_temp_password_set',
      'auth.users',
      rep_auth_id,
      seeded_rep_id,
      jsonb_build_object(
        'rep_slug', rep_row.rep_slug,
        'rep_email', rep_row.rep_email,
        'profile_id', rep_profile_id,
        'temporary_password_set', true
      ),
      'AACTIVATEDRX rep portal auth user created/updated and linked. Temporary password supplied by platform owner.'
    );
  end loop;
end $$;
