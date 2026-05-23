update public.reps
set
  rep_name = 'Mark Ayala',
  rep_identifier = 'REP003',
  rep_slug = 'MARK65',
  discount_code = 'MARK65',
  commission_type = 'net_profit_share',
  commission_rate = 0.65,
  referral_path = '/EmpireHealth&Wellness',
  attribution_locked = true,
  attribution_window_days = 60,
  active = true
where rep_slug = 'MARK65'
   or rep_identifier = 'REP003'
   or lower(coalesce(rep_name, '')) = 'mark ayala';
