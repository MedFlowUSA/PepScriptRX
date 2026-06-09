-- Aurora Labs payout profile link.

update public.reps
set
  payout_method = 'PayPal',
  paypal_link = 'https://www.paypal.com/biz/profile/auroralabsco'
where rep_slug = 'AURORA';
