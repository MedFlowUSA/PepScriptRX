import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGintoTirzepatideOrder } from '../supabase/functions/_shared/ginto-pricing.ts';

test('Ginto Tirzepatide 30mg is normalized to 199 dollars', () => {
  const result = normalizeGintoTirzepatideOrder({
    store_slug: 'ginto',
    quoted_price: 600,
    order_total: 600,
    discount_amount: 0,
    shipping_cost: 0,
    order_items: [{ id: 'tirzepatide-30mg', name: 'Tirzepatide', strength: '30mg', price: 600, quantity: 1 }],
  });

  assert.equal(result.changed, true);
  assert.equal(result.order.quoted_price, 199);
  assert.equal(result.order.order_total, 199);
  assert.equal((result.order.order_items as Array<Record<string, unknown>>)[0].price, 199);
});

test('Ginto Tirzepatide 60mg quantity is normalized to 249 dollars per item', () => {
  const result = normalizeGintoTirzepatideOrder({
    checkout_scope_code: 'GINTO',
    quoted_price: 1900,
    order_total: 1900,
    discount_amount: 0,
    shipping_cost: 0,
    order_items: [{ sku: 'RXP-GLP-TIRZ-60', name: 'Tirzepatide 60mg', price: 950, qty: 2 }],
  });

  assert.equal(result.changed, true);
  assert.equal(result.order.quoted_price, 498);
  assert.equal(result.order.order_total, 498);
  assert.equal((result.order.order_items as Array<Record<string, unknown>>)[0].quantity, 2);
});

test('Ginto mixed carts retain other line prices and reprice Tirzepatide', () => {
  const result = normalizeGintoTirzepatideOrder({
    source_portal: 'Ginto Wellness Labs',
    quoted_price: 699,
    order_total: 699,
    discount_amount: 0,
    shipping_cost: 0,
    order_items: [
      { id: 'tirzepatide-30mg', name: 'Tirzepatide 30mg', price: 600, quantity: 1 },
      { id: 'semaglutide-10mg', name: 'Semaglutide 10mg', price: 99, quantity: 1 },
    ],
  });

  assert.equal(result.order.quoted_price, 298);
  assert.equal(result.order.order_total, 298);
});

test('Ginto percentage discounts are recalculated from the corrected subtotal', () => {
  const result = normalizeGintoTirzepatideOrder({
    referral_code: 'GINTO',
    quoted_price: 950,
    order_total: 807.5,
    discount_code: 'PSRX15',
    discount_amount: 142.5,
    shipping_cost: 0,
    order_items: [{ id: 'tirzepatide-60mg', name: 'Tirzepatide 60mg', price: 950, quantity: 1 }],
  });

  assert.equal(result.order.quoted_price, 249);
  assert.equal(result.order.discount_amount, 37.35);
  assert.equal(result.order.order_total, 211.65);
});

test('non-Ginto orders are not changed', () => {
  const order = {
    store_slug: 'main',
    quoted_price: 950,
    order_total: 950,
    order_items: [{ id: 'tirzepatide-60mg', name: 'Tirzepatide 60mg', price: 950, quantity: 1 }],
  };
  const result = normalizeGintoTirzepatideOrder(order);

  assert.equal(result.changed, false);
  assert.equal(result.order, order);
});
