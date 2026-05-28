-- WarXlabz and future downline stores can receive internal wallet entries.

alter table public.internal_wallets
  drop constraint if exists internal_wallets_account_type_check;

alter table public.internal_wallets
  add constraint internal_wallets_account_type_check
  check (account_type in ('platform', 'admin', 'rep', 'portal', 'store', 'sub_account'));
