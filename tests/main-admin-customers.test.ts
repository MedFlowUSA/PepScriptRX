import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const customerActivity = readFileSync(new URL('../src/pages/admin/AdminCustomerActivity.tsx', import.meta.url), 'utf8');

test('Main Admin customer activity uses customer profiles instead of order-email counts', () => {
  assert.match(app, /platform={<AdminCustomerActivity \/>}/);
  assert.match(customerActivity, /\.from\('profiles'\)/);
  assert.match(customerActivity, /\.in\('role', CUSTOMER_ROLES\)/);
  assert.doesNotMatch(customerActivity, /newCustomers:\s*Array\.from\(byEmail/);
});

test('customer account metrics deduplicate by profile id', () => {
  assert.match(customerActivity, /profiles\.map\(\(profile\)/);
  assert.match(customerActivity, /<Stat label="Customer accounts" value={customers\.length} \/>/);
  assert.match(customerActivity, /<tr key={customer\.id}>/);
});
