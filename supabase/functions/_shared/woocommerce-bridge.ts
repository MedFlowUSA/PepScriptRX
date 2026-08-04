export const BRIDGE_STATUSES = new Set([
  'created', 'awaiting_payment', 'redirected', 'payment_processing', 'paid',
  'declined', 'failed', 'cancelled', 'expired', 'refunded',
  'partially_refunded', 'voided', 'disputed', 'chargeback', 'reconciliation_required',
]);

export function encodeHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  return encodeHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

export async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return encodeHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function safeJson(body: Record<string, unknown>, status: number, origin?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

export function amountDueCents(row: Record<string, unknown>): number {
  const product = Number(row.quoted_price ?? 0);
  const discount = Math.min(Math.max(Number(row.discount_amount ?? 0), 0), product);
  const shipping = Math.max(Number(row.shipping_cost ?? 0), 0);
  return Math.round((Math.max(product - discount, 0) + shipping) * 100);
}

export function sanitizeToken(value: unknown): string {
  const token = String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{20,160}$/.test(token) ? token : '';
}
