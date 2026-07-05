-- Reset Jordan Wiggins / WIGG to the exact temporary password provided by support.
-- Login:
--   email: showtimewigg@gmail.com
--   password: Aactivated1

do $$
declare
  jordan_email text := 'showtimewigg@gmail.com';
  jordan_password text := 'Aactivated1';
  jordan_auth_id uuid;
  jordan_profile_id uuid;
  jordan_rep_id uuid;
  guy_profile_id uuid;
begin
  select id
    into jordan_auth_id
  from auth.users
  where lower(coalesce(email, '')) = jordan_email
  order by created_at desc
  limit 1;

  if jordan_auth_id is null then
    raise exception 'Cannot reset Jordan WIGG password because auth user % does not exist', jordan_email;
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(jordan_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now(),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'full_name', 'Jordan Wiggins',
        'role', 'rep',
        'store_scope', 'AACTIVATEDRX',
        'store_slug', 'aactivated',
        'rep_slug', 'WIGG',
        'portal', '/rep',
        'storefront', '/AACTIVATED?rep=WIGG',
        'force_password_reset', true
      )
  where id = jordan_auth_id;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', jordan_auth_id::text, 'email', jordan_email),
    updated_at = now()
  where user_id = jordan_auth_id
    and provider = 'email';

  select id
    into jordan_profile_id
  from public.profiles
  where auth_user_id = jordan_auth_id
     or id = jordan_auth_id
     or lower(coalesce(email, '')) = jordan_email
  order by
    case when auth_user_id = jordan_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if jordan_profile_id is not null then
    update public.profiles
    set
      auth_user_id = jordan_auth_id,
      email = jordan_email,
      full_name = 'Jordan Wiggins',
      role = 'rep',
      admin_scope = 'AACTIVATEDRX',
      store_slug = 'aactivated',
      owner_email = jordan_email,
      updated_at = now()
    where id = jordan_profile_id;
  end if;

  select id
    into jordan_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'WIGG'
     or profile_id = jordan_profile_id
  order by
    case when upper(coalesce(rep_slug, '')) = 'WIGG' then 0 else 1 end,
    created_at desc
  limit 1;

  if jordan_rep_id is not null then
    update public.reps
    set
      profile_id = coalesce(jordan_profile_id, profile_id),
      payout_email = jordan_email,
      active = true,
      updated_at = now()
    where id = jordan_rep_id;
  end if;

  select id
    into guy_profile_id
  from public.profiles
  where lower(coalesce(email, '')) = 'guy@aactivated.com'
     or lower(coalesce(owner_email, '')) = 'guy@aactivated.com'
     or upper(coalesce(admin_scope, '')) in ('AACTIVATEDRX', 'AACTIVATED', 'GUY60', 'VITALITYINS')
  order by
    case when lower(coalesce(email, '')) = 'guy@aactivated.com' then 0 else 1 end,
    created_at desc
  limit 1;

  if to_regclass('public.rep_store_intake_submissions') is not null then
    update public.rep_store_intake_submissions
    set
      status = 'launched',
      approval_status = 'approved',
      approval_notes = trim(coalesce(approval_notes, '') || E'\nRep portal temporary password reset from support request.'),
      internal_notes = trim(coalesce(internal_notes, '') || E'\nRep portal temporary password reset from support request.'),
      updated_at = now()
    where lower(coalesce(email, '')) = jordan_email
       or upper(coalesce(desired_rep_code, '')) = 'WIGG';
  end if;

  if to_regclass('public.partner_rep_setup_audit') is not null then
    insert into public.partner_rep_setup_audit (
      store_scope,
      actor_id,
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
      guy_profile_id,
      'guy@aactivated.com',
      'rep_temp_password_reset',
      'reps',
      jordan_rep_id,
      jordan_rep_id,
      jsonb_build_object(
        'rep_slug', 'WIGG',
        'email', jordan_email,
        'profile_id', jordan_profile_id,
        'auth_user_id', jordan_auth_id,
        'rep_portal', '/rep'
      ),
      'Jordan Wiggins / WIGG temporary password reset from support request.'
    );
  end if;
end $$;
