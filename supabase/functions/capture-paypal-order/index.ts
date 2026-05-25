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
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id, status, quoted_price, discount_amount, shipping_cost, rep_id')
      .eq('id', submission_id)
      .single();

    if (subError || !submission) return json({ ok: false, error: 'Submission not found' }, 404);
    if (submission.status === 'paid' || submission.status === 'fulfilled') {
      return json({ ok: true, paypal_order_id: order_id, already_paid: true }, 200);
    }
    if (submission.status !== 'payment_sent') {
      return json({ ok: false, error: `Submission is not payable: ${submission.status}` }, 409);
    }

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
    const captureId = capture?.id ?? null;
    const captureStatus = capture?.status ?? captureData.status;

    const { error: updateError } = await db
      .from('patient_submissions')
      .update({
        status: 'paid',
        payment_status: 'paid',
        paypal_order_id: order_id,
        paypal_capture_id: captureId,
        paypal_capture_status: captureStatus,
        paid_at: new Date().toISOString(),
      })
      .eq('id', submission_id)
      .eq('status', 'payment_sent');

    if (updateError) return json({ ok: false, error: 'Could not mark submission paid', detail: updateError }, 500);

    if (submission.rep_id) {
      const { data: rep } = await db
        .from('reps')
        .select('commission_rate')
        .eq('id', submission.rep_id)
        .single();
      const productTotal = Number(submission.quoted_price ?? 0);
      const discountAmt = Math.min(Number(submission.discount_amount ?? 0), productTotal);
      const shippingCost = Number(submission.shipping_cost ?? 0);
      const grossSale = Math.max(0, productTotal - discountAmt) + shippingCost;
      const commissionBase = Math.max(0, productTotal - discountAmt);
      const rate = Number(rep?.commission_rate ?? 0.2);

      await db.from('commission_ledger').upsert({
        submission_id,
        rep_id: submission.rep_id,
        gross_sale: grossSale,
        margin: commissionBase,
        commission_rate: rate,
        commission_amount: commissionBase * rate,
        status: 'pending',
      }, { onConflict: 'submission_id' });
    }

    return json({ ok: true, paypal_order_id: order_id, paypal_capture_id: captureId }, 200);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
