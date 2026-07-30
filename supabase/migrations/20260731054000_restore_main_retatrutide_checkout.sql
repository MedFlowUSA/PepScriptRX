-- Restore the authoritative Main Store price used by the hardened public
-- checkout RPC. The customer-facing catalog still offers this product, so the
-- server catalog must retain the matching active row.
insert into public.products (
  id,
  name,
  price,
  category,
  status,
  display_note,
  sort_order
)
values (
  'retatrutide',
  'Retatrutide Vial',
  279.00,
  'GLP-1 / Weight Management',
  'manual_review',
  'Available for checkout and standard verification review.',
  6
)
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;

-- Remove production-safe diagnostic submissions created while reproducing the
-- Information-to-Checkout failure. Failed probes never inserted a row.
delete from public.patient_submissions
where lower(email) = 'qa+checkout-probe@pepscriptrx.com'
  and full_name = 'QA Checkout Probe';

