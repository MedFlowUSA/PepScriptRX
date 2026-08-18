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
const starterPriceFix=readFileSync('supabase/migrations/20260807150000_fix_aactivated_starter_tirzepatide_price.sql','utf8');
const payoutMethods=readFileSync('supabase/migrations/20260807170000_aactivated_weekly_payout_methods.sql','utf8');

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

test('starter kit can be completed by a recorded purchase attestation',()=>{
  assert.match(rep,/starter_kit_attestation/);
  assert.match(rep,/I attest that I already purchased my required AACTIVATEDRX starter kit/);
  assert.match(submit,/starter_kit_purchase_attested/);
  assert.match(submit,/starter_kit_status: 'complete'/);
});

test('payout remains pending until administrative verification',()=>{
  assert.match(submit,/payout_status: 'submitted'/);
  assert.match(manage,/verification_status:status/);
  assert.match(manage,/payout_status:status==='verified'\?'complete':'correction_required'/);
});

test('rep starter-kit step provides secure checkout before optional prior-purchase attestation',()=>{
  assert.match(rep,/create-aactivated-starter-kit-order/);
  assert.match(rep,/Purchase starter kit securely/);
  assert.match(rep,/Purchase or attest later — continue onboarding/);
  assert.match(rep,/Attest to completed purchase/);
  assert.match(rep,/STARTER_KIT_FALLBACKS/);
  assert.match(rep,/window\.location\.assign\(String\(data\.payment_path\)\)/);
});

test('activated representative leaves onboarding for the actual rep portal',()=>{
  assert.match(rep,/profile\.state === 'active'[\s\S]*?<Navigate to="\/rep" replace/);
});

test('completed rep can enter a useful pending portal while final activation is pending',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  const gate=readFileSync('src/components/AactivatedRepAccessGate.tsx','utf8');
  const dashboard=readFileSync('src/pages/rep/RepDashboard.tsx','utf8');
  assert.match(rep,/Continue to Rep Portal/);
  assert.match(app,/ProtectedRoute roles=\{\['rep', 'rep_applicant'\]\}[\s\S]*?AactivatedRepAccessGate/);
  assert.match(gate,/access\.state !== 'active' && !access\.ready/);
  assert.match(gate,/access === null[\s\S]*?<Navigate to="\/applicant" replace/);
  assert.match(gate,/\.order\('last_activity_at', \{ ascending: false \}\)/);
  assert.doesNotMatch(gate,/\.maybeSingle\(\)/);
  assert.match(dashboard,/Final activation pending/);
  assert.match(dashboard,/Open Starter Kit Store/);
});

test('starter kits explain every included product and quantity',()=>{
  assert.match(rep,/WHAT IS INCLUDED/);
  assert.match(rep,/RETA 20 mg × 1/);
  assert.match(rep,/Tirzepatide 30 mg × 1/);
  assert.match(rep,/Wolverine Stack 20 mg × 1/);
  assert.match(rep,/BAC Water 10 mL × 3/);
});

test('activated AACTIVATED rep portal retains permanent starter-kit access',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  const dashboard=readFileSync('src/pages/rep/RepDashboard.tsx','utf8');
  const kits=readFileSync('src/pages/rep/AactivatedStarterKits.tsx','utf8');
  assert.match(app,/path="\/rep\/starter-kits"/);
  assert.match(dashboard,/Open Starter Kit Store/);
  assert.match(kits,/View and purchase starter kits/);
  assert.match(kits,/StarterKitForm/);
});

test('starter-kit dialog escapes dashboard clipping and remains fully scrollable',()=>{
  assert.match(rep,/createPortal\(dialog, document\.body\)/);
  assert.match(rep,/maxHeight: 'calc\(100dvh - 40px\)'/);
  assert.match(rep,/overflowY: 'auto'/);
  assert.match(rep,/position: 'sticky'/);
});

test('starter-kit checkout and attestation explicitly use a refreshed authenticated session',()=>{
  assert.match(rep,/auth\.refreshSession\(\)/);
  assert.match(rep,/Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(rep,/invokeAuthenticated\('create-aactivated-starter-kit-order'/);
  assert.match(rep,/invokeAuthenticated\('submit-aactivated-onboarding'/);
  assert.match(rep,/Your secure session expired\. Please sign in again/);
});

test('new rep payouts support the approved weekly methods and schedule',()=>{
  assert.match(rep,/Zelle/);
  assert.match(rep,/Venmo/);
  assert.match(rep,/Apple Pay \/ Apple Cash/);
  assert.doesNotMatch(rep,/PayPal email/);
  assert.match(rep,/issued on Fridays/);
  assert.match(submit,/\['zelle', 'venmo', 'apple_pay'\]/);
  assert.match(payoutMethods,/weekly_friday/);
  assert.match(payoutMethods,/period closes Thursday/);
});

test('W-9 completion is not reported as failed after its secure record is saved',()=>{
  assert.match(submit,/W-9 record saved but document generation failed/);
  assert.match(submit,/W-9 record saved but audit write failed/);
  assert.match(submit,/evaluation failed after the step was saved/);
});

test('secure submissions evaluate status as the authenticated representative',()=>{
  assert.match(submit,/userClient\.rpc\('evaluate_aactivated_onboarding'/);
  assert.doesNotMatch(submit,/await db\.rpc\('evaluate_aactivated_onboarding'/);
});

test('secure steps are retry-safe after a prior save',()=>{
  assert.match(submit,/existingSignature/);
  assert.match(submit,/existingW9/);
  assert.match(submit,/existingPayout/);
  assert.match(submit,/return;/);
});

test('every approved lifecycle state can resume secure onboarding steps',()=>{
  assert.match(submit,/BLOCKED_STATES/);
  assert.doesNotMatch(submit,/BLOCKED_STATES[\s\S]{0,160}application_pending/);
  assert.match(submit,/application_declined/);
  assert.match(submit,/'suspended'/);
  assert.match(submit,/!BLOCKED_STATES\.has\(row\.state\)/);
});

test('rep submits first and admin performs one final approval and activation',()=>{
  const applicationSubmit=readFileSync('supabase/functions/submit-aactivated-application/index.ts','utf8');
  assert.match(applicationSubmit,/state: 'approved_onboarding_incomplete'/);
  assert.match(applicationSubmit,/next_path: '\/rep\/onboarding'/);
  assert.match(approve,/Final approval is available only after the rep submits every onboarding step/);
  assert.match(approve,/state:'active'/);
  assert.match(approve,/w9_status:'accepted'/);
  assert.match(approve,/payout_status:'complete'/);
  assert.match(approve,/final_onboarding_approved_and_activated/);
});

test('rep request status dropdown uses distinct approved and launched labels',()=>{
  const repIntake=readFileSync('src/pages/admin/AdminRepIntake.tsx','utf8');
  assert.match(repIntake,/ready_to_build'\) return 'Approved - Ready to Build'/);
  assert.match(repIntake,/launched'\) return 'Launched'/);
  assert.doesNotMatch(repIntake,/ready_to_build' \|\| status === 'launched'\) return 'Approved'/);
});

test('successful rep activation opens the exact rep in Store Manager for saving',()=>{
  const repIntake=readFileSync('src/pages/admin/AdminRepIntake.tsx','utf8');
  const storeManager=readFileSync('src/pages/admin/AdminAactivatedPartnerTools.tsx','utf8');
  assert.match(repIntake,/navigate\(`\/admin\/rep-store-manager\?rep=\$\{encodeURIComponent\(repSlug\)\}`/);
  assert.match(storeManager,/searchParams\.get\('rep'\)/);
  assert.match(storeManager,/focusedRep\.rep_name \|\| focusedRep\.rep_slug.*is ready for store setup/);
  assert.match(storeManager,/scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(storeManager,/Save Store/);
});

test('activated reps remain visible in Store Manager with complete AACTIVATED identity',()=>{
  const storeManager=readFileSync('src/pages/admin/AdminAactivatedPartnerTools.tsx','utf8');
  assert.match(storeManager,/aactivated_onboarding_profiles/);
  assert.match(storeManager,/onboardingRepIds\.has\(rep\.id\) \|\| isAactivatedRep/);
  assert.match(approve,/payout_email:application\.email/);
  assert.match(approve,/active:true/);
  assert.match(approve,/custom_store_slug:'aactivated'/);
  assert.match(approve,/brand_name:'AACTIVATEDRX'/);
  assert.match(approve,/rep_channel:'aactivated'/);
  assert.match(approve,/discount_code:repCode/);
  assert.match(approve,/list_store_manager_reps/);
  assert.match(approve,/stores:stores\?\?\[\]/);
  assert.match(approve,/body\.sponsor_rep_id\|\|aactivatedParent\?\.id\|\|null/);
  assert.match(storeManager,/securedRepData/);
  assert.match(storeManager,/securedStores/);
  assert.match(storeManager,/matchingRep\?\.rep_slug/);
});

test('duplicate historical onboarding rows resolve deterministically',()=>{
  assert.match(submit,/onboardingRows/);
  assert.match(submit,/order\('last_activity_at', \{ ascending: false \}\)/);
  assert.match(submit,/\.limit\(20\)/);
  assert.doesNotMatch(submit,/aactivated_onboarding_profiles'[\s\S]{0,180}maybeSingle\(\)/);
});

test('replacement submissions preserve the prior valid record until the new record saves',()=>{
  const w9Insert = submit.indexOf("from('aactivated_w9_submissions').insert");
  const w9Supersede = submit.indexOf("update({ status: 'superseded' })");
  const payoutInsert = submit.indexOf("from('aactivated_payout_profiles').insert");
  const payoutSupersede = submit.indexOf("verification_status: 'disabled'");
  assert.ok(w9Insert >= 0 && w9Supersede > w9Insert);
  assert.ok(payoutInsert >= 0 && payoutSupersede > payoutInsert);
});

test('partial approval can safely reuse its own unassigned rep code',()=>{
  assert.match(approve,/reusableOrphan/);
  assert.match(approve,/otherOwner/);
  assert.match(approve,/belongsToApplicant/);
});

test('starter-kit checkout resumes a valid pending payment instead of dead-ending',()=>{
  assert.match(kit,/resumed: true/);
  assert.match(kit,/payment_expires_at/);
  assert.match(kit,/payment_status: 'cancelled'/);
  assert.doesNotMatch(kit,/hasDuplicatePurchase/);
});

test('administrative reviews evaluate status as the authenticated administrator',()=>{
  assert.match(manage,/auth\.rpc\('evaluate_aactivated_onboarding'/);
  assert.doesNotMatch(manage,/await db\.rpc\('evaluate_aactivated_onboarding'/);
});

test('account setup can be completed and pending reviews cannot be duplicated',()=>{
  assert.match(submit,/body\.action === 'account'/);
  assert.match(rep,/Confirm account setup/);
  assert.match(rep,/status === 'submitted' \|\| status === 'under_review'/);
  assert.match(rep,/return 'Submitted'/);
});

test('normal onboarding uses one rep submission pass and one final admin action',()=>{
  assert.match(admin,/APPROVE & ACTIVATE REP PORTAL/);
  assert.match(admin,/Awaiting Rep Submission/);
  assert.doesNotMatch(admin,/>\s*Accept\s*</);
  assert.doesNotMatch(admin,/>\s*Verify\s*</);
  assert.match(rep,/Form W-9 submitted securely\./);
});

test('main onboarding admin always exposes one atomic final approval and portal activation action',()=>{
  assert.match(admin,/APPROVE & ACTIVATE REP PORTAL/);
  assert.doesNotMatch(admin,/Verify & activate/);
  assert.match(admin,/row\.state !== "active"/);
  assert.match(approve,/event_type:'rep_portal_activated'/);
  assert.match(approve,/const path='\/rep'/);
  assert.match(rep,/Continue to Rep Portal/);
});

test('customer storefront keeps rep attribution private while preserving checkout routing',()=>{
  const storefront=readFileSync('src/pages/public/RxPlusDistributorPortal.tsx','utf8');
  assert.doesNotMatch(storefront,/AACTIVATEDRX Rep Store/);
  assert.doesNotMatch(storefront,/Shopping through .* keeps attribution attached through checkout/);
  assert.doesNotMatch(storefront,/Rep: \{aactivatedAttributionCode\}/);
  assert.doesNotMatch(storefront,/aactivatedRepDisplayName.*attribution stays attached through checkout/);
  assert.match(storefront,/portalRepCode =/);
  assert.match(storefront,/aactivatedAttributionCode \|\| 'VITALITYINS'/);
});

test('AACTIVATED storefront subpages retain the join-the-team header',()=>{
  const storefront=readFileSync('src/pages/public/RxPlusDistributorPortal.tsx','utf8');
  const layout=readFileSync('src/components/layout/PublicLayout.tsx','utf8');
  assert.match(storefront,/normalizedPathname\.startsWith\('\/aactivated\/'\)/);
  assert.match(layout,/isAactivatedPortal && \([\s\S]*?JOIN THE TEAM/);
  assert.match(layout,/to="\/aactivated\/rep-intake"/);
});

test('AACTIVATED customer promo validation and checkout fail over securely',()=>{
  const storefront=readFileSync('src/pages/public/RxPlusDistributorPortal.tsx','utf8');
  const client=readFileSync('src/lib/supabase.ts','utf8');
  const checkout=readFileSync('supabase/functions/create-aactivated-cart-submission/index.ts','utf8');
  assert.match(storefront,/action: 'validate_promo'/);
  assert.doesNotMatch(storefront,/\.from\('aactivated_promo_links'\)[\s\S]{0,400}\.eq\('discount_code', normalized\)/);
  assert.match(checkout,/findActivePromo/);
  assert.match(checkout,/discount_type === 'percentage'/);
  assert.match(client,/shouldUseAactivatedCartFallback/);
  assert.doesNotMatch(client,/code !== '57014'/);
});

test('application decisions send secure portal notifications and retain delivery status',()=>{
  assert.match(approve,/api\.resend\.com\/emails/);
  assert.match(approve,/rep_portal_activated/);
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

test('Starter Experience Tirzepatide uses the authoritative 249 dollar price',()=>{
  assert.match(starterPriceFix,/package_tier = 'starter_experience'/);
  assert.match(starterPriceFix,/tirzepatide starter%/);
  assert.match(starterPriceFix,/promo_price = 249\.00/);
});
