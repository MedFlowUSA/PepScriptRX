-- Correct Aurora Labs / Mike admin login email from MNs to MSn spelling.
-- Password creation/reset still belongs in Supabase Auth admin tooling, not SQL migrations.

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  old_email text := 'mnsgroup107@gmail.com';
  new_email text := 'msngroup107@gmail.com';
  old_user_id uuid;
  new_user_id uuid;
  mike_profile_id uuid;
begin
  select id
    into old_user_id
  from auth.users
  where lower(coalesce(email, '')) = old_email
  order by created_at desc
  limit 1;

  select id
    into new_user_id
  from auth.users
  where lower(coalesce(email, '')) = new_email
  order by created_at desc
  limit 1;

  -- If the old auth user exists and the corrected email is not already in auth,
  -- keep the same auth user/password and correct the login email.
  if old_user_id is not null and new_user_id is null then
    update auth.users
    set
      email = new_email,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'email', new_email,
          'full_name', coalesce(raw_user_meta_data->>'full_name', 'Mike'),
          'role', 'admin',
          'admin_scope', 'AURORA',
          'store_slug', 'aurora',
          'admin_code', 'MIKEAURORA'
        ),
      updated_at = now()
    where id = old_user_id;

    new_user_id := old_user_id;
  end if;

  select id
    into mike_profile_id
  from public.profiles
  where lower(coalesce(email, '')) in (old_email, new_email)
     or (
      role = 'admin'
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
        or upper(coalesce(owner_email, '')) = 'AURORA'
      )
    )
  order by
    case when lower(coalesce(email, '')) = new_email then 0 else 1 end,
    created_at desc
  limit 1;

  if mike_profile_id is not null then
    update public.profiles
    set
      auth_user_id = coalesce(new_user_id, auth_user_id),
      email = new_email,
      full_name = coalesce(nullif(full_name, ''), 'Mike'),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = new_email,
      updated_at = now()
    where id = mike_profile_id;
  elsif new_user_id is not null then
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
      new_user_id,
      new_user_id,
      new_email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      new_email
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = excluded.owner_email,
      updated_at = now()
    returning id into mike_profile_id;
  end if;

  update public.profiles
  set owner_email = new_email,
      updated_at = now()
  where lower(coalesce(owner_email, '')) = old_email
     or (
      role = 'admin'
      and (
        upper(coalesce(admin_scope, '')) = 'AURORA'
        or lower(coalesce(store_slug, '')) = 'aurora'
      )
    );

  update public.reps
  set
    profile_id = coalesce(mike_profile_id, profile_id),
    payout_email = case
      when lower(coalesce(payout_email, '')) = old_email then new_email
      else payout_email
    end,
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or custom_store_slug = 'aurora'
     or brand_name = 'Aurora Labs';
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
      new.email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      new.email
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
