import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_TO     = Deno.env.get('NOTIFY_EMAIL') ?? 'service@pepscriptrx.com';
const NOTIFY_FROM   = Deno.env.get('NOTIFY_FROM')  ?? 'PepScriptRX <service@pepscriptrx.com>';
const SITE_URL      = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL') ?? 'https://pepscriptrx.vercel.app';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body; // webhook sends { type, table, record }

    const shippingLine = [
      record.shipping_address,
      record.shipping_city,
      record.shipping_state,
      record.shipping_zip,
    ].filter(Boolean).join(', ');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; color: #1a2332; margin: 0; padding: 0; background: #f5f7fa; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .hdr { background: #1a2332; padding: 28px 32px; }
  .hdr h1 { color: #fff; margin: 0; font-size: 22px; }
  .hdr p { color: rgba(255,255,255,.6); margin: 4px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .badge { display: inline-block; background: #e6faf5; color: #00b894; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #6b7280; width: 40%; }
  td:last-child { font-weight: 600; }
  .cta { display: block; margin: 24px 0 0; background: #00b894; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f0f0f0; }
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>New Submission Received</h1>
    <p>PepScriptRX · ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>
  </div>
  <div class="body">
    <span class="badge">Action required</span>
    <table>
      <tr><td>Name</td><td>${record.full_name ?? '—'}</td></tr>
      <tr><td>Email</td><td>${record.email ?? '—'}</td></tr>
      <tr><td>Phone</td><td>${record.phone ?? '—'}</td></tr>
      <tr><td>Medication</td><td>${record.medication ?? '—'}</td></tr>
      <tr><td>Current dose</td><td>${record.current_dose ?? '—'}</td></tr>
      <tr><td>Currently paying</td><td>${record.current_price ? '$' + Number(record.current_price).toFixed(2) + '/mo' : '—'}</td></tr>
      <tr><td>State</td><td>${record.state ?? '—'}</td></tr>
      <tr><td>Shipping</td><td>${shippingLine || '—'}</td></tr>
      <tr><td>Shipping speed</td><td>${record.shipping_speed ?? 'standard'}</td></tr>
    </table>
    <a class="cta" href="${SITE_URL}/admin/submissions/${record.id}">Review Submission in Admin →</a>
  </div>
  <div class="footer">PepScriptRX · Nationwide Shipment</div>
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
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        subject: `New submission: ${record.full_name ?? 'Unknown'} — ${record.medication ?? 'Unknown'}`,
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
