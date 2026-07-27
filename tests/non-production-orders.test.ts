import assert from 'node:assert/strict';
import test from 'node:test';
import { isNonProductionOrder } from '../src/lib/nonProductionOrders.ts';

test('hides explicit test, sample, demo, QA, and miscellaneous orders', () => {
  assert.equal(isNonProductionOrder({ full_name: 'Test Order' }), true);
  assert.equal(isNonProductionOrder({ product_name: 'Sample Product' }), true);
  assert.equal(isNonProductionOrder({ submission_type: 'demo' }), true);
  assert.equal(isNonProductionOrder({ store_slug: 'qa_order' }), true);
  assert.equal(isNonProductionOrder({ medication: 'Miscellaneous' }), true);
  assert.equal(isNonProductionOrder({ email: 'test+checkout@pepscriptrx.com' }), true);
});

test('keeps legitimate production orders with incidental matching text', () => {
  assert.equal(isNonProductionOrder({
    full_name: 'Contest Winner',
    email: 'customer@example.org',
    product_name: 'Retatrutide',
    store_slug: 'aactivated',
  }), false);
  assert.equal(isNonProductionOrder({
    full_name: 'Sam Pleasant',
    email: 'sam@example.org',
    medication: 'Semaglutide',
  }), false);
});
