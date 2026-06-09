-- Keep Aurora's admin profile attached when Mike's Supabase Auth user is created.
-- Password creation/reset still belongs in Supabase Auth admin tooling, not SQL migrations.

create or replace function public.ensure_aurora_mike_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'mnsgroup107@gmail.com' then
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
      owner_email = excluded.owner_email;

    update public.reps
    set profile_id = new.id
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

do $$
declare
  mike_user auth.users%rowtype;
begin
  select *
    into mike_user
  from auth.users
  where lower(coalesce(email, '')) = 'mnsgroup107@gmail.com'
  order by created_at desc
  limit 1;

  if mike_user.id is not null then
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
      mike_user.id,
      mike_user.id,
      mike_user.email,
      'Mike',
      'admin',
      'AURORA',
      'aurora',
      mike_user.email
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = excluded.owner_email;

    update public.reps
    set profile_id = mike_user.id
    where rep_slug = 'AURORA'
      and (profile_id is null or profile_id = mike_user.id);
  end if;
end $$;
