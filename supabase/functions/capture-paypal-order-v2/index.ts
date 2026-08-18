import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeAndPersistGintoTirzepatide60Order } from '../_shared/ginto-pricing.ts';
import { finalizeVerifiedPaidOrder } from '../_shared/order-finalizer.ts';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const PAYPAL_ENV = Deno.env.get('PAYPAL_ENV') ?? '';
const ADMIN_PAYPAL_EMAIL = Deno.env.get('ADMIN_PAYPAL_EMAIL') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (PAYPAL_ENV !== 'live') throw new Error('PAYPAL_ENV must be set to "live".');
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal credentials are required.');
if (!ADMIN_PAYPAL_EMAIL) throw new Error('ADMIN_PAYPAL_EMAIL is required.');

const PAYPAL_BASE = 'https://api-m.paypal.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { order_id, payment_token } = await req.json() as { order_id?: string; payment_token?: string };
    const paypalOrderId = String(order_id ?? '').trim();
    const paymentToken = String(payment_token ?? '').trim();
    if (!paypalOrderId || !paymentToken) return json({ error: 'order_id and payment_token required' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id,status,quoted_price,discount_amount,shipping_cost,order_items,payment_status,payment_provider,paypal_order_id,paypal_capture_id,paid_at')
      .eq('public_payment_token', paymentToken)
      .single();
    if (subError || !submission) return json({ error: 'Payment order not found' }, 404);

    const alreadyPaid = submission.payment_status === 'paid' || submission.status === 'paid' || submission.status === 'fulfilled';
    const pricedSubmission = alreadyPaid
      ? submission
      : await normalizeAndPersistGintoTirzepatide60Order(db, submission);
    const productTotal = Number(pricedSubmission.quoted_price ?? 0);
    const discountAmount = Math.min(Number(pricedSubmission.discount_amount ?? 0), productTotal);
    const shippingCost = Number(pricedSubmission.shipping_cost ?? 0);
    const expectedAmountCents = cents(Math.max(0, productTotal - discountAmount) + shippingCost);
    if (expectedAmountCents <= 0) return json({ error: 'Order total is not payable' }, 400);

    if (alreadyPaid) {
      if (submission.payment_provider !== 'paypal' || submission.paypal_order_id !== paypalOrderId || !submission.paypal_capture_id) {
        return json({ error: 'Order is already paid by a different provider or reference' }, 409);
      }
      const replay = await finalizeVerifiedPaidOrder(db, {
        provider: 'paypal',
        providerEventId: `capture:${submission.paypal_capture_id}`,
        providerOrderReference: paypalOrderId,
        providerTransactionReference: String(submission.paypal_capture_id),
        orderId: String(submission.id),
        amountCents: expectedAmountCents,
        currency: 'USD',
        paidAt: String(submission.paid_at ?? new Date().toISOString()),
      });
      return json({ ok: true, paypal_order_id: paypalOrderId, paypal_capture_id: submission.paypal_capture_id, finalization: replay.result }, 200);
    }
    if (submission.status !== 'payment_sent') return json({ error: `Order is not checkout-ready: ${submission.status}` }, 409);

    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${String(pricedSubmission.id)}`,
      },
    });
    const captureData = await captureRes.json().catch(() => ({}));
    if (!captureRes.ok) return json({ error: 'PayPal capture failed' }, 502);
    if (captureData.status !== 'COMPLETED') return json({ error: 'PayPal payment is not completed' }, 409);

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
    const captureId = String(capture?.id ?? '').trim();
    const captureStatus = String(capture?.status ?? '').trim();
    const captureAmountCents = cents(Number(capture?.amount?.value ?? NaN));
    const captureCurrency = String(capture?.amount?.currency_code ?? '').toUpperCase();
    const payeeEmail = String(captureData.purchase_units?.[0]?.payee?.email_address ?? '').trim().toLowerCase();
    if (!captureId || captureStatus !== 'COMPLETED') return json({ error: 'PayPal capture is incomplete' }, 409);
    if (captureCurrency !== 'USD' || captureAmountCents !== expectedAmountCents) {
      return json({ error: 'PayPal capture amount or currency mismatch' }, 409);
    }
    if (payeeEmail && payeeEmail !== ADMIN_PAYPAL_EMAIL.trim().toLowerCase()) {
      return json({ error: 'PayPal payee mismatch' }, 409);
    }

    const finalized = await finalizeVerifiedPaidOrder(db, {
      provider: 'paypal',
      providerEventId: `capture:${captureId}`,
      providerOrderReference: paypalOrderId,
      providerTransactionReference: captureId,
      orderId: String(submission.id),
      amountCents: captureAmountCents,
      currency: captureCurrency,
      paidAt: String(capture?.create_time ?? new Date().toISOString()),
      eventPayload: { capture_status: captureStatus },
    });
    if (!['finalized', 'already_finalized'].includes(finalized.result)) {
      return json({ error: 'PayPal finalization failed closed', result: finalized.result }, 409);
    }
    return json({ ok: true, paypal_order_id: paypalOrderId, paypal_capture_id: captureId, finalization: finalized.result }, 200);
  } catch {
    return json({ error: 'Could not complete PayPal payment' }, 500);
  }
});

async function getPayPalAccessToken(): Promise<string> {
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error('PayPal authentication failed');
  return String(body.access_token);
}

function cents(value: number): number {
  if (!Number.isFinite(value)) return -1;
  return Math.round(value * 100);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
