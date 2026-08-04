import { supabase } from './supabase';

export type WooCommerceBridgeStatus =
  | 'not_started' | 'created' | 'awaiting_payment' | 'redirected'
  | 'payment_processing' | 'paid' | 'declined' | 'failed' | 'cancelled'
  | 'expired' | 'refunded' | 'partially_refunded' | 'voided' | 'disputed'
  | 'reconciliation_required';

export class WooCommerceCheckoutError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function invoke<T>(name: string, paymentToken: string): Promise<T> {
  if (!supabase) throw new WooCommerceCheckoutError('Card checkout is unavailable');
  const { data, error } = await supabase.functions.invoke(name, { body: { payment_token: paymentToken } });
  if (error) {
    const context = error.context as Response | undefined;
    const body = await context?.json().catch(() => ({})) as { error?: string; code?: string } | undefined;
    throw new WooCommerceCheckoutError(body?.error ?? error.message, body?.code);
  }
  return data as T;
}

export function createWooCommercePaymentSession(paymentToken: string) {
  return invoke<{ ok: true; url: string; expires_at: string }>('create-woocommerce-payment-session', paymentToken);
}

export function getWooCommercePaymentStatus(paymentToken: string) {
  return invoke<{ status: WooCommerceBridgeStatus; expires_at?: string; updated_at?: string }>('woocommerce-payment-status', paymentToken);
}
