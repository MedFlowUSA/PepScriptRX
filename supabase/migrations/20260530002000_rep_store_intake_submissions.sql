create table if not exists public.rep_store_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'logo_needed', 'pricing_review', 'ready_to_build', 'launched', 'rejected')),
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
  internal_notes text
);

create index if not exists rep_store_intake_status_idx
  on public.rep_store_intake_submissions(status);

create index if not exists rep_store_intake_created_at_idx
  on public.rep_store_intake_submissions(created_at desc);

create or replace function public.set_rep_store_intake_updated_at()
returns trigger
language plpgsql
as $$
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
on public.rep_store_intake_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "admin_manage_rep_store_intake" on public.rep_store_intake_submissions;
create policy "admin_manage_rep_store_intake"
on public.rep_store_intake_submissions
for all
to authenticated
using (public.my_role() in ('admin', 'rx_plus_admin'))
with check (public.my_role() in ('admin', 'rx_plus_admin'));
