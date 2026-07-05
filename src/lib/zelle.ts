import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type ManualPaymentProvider = 'zelle' | 'venmo';

export type ZelleIntent = {
  id: string;
  order_id?: string;
  payment_provider?: ManualPaymentProvider;
  status: 'pending' | 'sent' | 'needs_info' | 'confirmed' | 'rejected' | 'expired' | 'cancelled';
  subtotal_cents: number;
  discount_cents: number;
  amount_due_cents: number;
  recipient_display_name: string;
  recipient_kind: string;
  recipient_value: string;
  payment_reference: string;
  expires_at: string;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
};

type FunctionPayload = Record<string, unknown>;

export class ZelleFunctionError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ZelleFunctionError';
    this.status = status;
    this.body = body;
  }
}

async function callZelleFunction<T>(payload: FunctionPayload): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase is not configured');
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = session?.access_token ?? supabaseAnonKey;
  const res = await fetch(`${supabaseUrl}/functions/v1/zelle-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new ZelleFunctionError(body.error ?? 'Zelle payment request failed', res.status, body);
  return body as T;
}

export function createZelleIntent(paymentToken: string, provider: ManualPaymentProvider = 'zelle') {
  return callZelleFunction<{ ok: true; intent: ZelleIntent }>({
    action: 'create-intent',
    provider,
    payment_token: paymentToken,
  });
}

export function getZelleStatus(paymentToken: string, provider: ManualPaymentProvider = 'zelle') {
  return callZelleFunction<{ ok: true; intent: ZelleIntent | null }>({
    action: 'status',
    provider,
    payment_token: paymentToken,
  });
}

export function createVenmoIntent(paymentToken: string) {
  return createZelleIntent(paymentToken, 'venmo');
}

export function getVenmoStatus(paymentToken: string) {
  return getZelleStatus(paymentToken, 'venmo');
}

export function markZelleSent(input: {
  intentId: string;
  paymentToken: string;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  claimedAmountCents?: number;
}) {
  return callZelleFunction<{ ok: true; intent: ZelleIntent }>({
    action: 'mark-sent',
    intent_id: input.intentId,
    payment_token: input.paymentToken,
    sender_name: input.senderName,
    sender_email: input.senderEmail,
    sender_phone: input.senderPhone,
    claimed_amount_cents: input.claimedAmountCents,
  });
}

export function requestZelleProofUpload(input: { intentId: string; paymentToken: string; fileName: string; contentType: string }) {
  return callZelleFunction<{ ok: true; uploadUrl: string; filePath: string }>({
    action: 'proof-upload-url',
    intent_id: input.intentId,
    payment_token: input.paymentToken,
    file_name: input.fileName,
    content_type: input.contentType,
  });
}

export function completeZelleProofUpload(input: { intentId: string; paymentToken: string; filePath: string; fileName: string; contentType: string; fileSize: number }) {
  return callZelleFunction<{ ok: true }>({
    action: 'proof-complete',
    intent_id: input.intentId,
    payment_token: input.paymentToken,
    file_path: input.filePath,
    file_name: input.fileName,
    content_type: input.contentType,
    file_size: input.fileSize,
  });
}

export function adminUpdateZelleIntent(input: { intentId: string; action: 'admin-confirm' | 'admin-reject' | 'admin-needs-info' | 'admin-expire'; note?: string }) {
  return callZelleFunction<{ ok: true }>({
    action: input.action,
    intent_id: input.intentId,
    note: input.note,
  });
}
