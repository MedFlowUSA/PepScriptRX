import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
  REFERRAL_STORAGE_KEY,
  type StoredReferral,
} from '../config/referrals';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

const BUCKET = 'submission-documents';

type DocType = 'prescription' | 'receipt' | 'medication_photo';

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

  const { error: submissionError } = await supabase!
    .from('patient_submissions')
    .insert({
      id: submissionId,
      full_name: val(formData, 'full_name'),
      email: val(formData, 'email'),
      phone: val(formData, 'phone'),
      rep_id: repId,
      medication: val(formData, 'medication'),
      current_dose: val(formData, 'current_dose'),
      current_price: numVal(formData, 'current_price'),
      state: val(formData, 'state'),
      date_of_birth: val(formData, 'date_of_birth'),
      current_pharmacy: val(formData, 'current_pharmacy'),
      shipping_address: val(formData, 'shipping_address'),
      shipping_city: val(formData, 'shipping_city'),
      shipping_state: val(formData, 'shipping_state'),
      shipping_zip: val(formData, 'shipping_zip'),
      shipping_speed: shippingSpeed,
      shipping_cost: shippingCostMap[shippingSpeed] ?? 0,
      referral_code: referralCode || null,
      discount_code: discountCode,
      discount_amount: discountAmount,
      status: 'new_submission',
    });

  if (submissionError) throw submissionError;

  await Promise.all([
    uploadDoc(submissionId, formData, 'receipt', false),
  ]);

  return submissionId;
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
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY)
    ?? window.sessionStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!raw) {
    const trimmed = repSlug.trim().toUpperCase();
    return trimmed
      ? {
          repSlug: trimmed,
          discountCode: trimmed,
          discountAmount: DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
          capturedAt: new Date().toISOString(),
        }
      : null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredReferral;
    if (!parsed.repSlug) return null;
    return {
      repSlug: parsed.repSlug.trim().toUpperCase(),
      discountCode: (parsed.discountCode || parsed.repSlug).trim().toUpperCase(),
      discountAmount: Number(parsed.discountAmount || 0),
      capturedAt: parsed.capturedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
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

function numVal(fd: FormData, key: string): number | null {
  const n = parseFloat(val(fd, key));
  return isFinite(n) ? n : null;
}
