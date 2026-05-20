-- Products catalog — admin-editable, public read-only

create table if not exists public.products (
  id           text        primary key,
  name         text        not null,
  price        numeric     not null default 0,
  category     text        not null default '',
  status       text        not null default 'active'
                           check (status in ('active','manual_review','physician_review','hidden','inactive')),
  display_note text,
  per_day      text,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products_admin_all" on public.products
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "products_public_read" on public.products
  for select using (true);

-- Keep updated_at current on every update
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.touch_updated_at();

-- Seed initial catalog
insert into public.products (id, name, price, category, status, display_note, sort_order)
values
  ('tirzepatide-30', 'Tirzepatide 30mg Vial',              199,  'GLP-1 / Weight Management', 'active',            null,                                      1),
  ('tirzepatide-60', 'Tirzepatide 60mg Vial',              249,  'GLP-1 / Weight Management', 'active',            null,                                      2),
  ('semaglutide-10', 'Semaglutide 10mg Vial',               99,  'GLP-1 / Weight Management', 'active',            null,                                      3),
  ('bac-water',      'BAC Water + 8-Pack Syringe Kit',      12,  'Supplies',                  'active',            null,                                      4),
  ('retatrutide',    'Retatrutide Vial',                   279,  'GLP-1 / Weight Management', 'active',            'Available for savings-check submissions.', 5),
  ('igf1',           'IGF-1 / Insulin Growth Factor One',  199,  'Physician Review',          'physician_review',  'Physician review required.',              6)
on conflict (id) do nothing;
