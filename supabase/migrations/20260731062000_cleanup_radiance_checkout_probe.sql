delete from public.patient_submissions
where lower(email) = 'qa+radiance-checkout@pepscriptrx.com'
  and full_name = 'QA Radiance Checkout Probe';

