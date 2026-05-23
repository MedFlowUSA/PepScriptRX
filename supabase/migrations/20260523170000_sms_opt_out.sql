-- Allow patients to opt out of weekly injection reminder SMS
alter table public.profiles
  add column if not exists sms_opted_out boolean not null default false;
