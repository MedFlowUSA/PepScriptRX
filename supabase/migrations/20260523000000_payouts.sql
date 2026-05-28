-- payout_rules
-- Stores the split percentages. main_pct stays in the primary account;
-- admin_pct and rep_pct are internal manual payout splits.
-- main_pct + admin_pct + rep_pct must equal 100.
create table if not exists public.payout_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null default 'default',
  main_pct    numeric(5,2) not null default 35,
  admin_pct   numeric(5,2) not null default 40,
  rep_pct     numeric(5,2) not null default 25,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint payout_pcts_sum check (main_pct + admin_pct + rep_pct = 100)
);

insert into public.payout_rules (name, main_pct, admin_pct, rep_pct)
values ('default', 35, 40, 25)
on conflict (name) do nothing;

alter table public.payout_rules enable row level security;

create policy "admin_manage_payout_rules"
on public.payout_rules for all
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

-- payouts
-- Logs every PayPal payout sent. One row per recipient per order.
create table if not exists public.payouts (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid references public.patient_submissions(id) on delete set null,
  recipient_type         text not null check (recipient_type in ('admin', 'rep')),
  recipient_email        text not null,
  amount                 numeric(10,2) not null,
  pct                    numeric(5,2) not null,
  currency               text not null default 'USD',
  status                 text not null default 'pending'
                           check (status in ('pending', 'sent', 'failed')),
  paypal_batch_id        text,
  paypal_item_id         text,
  error_message          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists payouts_submission_idx on public.payouts(submission_id);
create index if not exists payouts_status_idx     on public.payouts(status);

alter table public.payouts enable row level security;

-- Admins see everything
create policy "admin_all_payouts"
on public.payouts for all
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

-- Reps see their own payouts
create policy "rep_own_payouts"
on public.payouts for select
using (
  recipient_type = 'rep'
  and exists (
    select 1
    from public.patient_submissions s
    join public.reps r on r.id = s.rep_id
    where s.id = payouts.submission_id
      and r.profile_id = auth.uid()
  )
);

drop trigger if exists payouts_touch_updated_at on public.payouts;
create trigger payouts_touch_updated_at
  before update on public.payouts
  for each row execute function public.touch_updated_at();

drop trigger if exists payout_rules_touch_updated_at on public.payout_rules;
create trigger payout_rules_touch_updated_at
  before update on public.payout_rules
  for each row execute function public.touch_updated_at();
