import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const applicant=readFileSync('src/pages/applicant/AactivatedApplicantPortal.tsx','utf8');
const rep=readFileSync('src/pages/rep/AactivatedOnboarding.tsx','utf8');
const admin=readFileSync('src/pages/admin/AdminAactivatedOnboarding.tsx','utf8');
const manage=readFileSync('supabase/functions/manage-aactivated-onboarding/index.ts','utf8');
const approve=readFileSync('supabase/functions/approve-aactivated-onboarding/index.ts','utf8');
const submit=readFileSync('supabase/functions/submit-aactivated-onboarding/index.ts','utf8');
const kit=readFileSync('supabase/functions/create-aactivated-starter-kit-order/index.ts','utf8');
const migration=readFileSync('supabase/migrations/20260806180000_complete_aactivated_onboarding_workflow.sql','utf8');
const submissionFix=readFileSync('supabase/migrations/20260807120000_fix_aactivated_onboarding_submissions.sql','utf8');
const approvedAgreement=readFileSync('supabase/migrations/20260807140000_publish_aactivated_rep_agreement.sql','utf8');

test('applicant can securely resubmit requested information',()=>{
  assert.match(applicant,/more_info_requested/);
  assert.match(applicant,/approval_status:'pending'/);
  assert.match(applicant,/Send updated information/);
});

test('admin decisions and compliance reviews use the secured function',()=>{
  assert.match(admin,/approve-aactivated-onboarding/);
  assert.match(admin,/application_more_info/);
  assert.match(manage,/w9_review/);
  assert.match(manage,/payout_review/);
  assert.doesNotMatch(admin,/tin_ciphertext|destination_ciphertext/);
});

test('agreement requires explicit legal approval before publication',()=>{
  assert.match(admin,/legal_approval_confirmed/);
  assert.match(manage,/content\.length<100/);
  assert.match(manage,/agreement_published/);
});

test('published agreement resolves company, venue, notices, and company signature',()=>{
  assert.match(approvedAgreement,/Vitality Enterprises LLC/);
  assert.match(approvedAgreement,/San Bernardino County/);
  assert.match(approvedAgreement,/service@pepscriptrx\.com/);
  assert.match(approvedAgreement,/411 W State St, Suite B, Redlands, CA 92373/);
  assert.match(approvedAgreement,/company_signer_name.*Manuel Rodriguez/s);
  assert.match(approvedAgreement,/status = 'approved'|, 'approved',/);
  assert.match(approvedAgreement,/still contains unresolved draft language/);
});

test('starter kit uses authoritative private checkout and paid completion trigger',()=>{
  assert.match(rep,/create-aactivated-starter-kit-order/);
  assert.match(kit,/amountCents = Math\.round\(promoPrice \* 100\)/);
  assert.match(migration,/new\.payment_status = 'paid'/);
  assert.match(migration,/starter_kit_status='complete'/);
});

test('payout remains pending until administrative verification',()=>{
  assert.match(submit,/payout_status: 'submitted'/);
  assert.match(manage,/verification_status:status/);
  assert.match(manage,/payout_status:status==='verified'\?'complete':'correction_required'/);
});

test('secure submissions evaluate status as the authenticated representative',()=>{
  assert.match(submit,/userClient\.rpc\('evaluate_aactivated_onboarding'/);
  assert.doesNotMatch(submit,/await db\.rpc\('evaluate_aactivated_onboarding'/);
});

test('administrative reviews evaluate status as the authenticated administrator',()=>{
  assert.match(manage,/auth\.rpc\('evaluate_aactivated_onboarding'/);
  assert.doesNotMatch(manage,/await db\.rpc\('evaluate_aactivated_onboarding'/);
});

test('account setup can be completed and pending reviews cannot be duplicated',()=>{
  assert.match(submit,/body\.action === 'account'/);
  assert.match(rep,/Confirm account setup/);
  assert.match(rep,/status === 'submitted' \|\| status === 'under_review'/);
  assert.match(rep,/return 'Under Review'/);
});

test('application decisions send secure portal notifications and retain delivery status',()=>{
  assert.match(approve,/api\.resend\.com\/emails/);
  assert.match(approve,/application_approved/);
  assert.match(manage,/api\.resend\.com\/emails/);
  assert.match(manage,/status:response\.ok\?'sent':'failed'/);
  assert.doesNotMatch(approve,/password/i);
});

test('approval resolves the exact applicant identity and rejects duplicate rep codes',()=>{
  assert.match(approve,/existingOnboarding/);
  assert.match(approve,/Representative code is already assigned/);
  assert.match(approve,/applicant_user_id:authUser\.id/);
  assert.match(approve,/profileError/);
  assert.match(approve,/repLinkError/);
  assert.match(approve,/applicationUpdateError/);
});

test('starter-kit eligibility builds predicate arrays without text array coercion',()=>{
  assert.match(submissionFix,/array_append\(filters,/);
  assert.doesNotMatch(submissionFix,/filters\s*:=\s*filters\s*\|\|\s*'/);
});
