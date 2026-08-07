-- AACTIVATEDRX rep payouts are reviewed destinations paid weekly on Friday.
-- PayPal remains valid only for legacy rows; new onboarding offers the methods below.
alter table public.aactivated_payout_profiles
  drop constraint if exists aactivated_payout_profiles_method_check;

alter table public.aactivated_payout_profiles
  add constraint aactivated_payout_profiles_method_check
  check (method in ('paypal', 'zelle', 'venmo', 'apple_pay'));

alter table public.aactivated_payout_profiles
  add column if not exists payout_frequency text not null default 'weekly_friday',
  add column if not exists period_end_day text not null default 'thursday';

alter table public.aactivated_payout_profiles
  drop constraint if exists aactivated_payout_profiles_payout_frequency_check;

alter table public.aactivated_payout_profiles
  add constraint aactivated_payout_profiles_payout_frequency_check
  check (payout_frequency = 'weekly_friday');

alter table public.aactivated_payout_profiles
  drop constraint if exists aactivated_payout_profiles_period_end_day_check;

alter table public.aactivated_payout_profiles
  add constraint aactivated_payout_profiles_period_end_day_check
  check (period_end_day = 'thursday');

comment on column public.aactivated_payout_profiles.payout_frequency is
  'AACTIVATEDRX scheduled payout day: Friday, subject to verification and eligibility.';

comment on column public.aactivated_payout_profiles.period_end_day is
  'Commission earning period closes Thursday for the following Friday payout.';
