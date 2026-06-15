-- Link the PhysioPeptides Supabase Auth admin user to the scoped admin profile.
-- Password creation/reset is intentionally handled through Supabase Auth tooling.

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
  physio_email text := 'physiopeptides@gmail.com';
  physio_auth_id uuid;
begin
  select id
    into physio_auth_id
  from auth.users
  where lower(coalesce(email, '')) = physio_email
  order by created_at desc
  limit 1;

  if physio_auth_id is not null then
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
      physio_auth_id,
      physio_auth_id,
      physio_email,
      'PhysioPeptides Admin',
      'admin',
      'PHYSIOPEPTIDES',
      'physiopeptides',
      physio_email,
      now()
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'admin',
      admin_scope = 'PHYSIOPEPTIDES',
      store_slug = 'physiopeptides',
      owner_email = excluded.owner_email,
      updated_at = now();

    update public.reps
    set
      profile_id = physio_auth_id,
      payout_email = physio_email,
      active = true,
      updated_at = now()
    where rep_slug = 'PHYSIOPEPTIDES'
       or rep_identifier = 'PHYSIOPEPTIDES'
       or custom_store_slug = 'physiopeptides';
  end if;
end $$;
