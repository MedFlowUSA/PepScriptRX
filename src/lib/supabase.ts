import { createClient } from '@supabase/supabase-js';
import {
  captureReferral,
  getReferralVisitorId,
  type StoredReferral,
} from '../config/referrals';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configuredSiteUrl = (
  import.meta.env.VITE_PUBLIC_SITE_URL
  ?? import.meta.env.VITE_APP_URL
  ?? ''
) as string;

const PRODUCTION_SITE_URL = 'https://pepscriptrx.vercel.app';
const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: authStorage,
        storageKey: 'pepscriptrx-auth-session',
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

function getAuthSiteUrl(): string {
  const explicitUrl = configuredSiteUrl.trim();
  if (explicitUrl) return explicitUrl.replace(/\/+$/, '');
  return PRODUCTION_SITE_URL;
}

export function getAuthCallbackUrl(): string {
  return `${getAuthSiteUrl()}/auth/callback`;
}

export function getPasswordResetUrl(params?: { brand?: string | null; portal?: string | null }): string {
  const search = new URLSearchParams();
  if (params?.brand) search.set('brand', params.brand);
  if (params?.portal) search.set('portal', params.portal);
  const suffix = search.toString();
  return `${getAuthSiteUrl()}/reset-password${suffix ? `?${suffix}` : ''}`;
}

const BUCKET = 'submission-documents';

type DocType = 'prescription' | 'receipt' | 'medication_photo';

type SubmissionInsert = Record<string, string | number | boolean | null | unknown[]>;

export type PublicSubmissionResult = {
  submissionId: string;
  publicPaymentToken: string | null;
};

export type OrderEmailType = 'order_confirmation' | 'shipping_confirmation';

export type CustomerOrderEmailRecord = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  order_number?: string | null;
  order_items?: unknown[];
  order_total?: number | null;
  quoted_price?: number | null;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  medication?: string | null;
  product_name?: string | null;
  referral_code?: string | null;
  discount_code?: string | null;
  tracking_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
};

export type CheckoutScopeValidation = {
  valid: boolean;
  scope_code: string | null;
  display_name: string | null;
};

export type CustomerAccountStatus = {
  account_exists: boolean;
  customer_account_exists: boolean;
};

export type PortalAgeLeadCapturePayload = {
  age_confirmed: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  portal_id?: string | null;
  portal_name?: string | null;
  portal_path?: string | null;
  domain?: string | null;
  path?: string | null;
  discount_code?: string | null;
  discount_percent?: number;
  discount_triggered?: boolean;
  user_agent?: string | null;
};

export type AbandonedLeadPayload = {
  status?: 'captured' | 'checkout_started' | 'abandoned' | 'converted' | 'follow_up_needed' | 'closed';
  age_confirmed: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  source_scope: string;
  source_portal?: string | null;
  source_route?: string | null;
  source_path?: string | null;
  rep_code?: string | null;
  checkout_scope_code?: string | null;
  discount_code?: string | null;
  discount_percent?: number;
  product_interest?: string | null;
  product_interest_id?: string | null;
  cart_snapshot?: unknown[];
  metadata?: Record<string, unknown>;
  domain?: string | null;
  user_agent?: string | null;
};

export async function createPepScriptSubmission(
  formData: FormData,
  repSlug: string,
): Promise<PublicSubmissionResult> {
  assertSupabase();
  const repId = await findRepId(repSlug);
  const referral = getStoredReferral(repSlug);
  const fallbackReferralCode = repSlug.trim().toUpperCase();
  const referralCode = referral?.repSlug ?? fallbackReferralCode;
  const formDiscountCode = val(formData, 'discount_code');
  const formDiscountAmount = numVal(formData, 'discount_amount');
  const discountCode = formDiscountCode || referral?.discountCode || null;
  const discountAmount = formDiscountAmount ?? referral?.discountAmount ?? 0;

  const shippingCostMap: Record<string, number> = { standard: 0, expedited: 25, overnight: 50 };
  const shippingSpeed = val(formData, 'shipping_speed') || 'standard';
  const submissionId = crypto.randomUUID();
  const orderNumber = `PSRX-${submissionId.slice(0, 8).toUpperCase()}`;
  const submissionType = val(formData, 'submission_type') || 'savings_check';
  const isOrderReady = val(formData, 'order_ready') === 'true';
  const wantsReceiptDiscountReview = val(formData, 'receipt_discount_review') === 'true';
  const quotedPrice = numVal(formData, 'quoted_price');
  const isAccessoryOnly = val(formData, 'is_accessory_only') === 'true';
  const isInquiryOnly = !isOrderReady && (isAccessoryOnly
    || submissionType === 'accessory_inquiry'
    || submissionType === 'supply_inquiry');
  const selectedAddons = parseJsonArray(val(formData, 'selected_addons'));
  const orderItems = buildOrderItems(formData, quotedPrice);
  const explicitOrderTotal = numVal(formData, 'order_total');
  const shouldKeepOrderPricing = isOrderReady || wantsReceiptDiscountReview;
  const orderTotal = shouldKeepOrderPricing
    ? explicitOrderTotal ?? Math.max(0, Number(quotedPrice ?? 0) + (shippingCostMap[shippingSpeed] ?? 0) - discountAmount)
    : null;

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
    status: wantsReceiptDiscountReview ? 'under_review' : isOrderReady && quotedPrice ? 'payment_sent' : 'new_submission',
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
    order_ready: isOrderReady,
    receipt_discount_review: wantsReceiptDiscountReview,
    inquiry_notes: nullableVal(formData, 'inquiry_notes'),
    quoted_price: shouldKeepOrderPricing ? quotedPrice : null,
    order_number: orderNumber,
    order_items: shouldKeepOrderPricing ? orderItems : [],
    order_total: orderTotal,
    admin_code: nullableVal(formData, 'admin_code'),
    store_slug: nullableVal(formData, 'store_slug'),
    store_name: nullableVal(formData, 'store_name'),
    account_type: nullableVal(formData, 'account_type'),
    parent_type: nullableVal(formData, 'parent_type'),
    checkout_scope_code: nullableVal(formData, 'checkout_scope_code'),
    attribution_source: nullableVal(formData, 'attribution_source') || 'default',
    source_portal: nullableVal(formData, 'source_portal') || 'main',
    source_route: nullableVal(formData, 'source_route'),
    source_store: nullableVal(formData, 'source_store'),
    source_admin: nullableVal(formData, 'source_admin'),
    source_rep: nullableVal(formData, 'source_rep') || referralCode || null,
  };

  const submissionResult = await createSubmissionViaRpc(isInquiryOnly
    ? buildInquiryFallbackInsert(baseInsert, extendedInsert)
    : extendedInsert);

  await attachCurrentCustomerToSubmission(submissionResult.submissionId).catch((error) => {
    console.warn('Could not attach authenticated customer profile to submission', error);
  });

  const receipt = formData.get('receipt');
  const shouldUploadReceipt = !isInquiryOnly
    && receipt instanceof File
    && receipt.size > 0
    && val(formData, 'requires_receipt_upload') !== 'false';

  if (shouldUploadReceipt) {
    await Promise.all([
      uploadDoc(submissionResult.submissionId, formData, 'receipt', false),
    ]);
  }

  if (referral?.repSlug) {
    void recordReferralAttribution(referral, 'checkout_submit', repId, {
      submission_id: submissionResult.submissionId,
      product: val(formData, 'medication'),
      submission_type: submissionType,
    });
  }

  return submissionResult;
}

export async function sendCustomerOrderEmail(
  type: OrderEmailType,
  record: CustomerOrderEmailRecord,
  force = false,
): Promise<Record<string, unknown>> {
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.');

  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const res = await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ type, force, record }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json as Record<string, unknown>;
}

export async function validateCheckoutScope(scopeCode: string): Promise<CheckoutScopeValidation> {
  assertSupabase();
  const { data, error } = await supabase!.rpc('validate_checkout_scope', { p_scope_code: scopeCode });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    valid: Boolean(row?.valid),
    scope_code: row?.scope_code ?? null,
    display_name: row?.display_name ?? null,
  };
}

export async function getCustomerAccountStatus(email: string): Promise<CustomerAccountStatus | null> {
  if (!supabase) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase.rpc('get_customer_account_status', { p_email: normalized });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    account_exists: Boolean(row?.account_exists),
    customer_account_exists: Boolean(row?.customer_account_exists),
  };
}

async function attachCurrentCustomerToSubmission(submissionId: string): Promise<void> {
  if (!supabase || !submissionId) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return;
  const { error } = await supabase.rpc('attach_current_customer_to_submission', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
}

export async function applyCheckoutScopeToSubmission(
  submissionId: string,
  scopeCode: string,
  attributionSource: string,
): Promise<CheckoutScopeValidation> {
  assertSupabase();
  const { data, error } = await supabase!.rpc('apply_checkout_scope', {
    p_submission_id: submissionId,
    p_scope_code: scopeCode,
    p_attribution_source: attributionSource,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    valid: Boolean(row?.valid),
    scope_code: row?.scope_code ?? null,
    display_name: row?.display_name ?? null,
  };
}

export async function recordPortalAgeLeadCapture(payload: PortalAgeLeadCapturePayload): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('portal_age_lead_captures').insert(payload);
  if (error) throw error;
}

export async function recordAbandonedLead(payload: AbandonedLeadPayload): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('abandoned_leads').insert({
    status: payload.status ?? 'captured',
    age_confirmed: payload.age_confirmed,
    first_name: payload.first_name ?? null,
    last_name: payload.last_name ?? null,
    email: payload.email,
    phone: payload.phone ?? null,
    source_scope: payload.source_scope,
    source_portal: payload.source_portal ?? null,
    source_route: payload.source_route ?? null,
    source_path: payload.source_path ?? null,
    rep_code: payload.rep_code ?? null,
    checkout_scope_code: payload.checkout_scope_code ?? null,
    discount_code: payload.discount_code ?? null,
    discount_percent: payload.discount_percent ?? 0,
    product_interest: payload.product_interest ?? null,
    product_interest_id: payload.product_interest_id ?? null,
    cart_snapshot: payload.cart_snapshot ?? [],
    metadata: payload.metadata ?? {},
    domain: payload.domain ?? null,
    user_agent: payload.user_agent ?? null,
  });
  if (error) throw error;
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

function buildOrderItems(formData: FormData, quotedPrice: number | null): unknown[] {
  const explicitItems = parseJsonArray(val(formData, 'order_items'));
  if (explicitItems.length > 0) return explicitItems;

  const name = nullableVal(formData, 'product_name') || val(formData, 'medication') || 'PepScriptRX order';
  return [{
    name,
    price: quotedPrice ?? 0,
    quantity: 1,
  }];
}

async function createSubmissionViaRpc(insert: SubmissionInsert): Promise<PublicSubmissionResult> {
  const { data, error } = await supabase!.rpc('create_public_patient_submission', {
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

  const row = Array.isArray(data) ? data[0] : data;
  const submissionId = typeof row === 'string'
    ? row
    : String(row?.submission_id ?? row?.id ?? '');
  if (!submissionId) throw new Error('Submission RPC did not return a submission id.');
  return {
    submissionId,
    publicPaymentToken: typeof row === 'object' && row !== null
      ? String(row.public_payment_token ?? row.payment_token ?? '') || null
      : null,
  };
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

function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}
