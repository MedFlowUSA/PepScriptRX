import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const portalConfig = readFileSync(new URL('../src/config/whiteLabelPortals.ts', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../src/data/rxPlus.ts', import.meta.url), 'utf8');

test('Radiance has a dedicated canonical storefront', () => {
  assert.match(appSource, /path="\/radiance" element=\{<RadianceStorefront \/>\}/);
  assert.match(portalConfig, /brandName: 'Radiance Wellness'/);
  assert.match(portalConfig, /path: '\/radiance'/);
  assert.match(catalogSource, /portal_name: 'Radiance Wellness'/);
});

test('legacy EHWSUB routes redirect to the canonical Radiance storefront', () => {
  assert.match(appSource, /path="\/EHWSUB" element=\{<Navigate to="\/radiance" replace \/>\}/);
  assert.match(appSource, /path="\/ehwsub" element=\{<Navigate to="\/radiance" replace \/>\}/);
  assert.match(appSource, /path="\/rx-plus\/EHWSUB" element=\{<Navigate to="\/radiance" replace \/>\}/);
  assert.match(appSource, /path="\/rx-plus\/ehwsub" element=\{<Navigate to="\/radiance" replace \/>\}/);
});
