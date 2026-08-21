import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const storefront = fs.readFileSync('src/pages/public/LongevityWellnessStorefront.tsx','utf8');
const migration = fs.readFileSync('supabase/migrations/20260821233000_longevity_wellness_cynthia_direct_store.sql','utf8');

test('Longevity Wellness exposes the exact 29-item curated catalog once', () => {
  const rows = [...storefront.matchAll(/^\s+\['([^']+)'[^\n]+\],$/gm)];
  assert.equal(rows.length,29);
  assert.equal(new Set(rows.map((row) => row[1])).size,29);
  for (const [name, price] of [['Retatrutide','179'],['Tirzepatide','129'],['Semaglutide','99'],['Wolverine Stack','159'],['HGH / Somatropin','285']]) {
    assert.match(storefront,new RegExp(`'${name}'[^\\n]+,${price},`));
  }
});

test('checkout attribution is a parentless 50% Cynthia direct store', () => {
  assert.match(storefront,/const OWNER = 'CYNTHIA50'/);
  assert.match(storefront,/commission_rate:\.5/);
  assert.match(storefront,/parent_brand_id:null/);
  assert.match(storefront,/override_commission:0/);
  assert.match(migration,/parent_account_id=null/);
  assert.match(migration,/parent_rep_id=null/);
  assert.match(migration,/commission_percent=50/);
});

test('all supplied brand assets and canonical route are wired', () => {
  for (const file of ['longevity-logo.png','longevity-vial.png','longevity-hero.png']) assert.equal(fs.existsSync(`public/brands/longevity-wellness/${file}`),true);
  assert.match(fs.readFileSync('src/App.tsx','utf8'),/path="\/longevity-wellness"/);
});
