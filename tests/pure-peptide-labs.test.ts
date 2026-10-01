import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPureCart, mapPureCatalogRow, PURE_APPROVED_SHARED_SKUS, PURE_STORE, pureProductImage, type PureCatalogRow } from '../src/lib/purePeptideLabsCatalog.ts';
import { buildPortalLeadCapture } from '../src/lib/portalLeadCapture.ts';
import { getPartnerTenant, isPlatformAdmin, partnerCan } from '../src/lib/partnerTenant.ts';
import type { WhiteLabelPortal } from '../src/config/whiteLabelPortals.ts';
import type { Profile } from '../src/types';

const fixture = {
  id: 'assignment', product_id: 'approved-id', is_enabled: true, enabled: true,
  custom_price: 125, custom_retail_price: 150,
  product: { id: 'approved-id', product_name: 'Test catalog record', sku: 'TEST', strength: 'Test strength', category: 'Test category', active: true, visibility_type: 'rx_plus', suggested_retail_price: 999 },
} as PureCatalogRow;

test('only explicit active partner assignments with a configured retail price are published', () => {
  assert.equal(mapPureCatalogRow(fixture)?.displayPrice, 125);
  for (const change of [{ is_enabled: false }, { enabled: false }, { custom_price: null, custom_retail_price: null }, { custom_price: 0 }, { custom_price: -1 }, { custom_price: Infinity }, { product: null }]) {
    assert.equal(mapPureCatalogRow({ ...fixture, ...change }), null);
  }
  for (const change of [{ active: false }, { visibility_type: 'wholesale_only' }, { visibility_type: 'invite_only' }, { partner_slug: 'glow' }]) {
    assert.equal(mapPureCatalogRow({ ...fixture, product: { ...fixture.product!, ...change } } as PureCatalogRow), null);
  }
});

test('checkout reuses the platform cart contract and excludes unknown or unavailable items', () => {
  const p = mapPureCatalogRow(fixture)!;
  assert.equal(buildPureCart([p], { [p.id]: 2 }).items.length, 0);
  p.inventoryStatus = { inventory_status: 'in_stock', inventory_status_label: 'In stock', checkout_allowed: true, was_special_order: false, quantity_on_hand: 10, low_stock_threshold: 3, estimated_fulfillment_days: 14, allow_special_order: false, supporting_copy: null };
  const cart = buildPureCart([p], { [p.id]: 2, 'another-store-item': 5 });
  assert.equal(cart.total, 250);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.scope_code, 'PUREPEPTIDELABS');
  assert.equal(cart.rep, 'LILY60');
  assert.equal(cart.parent_brand_id, null);
  assert.equal(cart.override_commission, 0);
  assert.equal(cart.commission_rate, 0.65);
  assert.equal(buildPureCart([p], { [p.id]: 1.5 }).items.length, 0);
  assert.equal(pureProductImage(p), `${PURE_STORE.assets}/vial.png`);
});

test('approved GLOW shared records still require Pure publication and Pure pricing', () => {
  const sql = readFileSync('supabase/migrations/20260928192000_pure_peptide_labs_glow_catalog.sql', 'utf8');
  const rows = [...sql.matchAll(/\('(RXP-[^']+)','([^']+)',([\d.]+),(true|false)\)/g)];
  assert.equal(rows.length, 37);
  assert.deepEqual(new Set(rows.map((r) => r[1])), PURE_APPROVED_SHARED_SKUS);
  for (const [, sku, strength, price] of rows) {
    const row = { ...fixture, custom_price: Number(price), product: { ...fixture.product!, sku, strength, partner_slug: 'guy' } };
    assert.equal(mapPureCatalogRow(row)?.displayPrice, Number(price));
    assert.equal(mapPureCatalogRow({ ...row, is_enabled: false }), null);
    assert.equal(mapPureCatalogRow({ ...row, custom_price: null, custom_retail_price: null }), null);
    assert.equal(mapPureCatalogRow({ ...row, product: { ...row.product, partner_slug: 'another-store' } }), null);
  }
  assert.equal(mapPureCatalogRow({ ...fixture, product: { ...fixture.product!, partner_slug: 'guy' } }), null);
  assert.equal(PURE_STORE.commissionRate, .65);
});

test('owner seed creates no identity, guessed email, catalog rows, or payout mutation', () => {
  const sql = readFileSync('supabase/migrations/20260928190000_pure_peptide_labs_direct_store.sql', 'utf8');
  assert.doesNotMatch(sql, /insert into (?:auth\.users|public\.profiles|public\.distributor_products|public\.payouts)/i);
  assert.doesNotMatch(sql, /@[a-z]/i);
  assert.match(sql, /'direct_store_commission',0\.6000,0,0\.4000/);
  assert.match(sql, /'PUREPEPTIDELABS','Pure Peptide Labs','rep','LILY60',null,true,0\.6000/);
});

test('Lily resolves to one limited tenant with no platform or pricing privileges', () => {
  const profile = { role: 'partner_admin_limited', brand_id: 'purepeptidelabs', store_slug: 'purepeptidelabs', admin_scope: 'PUREPEPTIDELABS', partner_access_level: 'limited' } as Profile;
  assert.equal(getPartnerTenant(profile)?.brandId, 'purepeptidelabs');
  assert.equal(isPlatformAdmin(profile), false);
  assert.equal(partnerCan(profile, 'pricing'), false);
  assert.equal(partnerCan(profile, 'inventory'), false);
  assert.equal(partnerCan(profile, 'orders'), true);
  assert.equal(getPartnerTenant({ role: 'rep', brand_id: 'glow' } as Profile)?.brandId, 'glow');
});

test('Pure age confirmation never invents a discount; existing portal opt-ins are unchanged', () => {
  const portal = { id: 'purepeptidelabs', brandName: 'Pure Peptide Labs', path: '/purepeptidelabs', ageGateDiscountEnabled: false } as WhiteLabelPortal;
  const values = { firstName: 'Test', lastName: 'Visitor', email: 'qa@example.invalid', phone: '' };
  const pure = buildPortalLeadCapture(portal, values);
  assert.equal(pure.discountTriggered, false);
  assert.equal(pure.discountPercent, 0);
  assert.equal(pure.discountCode, '');
  assert.equal(buildPortalLeadCapture({ ...portal, id: 'glow', ageGateDiscountEnabled: undefined }, values).discountTriggered, true);
});
