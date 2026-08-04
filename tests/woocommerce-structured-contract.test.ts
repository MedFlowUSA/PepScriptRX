import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkoutFingerprint,
  PROCESSING_FEE_BASIS_POINTS,
  PROCESSING_FEE_RULE,
  processingFeeCents,
  structuredCheckoutItems,
} from '../supabase/functions/_shared/woocommerce-contract.ts';

test('WooCommerce processing fee is capped at three percent with integer-cent half-up rounding exactly once', () => {
  assert.equal(PROCESSING_FEE_RULE, 'woocommerce_3_percent_v1');
  assert.equal(PROCESSING_FEE_BASIS_POINTS, 300);
  assert.equal(processingFeeCents(0), 0);
  assert.equal(processingFeeCents(16), 0);
  assert.equal(processingFeeCents(17), 1);
  assert.equal(processingFeeCents(1500), 45);
  assert.equal(processingFeeCents(12345), 370);
  assert.throws(() => processingFeeCents(-1), /Invalid pre-fee amount/);
  assert.throws(() => processingFeeCents(1.5), /Invalid pre-fee amount/);
});

test('authoritative product lines retain products, variations, quantities, and discounts', () => {
  const items = structuredCheckoutItems([
    { id: 'product-a', sku: 'A-10', name: 'Product A', strength: '10 mg', price: 10, quantity: 2 },
    { id: 'product-b', sku: 'B-5', name: 'Product B', strength: '5 mg', price: 5, quantity: 1 },
  ], 333);
  assert.deepEqual(items, [
    {
      product_id: 'product-a', sku: 'A-10', name: 'Product A', variation: '10 mg', quantity: 2,
      unit_amount_cents: 1000, line_subtotal_cents: 2000, discount_cents: 266, line_total_cents: 1734,
    },
    {
      product_id: 'product-b', sku: 'B-5', name: 'Product B', variation: '5 mg', quantity: 1,
      unit_amount_cents: 500, line_subtotal_cents: 500, discount_cents: 67, line_total_cents: 433,
    },
  ]);
  assert.equal(items.reduce((sum, item) => sum + item.discount_cents, 0), 333);
  assert.equal(items.reduce((sum, item) => sum + item.line_total_cents, 0), 2167);
});

test('invalid or altered authoritative lines and discounts fail closed', () => {
  const valid = { id: 'product-a', name: 'Product A', price: 10, quantity: 1 };
  assert.throws(() => structuredCheckoutItems([], 0), /no authoritative line items/);
  assert.throws(() => structuredCheckoutItems([{ ...valid, id: '' }], 0), /invalid authoritative line item/);
  assert.throws(() => structuredCheckoutItems([{ ...valid, quantity: 0 }], 0), /invalid authoritative line item/);
  assert.throws(() => structuredCheckoutItems([{ ...valid, quantity: 21 }], 0), /invalid authoritative line item/);
  assert.throws(() => structuredCheckoutItems([{ ...valid, price: -1 }], 0), /invalid authoritative line item/);
  assert.throws(() => structuredCheckoutItems([valid], 1001), /Invalid authoritative discount/);
});

test('cart fingerprint changes for amount, currency, product, or quantity tampering', async () => {
  const base = { order_id: 'order-1', currency: 'USD', items: [{ product_id: 'a', quantity: 1 }], pre_fee_amount_cents: 1000 };
  const fingerprint = await checkoutFingerprint(base);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  for (const altered of [
    { ...base, pre_fee_amount_cents: 1001 },
    { ...base, currency: 'EUR' },
    { ...base, items: [{ product_id: 'b', quantity: 1 }] },
    { ...base, items: [{ product_id: 'a', quantity: 2 }] },
  ]) {
    assert.notEqual(await checkoutFingerprint(altered), fingerprint);
  }
});
