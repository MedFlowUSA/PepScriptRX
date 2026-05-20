create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  visitor_id text,
  referral_code text not null,
  discount_code text,
  rep_id uuid references public.reps(id) on delete set null,
  original_referrer text,
  first_visit timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  install_detected boolean not null default false,
  checkout_count integer not null default 0,
  lifetime_value numeric not null default 0,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_attributions_referral_code_idx
  on public.referral_attributions(referral_code);

create index if not exists referral_attributions_visitor_id_idx
  on public.referral_attributions(visitor_id);

alter table public.referral_attributions enable row level security;

drop policy if exists "referral attribution public insert" on public.referral_attributions;
create policy "referral attribution public insert"
  on public.referral_attributions for insert
  with check (true);

drop policy if exists "referral attribution admin read" on public.referral_attributions;
create policy "referral attribution admin read"
  on public.referral_attributions for select
  using (public.is_admin());

update public.reps
set referral_path = '/rick'
where rep_slug = 'RICK50';

update public.reps
set referral_path = '/mark'
where rep_slug = 'MARK65';

update public.reps
set referral_path = '/dennis'
where rep_slug = 'DEAN50';
