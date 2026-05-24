import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPAL_CLIENT_ID     = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const PAYPAL_ENV           = Deno.env.get('PAYPAL_ENV') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (PAYPAL_ENV !== 'live') {
  throw new Error(
    'PAYPAL_ENV must be set to "live" in Supabase Edge Function secrets. ' +
    'Payment capture is blocked until this is configured.',
  );
}

const PAYPAL_BASE = 'https://api-m.paypal.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, submission_id } = await req.json() as { order_id: string; submission_id: string };
    if (!order_id || !submission_id) {
      return json({ error: 'order_id and submission_id required' }, 400);
    }

    // Get PayPal access token
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return json({ ok: false, error: 'PayPal auth failed', detail: tokenData }, 502);
    }

    // Capture the PayPal order server-side
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': submission_id, // idempotency — safe to retry
      },
    });
    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      return json({ ok: false, error: 'PayPal capture failed', detail: captureData }, 502);
    }

    if (captureData.status !== 'COMPLETED') {
      return json({ ok: false, error: `Unexpected PayPal order status: ${captureData.status}` }, 400);
    }

    // Mark submission as paid — only transitions from payment_sent to prevent double-processing
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await db
      .from('patient_submissions')
      .update({ status: 'paid' })
      .eq('id', submission_id)
      .eq('status', 'payment_sent');

    return json({ ok: true, paypal_order_id: order_id }, 200);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
