import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeAndPersistGintoTirzepatide60Order } from '../_shared/ginto-pricing.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_PAYMENTS_ENABLED = (Deno.env.get('STRIPE_PAYMENTS_ENABLED') ?? 'false').toLowerCase() === 'true';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = (
  Deno.env.get('APP_URL')
  ?? Deno.env.get('PUBLIC_SITE_URL')
  ?? Deno.env.get('SITE_URL')
  ?? 'https://pepscriptrx.vercel.app'
).replace(/\/+$/, '');

if (STRIPE_PAYMENTS_ENABLED && !STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY must be set when Stripe payments are enabled.');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!STRIPE_PAYMENTS_ENABLED) {
    return json({ error: 'Stripe payments are unavailable', code: 'stripe_unavailable' }, 503);
  }

  try {
    const { payment_token } = await req.json() as { payment_token?: string };
    const paymentToken = String(payment_token ?? '').trim();
    if (!paymentToken) return json({ error: 'payment_token required' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id, public_payment_token, order_number, full_name, email, medication, status, quoted_price, discount_amount, shipping_cost, order_items, checkout_scope_code, source_portal, source_store, store_slug, store_name, referral_code, payment_status, stripe_checkout_session_id')
      .eq('public_payment_token', paymentToken)
      .single();

    if (subError || !submission) return json({ error: 'Payment order not found' }, 404);
    if (submission.status === 'paid' || submission.status === 'fulfilled' || submission.payment_status === 'paid') {
      return json({ error: 'This order is already paid' }, 409);
    }
    if (submission.status !== 'payment_sent') return json({ error: `Order is not checkout-ready: ${submission.status}` }, 409);

    const pricedSubmission = await normalizeAndPersistGintoTirzepatide60Order(db, submission);
    const productTotal = Number(pricedSubmission.quoted_price ?? 0);
    const discountAmount = Math.min(Number(pricedSubmission.discount_amount ?? 0), productTotal);
    const shippingCost = Number(pricedSubmission.shipping_cost ?? 0);
    const amountDueCents = cents(Math.max(0, productTotal - discountAmount) + shippingCost);
    if (amountDueCents <= 0) return json({ error: 'Order total is not payable' }, 400);

    const priorSessionId = String(pricedSubmission.stripe_checkout_session_id ?? '').trim();
    if (priorSessionId) {
      const priorSession = await retrieveStripeSession(priorSessionId);
      if (priorSession?.status === 'open' && priorSession.url) {
        return json({ ok: true, id: priorSession.id, url: priorSession.url, reused: true }, 200);
      }
      if (priorSession?.status === 'complete') {
        return json({
          error: priorSession.payment_status === 'paid'
            ? 'This order is already paid'
            : 'This payment is still processing. Please wait for confirmation before trying again.',
        }, 409);
      }
    }

    const brandName = stripeBrandName(pricedSubmission);
    const orderReference = String(pricedSubmission.order_number ?? `PSRX-${String(pricedSubmission.public_payment_token).slice(0, 8).toUpperCase()}`);
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${APP_URL}/pay/${encodeURIComponent(paymentToken)}?stripe=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${APP_URL}/pay/${encodeURIComponent(paymentToken)}?stripe=cancelled`);
    params.set('client_reference_id', String(pricedSubmission.id));
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(amountDueCents));
    params.set('line_items[0][price_data][product_data][name]', `${brandName} order ${orderReference}`);
    params.set('line_items[0][price_data][product_data][description]', String(pricedSubmission.medication ?? 'Wellness order').slice(0, 250));
    params.set('payment_intent_data[description]', `${brandName} ${orderReference}`);
    params.set('metadata[order_id]', String(pricedSubmission.id));
    params.set('metadata[payment_token]', paymentToken);
    params.set('metadata[order_reference]', orderReference);
    params.set('metadata[checkout_scope_code]', String(pricedSubmission.checkout_scope_code ?? ''));
    params.set('metadata[source_portal]', String(pricedSubmission.source_portal ?? ''));
    params.set('metadata[referral_code]', String(pricedSubmission.referral_code ?? ''));
    params.set('payment_intent_data[metadata][order_id]', String(pricedSubmission.id));
    params.set('payment_intent_data[metadata][payment_token]', paymentToken);
    params.set('payment_intent_data[metadata][checkout_scope_code]', String(pricedSubmission.checkout_scope_code ?? ''));
    params.set('integration_identifier', `pepscriptrx_${randomLetters(8)}`);

    const email = String(pricedSubmission.email ?? '').trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) params.set('customer_email', email);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2026-06-24.dahlia',
        'Idempotency-Key': checkoutIdempotencyKey(String(pricedSubmission.id), amountDueCents, priorSessionId),
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok || !session.id || !session.url) {
      const stripeError = classifyStripeError(session, stripeRes.headers.get('request-id'));
      await db.from('payment_audit_log').insert({
        order_id: pricedSubmission.id,
        actor_type: 'system',
        event_type: 'stripe_checkout_session_failed',
        event_payload: {
          stripe_error_type: stripeError.type,
          stripe_error_code: stripeError.code,
          stripe_decline_code: stripeError.declineCode,
          stripe_request_id: stripeError.requestId,
          http_status: stripeRes.status,
          amount_due_cents: amountDueCents,
        },
      });
      return json({
        error: stripeError.customerMessage,
        code: stripeError.code,
        support_reference: stripeError.requestId,
      }, 502);
    }

    await db
      .from('patient_submissions')
      .update({
        payment_provider: 'stripe',
        payment_status: 'payment_pending',
        payment_reference: session.id,
        stripe_checkout_session_id: session.id,
        stripe_payment_status: session.payment_status ?? 'unpaid',
        payment_release_policy: 'released',
      })
      .eq('id', pricedSubmission.id)
      .eq('status', 'payment_sent');

    await db.from('payment_audit_log').insert({
      order_id: pricedSubmission.id,
      actor_type: 'customer',
      event_type: 'stripe_checkout_session_created',
      event_payload: {
        stripe_checkout_session_id: session.id,
        amount_due_cents: amountDueCents,
        checkout_scope_code: pricedSubmission.checkout_scope_code ?? null,
      },
    });

    return json({ ok: true, id: session.id, url: session.url }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function stripeBrandName(submission: Record<string, unknown>): string {
  const tokens = [
    submission.checkout_scope_code,
    submission.referral_code,
    submission.source_portal,
    submission.source_store,
    submission.store_slug,
    submission.store_name,
  ].map((value) => String(value ?? '').toLowerCase());
  if (tokens.some((token) => token.includes('aactivated') || token.includes('vitalityins') || token === 'guy60')) {
    return 'AACTIVATED-RX';
  }
  if (tokens.some((token) => token.includes('anatolia'))) return 'Anatolia Wellness Labs';
  if (tokens.some((token) => token.includes('blackline'))) return 'Blackline Peptides';
  if (tokens.some((token) => token.includes('rockphorm') || token.includes('rock phorm'))) return 'Rock Phorm';
  if (tokens.some((token) => token.includes('aurora'))) return 'Aurora Labs';
  if (tokens.some((token) => token.includes('ginto'))) return 'Ginto Wellness Labs';
  if (tokens.some((token) => token.includes('glow'))) return 'GLOW';
  if (tokens.some((token) => token.includes('viltrum'))) return 'Viltrum Peptide';
  if (tokens.some((token) => token.includes('sandman'))) return 'Sandman Wellness Labs';
  if (tokens.some((token) => token.includes('klow'))) return 'KLOW';
  if (tokens.some((token) => token.includes('vitality'))) return 'Vitality Institute Labs';
  if (tokens.some((token) => token.includes('zenora'))) return 'ZENORA';
  if (tokens.some((token) => token.includes('physio'))) return 'PhysioPeptides';
  if (tokens.some((token) => token.includes('optimax'))) return 'Optimax Peptide Therapy';
  if (tokens.some((token) => token.includes('ronin'))) return 'Ronin';
  if (tokens.some((token) => token.includes('vyigenix'))) return 'Vyigenix Pharmaceuticals';
  if (tokens.some((token) => token.includes('agprime') || token.includes('ag prime'))) return 'AG Prime Lab';
  if (tokens.some((token) => token.includes('alphapride') || token.includes('alpha pride'))) return 'Alpha Pride Wellness';
  if (tokens.some((token) => token.includes('warx'))) return 'WarXlabz';
  if (tokens.some((token) => token.includes('peakform') || token.includes('peak form'))) return 'Peak Form Peptides';
  if (tokens.some((token) => token.includes('empire') || token.includes('mark65'))) return 'Empire Health & Wellness';
  return 'PepScriptRX';
}

async function retrieveStripeSession(sessionId: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2026-06-24.dahlia',
    },
  });
  if (response.status === 404) return null;
  const session = await response.json().catch(() => ({}));
  return response.ok ? session as Record<string, unknown> : null;
}

function checkoutIdempotencyKey(orderId: string, amountDueCents: number, priorSessionId: string): string {
  const attempt = priorSessionId ? priorSessionId.slice(-24) : 'initial';
  return `checkout-${orderId}-${amountDueCents}-${attempt}`.slice(0, 255);
}

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function classifyStripeError(payload: Record<string, unknown>, requestId: string | null) {
  const error = (payload?.error && typeof payload.error === 'object'
    ? payload.error
    : {}) as Record<string, unknown>;
  const type = cleanErrorToken(error.type, 'stripe_api_error');
  const code = cleanErrorToken(error.code, type);
  const declineCode = cleanErrorToken(error.decline_code, '');
  const safeCode = code.slice(0, 80);
  const customerMessage = type === 'authentication_error' || ['api_key_expired', 'account_invalid'].includes(code)
    ? `Card checkout is temporarily unavailable because the payment account needs attention. Please choose another payment option or contact support. (${safeCode})`
    : type === 'rate_limit_error'
      ? `Card checkout is temporarily busy. Please wait a moment and try again. (${safeCode})`
      : `Could not start secure card checkout. Please try again or choose another payment option. (${safeCode})`;
  return {
    type,
    code,
    declineCode,
    requestId: cleanErrorToken(requestId, crypto.randomUUID()).slice(0, 100),
    customerMessage,
  };
}

function cleanErrorToken(value: unknown, fallback: string): string {
  const token = String(value ?? '').trim();
  return /^[a-zA-Z0-9_:-]+$/.test(token) ? token : fallback;
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
