// Verify the approved publication snapshot against the catalog GLOW actually renders.
import { rolldown } from 'rolldown';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const bundle = await rolldown({ input: 'src/data/rxPlus.ts' });
try {
  const { output } = await bundle.generate({ format: 'esm' });
  const { getDistributorProducts } = await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
  const glow = getDistributorProducts('glow').map(p => [p.sku,p.strength,p.displayPrice]);
  const sql = readFileSync('supabase/migrations/20260928192000_pure_peptide_labs_glow_catalog.sql','utf8');
  const pure = [...sql.matchAll(/\('(RXP-[^']+)','([^']+)',([\d.]+),(true|false)\)/g)].map(r => [r[1],r[2],Number(r[3])]);
  const bySku = (a,b) => a[0].localeCompare(b[0]);
  assert.equal(glow.length,37);
  assert.deepEqual(pure.sort(bySku),glow.sort(bySku));
  console.log('All 37 Pure publication SKUs, strengths, and prices exactly match the current GLOW catalog.');
} finally { await bundle.close(); }
