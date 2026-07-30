delete from public.patient_submissions
where lower(email) = 'qa+checkout-probe@pepscriptrx.com'
  and full_name = 'QA Checkout Probe';

