import { createClient } from '@supabase/supabase-js';
import {
  captureReferral,
  getReferralVisitorId,
  restoreReferral,
  type StoredReferral,
} from '../config/referrals';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configuredSiteUrl = (
  import.meta.env.VITE_PUBLIC_SITE_URL
  ?? import.meta.env.VITE_APP_URL
  ?? ''
) as string;

const PRODUCTION_SITE_URL = 'https://pepscriptrx.vercel.app';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function getPublicSiteUrl(): string {
  const explicitUrl = configuredSiteUrl.trim();
  if (explicitUrl) return explicitUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal || import.meta.env.DEV) return origin;
  }

  return PRODUCTION_SITE_URL;
}

export function getAuthCallbackUrl(): string {
  return `${getPublicSiteUrl()}/auth/callback`;
}

const BUCKET = 'submission-documents';

type DocType = 'prescription' | 'receipt' | 'medication_photo';

type SubmissionInsert = Record<string, string | number | boolean | null | unknown[]>;

export async function createPepScriptSubmission(
  formData: FormData,
  repSlug: string,
): Promise<string> {
  assertSupabase();
  const repId = await findRepId(repSlug);
  const referral = getStoredReferral(repSlug);
  const fallbackReferralCode = repSlug.trim().toUpperCase();
  const referralCode = referral?.repSlug ?? fallbackReferralCode;
  const fallbackDiscountCode = val(formData, 'discount_code');
  const discountCode = referral?.discountCode ?? (fallbackDiscountCode || null);
  const discountAmount = referral?.discountAmount ?? 0;

  const shippingCostMap: Record<string, number> = { standard: 0, expedited: 25, overnight: 50 };
  const shippingSpeed = val(formData, 'shipping_speed') || 'standard';
  const submissionId = crypto.randomUUID();
  const submissionType = val(formData, 'submission_type') || 'savings_check';
  const isOrderReady = val(formData, 'order_ready') === 'true';
  const quotedPrice = numVal(formData, 'quoted_price');
  const isAccessoryOnly = val(formData, 'is_accessory_only') === 'true';
  const isInquiryOnly = isAccessoryOnly
    || submissionType === 'accessory_inquiry'
    || submissionType === 'supply_inquiry';
  const selectedAddons = parseJsonArray(val(formData, 'selected_addons'));

  const baseInsert: SubmissionInsert = {
    id: submissionId,
    full_name: val(formData, 'full_name'),
    email: val(formData, 'email'),
    phone: val(formData, 'phone'),
    rep_id: repId,
    medication: val(formData, 'medication'),
    current_dose: nullableVal(formData, 'current_dose'),
    current_price: numVal(formData, 'current_price'),
    state: val(formData, 'state') || val(formData, 'shipping_state'),
    date_of_birth: nullableVal(formData, 'date_of_birth'),
    current_pharmacy: nullableVal(formData, 'current_pharmacy'),
    shipping_address: nullableVal(formData, 'shipping_address'),
    shipping_city: nullableVal(formData, 'shipping_city'),
    shipping_state: nullableVal(formData, 'shipping_state') || nullableVal(formData, 'state'),
    shipping_zip: nullableVal(formData, 'shipping_zip'),
    shipping_speed: shippingSpeed,
    shipping_cost: shippingCostMap[shippingSpeed] ?? 0,
    referral_code: referralCode || null,
    discount_code: discountCode,
    discount_amount: discountAmount,
    status: isOrderReady && quotedPrice ? 'payment_sent' : 'new_submission',
  };

  const extendedInsert: SubmissionInsert = {
    ...baseInsert,
    product_id: nullableVal(formData, 'product_id'),
    product_name: nullableVal(formData, 'product_name') || val(formData, 'medication'),
    product_category: nullableVal(formData, 'product_category'),
    product_type: nullableVal(formData, 'product_type'),
    selected_addons: selectedAddons,
    is_accessory_only: isAccessoryOnly,
    submission_type: submissionType,
    inquiry_notes: nullableVal(formData, 'inquiry_notes'),
    quoted_price: isOrderReady ? quotedPrice : null,
  };

  const { error: submissionError } = await supabase!
    .from('patient_submissions')
    .insert(extendedInsert);

  if (submissionError) {
    logSubmissionError('PepScriptRX submission insert failed', submissionError, formData, submissionType);

    if (isInquiryOnly) {
      const { error: inquiryFallbackError } = await supabase!
        .from('patient_submissions')
        .insert(buildInquiryFallbackInsert(baseInsert, extendedInsert));

      if (inquiryFallbackError) {
        logSubmissionError(
          'PepScriptRX inquiry fallback insert failed',
          inquiryFallbackError,
          formData,
          submissionType,
        );
        await createSubmissionViaRpc(extendedInsert);
      }
    } else if (isSchemaCacheError(submissionError)) {
      const { error: fallbackError } = await supabase!
        .from('patient_submissions')
        .insert(baseInsert);
      if (fallbackError) {
        logSubmissionError('PepScriptRX legacy fallback insert failed', fallbackError, formData, submissionType);
        await createSubmissionViaRpc(baseInsert);
      }
    } else if (isRlsError(submissionError)) {
      await createSubmissionViaRpc(extendedInsert);
    } else {
      throw submissionError;
    }
  }

  const receipt = formData.get('receipt');
  const shouldUploadReceipt = !isInquiryOnly
    && receipt instanceof File
    && receipt.size > 0
    && val(formData, 'requires_receipt_upload') !== 'false';

  if (shouldUploadReceipt) {
    await Promise.all([
      uploadDoc(submissionId, formData, 'receipt', false),
    ]);
  }

  if (referral?.repSlug) {
    void recordReferralAttribution(referral, 'checkout_submit', repId, {
      submission_id: submissionId,
      product: val(formData, 'medication'),
      submission_type: submissionType,
    });
  }

  return submissionId;
}

export async function recordReferralAttribution(
  referral: StoredReferral | null,
  source: string,
  repId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!supabase || !referral?.repSlug) return;
  const visitorId = getReferralVisitorId();
  const installDetected = isStandaloneApp();
  const resolvedRepId = repId ?? await findRepId(referral.repSlug);

  await supabase.from('referral_attributions').insert({
    visitor_id: visitorId || null,
    referral_code: referral.repSlug,
    discount_code: referral.discountCode,
    rep_id: resolvedRepId,
    original_referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    install_detected: installDetected,
    checkout_count: source === 'checkout_submit' ? 1 : 0,
    source,
    metadata: {
      ...metadata,
      rep_name: referral.repName,
      portal_path: referral.portalPath,
      captured_at: referral.capturedAt,
      display_mode: installDetected ? 'standalone' : 'browser',
    },
  });
}

export async function createRetaWaitlist(formData: FormData, repSlug: string): Promise<void> {
  assertSupabase();
  const repId = await findRepId(repSlug);

  const { error } = await supabase!.from('reta_waitlist').insert({
    full_name: val(formData, 'full_name'),
    email: val(formData, 'email'),
    phone: val(formData, 'phone'),
    state: val(formData, 'state'),
    interest_notes: val(formData, 'interest_notes'),
    rep_id: repId,
  });

  if (error) throw error;
}

async function uploadDoc(
  submissionId: string,
  formData: FormData,
  docType: DocType,
  required = true,
): Promise<void> {
  const file = formData.get(docType);
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new Error(`${docType} file is required.`);
    return;
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const path = `${submissionId}/${docType}-${Date.now()}-${safeName}`;

  const { error: uploadErr } = await supabase!.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadErr) throw uploadErr;

  const { error: docErr } = await supabase!.from('submission_documents').insert({
    submission_id: submissionId,
    document_type: docType,
    file_path: path,
  });
  if (docErr) throw docErr;
}

async function findRepId(repSlug: string): Promise<string | null> {
  if (!repSlug) return null;
  const { data } = await supabase!
    .from('reps')
    .select('id')
    .ilike('rep_slug', repSlug.trim())
    .eq('active', true)
    .maybeSingle();
  return data?.id ?? null;
}

function getStoredReferral(repSlug: string): StoredReferral | null {
  const restored = restoreReferral();
  if (restored) return restored;
  const trimmed = repSlug.trim().toUpperCase();
  return trimmed ? captureReferral(trimmed, 'submission_fallback') : null;
}

function assertSupabase(): void {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
    );
  }
}

function val(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

function nullableVal(fd: FormData, key: string): string | null {
  return val(fd, key) || null;
}

function numVal(fd: FormData, key: string): number | null {
  const n = parseFloat(val(fd, key));
  return isFinite(n) ? n : null;
}

function parseJsonArray(raw: string): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSchemaCacheError(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST204'
    || /Could not find .* column|schema cache/i.test(error.message ?? '');
}

function isRlsError(error: { code?: string; message?: string }): boolean {
  return error.code === '42501'
    && /row-level security policy/i.test(error.message ?? '');
}

async function createSubmissionViaRpc(insert: SubmissionInsert): Promise<void> {
  const { error } = await supabase!.rpc('create_public_patient_submission', {
    payload: sanitizeRpcPayload(insert),
  });

  if (error) {
    console.error('PepScriptRX submission RPC failed', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
}

function sanitizeRpcPayload(insert: SubmissionInsert): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(insert).filter(([, value]) => value !== undefined),
  );
}

function buildInquiryFallbackInsert(
  baseInsert: SubmissionInsert,
  extendedInsert: SubmissionInsert,
): SubmissionInsert {
  return {
    id: baseInsert.id,
    full_name: baseInsert.full_name,
    email: baseInsert.email,
    phone: baseInsert.phone,
    rep_id: baseInsert.rep_id,
    medication: baseInsert.medication,
    state: baseInsert.state,
    date_of_birth: null,
    current_dose: null,
    current_price: null,
    current_pharmacy: null,
    referral_code: baseInsert.referral_code,
    discount_code: baseInsert.discount_code,
    discount_amount: baseInsert.discount_amount,
    status: 'new_submission',
    product_id: extendedInsert.product_id,
    product_name: extendedInsert.product_name,
    product_category: extendedInsert.product_category,
    product_type: extendedInsert.product_type,
    selected_addons: extendedInsert.selected_addons,
    is_accessory_only: extendedInsert.is_accessory_only,
    submission_type: extendedInsert.submission_type,
    inquiry_notes: extendedInsert.inquiry_notes,
  };
}

function logSubmissionError(
  label: string,
  error: { message?: string; details?: string; hint?: string; code?: string },
  formData: FormData,
  submissionType: string,
): void {
  console.error(label, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    submissionType,
    product: val(formData, 'medication'),
    productType: val(formData, 'product_type'),
  });
}

function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}
