import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const prod = 'https://ubfruugzofftwlomkqcl.supabase.co';
const stage = 'https://yjexrleubnjuitiyjvoy.supabase.co';
const secretSentinel = 'DO_NOT_PRINT_THIS_SECRET';

function verify(overrides: Record<string, string> = {}) {
  const env = {
    PATH: process.env.PATH ?? '',
    SYSTEMROOT: process.env.SYSTEMROOT ?? '',
    VERCEL_ENV: '', VERCEL_PROJECT_ID: '', VERCEL_PROJECT_PRODUCTION_URL: '', VITE_PUBLIC_SITE_URL: '',
    APP_ENV: '', VITE_APP_ENV: '', APP_PROJECT: '', VITE_APP_PROJECT: '', VITE_SUPABASE_URL: '', SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: secretSentinel,
    ...overrides,
  };
  const result = spawnSync(process.execPath, ['verify-deployment-targets.mjs'], { cwd: process.cwd(), env, encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(output.includes(secretSentinel), false, 'validator output exposed a secret value');
  return { status: result.status, output };
}

const prodIdentity = { APP_ENV: 'production', VITE_APP_ENV: 'production', APP_PROJECT: 'pepscriptrx', VITE_APP_PROJECT: 'pepscriptrx' };
const stageIdentity = { APP_ENV: 'staging', VITE_APP_ENV: 'staging', APP_PROJECT: 'pepscriptrx-staging', VITE_APP_PROJECT: 'pepscriptrx-staging' };

test('canonical pepscriptrx production with production Supabase passes', () => {
  assert.equal(verify({ VERCEL_ENV: 'production', VERCEL_PROJECT_ID: 'prj_ReiH3X8RHsv53zvOm49yCAq6O40Y', VERCEL_PROJECT_PRODUCTION_URL: 'pepscriptrx.vercel.app', ...prodIdentity, VITE_SUPABASE_URL: prod, SUPABASE_URL: prod }).status, 0);
});
test('canonical pepscriptrx production with staging Supabase fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'production', ...prodIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('dedicated staging primary deployment with VERCEL_ENV=production passes', () => {
  assert.equal(verify({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'pepscriptrx-staging.vercel.app', ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('dedicated staging with production Supabase fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'production', ...stageIdentity, VITE_SUPABASE_URL: prod, SUPABASE_URL: prod }).status, 0);
});
test('preview with explicit staging and staging Supabase passes', () => {
  assert.equal(verify({ VERCEL_ENV: 'preview', ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('preview with production Supabase fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'preview', ...stageIdentity, VITE_SUPABASE_URL: prod, SUPABASE_URL: prod }).status, 0);
});
test('production project identity with staging application identity fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'production', VERCEL_PROJECT_ID: 'prj_ReiH3X8RHsv53zvOm49yCAq6O40Y', ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('staging project identity with production application identity fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'pepscriptrx-staging.vercel.app', ...prodIdentity, VITE_SUPABASE_URL: prod, SUPABASE_URL: prod }).status, 0);
});
test('missing environment identity fails', () => {
  assert.notEqual(verify({ VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('conflicting client and server references fail', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'preview', ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: prod }).status, 0);
});
test('missing or conflicting project identity fails', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'preview', APP_ENV: 'staging', VITE_APP_ENV: 'staging', VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
  assert.notEqual(verify({ VERCEL_ENV: 'preview', ...stageIdentity, VITE_APP_PROJECT: 'pepscriptrx', VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('local development requires an explicit application and project target', () => {
  assert.notEqual(verify().status, 0);
  assert.equal(verify({ ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
test('staging rejects the production customer-facing domain', () => {
  assert.notEqual(verify({ VERCEL_ENV: 'production', VITE_PUBLIC_SITE_URL: 'https://pepscriptrx.vercel.app', ...stageIdentity, VITE_SUPABASE_URL: stage, SUPABASE_URL: stage }).status, 0);
});
