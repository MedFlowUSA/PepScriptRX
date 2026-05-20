-- ============================================================
-- PepScriptRX — Initial Schema
-- Run this in your Supabase SQL editor (or via supabase db push)
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
-- Stores internal staff accounts (admin, rep, physician, fulfillment).
-- id matches auth.users.id so RLS can use auth.uid().
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        text not null check (role in ('patient','rep','physician','fulfillment','admin')),
  created_at  timestamptz not null default now()
);

-- Auto-create profile on sign-up (set role manually or via admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'admin')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── reps ─────────────────────────────────────────────────────
create table if not exists public.reps (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id),
  rep_slug         text not null unique,
  commission_rate  numeric not null default 0.20,
  payout_email     text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ── patient_submissions ──────────────────────────────────────
-- Anonymous intake (patient_profile_id is nullable for anon submissions)
create table if not exists public.patient_submissions (
  id                  uuid primary key default gen_random_uuid(),
  patient_profile_id  uuid references public.profiles(id),
  full_name           text not null,
  email               text not null,
  phone               text not null,
  rep_id              uuid references public.reps(id),
  physician_id        uuid references public.profiles(id),
  medication          text not null,
  current_dose        text,
  current_price       numeric,
  state               text,
  date_of_birth       date,
  current_pharmacy    text,
  status              text not null default 'new_submission'
                      check (status in (
                        'new_submission','missing_info','under_review',
                        'physician_review','fulfillment_review','eligible',
                        'payment_sent','paid','fulfilled',
                        'not_eligible','cancelled_refunded'
                      )),
  quoted_price        numeric,
  estimated_savings   numeric,
  admin_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── submission_documents ─────────────────────────────────────
create table if not exists public.submission_documents (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.patient_submissions(id) on delete cascade,
  document_type  text not null check (document_type in ('prescription','receipt','medication_photo','id_optional')),
  file_path      text not null,
  uploaded_at    timestamptz not null default now()
);

-- ── physician_reviews ────────────────────────────────────────
create table if not exists public.physician_reviews (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.patient_submissions(id) on delete cascade,
  physician_id   uuid not null references public.profiles(id),
  review_status  text not null check (review_status in (
                   'approved_for_refill_review','needs_more_information',
                   'not_appropriate','refer_to_fulfillment_partner','clinical_review_complete'
                 )),
  review_notes   text,
  reviewed_at    timestamptz,
  unique (submission_id, physician_id)
);

-- ── fulfillment_orders ───────────────────────────────────────
create table if not exists public.fulfillment_orders (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null references public.patient_submissions(id) on delete cascade,
  fulfillment_partner text,
  fulfillment_status  text not null default 'not_sent',
  tracking_number     text,
  cost_basis          numeric,
  retail_price        numeric,
  margin              numeric,
  created_at          timestamptz not null default now()
);

-- ── commission_ledger ─────────────────────────────────────────
create table if not exists public.commission_ledger (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references public.patient_submissions(id) on delete cascade,
  rep_id            uuid not null references public.reps(id),
  gross_sale        numeric,
  margin            numeric,
  commission_rate   numeric,
  commission_amount numeric,
  status            text not null default 'pending'
                    check (status in ('pending','payable','paid','reversed')),
  payout_date       date,
  created_at        timestamptz not null default now(),
  unique (submission_id)
);

-- ── reta_waitlist ─────────────────────────────────────────────
create table if not exists public.reta_waitlist (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null,
  phone           text,
  state           text,
  interest_notes  text,
  rep_id          uuid references public.reps(id),
  created_at      timestamptz not null default now()
);

-- ── audit_logs ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id                 uuid primary key default gen_random_uuid(),
  actor_profile_id   uuid references public.profiles(id),
  submission_id      uuid references public.patient_submissions(id),
  action             text not null,
  notes              text,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.reps               enable row level security;
alter table public.patient_submissions enable row level security;
alter table public.submission_documents enable row level security;
alter table public.physician_reviews  enable row level security;
alter table public.fulfillment_orders enable row level security;
alter table public.commission_ledger  enable row level security;
alter table public.reta_waitlist      enable row level security;
alter table public.audit_logs         enable row level security;

-- Helper: check role
create or replace function public.my_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- profiles: users see their own; admins see all
create policy "profiles_own"   on public.profiles for select using (id = auth.uid());
create policy "profiles_admin" on public.profiles for all using (public.my_role() = 'admin');

-- reps: anon can read slug for referral lookup; admins manage
create policy "reps_anon_read"  on public.reps for select using (active = true);
create policy "reps_admin_all"  on public.reps for all using (public.my_role() = 'admin');

-- patient_submissions: anon INSERT; admins all; reps see their own; physicians see assigned
create policy "submissions_anon_insert" on public.patient_submissions for insert with check (true);
create policy "submissions_admin_all"   on public.patient_submissions for all using (public.my_role() = 'admin');
create policy "submissions_rep_select"  on public.patient_submissions for select
  using (
    public.my_role() = 'rep' and
    rep_id = (select id from public.reps where profile_id = auth.uid() limit 1)
  );
create policy "submissions_physician_select" on public.patient_submissions for select
  using (public.my_role() = 'physician' and physician_id = auth.uid());
create policy "submissions_physician_update" on public.patient_submissions for update
  using (public.my_role() = 'physician' and physician_id = auth.uid());
create policy "submissions_fulfillment_select" on public.patient_submissions for select
  using (public.my_role() = 'fulfillment');
create policy "submissions_fulfillment_update" on public.patient_submissions for update
  using (public.my_role() = 'fulfillment');

-- submission_documents: anon INSERT; role-restricted read
create policy "docs_anon_insert" on public.submission_documents for insert with check (true);
create policy "docs_admin_all"   on public.submission_documents for all using (public.my_role() = 'admin');
create policy "docs_physician_select" on public.submission_documents for select
  using (
    public.my_role() = 'physician' and
    exists (select 1 from public.patient_submissions s where s.id = submission_id and s.physician_id = auth.uid())
  );
create policy "docs_fulfillment_select" on public.submission_documents for select
  using (public.my_role() = 'fulfillment');

-- physician_reviews
create policy "reviews_physician_own" on public.physician_reviews for all using (physician_id = auth.uid());
create policy "reviews_admin_all"     on public.physician_reviews for all using (public.my_role() = 'admin');

-- fulfillment_orders
create policy "fulfillment_admin_all"  on public.fulfillment_orders for all using (public.my_role() = 'admin');
create policy "fulfillment_ff_all"     on public.fulfillment_orders for all using (public.my_role() = 'fulfillment');

-- commission_ledger
create policy "ledger_admin_all" on public.commission_ledger for all using (public.my_role() = 'admin');
create policy "ledger_rep_select" on public.commission_ledger for select
  using (
    public.my_role() = 'rep' and
    rep_id = (select id from public.reps where profile_id = auth.uid() limit 1)
  );

-- reta_waitlist: anon INSERT; admin all
create policy "reta_anon_insert" on public.reta_waitlist for insert with check (true);
create policy "reta_admin_all"   on public.reta_waitlist for all using (public.my_role() = 'admin');

-- audit_logs: admin only
create policy "audit_admin_all" on public.audit_logs for all using (public.my_role() = 'admin');

-- ============================================================
-- STORAGE — run in Supabase dashboard > Storage > Policies
-- ============================================================
-- 1. Create a PRIVATE bucket named: submission-documents
-- 2. Add these storage policies:
--
-- INSERT (upload) — allow anyone (anon or auth):
--   (bucket_id = 'submission-documents')
--
-- SELECT (download) — allow authenticated staff only:
--   (bucket_id = 'submission-documents'
--    AND auth.role() = 'authenticated'
--    AND public.my_role() IN ('admin','physician','fulfillment'))
-- ============================================================
