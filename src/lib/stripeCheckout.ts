import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

type FunctionPayload = Record<string, unknown>;

export class StripeCheckoutError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'StripeCheckoutError';
    this.status = status;
    this.body = body;
  }
}

async function callStripeCheckoutFunction<T>(payload: FunctionPayload): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase is not configured');
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = session?.access_token ?? supabaseAnonKey;
  const res = await fetch(`${supabaseUrl}/functions/v1/create-stripe-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new StripeCheckoutError(body.error ?? 'Stripe checkout request failed', res.status, body);
  return body as T;
}

export function createStripeCheckoutSession(paymentToken: string) {
  return callStripeCheckoutFunction<{ ok: true; id: string; url: string }>({
    payment_token: paymentToken,
  });
}
