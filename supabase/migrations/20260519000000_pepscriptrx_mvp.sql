create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text,
  email text,
  phone text,
  role text not null default 'patient' check (role in ('patient', 'rep', 'physician', 'fulfillment', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

update public.profiles
set auth_user_id = id
where auth_user_id is null
  and exists (select 1 from auth.users where auth.users.id = profiles.id);

create table if not exists public.reps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  rep_slug text unique not null,
  commission_rate numeric not null default 0.20,
  payout_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_submissions (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid references public.profiles(id) on delete set null,
  rep_id uuid references public.reps(id) on delete set null,
  physician_id uuid references public.profiles(id) on delete set null,
  medication text not null,
  current_dose text,
  current_price numeric,
  state text,
  date_of_birth date,
  current_pharmacy text,
  status text not null default 'new_submission' check (
    status in (
      'new_submission',
      'missing_info',
      'under_review',
      'physician_review',
      'fulfillment_review',
      'eligible',
      'payment_sent',
      'paid',
      'fulfilled',
      'not_eligible',
      'cancelled_refunded'
    )
  ),
  quoted_price numeric,
  estimated_savings numeric,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  document_type text not null check (document_type in ('prescription', 'receipt', 'medication_photo', 'id_optional')),
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.physician_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  physician_id uuid references public.profiles(id) on delete set null,
  review_status text check (
    review_status in (
      'approved_for_refill_review',
      'needs_more_information',
      'not_appropriate',
      'refer_to_fulfillment_partner',
      'clinical_review_complete'
    )
  ),
  review_notes text,
  reviewed_at timestamptz
);

create table if not exists public.fulfillment_orders (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  fulfillment_profile_id uuid references public.profiles(id) on delete set null,
  fulfillment_partner text,
  fulfillment_status text not null default 'not_sent',
  tracking_number text,
  cost_basis numeric,
  retail_price numeric,
  margin numeric generated always as (coalesce(retail_price, 0) - coalesce(cost_basis, 0)) stored,
  created_at timestamptz not null default now()
);

alter table public.fulfillment_orders
  add column if not exists fulfillment_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete set null,
  gross_sale numeric,
  margin numeric,
  commission_rate numeric,
  commission_amount numeric,
  status text not null default 'pending' check (status in ('pending', 'payable', 'paid', 'reversed')),
  payout_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.reta_waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  state text,
  interest_notes text,
  rep_id uuid references public.reps(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  submission_id uuid references public.patient_submissions(id) on delete cascade,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patient_submissions_touch_updated_at on public.patient_submissions;
create trigger patient_submissions_touch_updated_at
before update on public.patient_submissions
for each row execute function public.touch_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_role() = 'admin', false)
$$;

alter table public.profiles enable row level security;
alter table public.reps enable row level security;
alter table public.patient_submissions enable row level security;
alter table public.submission_documents enable row level security;
alter table public.physician_reviews enable row level security;
alter table public.fulfillment_orders enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.reta_waitlist enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles insert during intake" on public.profiles for insert with check (role = 'patient');
create policy "profiles own or admin read" on public.profiles for select using (id = public.current_profile_id() or public.is_admin());
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "reps public active lookup" on public.reps for select using (active = true);
create policy "reps admin all" on public.reps for all using (public.is_admin()) with check (public.is_admin());

create policy "submissions public insert" on public.patient_submissions for insert with check (true);
create policy "submissions admin all" on public.patient_submissions for all using (public.is_admin()) with check (public.is_admin());
create policy "submissions patient read own" on public.patient_submissions for select using (patient_profile_id = public.current_profile_id());
create policy "submissions physician assigned" on public.patient_submissions for select using (physician_id = public.current_profile_id());
create policy "submissions rep attributed read" on public.patient_submissions for select using (
  exists (
    select 1
    from public.reps
    where reps.id = patient_submissions.rep_id
      and reps.profile_id = public.current_profile_id()
  )
);

create policy "documents insert during intake" on public.submission_documents for insert with check (true);
create policy "documents admin read" on public.submission_documents for select using (public.is_admin());
create policy "documents physician assigned read" on public.submission_documents for select using (
  exists (
    select 1
    from public.patient_submissions
    where patient_submissions.id = submission_documents.submission_id
      and patient_submissions.physician_id = public.current_profile_id()
  )
);

create policy "reviews physician assigned all" on public.physician_reviews for all using (
  public.is_admin()
  or physician_id = public.current_profile_id()
  or exists (
    select 1
    from public.patient_submissions
    where patient_submissions.id = physician_reviews.submission_id
      and patient_submissions.physician_id = public.current_profile_id()
  )
) with check (
  public.is_admin()
  or physician_id = public.current_profile_id()
);

create policy "fulfillment admin all" on public.fulfillment_orders for all using (public.is_admin()) with check (public.is_admin());
create policy "fulfillment assigned read update" on public.fulfillment_orders for all using (
  fulfillment_profile_id = public.current_profile_id()
) with check (fulfillment_profile_id = public.current_profile_id());

create policy "ledger admin all" on public.commission_ledger for all using (public.is_admin()) with check (public.is_admin());
create policy "ledger rep own read" on public.commission_ledger for select using (
  exists (
    select 1
    from public.reps
    where reps.id = commission_ledger.rep_id
      and reps.profile_id = public.current_profile_id()
  )
);

create policy "waitlist public insert" on public.reta_waitlist for insert with check (true);
create policy "waitlist admin read" on public.reta_waitlist for select using (public.is_admin());

create policy "audit insert" on public.audit_logs for insert with check (true);
create policy "audit admin read" on public.audit_logs for select using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('submission-documents', 'submission-documents', false)
on conflict (id) do update set public = excluded.public;

create policy "submission documents can be uploaded" on storage.objects for insert with check (
  bucket_id = 'submission-documents'
);

create policy "submission documents admin can read" on storage.objects for select using (
  bucket_id = 'submission-documents' and public.is_admin()
);

create policy "submission documents physician assigned can read" on storage.objects for select using (
  bucket_id = 'submission-documents'
  and exists (
    select 1
    from public.submission_documents docs
    join public.patient_submissions submissions on submissions.id = docs.submission_id
    where docs.file_path = storage.objects.name
      and submissions.physician_id = public.current_profile_id()
  )
);
