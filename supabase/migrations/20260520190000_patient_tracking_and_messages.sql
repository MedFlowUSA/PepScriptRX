create table if not exists public.patient_activity_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  logged_date date not null,
  steps integer,
  active_minutes integer,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'google_fit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, logged_date)
);

create table if not exists public.patient_side_effects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  logged_date date not null default current_date,
  symptom text not null,
  severity integer not null check (severity between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submission_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists patient_activity_log_profile_date_idx
  on public.patient_activity_log(profile_id, logged_date desc);

create index if not exists patient_side_effects_profile_date_idx
  on public.patient_side_effects(profile_id, logged_date desc);

create index if not exists submission_messages_submission_created_idx
  on public.submission_messages(submission_id, created_at);

alter table public.patient_activity_log enable row level security;
alter table public.patient_side_effects enable row level security;
alter table public.submission_messages enable row level security;

drop trigger if exists patient_activity_log_touch_updated_at on public.patient_activity_log;
create trigger patient_activity_log_touch_updated_at
before update on public.patient_activity_log
for each row execute function public.touch_updated_at();

drop trigger if exists patient_side_effects_touch_updated_at on public.patient_side_effects;
create trigger patient_side_effects_touch_updated_at
before update on public.patient_side_effects
for each row execute function public.touch_updated_at();

drop policy if exists "patient activity own all" on public.patient_activity_log;
create policy "patient activity own all"
on public.patient_activity_log
for all
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "patient side effects own all" on public.patient_side_effects;
create policy "patient side effects own all"
on public.patient_side_effects
for all
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "submission messages participant read" on public.submission_messages;
create policy "submission messages participant read"
on public.submission_messages
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.patient_submissions s
    where s.id = submission_messages.submission_id
      and (
        s.patient_profile_id = public.current_profile_id()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or s.physician_id = public.current_profile_id()
        or exists (
          select 1
          from public.reps r
          where r.id = s.rep_id
            and r.profile_id = public.current_profile_id()
        )
        or public.my_role() = 'fulfillment'
      )
  )
);

drop policy if exists "submission messages participant insert" on public.submission_messages;
create policy "submission messages participant insert"
on public.submission_messages
for insert
with check (
  sender_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.patient_submissions s
    where s.id = submission_messages.submission_id
      and (
        public.is_admin()
        or s.patient_profile_id = public.current_profile_id()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or s.physician_id = public.current_profile_id()
        or exists (
          select 1
          from public.reps r
          where r.id = s.rep_id
            and r.profile_id = public.current_profile_id()
        )
        or public.my_role() = 'fulfillment'
      )
  )
);
