import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260730230000_woocommerce_payment_bridge.sql', 'utf8');
const structuredMigration = readFileSync('supabase/migrations/20260801010000_woocommerce_structured_fee_contract.sql', 'utf8');
const initiate = readFileSync('supabase/functions/create-woocommerce-payment-session/index.ts', 'utf8');
const callback = readFileSync('supabase/functions/woocommerce-payment-callback/index.ts', 'utf8');
const paymentStatus = readFileSync('supabase/functions/woocommerce-payment-status/index.ts', 'utf8');
const finalizer = readFileSync('supabase/migrations/20260731010000_shared_paid_order_finalizer.sql', 'utf8');
const deliveryMigration = readFileSync('supabase/migrations/20260804193000_payment_delivery_retries.sql', 'utf8');
const concurrencyGuard = readFileSync('supabase/migrations/20260804194000_shared_finalizer_concurrency_guard.sql', 'utf8');
const stripe = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
const paypal = readFileSync('supabase/functions/capture-paypal-order-v2/index.ts', 'utf8');
const notificationWorker = readFileSync('supabase/functions/process-payment-notification-outbox/index.ts', 'utf8');
const finalizerHelper = readFileSync('supabase/functions/_shared/order-finalizer.ts', 'utf8');
const plugin = readFileSync('wordpress/pepscriptrx-payment-bridge/pepscriptrx-payment-bridge.php', 'utf8');
const paymentPage = readFileSync('src/pages/public/PaymentPage.tsx', 'utf8');
const stripeCheckout = readFileSync('src/lib/stripeCheckout.ts', 'utf8');

test('bridge is disabled by default and UI is separately hidden', () => {
  assert.match(initiate, /WOOCOMMERCE_BRIDGE_ENABLED/);
  assert.match(initiate, /\?\? 'false'/);
  assert.match(paymentPage, /VITE_WOOCOMMERCE_BRIDGE_VISIBLE/);
  assert.match(paymentPage, /\?\? 'false'/);
  assert.match(initiate, /WOOCOMMERCE_ALLOWED_STORE_SCOPES/);
  assert.match(initiate, /store_scope_not_allowed/);
  assert.match(paymentPage, /VITE_WOOCOMMERCE_ALLOWED_STORE_SCOPES/);
});

test('browser-facing WooCommerce functions allow Supabase client headers during CORS preflight', () => {
  const allowedHeaders = /Access-Control-Allow-Headers['"]:\s*['"]authorization, x-client-info, apikey, content-type['"]/;

  assert.match(initiate, allowedHeaders);
  assert.match(paymentStatus, allowedHeaders);
});

test('session schema enforces idempotency, amount range, privacy, and explicit states', () => {
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /between 1500 and 140000/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* anon, authenticated/);
  for (const state of ['paid','declined','failed','expired','refunded','partially_refunded','voided','disputed','reconciliation_required']) {
    assert.ok(migration.includes(`'${state}'`), `missing state ${state}`);
  }
});

test('initiation binds server amount and uses a short opaque session', () => {
  assert.match(initiate, /amountDueCents\(pricedOrder\)/);
  assert.match(initiate, /15 \* 60 \* 1000/);
  assert.match(initiate, /randomToken\(\)/);
  assert.match(initiate, /sha256\(sessionToken\)/);
  assert.match(initiate, /currency: 'USD'/);
  assert.doesNotMatch(initiate, /VITE_/);
});

test('signed handoff contains structured cart, attribution, destinations, and one six-percent fee contract', () => {
  for (const field of [
    'merchandise_subtotal_cents', 'discount_total_cents', 'shipping_total_cents', 'tax_total_cents',
    'pre_fee_amount_cents', 'expected_processing_fee_cents', 'expected_captured_total_cents',
    'cart_fingerprint', 'items', 'shipping', 'customer', 'attribution', 'return_url', 'cancel_url',
  ]) assert.ok(initiate.includes(field), `missing signed checkout field ${field}`);
  assert.match(initiate, /processingFeeCents\(preFeeAmountCents\)/);
  assert.match(plugin, /new WC_Order_Item_Product/);
  assert.match(plugin, /new WC_Order_Item_Shipping/);
  assert.match(plugin, /new WC_Order_Item_Fee/);
  assert.match(plugin, /set_name\( 'Processing Fee' \)/);
  assert.match(plugin, /600 !== \$fee_basis/);
  assert.match(plugin, /intdiv\( \( \$pre_fee_amount \* 600 \) \+ 5000, 10000 \)/);
  assert.match(plugin, /allowed_return_url/);
  assert.match(plugin, /0 === strpos\( \$path, '\/pay\/' \)/);
});

test('callback verifies HMAC, timestamp, amount, and uses the shared finalizer', () => {
  assert.match(callback, /constantTimeEqual/);
  assert.match(callback, /> 300/);
  assert.match(callback, /amountCents !== session.expected_amount_cents/);
  assert.match(callback, /processingFeeCount === 1/);
  assert.match(callback, /cartFingerprint === session.cart_fingerprint/);
  assert.match(callback, /fee_or_cart_contract_mismatch/);
  assert.match(callback, /wooIsPaid/);
  assert.match(callback, /finalizeVerifiedPaidOrder/);
  assert.doesNotMatch(callback, /authoritative_finalizer_unavailable/);
});

test('structured reconciliation records merchandise, shipping-tax, and fee refund components', () => {
  for (const column of ['merchandise_amount_cents', 'shipping_tax_amount_cents', 'processing_fee_amount_cents']) {
    assert.ok(structuredMigration.includes(column), `missing reconciliation field ${column}`);
  }
  for (const field of ['merchandise_refunded_cents', 'shipping_tax_refunded_cents', 'processing_fee_refunded_cents']) {
    assert.ok(callback.includes(field), `missing callback reversal field ${field}`);
    assert.ok(plugin.includes(field), `missing plugin reversal field ${field}`);
  }
});

test('WordPress plugin is update-safe, MPS-only, nonce protected, and secret-masking', () => {
  assert.match(plugin, /woocommerce_available_payment_gateways/);
  assert.match(plugin, /hash_equals/);
  assert.match(plugin, /hash_hmac\(\s*'sha256'/);
  assert.match(plugin, /add_option\( \$nonce_option, time\(\), '', false \)/);
  assert.match(plugin, /wp_schedule_single_event/);
  assert.match(plugin, /type="password"/);
  assert.match(plugin, /empty\(\s*\$input\['request_secret'\]\s*\)\s*\?\s*\$old\['request_secret'\]/);
  assert.doesNotMatch(plugin, /MPS.*API.*key/i);
  assert.match(plugin, /'enabled'\s+=> self::enabled\(\)/);
  assert.match(plugin, /'promo_mutation'\s+=> false/);
  assert.match(plugin, /private static function enabled\(\)/);
  assert.match(plugin, /return new WP_Error\( 'bridge_disabled'/);
  assert.doesNotMatch(plugin, /return '1' === \$o\['enabled'\] &&/);
});

test('expired, replayed, failed, cancelled, and uncertain Woo states cannot create paid effects', () => {
  assert.match(plugin, /strtotime\( \$p\['expires_at'\] \) <= time\(\)/);
  assert.match(plugin, /return new WP_Error\( 'replay'/);
  assert.match(callback, /error_category: 'expired_paid_callback'/);
  assert.match(callback, /return safeJson\(\{ error: 'Expired checkout requires reconciliation' \}, 410\)/);
  assert.match(plugin, /'failed'\s*=> 'failed'/);
  assert.match(plugin, /'cancelled'\s*=> 'cancelled'/);
  assert.match(plugin, /\$map\[ \$to \] \?\? 'reconciliation_required'/);
  assert.match(callback, /if \(status === 'paid'\)/);
  assert.match(callback, /ambiguous_woocommerce_paid_state/);
});

test('card data never enters the application bridge contract', () => {
  for (const source of [initiate, callback, plugin, structuredMigration, deliveryMigration, notificationWorker]) {
    assert.doesNotMatch(source, /card_number|cardnumber|\bcvv\b|\bcvc\b|full_card/i);
  }
});

test('Stripe remains present and WooCommerce is additive', () => {
  assert.match(paymentPage, /createStripeCheckoutSession/);
  assert.match(paymentPage, /Pay with Stripe \/ card/);
  assert.match(paymentPage, /createWooCommercePaymentSession/);
  const stripeCard = paymentPage.indexOf("Pay securely with Stripe");
  const wooCard = paymentPage.indexOf('Additional card option');
  assert.ok(stripeCard > 0 && wooCard > stripeCard);
  assert.doesNotMatch(paymentPage.slice(stripeCard - 800, stripeCard), /wooCommerceBridgeVisible/);
  assert.match(paymentPage.slice(wooCard - 800, wooCard), /wooCommerceBridgeVisible/);
});

test('Stripe, PayPal, and WooCommerce call the same authoritative finalizer', () => {
  for (const source of [stripe, paypal, callback]) assert.match(source, /finalizeVerifiedPaidOrder/);
  assert.match(stripe, /provider: 'stripe'/);
  assert.match(paypal, /provider: 'paypal'/);
  assert.match(callback, /provider: 'woocommerce'/);
  assert.match(stripeCheckout, /create-stripe-checkout-session-v2/);
  assert.match(paymentPage, /capture-paypal-order-v2/);
  assert.doesNotMatch(paypal, /from\('commissions'\)|from\('wallet_transactions'\)|payment_status:\s*'paid'/);
  assert.match(paypal, /const pricedSubmission = alreadyPaid\s*\? submission\s*:\s*await normalizeAndPersistGintoTirzepatide60Order/);
  assert.match(stripe, /function stripeEventSummary/);
  assert.doesNotMatch(stripe, /audit\([^;]+,\s*event\s*\)/);
});

test('WordPress callbacks are persisted before delivery and retried with bounded backoff', () => {
  assert.match(plugin, /\$wpdb->prefix \. 'psrx_bridge_events'/);
  assert.match(plugin, /self::enqueue_callback_event\( \$event_id \? \$event_id/);
  assert.match(plugin, /public static function deliver_event\( \$event_id \)/);
  assert.ok(
    plugin.indexOf("INSERT INTO {$table} (event_id,order_id,callback_url,payload") <
      plugin.indexOf('self::schedule_delivery( $event_id, time() )'),
    'callback must be inserted before the first delivery is scheduled',
  );
  assert.match(plugin, /as_schedule_single_action/);
  assert.match(plugin, /wp_schedule_single_event/);
  assert.match(plugin, /408 === \$code \|\| 429 === \$code \|\| \$code >= 500/);
  assert.match(plugin, /MAX_CALLBACK_ATTEMPTS\s*=\s*8/);
  assert.match(plugin, /check_admin_referer/);
  assert.match(plugin, /hash_hmac\( 'sha256', \$payload, \$o\['callback_secret'\] \)/);
  assert.match(plugin, /ON DUPLICATE KEY UPDATE event_id=VALUES\(event_id\)/);
  assert.doesNotMatch(plugin, /ON DUPLICATE KEY UPDATE[^\n]*payload=VALUES\(payload\)/);
});

test('notification outbox uses durable claims and excludes historical rows from automatic replay', () => {
  assert.match(deliveryMigration, /retry_eligible boolean not null default false/);
  assert.match(deliveryMigration, /alter column retry_eligible set default true/);
  assert.match(deliveryMigration, /for update skip locked/i);
  assert.match(deliveryMigration, /lock_token=v_token/);
  assert.match(deliveryMigration, /v_delay_seconds := least\(21600/);
  assert.match(deliveryMigration, /make_interval\(secs=>v_delay_seconds\)/);
  assert.match(deliveryMigration, /terminal_failed/);
  assert.match(notificationWorker, /PAYMENT_NOTIFICATION_RETRY_ENABLED/);
  assert.match(notificationWorker, /claim_payment_notification_outbox/);
  assert.match(notificationWorker, /complete_payment_notification_outbox/);
  assert.match(notificationWorker, /constantTimeEqual/);
  assert.match(notificationWorker, /response\.status === 408 \|\| response\.status === 429 \|\| response\.status >= 500/);
  assert.doesNotMatch(finalizerHelper, /fetch\(/);
});

test('database finalizer locks the order and atomically deduplicates paid effects', () => {
  assert.match(finalizer, /for update/i);
  assert.match(finalizer, /unique \(provider, provider_event_id\)/);
  assert.match(finalizer, /provider_payment_events_transaction_uidx/);
  assert.match(finalizer, /on conflict\s*\(submission_id,rep_id,commission_role\) do nothing/i);
  assert.match(finalizer, /on conflict\s*\(wallet_id,order_id,entry_type\) do nothing/i);
  assert.match(finalizer, /unique \(order_id, notification_type\)/);
  assert.match(concurrencyGuard, /pg_advisory_xact_lock/);
  assert.match(concurrencyGuard, /payment-order\|/);
  assert.match(concurrencyGuard, /payment-transaction\|/);
  assert.match(concurrencyGuard, /payment-event\|/);
  assert.match(concurrencyGuard, /order_already_finalized_with_different_provider_or_transaction/);
  assert.match(concurrencyGuard, /finalize_verified_paid_order_unlocked/);
});

test('shared finalizer preserves current merchandise commission math and paid statuses', () => {
  assert.match(finalizer, /v_gross := greatest\(0, v_product_total - v_discount\) \+ v_shipping/);
  assert.match(finalizer, /v_profit := greatest\(0, v_product_total - v_discount - v_cogs\)/);
  assert.match(finalizer, /payout_status = 'pending'/);
  assert.match(finalizer, /fulfillment_status = 'pending'/);
  assert.match(finalizer, /payment_release_policy = 'released'/);
  assert.match(finalizer, /'REP_SAMPLE', 'REP_INTERNAL'/);
});

test('finalizer preserves manual inventory and existing promo behavior', () => {
  assert.doesNotMatch(finalizer, /update\s+public\.inventory_items/i);
  assert.doesNotMatch(finalizer, /update\s+public\.aactivated_promo_links/i);
  assert.match(finalizer, /inventory_automation',false/);
  assert.match(finalizer, /promo_mutation',false/);
});

test('amount and currency mismatches fail closed into reconciliation', () => {
  assert.match(finalizer, /currency_mismatch/);
  assert.match(finalizer, /amount_mismatch/);
  assert.match(finalizer, /conflicting_provider_reference/);
  assert.match(finalizer, /payment_reconciliation_events/);
});

test('WooCommerce finalization verifies the captured total from the exact private session', () => {
  assert.match(finalizer, /p_provider = 'woocommerce'/);
  assert.match(finalizer, /from public\.woocommerce_payment_sessions s/);
  assert.match(finalizer, /s\.submission_id = p_order_id/);
  assert.match(finalizer, /s\.woo_order_id = p_provider_order_reference::bigint/);
  assert.match(finalizer, /select s\.expected_amount_cents/);
});

test('refunds, partial refunds, voids, and disputes use manual reconciliation', () => {
  for (const event of ['refunded', 'partially_refunded', 'voided', 'disputed']) {
    assert.ok(callback.includes(`'${event}'`), `missing WooCommerce ${event}`);
  }
  assert.match(stripe, /recordManualReconciliation/);
  assert.doesNotMatch(finalizer, /refund_reversal|chargeback_reversal/);
});
