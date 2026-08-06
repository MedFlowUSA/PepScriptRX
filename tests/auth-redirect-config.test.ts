import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync('supabase/config.toml', 'utf8');
const authHelpers = readFileSync('src/lib/supabase.ts', 'utf8');

test('staging auth never uses localhost as its default email redirect', () => {
  assert.match(config, /\[auth\][\s\S]*site_url = "https:\/\/pepscriptrx\.vercel\.app"/);
  assert.doesNotMatch(config, /site_url = "http:\/\/localhost/);
});

test('password reset and callback destinations are allow-listed', () => {
  assert.match(config, /https:\/\/pepscriptrx\.vercel\.app\/reset-password/);
  assert.match(config, /https:\/\/pepscriptrx\.vercel\.app\/auth\/callback/);
  assert.match(config, /https:\/\/\*-manuel-rodriguezs-projects-f5946c44\.vercel\.app\/\*\*/);
  assert.match(authHelpers, /PRODUCTION_SITE_URL = 'https:\/\/pepscriptrx\.vercel\.app'/);
});
