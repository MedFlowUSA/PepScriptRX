-- Patient account portal: profile editing, goals, and weight tracking.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, auth_user_id, full_name, email, phone, role)
  values (
    new.id,
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'patient')
  )
  on conflict (id) do update set
    auth_user_id = coalesce(public.profiles.auth_user_id, excluded.auth_user_id),
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email = coalesce(public.profiles.email, excluded.email),
    phone = coalesce(public.profiles.phone, excluded.phone),
    role = coalesce(public.profiles.role, excluded.role);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;

create table if not exists public.patient_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  starting_weight numeric,
  goal_weight numeric,
  target_date date,
  activity_goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_weight_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weight numeric not null,
  waist_inches numeric,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.patient_goals enable row level security;
alter table public.patient_weight_entries enable row level security;

drop trigger if exists patient_goals_touch_updated_at on public.patient_goals;
create trigger patient_goals_touch_updated_at
before update on public.patient_goals
for each row execute function public.touch_updated_at();

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update
using (id = public.current_profile_id())
with check (id = public.current_profile_id());

drop policy if exists "submissions patient read by profile or email" on public.patient_submissions;
create policy "submissions patient read by profile or email" on public.patient_submissions
for select
using (
  patient_profile_id = public.current_profile_id()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "patient goals own all" on public.patient_goals;
create policy "patient goals own all" on public.patient_goals
for all
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "patient weight entries own all" on public.patient_weight_entries;
create policy "patient weight entries own all" on public.patient_weight_entries
for all
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());
