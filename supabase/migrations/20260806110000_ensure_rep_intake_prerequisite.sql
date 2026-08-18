-- Narrow staging-drift repair required by the AACTIVATED onboarding migrations.
-- This recreates only the intake table that staging migration history claimed was present.

create table if not exists public.rep_store_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new',
  full_name text not null,
  phone text,
  email text not null,
  paypal_account text,
  desired_rep_code text,
  parent_rep_or_admin_name text,
  store_type text not null,
  store_brand_name text not null,
  logo_needed text,
  preferred_color_1 text,
  preferred_color_2 text,
  preferred_color_3 text,
  brand_style_notes text,
  selected_products jsonb not null default '[]'::jsonb,
  custom_products jsonb not null default '[]'::jsonb,
  internal_notes text,
  source_portal_id text,
  source_portal text,
  source_route text,
  source_url text,
  review_queue text,
  review_admin_code text,
  review_admin_name text,
  parent_store_slug text,
  parent_store_name text,
  partner_admin_id uuid,
  partner_admin_email text,
  approval_owner_id uuid,
  approval_owner_email text,
  approval_status text check (
    approval_status is null or approval_status in ('pending', 'approved', 'rejected', 'more_info_requested')
  ),
  approval_notes text
);

create index if not exists rep_store_intake_status_idx
  on public.rep_store_intake_submissions(status);
create index if not exists rep_store_intake_created_at_idx
  on public.rep_store_intake_submissions(created_at desc);
create index if not exists rep_store_intake_source_portal_id_idx
  on public.rep_store_intake_submissions(source_portal_id);
create index if not exists rep_store_intake_review_queue_idx
  on public.rep_store_intake_submissions(review_queue);
create index if not exists rep_store_intake_review_admin_code_idx
  on public.rep_store_intake_submissions(review_admin_code);
create index if not exists rep_store_intake_parent_store_slug_idx
  on public.rep_store_intake_submissions(parent_store_slug);
create index if not exists rep_store_intake_partner_admin_email_idx
  on public.rep_store_intake_submissions(lower(partner_admin_email));
create index if not exists rep_store_intake_approval_owner_email_idx
  on public.rep_store_intake_submissions(lower(approval_owner_email));
create index if not exists rep_store_intake_approval_status_idx
  on public.rep_store_intake_submissions(approval_status);

create or replace function public.set_rep_store_intake_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rep_store_intake_set_updated_at on public.rep_store_intake_submissions;
create trigger rep_store_intake_set_updated_at
before update on public.rep_store_intake_submissions
for each row execute function public.set_rep_store_intake_updated_at();

alter table public.rep_store_intake_submissions enable row level security;

drop policy if exists "public_insert_rep_store_intake" on public.rep_store_intake_submissions;
create policy "public_insert_rep_store_intake"
on public.rep_store_intake_submissions for insert to anon, authenticated
with check (true);
