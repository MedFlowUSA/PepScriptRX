import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const checkoutFunction = readFileSync(
  new URL('../supabase/functions/create-stripe-checkout-session-v2/index.ts', import.meta.url),
  'utf8',
);
const retatrutideCheckoutRepair = readFileSync(
  new URL('../supabase/migrations/20260731054000_restore_main_retatrutide_checkout.sql', import.meta.url),
  'utf8',
);
const radianceCheckoutRepair = readFileSync(
  new URL('../supabase/migrations/20260731061000_restore_radiance_checkout_catalog.sql', import.meta.url),
  'utf8',
);
const webhookFunction = readFileSync(
  new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url),
  'utf8',
);
const pricingRpc = readFileSync(
  new URL('../supabase/migrations/20260717110000_fix_aactivated_cart_submission_pricing.sql', import.meta.url),
  'utf8',
);

test('payable public checkout never accepts a browser fallback price', () => {
  assert.doesNotMatch(pricingRpc, /v_price := v_cart_price_text::numeric/);
  assert.match(pricingRpc, /raise exception 'Could not price checkout item %'/);
});

test('Stripe checkout cannot be re-enabled by configuration', () => {
  assert.match(checkoutFunction, /code: 'stripe_unavailable'/);
  assert.match(checkoutFunction, /status: 503/);
  assert.doesNotMatch(checkoutFunction, /STRIPE_PAYMENTS_ENABLED/);
  assert.doesNotMatch(checkoutFunction, /api\.stripe\.com/);
  assert.equal(existsSync(new URL('../src/lib/stripeCheckout.ts', import.meta.url)), false);
});

test('Main Retatrutide checkout retains an authoritative server-side price', () => {
  assert.match(retatrutideCheckoutRepair, /insert into public\.products/);
  assert.match(retatrutideCheckoutRepair, /'retatrutide'/);
  assert.match(retatrutideCheckoutRepair, /279\.00/);
  assert.match(retatrutideCheckoutRepair, /'manual_review'/);
  assert.match(retatrutideCheckoutRepair, /on conflict \(id\) do update/);
});

test('Radiance checkout mirrors its full catalog into authoritative server pricing', () => {
  assert.match(radianceCheckoutRepair, /regexp_replace\(id, '\^mark-', 'ehwsub-'\)/);
  assert.match(radianceCheckoutRepair, /from public\.products/);
  assert.match(radianceCheckoutRepair, /where id like 'mark-%'/);
  assert.match(radianceCheckoutRepair, /on conflict \(id\) do update/);
});

test('Stripe webhooks wait for settlement and reject stale signatures', () => {
  assert.match(webhookFunction, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhookFunction, /checkout\.session\.async_payment_failed/);
  assert.match(webhookFunction, /session\.payment_status \?\? ''\) !== 'paid'/);
  assert.match(webhookFunction, /ageSeconds > 300/);
});
