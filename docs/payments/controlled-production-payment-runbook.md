# PepScriptRX Controlled MPS Production Payment Runbook

Status: **BLOCKED — do not execute until every precondition is signed off**
Example at the approved technical maximum: one `MAIN` payment, `$15.00` pre-fee and no more than `$15.45` total

This runbook does not itself authorize a payment. A new, explicit authorization is required immediately before execution.

## Preconditions

- [ ] The production launch decision packet is complete.
- [ ] The final fee percentage and classification have written acquirer approval.
- [ ] The implementation can exclude ineligible debit/prepaid products or the acquirer has approved a different program-specific model.
- [ ] The exact order has authoritative merchandise, shipping, fee, and tax treatment.
- [ ] The final statement descriptor is confirmed.
- [ ] The refund/void recovery route is proven and staffed.
- [ ] Dispute monitoring and commission/wallet handling owners are assigned.
- [ ] Payment remediation branch is reviewed and merged through the normal repository workflow.
- [ ] One-time or single-user production access is available. `MAIN` scope by itself is not sufficient to prevent other MAIN customers from seeing the option during an enabled window.
- [ ] WordPress health is v0.3.1, configured, and disabled.
- [ ] Supabase initiation returns HTTP 503 `bridge_disabled`.
- [ ] The public production bundle has the MPS option hidden.
- [ ] Stripe checkout initiation is unavailable and PayPal remains available.
- [ ] A named operator and independent observer are present.
- [ ] A new written authorization identifies the exact maximum amount and permits exactly one attempt.

If any precondition is incomplete, stop with all controls off.

## Rollback references

- Application rollback candidate: the immediately prior known-good Vercel deployment recorded in the deployment log.
- Supabase functions: redeploy the last known-good committed function versions only if post-deployment verification fails.
- WordPress: retain the last verified disabled plugin as the rollback copy; v0.3.1 is the required three-percent version.
- Database migrations are forward and may contain production data. Do not destructively reverse them.

Code rollback is not a substitute for disabling the three payment controls.

## Enablement sequence

Use a narrowly controlled window. Do not expose the option broadly.

1. Record the start time, operator, observer, approved order, and maximum amount.
2. Verify the frontend points only to production Supabase.
3. Verify `MAIN` is the only allowed store scope.
4. Verify WordPress is configured but disabled.
5. Set production `WOOCOMMERCE_BRIDGE_ENABLED=true`.
6. Verify a signed request can reach the bridge but do not create the authorized checkout yet.
7. Enable the WordPress PepScriptRX bridge.
8. Verify health reports v0.3.1, `configured=true`, `enabled=true`, and no more than 300 fee basis points.
9. Enable the MPS frontend only for the approved single-user/one-time pilot control.
10. Verify no other customer can see or initiate the payment option.

If single-user isolation is unavailable, disable everything and stop.

## Checkout verification

Create exactly one authorized checkout and verify before card entry:

- Correct PepScriptRX order ID
- `MAIN` attribution
- Correct representative, referral, source representative, and parent hierarchy
- Correct products, variations, quantities, and discounts
- Server-authoritative integer-cent prices
- Approved shipping amount
- Authoritative tax amount
- Exactly one approved processing-fee line
- No duplicate fee in the original application order
- Signed WooCommerce total equals the displayed total
- Total does not exceed the written authorization
- Correct return and cancellation routes
- Correct statement-descriptor disclosure

If any value differs, stop without entering card information.

## Private card-entry boundary

1. Open the processor-hosted secure card-entry page.
2. Confirm the displayed total one final time.
3. Hand control to the cardholder privately.
4. Do not read, record, screenshot, transmit, or request the card data.
5. The cardholder must explicitly confirm that the secure form is ready before submission.
6. Submit no more than one attempt.

If the attempt is declined, errors, times out, or returns an uncertain result, do not retry.

## Post-payment verification

After the single attempt, verify read-only:

- One processor transaction and exact amount/currency
- Final processor state: approved, declined, failed, or uncertain
- One matching WooCommerce order
- One provider-payment event
- Original PepScriptRX order paid only if server-side verification succeeded
- Exactly-once commission and wallet entries
- Exactly-once payment audit and notification-outbox records
- Correct `MAIN` and hierarchy attribution
- No card data, secrets, or raw authorization material in logs/database
- Inventory and promotion mutation remain false
- Stripe checkout initiation remains unavailable; PayPal remains unchanged

For an uncertain state, follow the uncertain-result section of the refund/dispute SOP. Do not create a second transaction.

## Mandatory shutdown

Run this sequence whether the payment succeeds, fails, is declined, is abandoned, or is uncertain:

1. Hide the frontend MPS option and redeploy if required.
2. Disable the WordPress PepScriptRX bridge.
3. Set `WOOCOMMERCE_BRIDGE_ENABLED=false`.
4. Verify WordPress reports `enabled=false`.
5. Verify Supabase initiation returns HTTP 503 `bridge_disabled` using a harmless request that creates no session or order.
6. Verify the public production bundle no longer exposes the option.
7. Confirm all three controls are false.
8. Record the shutdown time and verification evidence.

Do not issue a refund or void after the test without separate explicit authorization.

## Final test record

- Authorization reference: `____________________________`
- Operator/observer: `____________________________`
- Start/shutdown times: `____________________________`
- Internal and WooCommerce order IDs: `____________________________`
- Processor transaction reference: recorded privately
- Pre-fee/fee/tax/shipping/final totals: `____________________________`
- Final result: `approved / declined / failed / uncertain / abandoned`
- Exactly-once verification: `PASS / FAIL`
- All controls disabled afterward: `PASS / FAIL`
- Follow-up case, if any: `____________________________`
