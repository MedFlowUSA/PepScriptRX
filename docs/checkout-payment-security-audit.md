# Checkout and Payment Security Audit

Date: 2026-06-05

## Current Flow

1. Cart items are stored in browser state, local storage, and the checkout handoff session storage keys `pepscriptrx_portal_cart_state` and `pepscriptrx_portal_cart`.
2. Storefront product prices are displayed from local/static catalog data plus public catalog tables such as `aactivated_store_product_prices`, `rx_plus_products`, and `distributor_products`.
3. The browser calculates cart subtotals in `RxPlusDistributorPortal.tsx` and `Start.tsx`.
4. The browser applies checkout discounts in `Start.tsx`.
5. Public submissions are created through direct anonymous inserts and fallback RPC `create_public_patient_submission(jsonb)`.
6. Public checkout links currently use `/pay/:id`, where `:id` is the internal `patient_submissions.id` UUID.
7. Public payment lookup uses `get_public_payment_submission(uuid)`.
8. PayPal and Zelle functions calculate payable amount from `patient_submissions.quoted_price`, `discount_amount`, and `shipping_cost`.

## Findings

- The public RPC accepted server-owned fields from browser JSON: `status`, `quoted_price`, `order_total`, `discount_amount`, `order_items`, `tracking_url`, attribution fields, and checkout scope.
- The public RLS policy allowed direct anonymous inserts into `patient_submissions` with `WITH CHECK (true)`.
- A user could tamper with browser storage or direct RPC payloads to create a checkout-ready `payment_sent` submission with reduced prices/totals.
- Payment functions verified PayPal/Zelle payment amounts against stored submission values, but those values could be client-originated.
- Public payment lookup exposed unnecessary customer PII, including name, email, and shipping address, by internal UUID.
- Public checkout scope mutation allowed attribution changes on a known payable submission UUID.

## Repair Direction

- Public order creation must whitelist customer fields only.
- For checkout-ready carts, the server must recompute product price, subtotal, discount, total, order items, status, and payment basis.
- Public payment links must use an unguessable public token rather than the internal submission UUID.
- Public payment lookup must return only checkout-safe fields.
- Admin/manual paid or fulfillment state changes must remain authenticated/admin-only.

## Repairs Implemented

- Added `patient_submissions.public_payment_token` and changed public payment lookup to use the token instead of `patient_submissions.id`.
- Replaced `create_public_patient_submission(jsonb)` with a whitelisted server-authoritative version that ignores browser-submitted `status`, `payment_status`, `paid_at`, `quoted_price`, `order_total`, `discount_amount`, tracking fields, and commission fields.
- Public order creation now resolves product pricing from server catalog tables: `aactivated_store_product_prices`, `rx_plus_products`/`distributor_products`, and the default `products` catalog.
- Anonymous direct inserts into `patient_submissions` were revoked. Authenticated patient refill inserts remain allowed only for new unpaid refill requests.
- Public payment lookup no longer returns full name, email, phone, shipping address, admin notes, tracking fields, commission data, or internal submission UUIDs.
- Public crypto TX submission now uses a token-based RPC.
- PayPal capture and Zelle intent creation now accept the public payment token and resolve the internal submission ID server-side.
- Zelle public responses are sanitized so they do not expose internal order IDs or stored customer/contact fields.
