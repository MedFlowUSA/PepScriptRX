create table if not exists public.abandoned_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'captured'
    check (status in ('captured', 'checkout_started', 'abandoned', 'converted', 'follow_up_needed', 'closed')),
  age_confirmed boolean not null default false,
  first_name text,
  last_name text,
  email text not null,
  phone text,
  source_scope text not null default 'MAIN',
  source_portal text,
  source_route text,
  source_path text,
  rep_code text,
  checkout_scope_code text,
  discount_code text,
  discount_percent numeric(5,4) not null default 0,
  product_interest text,
  product_interest_id text,
  cart_snapshot jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  domain text,
  user_agent text
);

create index if not exists abandoned_leads_created_at_idx on public.abandoned_leads(created_at desc);
create index if not exists abandoned_leads_status_idx on public.abandoned_leads(status);
create index if not exists abandoned_leads_source_scope_idx on public.abandoned_leads(source_scope);
create index if not exists abandoned_leads_email_idx on public.abandoned_leads(lower(email));

create or replace function public.set_abandoned_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists abandoned_leads_updated_at on public.abandoned_leads;
create trigger abandoned_leads_updated_at
before update on public.abandoned_leads
for each row execute function public.set_abandoned_leads_updated_at();

alter table public.abandoned_leads enable row level security;

drop policy if exists "public_insert_abandoned_leads" on public.abandoned_leads;
create policy "public_insert_abandoned_leads"
on public.abandoned_leads for insert
to anon, authenticated
with check (
  age_confirmed = true
  and email is not null
  and length(trim(email)) > 3
);

drop policy if exists "admin_read_abandoned_leads" on public.abandoned_leads;
create policy "admin_read_abandoned_leads"
on public.abandoned_leads for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
);

drop policy if exists "admin_update_abandoned_leads" on public.abandoned_leads;
create policy "admin_update_abandoned_leads"
on public.abandoned_leads for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'rx_plus_admin')
  )
);
