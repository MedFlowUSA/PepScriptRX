import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM   = Deno.env.get('NOTIFY_FROM')  ?? 'PepScriptRX <service@pepscriptrx.com>';
const SITE_URL      = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL') ?? 'https://pepscriptrx.vercel.app';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;

    if (!record.email) {
      return new Response(JSON.stringify({ skipped: 'no email' }), { status: 200 });
    }

    const productTotal   = Number(record.quoted_price  ?? 0);
    const discountAmount = Math.min(Number(record.discount_amount ?? 0), productTotal);
    const shippingCost   = Number(record.shipping_cost ?? 0);
    const grandTotal     = Math.max(0, productTotal - discountAmount) + shippingCost;
    const payLink        = `${SITE_URL}/pay/${record.id}`;

    const shippingLabel =
      record.shipping_speed === 'overnight'  ? 'Overnight (next business day)' :
      record.shipping_speed === 'expedited'  ? 'Expedited (2–3 business days)' :
      'Standard (5–7 business days)';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; color: #1a2332; margin: 0; padding: 0; background: #f5f7fa; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .hdr  { background: #1a2332; padding: 28px 32px; }
  .hdr h1 { color: #fff; margin: 0; font-size: 22px; }
  .hdr p  { color: rgba(255,255,255,.6); margin: 6px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .badge { display: inline-block; background: #e6faf5; color: #00b894; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 9px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  td:first-child { color: #6b7280; width: 42%; }
  td:last-child { font-weight: 600; }
  .total-row td { font-size: 17px; font-weight: 800; border-bottom: none; padding-top: 14px; color: #1a2332; }
  .cta { display: block; margin: 28px 0 0; background: #25C7D9; color: #fff; text-align: center; padding: 16px 24px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 17px; letter-spacing: -.01em; }
  .note { margin-top: 20px; font-size: 13px; color: #6b7280; line-height: 1.7; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f0f0f0; }
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>Your order is ready to pay!</h1>
    <p>PepScriptRX savings quote approved — action required</p>
  </div>
  <div class="body">
    <span class="badge">Payment ready</span>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">
      Hi <strong>${record.full_name ?? 'there'}</strong> — great news! Your PepScriptRX savings quote
      for <strong>${record.medication ?? 'your medication'}</strong> has been approved and your
      payment link is ready.
    </p>
    <table>
      <tr><td>Medication</td><td>${record.medication ?? '—'}</td></tr>
      <tr><td>Quoted price</td><td>$${productTotal.toFixed(2)}</td></tr>
      ${discountAmount > 0 ? `<tr><td>Discount (${record.discount_code ?? 'referral'})</td><td style="color:#00b894">-$${discountAmount.toFixed(2)}</td></tr>` : ''}
      <tr><td>Shipping</td><td>${shippingCost === 0 ? 'Included — ' : '+$' + shippingCost.toFixed(2) + ' — '}${shippingLabel}</td></tr>
      <tr class="total-row"><td>Total due</td><td>$${grandTotal.toFixed(2)}</td></tr>
    </table>
    <a class="cta" href="${payLink}">Pay $${grandTotal.toFixed(2)} Now →</a>
    <p class="note">
      Accepts PayPal, credit card, debit card, and cryptocurrency.<br>
      Your order will be processed and shipped once payment is confirmed.
      Questions? Reply to this email or call us at (818) 864-0472.
    </p>
  </div>
  <div class="footer">PepScriptRX · Nationwide Shipment · <a href="${SITE_URL}/privacy" style="color:#9ca3af">Privacy</a></div>
</div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    NOTIFY_FROM,
        to:      [record.email],
        subject: `Your PepScriptRX payment is ready — $${grandTotal.toFixed(2)} for ${record.medication ?? 'your order'}`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: res.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
