import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const startCheckout = readFileSync(
  new URL('../src/pages/public/Start.tsx', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('../supabase/migrations/20260727213000_universal_psrx15_discount.sql', import.meta.url),
  'utf8',
);

test('PSRX15 is accepted by the main checkout at 15 percent', () => {
  assert.match(startCheckout, /const UNIVERSAL_DISCOUNT_CODE = 'PSRX15'/);
  assert.match(startCheckout, /const UNIVERSAL_DISCOUNT_PERCENT = 0\.15/);
  assert.match(startCheckout, /normalized === UNIVERSAL_DISCOUNT_CODE/);
});

test('PSRX15 promo is global, unlimited, and customer-facing', () => {
  assert.match(migration, /'PSRX15'/);
  assert.match(migration, /'percentage',\s+15,\s+'customer_discount'/);
  assert.match(migration, /'universal-psrx15'/);
  assert.match(migration, /store_scope_code = 'GLOBAL'/);
  assert.match(migration, /usage_limit = null/);
});

test('server calculation discounts products but not shipping', () => {
  assert.match(migration, /new\.discount_amount := round\(v_product_subtotal \* 0\.15, 2\)/);
  assert.match(migration, /new\.order_total := greatest\(0, v_product_subtotal - new\.discount_amount\) \+ v_shipping/);
  assert.match(migration, /new\.amount_due_cents := round\(new\.order_total \* 100\)::integer/);
});
