import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync('supabase/config.toml', 'utf8');
const authHelpers = readFileSync('src/lib/supabase.ts', 'utf8');
const login = readFileSync('src/pages/public/Login.tsx', 'utf8');
const reset = readFileSync('src/pages/public/ResetPassword.tsx', 'utf8');
const dashLayout = readFileSync('src/components/layout/DashLayout.tsx', 'utf8');
const repIntakeAdmin = readFileSync('src/pages/admin/AdminRepIntake.tsx', 'utf8');

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

test('AACTIVATED admin can send a correctly branded rep password reset', () => {
  assert.match(repIntakeAdmin, /Send Rep Password Reset/);
  assert.match(repIntakeAdmin, /resetPasswordForEmail\(email/);
  assert.match(repIntakeAdmin, /getPasswordResetUrl\(\{ brand: 'aactivated', portal: 'rep' \}\)/);
  assert.match(repIntakeAdmin, /Administrators never see or create the rep's password/);
});

test('rep final activation refreshes admin authentication and surfaces the server reason', () => {
  assert.match(repIntakeAdmin, /auth\.refreshSession\(\)/);
  assert.match(repIntakeAdmin, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(repIntakeAdmin, /context\.clone\(\)\.json\(\)/);
  assert.match(repIntakeAdmin, /Final approval|edgeFunctionErrorMessage/);
});
