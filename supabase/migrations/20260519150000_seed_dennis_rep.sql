-- Dennis Hernandez rep account seed.
-- Keeps early rep setup standardized: locked attribution, $10 customer discount, 50% net-profit share.

alter table public.reps
  add column if not exists rep_name text,
  add column if not exists handle text,
  add column if not exists rep_identifier text,
  add column if not exists commission_type text not null default 'net_profit_share',
  add column if not exists payout_method text,
  add column if not exists attribution_window_days integer not null default 60;

update public.reps
set
  rep_name = coalesce(rep_name, 'Rick'),
  rep_identifier = coalesce(rep_identifier, 'REP001'),
  commission_type = coalesce(commission_type, 'net_profit_share'),
  discount_code = coalesce(discount_code, 'RICK50'),
  discount_amount = coalesce(discount_amount, 10),
  referral_path = coalesce(referral_path, '/r/RICK50'),
  attribution_locked = coalesce(attribution_locked, true),
  attribution_window_days = coalesce(attribution_window_days, 60)
where rep_slug = 'RICK50';

insert into public.reps (
  rep_name,
  handle,
  rep_identifier,
  rep_slug,
  commission_type,
  commission_rate,
  discount_code,
  discount_amount,
  referral_path,
  attribution_locked,
  attribution_window_days,
  payout_method,
  payout_email,
  active
)
values (
  'Dennis Hernandez',
  '@deanvenus',
  'REP002',
  'DEAN50',
  'net_profit_share',
  0.50,
  'DEAN50',
  10,
  '/r/DEAN50',
  true,
  60,
  'PayPal.Me',
  'Deanvenus1977@outlook.com',
  true
)
on conflict (rep_slug) do update set
  rep_name = excluded.rep_name,
  handle = excluded.handle,
  rep_identifier = excluded.rep_identifier,
  commission_type = excluded.commission_type,
  commission_rate = excluded.commission_rate,
  discount_code = excluded.discount_code,
  discount_amount = excluded.discount_amount,
  referral_path = excluded.referral_path,
  attribution_locked = excluded.attribution_locked,
  attribution_window_days = excluded.attribution_window_days,
  payout_method = excluded.payout_method,
  payout_email = excluded.payout_email,
  active = true;
