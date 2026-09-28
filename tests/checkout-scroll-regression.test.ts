import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkout = readFileSync(
  new URL('../src/pages/public/Start.tsx', import.meta.url),
  'utf8',
);

test('optional returning-customer login does not block guest checkout validation', () => {
  const loginSection = checkout.slice(
    checkout.indexOf('aria-label="Existing account email"'),
    checkout.indexOf('onClick={handleCheckoutLogin}'),
  );

  assert.ok(loginSection.length > 0);
  assert.doesNotMatch(loginSection, /\brequired\b/);
  assert.match(checkout, /or continue below as a guest/);
});

test('checkout validation focuses one invalid field without bouncing to the error summary', () => {
  assert.match(checkout, /errorSummaryRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(checkout, /if \(invalidFocusFrameRef\.current !== null\) return/);
  assert.match(checkout, /invalid\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(checkout, /invalid\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
});

test('staff sessions have a cart-preserving path into customer checkout', () => {
  assert.match(checkout, /async function handleStaffSignOutForCheckout\(\)/);
  assert.match(checkout, /Your cart, pricing, and attribution are preserved/);
  assert.match(checkout, /Sign out and continue checkout/);
});
