-- Mark Ayala strategic partner rep seed.

alter table public.reps
  add column if not exists rep_tier text not null default 'standard_rep';

update public.reps
set rep_tier = coalesce(rep_tier, 'standard_rep')
where rep_tier is null;

update public.reps
set rep_tier = 'standard_rep'
where rep_slug in ('RICK50', 'DEAN50')
  and (rep_tier is null or rep_tier = 'standard_rep');

insert into public.reps (
  rep_name,
  rep_identifier,
  rep_slug,
  commission_type,
  commission_rate,
  rep_tier,
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
  'Mark Ayala',
  'REP003',
  'MARK65',
  'net_profit_share',
  0.65,
  'strategic_partner',
  'MARK65',
  10,
  '/r/MARK65',
  true,
  60,
  'PayPal.Me',
  'Kyleemaris07@mail.com',
  true
)
on conflict (rep_slug) do update set
  rep_name = excluded.rep_name,
  rep_identifier = excluded.rep_identifier,
  commission_type = excluded.commission_type,
  commission_rate = excluded.commission_rate,
  rep_tier = excluded.rep_tier,
  discount_code = excluded.discount_code,
  discount_amount = excluded.discount_amount,
  referral_path = excluded.referral_path,
  attribution_locked = excluded.attribution_locked,
  attribution_window_days = excluded.attribution_window_days,
  payout_method = excluded.payout_method,
  payout_email = excluded.payout_email,
  active = true;
