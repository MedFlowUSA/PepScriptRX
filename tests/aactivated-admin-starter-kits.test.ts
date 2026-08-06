import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page=readFileSync('src/pages/admin/AdminAactivatedStarterKits.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const nav=readFileSync('src/pages/admin/adminNav.ts','utf8');

test('AACTIVATED admins can manage and monitor starter kits',()=>{
  assert.match(app,/\/admin\/starter-kits/);
  assert.match(app,/AactivatedOnlyAdminToolPage element=\{<AdminAactivatedStarterKits/);
  assert.match(nav,/Starter Kits/);
  assert.match(page,/aactivated_starter_kit_packages/);
  assert.match(page,/aactivated_starter_kit_orders/);
  assert.match(page,/enabled:!row\.enabled/);
});
