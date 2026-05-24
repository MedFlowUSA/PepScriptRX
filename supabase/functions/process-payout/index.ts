import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPAL_CLIENT_ID     = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const PAYPAL_ENV           = Deno.env.get('PAYPAL_ENV') ?? '';
const ADMIN_PAYPAL_EMAIL   = Deno.env.get('ADMIN_PAYPAL_EMAIL') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (PAYPAL_ENV !== 'live') {
  throw new Error(
    'PAYPAL_ENV must be explicitly set to "live" in Supabase Edge Function secrets. ' +
    'Real payouts are blocked until this is configured to prevent accidental sandbox runs.',
  );
}

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in Supabase Edge Function secrets.');
}

if (!ADMIN_PAYPAL_EMAIL) {
  throw new Error('ADMIN_PAYPAL_EMAIL must be set in Supabase Edge Function secrets.');
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
    const { submission_id } = await req.json() as { submission_id: string };
    if (!submission_id) return json({ error: 'submission_id required' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Idempotency: skip if already processed ───────────────────
    const { data: existing } = await db
      .from('payouts')
      .select('id')
      .eq('submission_id', submission_id)
      .eq('status', 'sent')
      .limit(1);
    if (existing && existing.length > 0) {
      return json({ ok: true, skipped: 'already processed' }, 200);
    }

    // ── Fetch submission ─────────────────────────────────────────
    const { data: sub, error: subErr } = await db
      .from('patient_submissions')
      .select('id, quoted_price, discount_amount, shipping_cost, rep_id, full_name, medication')
      .eq('id', submission_id)
      .single();
    if (subErr || !sub) return json({ error: 'Submission not found' }, 404);

    // Grand total = what patient actually paid
    const productTotal  = Number(sub.quoted_price  ?? 0);
    const discountAmt   = Math.min(Number(sub.discount_amount ?? 0), productTotal);
    const shippingCost  = Number(sub.shipping_cost ?? 0);
    const grandTotal    = Math.max(0, productTotal - discountAmt) + shippingCost;

    if (grandTotal <= 0) return json({ error: 'Grand total is 0 — nothing to distribute' }, 400);

    // ── Fetch payout rules ───────────────────────────────────────
    const { data: rules } = await db
      .from('payout_rules')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .limit(1);
    const rule = rules?.[0] ?? { admin_pct: 40, rep_pct: 25, main_pct: 35 };

    // ── Fetch rep's payout email ─────────────────────────────────
    let repEmail: string | null = null;
    if (sub.rep_id) {
      const { data: rep } = await db
        .from('reps')
        .select('payout_email, rep_slug')
        .eq('id', sub.rep_id)
        .single();
      repEmail = rep?.payout_email ?? null;
    }

    // ── Build payout items ───────────────────────────────────────
    type PayoutItem = {
      recipient_type: 'admin' | 'rep';
      email: string;
      amount: number;
      pct: number;
      note: string;
      sender_item_id: string;
    };

    const items: PayoutItem[] = [];

    if (ADMIN_PAYPAL_EMAIL) {
      const adminAmount = parseFloat(((grandTotal * rule.admin_pct) / 100).toFixed(2));
      items.push({
        recipient_type: 'admin',
        email: ADMIN_PAYPAL_EMAIL,
        amount: adminAmount,
        pct: rule.admin_pct,
        note: `PepScriptRX admin split (${rule.admin_pct}%) — ${sub.medication ?? 'order'}`,
        sender_item_id: `${submission_id}-admin`,
      });
    }

    if (repEmail) {
      const repAmount = parseFloat(((grandTotal * rule.rep_pct) / 100).toFixed(2));
      items.push({
        recipient_type: 'rep',
        email: repEmail,
        amount: repAmount,
        pct: rule.rep_pct,
        note: `PepScriptRX rep commission (${rule.rep_pct}%) — ${sub.medication ?? 'order'}`,
        sender_item_id: `${submission_id}-rep`,
      });
    }

    if (items.length === 0) {
      return json({ ok: false, error: 'No valid recipients configured (check ADMIN_PAYPAL_EMAIL and rep payout_email)' }, 400);
    }

    // ── Pre-log payouts as pending ───────────────────────────────
    const pendingRows = items.map((item) => ({
      submission_id,
      recipient_type: item.recipient_type,
      recipient_email: item.email,
      amount: item.amount,
      pct: item.pct,
      status: 'pending',
    }));
    await db.from('payouts').insert(pendingRows);

    // ── Get PayPal access token ──────────────────────────────────
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
      await db.from('payouts')
        .update({ status: 'failed', error_message: `PayPal auth failed: ${JSON.stringify(tokenData)}` })
        .eq('submission_id', submission_id)
        .eq('status', 'pending');
      return json({ ok: false, error: 'PayPal authentication failed', detail: tokenData }, 502);
    }
    const accessToken = tokenData.access_token;

    // ── Call PayPal Payouts API ──────────────────────────────────
    const payoutBody = {
      sender_batch_header: {
        sender_batch_id: submission_id,  // idempotency key — PayPal rejects duplicate batch IDs
        email_subject: 'PepScriptRX Commission Payment',
        email_message: 'Your commission payment from PepScriptRX has been sent.',
      },
      items: items.map((item) => ({
        recipient_type: 'EMAIL',
        amount: { value: item.amount.toFixed(2), currency: 'USD' },
        receiver: item.email,
        note: item.note,
        sender_item_id: item.sender_item_id,
      })),
    };

    const payoutRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutBody),
    });
    const payoutData = await payoutRes.json();

    if (!payoutRes.ok) {
      await db.from('payouts')
        .update({
          status: 'failed',
          error_message: `PayPal Payouts API error: ${JSON.stringify(payoutData)}`,
        })
        .eq('submission_id', submission_id)
        .eq('status', 'pending');
      return json({ ok: false, error: 'PayPal Payouts API failed', detail: payoutData }, 502);
    }

    const batchId = payoutData.batch_header?.payout_batch_id ?? null;

    // ── Mark payouts as sent ─────────────────────────────────────
    await db.from('payouts')
      .update({ status: 'sent', paypal_batch_id: batchId })
      .eq('submission_id', submission_id)
      .eq('status', 'pending');

    return json({
      ok: true,
      batch_id: batchId,
      total_distributed: items.reduce((s, i) => s + i.amount, 0),
      recipients: items.map((i) => ({
        type: i.recipient_type,
        email: i.email,
        amount: i.amount,
        pct: i.pct,
      })),
    }, 200);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
