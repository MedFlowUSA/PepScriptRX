create table if not exists public.portal_age_lead_captures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  age_confirmed boolean not null default false,
  first_name text,
  last_name text,
  email text,
  phone text,
  portal_id text,
  portal_name text,
  portal_path text,
  domain text,
  path text,
  discount_code text,
  discount_percent numeric not null default 0,
  discount_triggered boolean not null default false,
  user_agent text
);

create index if not exists portal_age_lead_captures_email_idx
  on public.portal_age_lead_captures(lower(email));

create index if not exists portal_age_lead_captures_portal_idx
  on public.portal_age_lead_captures(portal_id, created_at desc);

alter table public.portal_age_lead_captures enable row level security;

drop policy if exists "public_insert_portal_age_leads" on public.portal_age_lead_captures;
create policy "public_insert_portal_age_leads"
on public.portal_age_lead_captures for insert
with check (age_confirmed = true);

drop policy if exists "admin_read_portal_age_leads" on public.portal_age_lead_captures;
create policy "admin_read_portal_age_leads"
on public.portal_age_lead_captures for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
);
