alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('patient', 'rep', 'physician', 'fulfillment', 'admin', 'rx_plus_admin'));

update public.profiles
set
  role = 'rx_plus_admin',
  full_name = coalesce(nullif(full_name, ''), 'Guy')
where lower(email) = 'guy@aactivated.com'
   or id = 'dce11498-4ad8-4b1e-89d4-683f7e0b1f03'::uuid;

update auth.users
set
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'rx_plus_admin', 'full_name', 'Guy'),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'rx_plus_admin')
where lower(email) = 'guy@aactivated.com'
   or id = 'dce11498-4ad8-4b1e-89d4-683f7e0b1f03'::uuid;
