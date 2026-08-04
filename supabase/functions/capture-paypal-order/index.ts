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
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal API credentials are required.');
if (!ADMIN_PAYPAL_EMAIL) throw new Error('ADMIN_PAYPAL_EMAIL is required.');

const PAYPAL_BASE = 'https://api-m.paypal.com';
const allowedOrigins = (Deno.env.get('PAYMENT_ALLOWED_ORIGINS') ?? 'https://pepscriptrx.com,https://pepscriptrx.vercel.app')
  .split(',').map((value) => value.trim()).filter(Boolean);

serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = origin && allowedOrigins.includes(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json',
  } : { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: origin && allowedOrigins.includes(origin) ? 204 : 403, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  if (!origin || !allowedOrigins.includes(origin)) return json({ error: 'Origin not allowed' }, 403, cors);

  try {
    const body = await req.json() as { order_id?: string; payment_token?: string };
    const paypalOrderId = cleanReference(body.order_id);
    const paymentToken = String(body.payment_token ?? '').trim();
    if (!paypalOrderId || !/^[A-Za-z0-9_-]{20,160}$/.test(paymentToken)) {
      return json({ error: 'Invalid payment request' }, 400, cors);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id, status, quoted_price, discount_amount, shipping_cost, order_items, medication, cost_of_goods, rep_id, admin_code, store_slug, store_name, account_type, checkout_scope_id, checkout_scope_code, source_portal, source_store, source_admin, source_rep, order_type, payment_status, referral_code')
      .eq('public_payment_token', paymentToken)
      .single();

    if (subError || !submission) return json({ ok: false, error: 'Submission not found' }, 404, cors);
    if (submission.status === 'paid' || submission.status === 'fulfilled' || submission.payment_status === 'paid') {
      return json({ ok: true, paypal_order_id: paypalOrderId, already_paid: true }, 200, cors);
    }
    if (submission.status !== 'payment_sent') {
      return json({ ok: false, error: 'Submission is not payable' }, 409, cors);
    }

    const pricedSubmission = await normalizeAndPersistGintoTirzepatide60Order(db, submission);
    const expectedCents = amountDueCents(pricedSubmission);
    if (expectedCents <= 0) return json({ ok: false, error: 'Submission total is not payable' }, 400, cors);

    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) return json({ ok: false, error: 'PayPal authentication failed' }, 502, cors);

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': String(pricedSubmission.id), // idempotency - safe to retry
      },
    });
    const captureData = await captureRes.json();
    if (!captureRes.ok) return json({ ok: false, error: 'PayPal capture failed' }, 502, cors);

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
    const captureId = cleanReference(capture?.id);
    const captureStatus = String(capture?.status ?? captureData.status ?? '');
    const captureCents = Math.round(Number(capture?.amount?.value ?? NaN) * 100);
    const currency = String(capture?.amount?.currency_code ?? '').toUpperCase();
    const payeeEmail = String(captureData.purchase_units?.[0]?.payee?.email_address ?? '').toLowerCase();
    if (captureData.status !== 'COMPLETED' || captureStatus !== 'COMPLETED' || !captureId) {
      return json({ ok: false, error: 'PayPal did not confirm a completed capture' }, 409, cors);
    }
    if (!Number.isFinite(captureCents) || currency !== 'USD' || captureCents !== expectedCents) {
      return json({ ok: false, error: 'PayPal capture amount does not match expected order total' }, 409, cors);
    }
    if (payeeEmail && payeeEmail !== ADMIN_PAYPAL_EMAIL.toLowerCase()) {
      return json({ ok: false, error: 'PayPal payee mismatch' }, 409, cors);
    }

    const finalized = await finalizeVerifiedPaidOrder(db, {
      provider: 'paypal',
      providerEventId: `capture:${captureId}`,
      providerOrderReference: paypalOrderId,
      providerTransactionReference: captureId,
      orderId: String(pricedSubmission.id),
      amountCents: captureCents,
      currency,
      paidAt: String(capture?.create_time ?? captureData.create_time ?? new Date().toISOString()),
      eventPayload: { paypal_capture_status: captureStatus },
      notificationEndpoint: { supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_KEY },
    });
    if (!['finalized', 'already_finalized'].includes(finalized.result)) {
      return json({ ok: false, error: `PayPal payment finalization failed closed: ${finalized.result}` }, 409, cors);
    }
    return json({
      ok: true,
      paypal_order_id: paypalOrderId,
      paypal_capture_id: captureId,
      finalization: finalized.result,
    }, 200, cors);
  } catch {
    return json({ ok: false, error: 'Payment confirmation failed' }, 500, cors);
  }
});

function amountDueCents(order: Record<string, unknown>) {
  const product = Math.max(0, Number(order.quoted_price ?? 0));
  const discount = Math.min(product, Math.max(0, Number(order.discount_amount ?? 0)));
  const shipping = Math.max(0, Number(order.shipping_cost ?? 0));
  return Math.round((product - discount + shipping) * 100);
}

function cleanReference(value: unknown) {
  const reference = String(value ?? '').trim();
  return /^[A-Za-z0-9._:-]{1,200}$/.test(reference) ? reference : '';
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}
