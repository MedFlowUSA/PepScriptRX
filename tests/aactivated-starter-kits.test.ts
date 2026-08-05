import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AACTIVATED_STARTER_KITS,
  evaluateStarterKitCheckout,
  starterKitComponents,
  validateStarterKitSelection,
  type StarterKitInventoryRow,
} from '../src/lib/aactivatedStarterKits.ts';

const allInventory: StarterKitInventoryRow[] = [
  { sku: 'RXP-GLP-RETA-20', name: 'RETA 20 mg', quantity: 1, currentQty: 5, active: true },
  { sku: 'TR30', name: 'Tirzepatide 30 mg', quantity: 1, currentQty: 5, active: true },
  { sku: 'RXP-LONG-NAD-1000', name: 'NAD+ 1000 mg', quantity: 1, currentQty: 5, active: true },
  { sku: 'RXP-MAIN-GLOW70', name: 'Glow', quantity: 1, currentQty: 5, active: true },
  { sku: 'RXP-MAIN-WOLVERINE-20', name: 'Wolverine Stack', quantity: 1, currentQty: 5, active: true },
  { sku: 'RXP-REC-BPC157-10', name: 'BPC-157 10 mg', quantity: 1, currentQty: 5, active: true },
  { sku: 'WA10', name: 'BAC Water 10 mL', quantity: 3, currentQty: 9, active: true },
];

test('AACTIVATED starter kits match the requested package prices and savings', () => {
  assert.deepEqual(AACTIVATED_STARTER_KITS.map((kit) => [kit.packageId, kit.retailValue, kit.promoPrice, kit.savings]), [
    ['starter-experience-kit', 447, 249, 198],
    ['momentum-business-builder-kit', 850, 499, 351],
    ['ultimate-business-builder-kit', 1099, 699, 400],
  ]);
});

test('starter experience requires exactly one supported variation', () => {
  assert.equal(validateStarterKitSelection('starter-experience-kit').reason, 'variation_required');
  assert.equal(validateStarterKitSelection('starter-experience-kit', 'reta').allowed, true);
  assert.equal(validateStarterKitSelection('starter-experience-kit', 'tirz').allowed, true);
  assert.equal(validateStarterKitSelection('starter-experience-kit', 'both').reason, 'unknown_variation');
  assert.equal(validateStarterKitSelection('momentum-business-builder-kit', 'reta').reason, 'variation_not_allowed');
});

test('starter experience variations are inventory-backed component bundles', () => {
  assert.deepEqual(starterKitComponents('starter-experience-kit', 'reta').map((row) => [row.sku, row.quantity]), [
    ['RXP-GLP-RETA-20', 1],
    ['RXP-LONG-NAD-1000', 1],
    ['RXP-MAIN-GLOW70', 1],
    ['WA10', 2],
  ]);
  assert.deepEqual(starterKitComponents('starter-experience-kit', 'tirz').map((row) => [row.sku, row.quantity]), [
    ['TR30', 1],
    ['RXP-LONG-NAD-1000', 1],
    ['RXP-MAIN-WOLVERINE-20', 1],
    ['WA10', 2],
  ]);
});

test('business builder kits include every requested underlying product', () => {
  const momentum = starterKitComponents('momentum-business-builder-kit');
  const ultimate = starterKitComponents('ultimate-business-builder-kit');
  assert.deepEqual(momentum.map((row) => row.sku), ['RXP-GLP-RETA-20', 'TR30', 'RXP-LONG-NAD-1000', 'RXP-MAIN-GLOW70', 'RXP-MAIN-WOLVERINE-20', 'WA10']);
  assert.deepEqual(ultimate.map((row) => row.sku), ['RXP-GLP-RETA-20', 'TR30', 'RXP-MAIN-WOLVERINE-20', 'RXP-REC-BPC157-10', 'RXP-LONG-NAD-1000', 'RXP-MAIN-GLOW70', 'WA10']);
});

test('private checkout rejects public users, other reps, coupons, and commission stacking', () => {
  assert.equal(evaluateStarterKitCheckout({ audience: 'public', packageId: 'momentum-business-builder-kit', inventory: allInventory }).reason, 'private_aactivated_only');
  assert.equal(evaluateStarterKitCheckout({ audience: 'other_rep', packageId: 'momentum-business-builder-kit', inventory: allInventory }).reason, 'private_aactivated_only');
  assert.equal(evaluateStarterKitCheckout({ audience: 'aactivated_rep', packageId: 'momentum-business-builder-kit', inventory: allInventory, couponCode: 'REP50' }).reason, 'discount_codes_not_allowed');
  assert.equal(evaluateStarterKitCheckout({ audience: 'aactivated_rep', packageId: 'momentum-business-builder-kit', inventory: allInventory, commissionEnabled: true }).reason, 'commission_stacking_not_allowed');
});

test('purchase limits block reps while admin override can reopen access', () => {
  assert.equal(evaluateStarterKitCheckout({
    audience: 'aactivated_rep',
    packageId: 'momentum-business-builder-kit',
    priorPurchases: ['momentum-business-builder-kit'],
    inventory: allInventory,
  }).reason, 'purchase_limit_reached');
  assert.equal(evaluateStarterKitCheckout({
    audience: 'aactivated_rep',
    packageId: 'momentum-business-builder-kit',
    priorPurchases: ['momentum-business-builder-kit'],
    adminOverride: true,
    inventory: allInventory,
  }).allowed, true);
});

test('inventory validation fails closed by underlying SKU', () => {
  const low = allInventory.map((row) => row.sku === 'WA10' ? { ...row, currentQty: 1 } : row);
  assert.equal(evaluateStarterKitCheckout({
    audience: 'aactivated_rep',
    packageId: 'ultimate-business-builder-kit',
    inventory: low,
  }).reason, 'inventory_unavailable:WA10');
});

test('starter-kit route and admin manager are wired without replacing public AACTIVATED checkout', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const repDashboard = readFileSync('src/pages/rep/RepDashboard.tsx', 'utf8');
  const adminTools = readFileSync('src/pages/admin/AdminAactivatedPartnerTools.tsx', 'utf8');
  assert.match(app, /path="\/aactivated\/rep\/starter-kits"/);
  assert.match(app, /ProtectedRoute roles=\{\['rep', 'admin', 'rx_plus_admin'\]\}/);
  assert.match(app, /mode="starter-kits"/);
  assert.match(repDashboard, /AACTIVATED_STARTER_KIT_PATH/);
  assert.match(adminTools, /AactivatedStarterKitManager/);
});

test('database migration keeps starter kit paid effects isolated to REP_INTERNAL orders', () => {
  const migration = readFileSync('supabase/migrations/20260805210000_aactivated_rep_starter_kits.sql', 'utf8');
  const checkoutFunction = readFileSync('supabase/functions/create-aactivated-starter-kit-order/index.ts', 'utf8');
  const sharedFinalizer = readFileSync('supabase/migrations/20260731010000_shared_paid_order_finalizer.sql', 'utf8');
  assert.match(checkoutFunction, /order_type:\s*'REP_INTERNAL'/);
  assert.match(checkoutFunction, /partner_payout_eligible:\s*false/);
  assert.match(checkoutFunction, /discount_code:\s*null/);
  assert.match(migration, /finalize_aactivated_starter_kit_order/);
  assert.match(migration, /update public\.inventory_items\s+set current_qty = current_qty - v_qty/);
  assert.match(migration, /aactivated_starter_kit_resource_access/);
  assert.match(sharedFinalizer, /not in \('REP_SAMPLE', 'REP_INTERNAL'\)/);
});

test('private order function validates auth before creating payment tokens', () => {
  const edgeFunction = readFileSync('supabase/functions/create-aactivated-starter-kit-order/index.ts', 'utf8');
  assert.match(edgeFunction, /Authentication required/);
  assert.match(edgeFunction, /db\.auth\.getUser\(bearer\)/);
  assert.match(edgeFunction, /AACTIVATEDRX rep access required/);
  assert.match(edgeFunction, /Purchase limit reached/);
  assert.match(edgeFunction, /Inventory unavailable/);
});
