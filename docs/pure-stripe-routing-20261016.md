# Pure shared Stripe routing — October 16, 2026

Pure's 37 published distributor assignments retained the default
`alternate_processor` setting. The platform owner confirmed Pure should use the
existing main-app Stripe setup, matching other sub-stores.

Applied `20261016193000_enable_pure_shared_stripe_checkout.sql` to production.
It changes only processor eligibility on Pure's enabled, active catalog and
guards against unexpected catalog size. No frontend or Edge Function deployment
is needed: the deployed checkout handler reads this configuration per request.

Verification:

- Isolated SQL test passes for scope, idempotency, unpublished products, pricing,
  commission preservation and unexpected catalog size.
- Live before/after comparison: 37 Pure assignments enabled; all 1,500 other
  assignments unchanged; all prices and commission rates unchanged.
- Downloaded production checkout handler exercised against live read-only
  catalog/configuration: all 37 products and six bundle/discount cases pass.
- Production Stripe webhook is enabled for completed, asynchronous success and
  failure events; unsigned requests return 400. Paid events go through the
  existing shared finalizer with amount/currency validation.
- Live-page desktop/mobile checks use a browser-only fixture order, live token
  settings and an intercepted Stripe response to check the button and redirect.

Test orders and Stripe responses were isolated fixtures. No customer order,
live Checkout Session, card charge, email, payout or refund was created. This
verifies routing and the integration path; an actual payment was not executed.
