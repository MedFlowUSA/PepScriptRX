-- Add shipping address fields and PayPal payment link to patient_submissions

ALTER TABLE patient_submissions
  ADD COLUMN IF NOT EXISTS shipping_address  text,
  ADD COLUMN IF NOT EXISTS shipping_city     text,
  ADD COLUMN IF NOT EXISTS shipping_state    text,
  ADD COLUMN IF NOT EXISTS shipping_zip      text,
  ADD COLUMN IF NOT EXISTS shipping_speed    text CHECK (shipping_speed IN ('standard', 'expedited', 'overnight')),
  ADD COLUMN IF NOT EXISTS shipping_cost     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paypal_link       text;

COMMENT ON COLUMN patient_submissions.shipping_speed IS 'standard = 5-7 days (free), expedited = 2-3 days (+$25), overnight = next day (+$50)';
COMMENT ON COLUMN patient_submissions.paypal_link IS 'PayPal payment link pasted by admin; patient sees Pay Now button at /pay/:id';
