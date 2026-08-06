import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const application = readFileSync('src/pages/public/AactivatedRepApplication.tsx','utf8');
const onboarding = readFileSync('src/pages/rep/AactivatedOnboarding.tsx','utf8');
const admin = readFileSync('src/pages/admin/AdminAactivatedOnboarding.tsx','utf8');
const submit = readFileSync('supabase/functions/submit-aactivated-onboarding/index.ts','utf8');
const approve = readFileSync('supabase/functions/approve-aactivated-onboarding/index.ts','utf8');
const migration = readFileSync('supabase/migrations/20260806120000_aactivated_rep_onboarding_staging.sql','utf8');

test('AACTIVATED application collects only approved application data',()=>{
  assert.doesNotMatch(application,/PayPal Account|bank information|social security|tax classification/i);
  assert.doesNotMatch(application,/paypal_account|PayPal Account|PayPal\.Me/i);
  assert.match(application,/application_terms_accepted_at/);
});

test('secure approval never returns or creates plaintext passwords',()=>{
  assert.doesNotMatch(approve,/temporaryPassword|encrypted_password|password:/);
  assert.match(approve,/generateLink\(\{type:'recovery'/);
  assert.match(approve,/commission_rate:0/);
  assert.match(approve,/active:false/);
  assert.match(approve,/referral_path:null/);
});

test('onboarding contains required steps and no welcome video',()=>{
  assert.match(onboarding,/Rep Agreement/);
  assert.match(onboarding,/Electronic Form W-9/);
  assert.match(onboarding,/Starter Kit/);
  assert.match(onboarding,/Payout Information/);
  assert.doesNotMatch(onboarding,/welcome.?video/i);
});

test('TIN and payout details are encrypted server-side and omitted from admin report',()=>{
  assert.match(submit,/AES-GCM/);
  assert.match(submit,/tin_ciphertext/);
  assert.match(submit,/TIN: \*\*\*-\*\*-/);
  assert.doesNotMatch(admin,/tin_ciphertext|destination_ciphertext|tin_last_four/);
  assert.match(migration,/revoke insert, update, delete on public\.aactivated_w9_submissions from authenticated/);
  assert.match(migration,/public=false/);
});

test('agreement is versioned and only approved published content can be signed',()=>{
  assert.match(submit,/eq\('status', 'approved'\)\.not\('published_at'/);
  assert.match(migration,/unique \(onboarding_id, agreement_id\)/);
  assert.match(migration,/rendered_content text not null/);
});

test('activation is a centralized server-side transition',()=>{
  assert.match(migration,/evaluate_aactivated_onboarding/);
  assert.match(migration,/activate_aactivated_onboarding/);
  assert.match(migration,/commissions_enabled=true, referral_enabled=true/);
});
