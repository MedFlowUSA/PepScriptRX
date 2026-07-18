import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = (
  Deno.env.get('APP_URL')
  ?? Deno.env.get('PUBLIC_SITE_URL')
  ?? Deno.env.get('SITE_URL')
  ?? 'https://pepscriptrx.vercel.app'
).replace(/\/+$/, '');

if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY must be set in Supabase Edge Function secrets.');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { payment_token } = await req.json() as { payment_token?: string };
    const paymentToken = String(payment_token ?? '').trim();
    if (!paymentToken) return json({ error: 'payment_token required' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id, public_payment_token, order_number, full_name, email, medication, status, quoted_price, discount_amount, shipping_cost, checkout_scope_code, source_portal, referral_code, payment_status')
      .eq('public_payment_token', paymentToken)
      .single();

    if (subError || !submission) return json({ error: 'Payment order not found' }, 404);
    if (submission.status === 'paid' || submission.status === 'fulfilled' || submission.payment_status === 'paid') {
      return json({ error: 'This order is already paid' }, 409);
    }
    if (submission.status !== 'payment_sent') return json({ error: `Order is not checkout-ready: ${submission.status}` }, 409);

    const productTotal = Number(submission.quoted_price ?? 0);
    const discountAmount = Math.min(Number(submission.discount_amount ?? 0), productTotal);
    const shippingCost = Number(submission.shipping_cost ?? 0);
    const amountDueCents = cents(Math.max(0, productTotal - discountAmount) + shippingCost);
    if (amountDueCents <= 0) return json({ error: 'Order total is not payable' }, 400);

    const brandName = stripeBrandName(submission);
    const orderReference = String(submission.order_number ?? `PSRX-${String(submission.public_payment_token).slice(0, 8).toUpperCase()}`);
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${APP_URL}/pay/${encodeURIComponent(paymentToken)}?stripe=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${APP_URL}/pay/${encodeURIComponent(paymentToken)}?stripe=cancelled`);
    params.set('client_reference_id', String(submission.id));
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(amountDueCents));
    params.set('line_items[0][price_data][product_data][name]', `${brandName} order ${orderReference}`);
    params.set('line_items[0][price_data][product_data][description]', String(submission.medication ?? 'Wellness order').slice(0, 250));
    params.set('payment_intent_data[description]', `${brandName} ${orderReference}`);
    params.set('metadata[order_id]', String(submission.id));
    params.set('metadata[payment_token]', paymentToken);
    params.set('metadata[order_reference]', orderReference);
    params.set('metadata[checkout_scope_code]', String(submission.checkout_scope_code ?? ''));
    params.set('metadata[source_portal]', String(submission.source_portal ?? ''));
    params.set('metadata[referral_code]', String(submission.referral_code ?? ''));
    params.set('payment_intent_data[metadata][order_id]', String(submission.id));
    params.set('payment_intent_data[metadata][payment_token]', paymentToken);
    params.set('payment_intent_data[metadata][checkout_scope_code]', String(submission.checkout_scope_code ?? ''));

    const email = String(submission.email ?? '').trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) params.set('customer_email', email);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `checkout-${submission.id}-${amountDueCents}`,
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok || !session.id || !session.url) {
      return json({ error: 'Could not create Stripe checkout session', detail: session }, 502);
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
      .eq('id', submission.id)
      .eq('status', 'payment_sent');

    await db.from('payment_audit_log').insert({
      order_id: submission.id,
      actor_type: 'customer',
      event_type: 'stripe_checkout_session_created',
      event_payload: {
        stripe_checkout_session_id: session.id,
        amount_due_cents: amountDueCents,
        checkout_scope_code: submission.checkout_scope_code ?? null,
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
  ].map((value) => String(value ?? '').toLowerCase());
  if (tokens.some((token) => token.includes('aactivated') || token.includes('vitalityins') || token === 'guy60')) {
    return 'AACTIVATED-RX';
  }
  if (tokens.some((token) => token.includes('anatolia'))) return 'Anatolia Wellness Labs';
  if (tokens.some((token) => token.includes('blackline'))) return 'Blackline Peptides';
  return 'PepScriptRX';
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
