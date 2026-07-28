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

test('Main Admin dashboard excludes non-production and not-eligible orders from every metric', () => {
  const dashboard = readFileSync('src/pages/admin/AdminDashboard.tsx', 'utf8');

  assert.match(dashboard, /import \{ isVisibleMainAdminOrder \} from '\.\.\/\.\.\/lib\/nonProductionOrders'/);
  assert.match(dashboard, /scopedData[\s\S]*?filter\(isVisibleMainAdminOrder\)/);
  assert.match(dashboard, /setRecent\([\s\S]*?nextRows\.filter\(isVisibleMainAdminOrder\)/);
});
