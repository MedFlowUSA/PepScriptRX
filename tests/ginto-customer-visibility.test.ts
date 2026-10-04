import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repDashboard = readFileSync(new URL('../src/pages/rep/RepDashboard.tsx', import.meta.url), 'utf8');
const glowScope = readFileSync(new URL('../src/lib/glowScope.ts', import.meta.url), 'utf8');

test('rep customer lists recover orders from every valid attribution field', () => {
  assert.match(repDashboard, /buildRepSubmissionScope\(r\)/);
  for (const field of ['rep_id', 'referral_code', 'source_rep', 'admin_code', 'checkout_scope_code']) {
    assert.match(repDashboard, new RegExp(`${field}\\.eq\\.`));
  }
});

test('Ginto is not included in frontend GLOW scope filters', () => {
  assert.doesNotMatch(glowScope, /GINTO/);
});
