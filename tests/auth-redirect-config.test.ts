import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync('supabase/config.toml', 'utf8');
const authHelpers = readFileSync('src/lib/supabase.ts', 'utf8');
const login = readFileSync('src/pages/public/Login.tsx', 'utf8');
const reset = readFileSync('src/pages/public/ResetPassword.tsx', 'utf8');
const dashLayout = readFileSync('src/components/layout/DashLayout.tsx', 'utf8');

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

test('AACTIVATED rep password recovery preserves the branded rep portal end to end', () => {
  assert.match(login, /getPasswordResetUrl\([\s\S]*brand: brandPortal\?\.id[\s\S]*portal: searchParams\.get\('portal'\)/);
  assert.match(dashLayout, /changePasswordPath[\s\S]*brand=.*accountPortal\.id.*portal=.*accountPortalRole/);
  assert.match(reset, /buildPortalLoginPath\(brandPortal, portalRole\)/);
  assert.match(reset, /auth\.signOut\(\{ scope: 'local' \}\)/);
});

test('password resets enforce the same strong-password baseline as rep signup', () => {
  assert.match(reset, /password\.length >= 10/);
  assert.match(reset, /\/\[a-z\]\//);
  assert.match(reset, /\/\[A-Z\]\//);
  assert.match(reset, /\/\\d\//);
});
