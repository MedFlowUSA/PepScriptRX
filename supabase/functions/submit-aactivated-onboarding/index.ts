import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase Edge runtime client types are remote Deno imports. */

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ENCRYPTION_KEY = Deno.env.get('AACTIVATED_ONBOARDING_ENCRYPTION_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-api-version, apikey, content-type', 'Content-Type': 'application/json' };
// Once an application has been approved, every incomplete/corrected step must
// remain resumable. In particular, approval can briefly leave a profile in
// approved_activation_pending, and an administrator may activate a profile
// before a document correction is resubmitted.
const BLOCKED_STATES = new Set([
  'application_more_info_required',
  'application_declined',
  'suspended',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const userClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return reply({ error: 'Authentication required' }, 401);
    const db = createClient(URL, SERVICE_KEY);
    // Historical approval retries can leave more than one row linked to the
    // same auth account. maybeSingle() turns that valid situation into null,
    // so resolve the newest approved, usable record deterministically.
    const { data: onboardingRows, error: onboardingError } = await db
      .from('aactivated_onboarding_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('brand_id', 'aactivated')
      .order('last_activity_at', { ascending: false })
      .limit(20);
    if (onboardingError) throw onboardingError;
    const onboarding = (onboardingRows ?? []).find((row: any) => !BLOCKED_STATES.has(row.state));
    if (!onboarding) {
      return reply({ error: 'Approved AACTIVATEDRX onboarding is required' }, 403);
    }
    const body = await req.json();
    if (body.action === 'agreement') await submitAgreement(db, onboarding, user, body, req);
    else if (body.action === 'w9') await submitW9(db, onboarding, user, body, req);
    else if (body.action === 'payout') await submitPayout(db, onboarding, user, body);
    else if (body.action === 'starter_kit_attestation') await attestStarterKit(db, onboarding, user, body);
    else if (body.action === 'account') await completeAccount(db, onboarding);
    else return reply({ error: 'Unsupported action' }, 400);
    // Evaluate as the authenticated representative. Calling this RPC through the
    // service-role client loses auth.uid(), and the authorization guard correctly
    // rejects the otherwise successful submission.
    const { error: evaluationError } = await userClient.rpc('evaluate_aactivated_onboarding', { p_onboarding_id: onboarding.id });
    if (evaluationError) console.error('AACTIVATED onboarding evaluation failed after the step was saved', safeError(evaluationError));
    return reply({ ok: true });
  } catch (error) {
    console.error('AACTIVATED onboarding submission failed', safeError(error));
    return reply({ error: clientError(error) }, 400);
  }
});

async function submitAgreement(db: any, onboarding: any, user: any, body: any, req: Request) {
  if (!body.read_consent || !body.electronic_consent || !clean(body.legal_name) || !clean(body.signature_text)) throw new Error('Agreement consent and signature are required');
  const { data: agreement } = await db.from('aactivated_agreements').select('*').eq('id', body.agreement_id).eq('brand_id', 'aactivated').eq('status', 'approved').not('published_at', 'is', null).single();
  if (!agreement) throw new Error('Published agreement not found');
  const documentHash = await sha256(agreement.content);
  if (documentHash !== agreement.content_hash) throw new Error('Agreement integrity check failed');
  const { data: existingSignature, error: existingSignatureError } = await db.from('aactivated_agreement_signatures').select('id').eq('onboarding_id', onboarding.id).eq('agreement_id', agreement.id).maybeSingle();
  if (existingSignatureError) throw existingSignatureError;
  if (existingSignature) {
    const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ agreement_status: 'complete', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
    if (profileError) throw profileError;
    return;
  }
  const record = { onboarding_id: onboarding.id, rep_user_id: user.id, agreement_id: agreement.id, agreement_version: agreement.version, rendered_content: agreement.content, document_hash: documentHash, legal_name: clean(body.legal_name), signature_text: clean(body.signature_text), read_consent: true, electronic_consent: true, ip_address: clientIp(req), user_agent: req.headers.get('user-agent') };
  const { data: signature, error } = await db.from('aactivated_agreement_signatures').insert(record).select('id').single();
  if (error) throw error;
  const path = `${onboarding.id}/agreements/${signature.id}.pdf`;
  try {
    await storePdf(db, path, `${agreement.title}\nVersion ${agreement.version}\n\n${agreement.content}\n\nSigned by ${record.legal_name}\n${new Date().toISOString()}`);
    const { error: pathError } = await db.from('aactivated_agreement_signatures').update({ pdf_storage_path: path }).eq('id', signature.id);
    if (pathError) throw pathError;
  } catch (documentError) {
    console.error('Agreement signature saved but document generation failed', safeError(documentError));
  }
  const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ agreement_status: 'complete', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
  if (profileError) throw profileError;
}

async function submitW9(db: any, onboarding: any, user: any, body: any, req: Request) {
  if (!ENCRYPTION_KEY) throw new Error('Encryption is not configured');
  const required = ['tax_name','federal_tax_classification','address','city','state','zip','tin','signature_text'];
  if (required.some((key) => !clean(body[key])) || !body.certification_accepted) throw new Error('Required Form W-9 information is missing');
  const tin = String(body.tin).replace(/\D/g, '');
  if (![9].includes(tin.length)) throw new Error('Invalid TIN');
  const { data: existingW9, error: existingW9Error } = await db.from('aactivated_w9_submissions').select('id,status,tax_name,tin_last_four,signature_text').eq('onboarding_id', onboarding.id).neq('status', 'superseded').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existingW9Error) throw existingW9Error;
  if (existingW9 && existingW9.status !== 'correction_required' && clean(existingW9.tax_name) === clean(body.tax_name) && clean(existingW9.tin_last_four) === tin.slice(-4) && clean(existingW9.signature_text) === clean(body.signature_text)) {
    const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ w9_status: existingW9.status === 'accepted' ? 'accepted' : 'submitted', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
    if (profileError) throw profileError;
    return;
  }
  const ciphertext = await encrypt(tin);
  const { count, error: countError } = await db.from('aactivated_w9_submissions').select('*', { count: 'exact', head: true }).eq('onboarding_id', onboarding.id);
  if (countError) throw countError;
  const certification = 'Under penalties of perjury, I certify that the information provided is correct and complete, and that I am a U.S. person unless otherwise indicated on the applicable official Form W-9.';
  const safe = { tax_name: clean(body.tax_name), business_name: clean(body.business_name), federal_tax_classification: clean(body.federal_tax_classification), llc_classification: clean(body.llc_classification), exempt_payee_code: clean(body.exempt_payee_code), fatca_exemption_code: clean(body.fatca_exemption_code), address: clean(body.address), city: clean(body.city), state: clean(body.state), zip: clean(body.zip), account_numbers: clean(body.account_numbers) };
  const hash = await sha256(JSON.stringify({ ...safe, tin_last_four: tin.slice(-4), certification, signed_at: new Date().toISOString() }));
  const { data: submission, error } = await db.from('aactivated_w9_submissions').insert({ onboarding_id: onboarding.id, rep_user_id: user.id, revision: Number(count ?? 0) + 1, ...safe, tin_ciphertext: ciphertext, tin_last_four: tin.slice(-4), certification_version: 'IRS-W9-current-2026-08-06', certification_accepted: true, signature_text: clean(body.signature_text), document_hash: hash }).select('id').single();
  if (error) throw error;
  const { error: supersedeError } = await db.from('aactivated_w9_submissions').update({ status: 'superseded' }).eq('onboarding_id', onboarding.id).neq('id', submission.id).neq('status', 'superseded');
  if (supersedeError) console.error('New W-9 saved but prior revision cleanup failed', safeError(supersedeError));
  const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ w9_status: 'submitted', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
  if (profileError) throw profileError;
  const path = `${onboarding.id}/w9/${submission.id}.pdf`;
  try {
    await storePdf(db, path, `Form W-9\n${safe.tax_name}\n${safe.business_name}\n${safe.federal_tax_classification}\n${safe.address}\n${safe.city}, ${safe.state} ${safe.zip}\nTIN: ***-**-${tin.slice(-4)}\n\n${certification}\n\nElectronically signed: ${clean(body.signature_text)}\n${new Date().toISOString()}`);
    const { error: pdfPathError } = await db.from('aactivated_w9_submissions').update({ pdf_storage_path: path }).eq('id', submission.id);
    if (pdfPathError) throw pdfPathError;
  } catch (documentError) {
    console.error('W-9 record saved but document generation failed', safeError(documentError));
  }
  const { error: auditError } = await db.from('aactivated_onboarding_audit').insert({ onboarding_id: onboarding.id, actor_id: user.id, action: 'w9_submitted', metadata: { submission_id: submission.id, tin_last_four: tin.slice(-4), ip_recorded: Boolean(clientIp(req)) } });
  if (auditError) console.error('W-9 record saved but audit write failed', safeError(auditError));
}

async function submitPayout(db: any, onboarding: any, user: any, body: any) {
  const method = clean(body.method).toLowerCase();
  if (!ENCRYPTION_KEY) throw new Error('Payout encryption is not configured');
  if (!['zelle', 'venmo', 'apple_pay'].includes(method)) throw new Error('Choose Zelle, Venmo, or Apple Pay / Apple Cash');
  const destination = normalizeDestination(clean(body.destination));
  const confirmation = normalizeDestination(clean(body.confirmation));
  if (!destination || destination !== confirmation || !validDestination(method, destination)) throw new Error('Enter matching valid payout destination details');
  const maskedDestination = maskDestination(destination);
  const { data: existingPayout, error: existingPayoutError } = await db.from('aactivated_payout_profiles').select('id,method,verification_status,masked_destination').eq('onboarding_id', onboarding.id).is('superseded_at', null).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
  if (existingPayoutError) throw existingPayoutError;
  if (existingPayout && existingPayout.verification_status !== 'correction_required' && existingPayout.method === method && existingPayout.masked_destination === maskedDestination) {
    const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ payout_status: existingPayout.verification_status === 'verified' ? 'complete' : 'submitted', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
    if (profileError) throw profileError;
    return;
  }
  const { data: insertedPayout, error: insertError } = await db.from('aactivated_payout_profiles').insert({ onboarding_id: onboarding.id, rep_user_id: user.id, method, destination_ciphertext: await encrypt(destination), masked_destination: maskedDestination, payout_frequency: 'weekly_friday', period_end_day: 'thursday' }).select('id').single();
  if (insertError) throw insertError;
  const { error: supersedeError } = await db.from('aactivated_payout_profiles').update({ superseded_at: new Date().toISOString(), verification_status: 'disabled' }).eq('onboarding_id', onboarding.id).is('superseded_at', null).neq('id', insertedPayout.id);
  if (supersedeError) console.error('New payout destination saved but prior destination cleanup failed', safeError(supersedeError));
  const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ payout_status: 'submitted', last_activity_at: new Date().toISOString() }).eq('id', onboarding.id);
  if (profileError) throw profileError;
}

async function completeAccount(db: any, onboarding: any) {
  const { error } = await db.from('aactivated_onboarding_profiles').update({
    account_status: 'complete',
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', onboarding.id).eq('user_id', onboarding.user_id);
  if (error) throw error;
}

async function attestStarterKit(db: any, onboarding: any, user: any, body: any) {
  if (!body.purchase_attested) throw new Error('Starter-kit purchase attestation is required');
  const now = new Date().toISOString();
  const { error: profileError } = await db.from('aactivated_onboarding_profiles').update({ starter_kit_status: 'complete', last_activity_at: now, updated_at: now }).eq('id', onboarding.id).eq('user_id', user.id);
  if (profileError) throw profileError;
  const { error: auditError } = await db.from('aactivated_onboarding_audit').insert({ onboarding_id: onboarding.id, actor_id: user.id, action: 'starter_kit_purchase_attested', metadata: { attested_at: now } });
  if (auditError) console.error('Starter-kit attestation saved but audit write failed', safeError(auditError));
}

async function encrypt(value: string) {
  const raw = Uint8Array.from(atob(ENCRYPTION_KEY), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('Encryption key must be 32 bytes');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  return `v1.${toB64(iv)}.${toB64(encrypted)}`;
}

async function storePdf(db: any, path: string, text: string) {
  const bytes = simplePdf(text);
  const { error } = await db.storage.from('aactivated-onboarding-private').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
}

function simplePdf(text: string) {
  const lines = text.replace(/[^\x20-\x7E\n]/g, '?').split('\n').slice(0, 80);
  const stream = `BT /F1 9 Tf 48 744 Td 11 TL ${lines.map((line) => `(${line.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n', offset = pdf.length; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(offset); const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; pdf += chunk; offset += chunk.length; });
  const xref = offset; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const clean = (value: unknown) => String(value ?? '').trim();
const clientIp = (req: Request) => clean(req.headers.get('x-forwarded-for')).split(',')[0] || null;
const normalizeDestination = (value: string) => value.trim().toLowerCase().replace(/^@/, '');
const validDestination = (method: string, value: string) => {
  const email = /^\S+@\S+\.\S+$/.test(value);
  const phone = /^\+?\d{10,15}$/.test(value.replace(/[\s().-]/g, ''));
  const venmoHandle = /^[a-z0-9][a-z0-9._-]{2,29}$/i.test(value);
  return method === 'venmo' ? email || phone || venmoHandle : email || phone;
};
const maskDestination = (value: string) => value.includes('@')
  ? `${value[0]}***@${value.split('@')[1]}`
  : value.replace(/\d(?=\d{4})/g, '*').replace(/^(.).+(.{2})$/, '$1***$2');
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const safeError = (error: unknown) => error instanceof Error ? error.message.replace(/\b\d{9}\b/g, '[REDACTED]') : 'unknown';
const clientError = (error: unknown) => {
  const message = safeError(error);
  const allowed = [
    'Required Form W-9 information is missing', 'Invalid TIN', 'Payout encryption is not configured',
    'Choose Zelle, Venmo, or Apple Pay / Apple Cash', 'Enter matching valid payout destination details',
    'Starter-kit purchase attestation is required',
    'Approved AACTIVATEDRX onboarding is required',
  ];
  return allowed.includes(message) ? message : 'Unable to securely save onboarding information. Please retry once; if it continues, contact support.';
};
async function sha256(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: cors }); }
