import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_TO = Deno.env.get('NOTIFY_EMAIL') ?? 'service@pepscriptrx.com';
const NOTIFY_FROM = Deno.env.get('NOTIFY_FROM') ?? 'PepScriptRX <service@pepscriptrx.com>';
const SITE_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL') ?? 'https://pepscriptrx.vercel.app';
const THE_P_LOUNGE_NOTIFY_EMAIL = Deno.env.get('THE_P_LOUNGE_NOTIFY_EMAIL') ?? 'hello@theplounge.com';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;

    const shippingLine = [
      record.shipping_address,
      record.shipping_city,
      record.shipping_state,
      record.shipping_zip,
    ].filter(Boolean).map((value) => cleanText(value)).join(', ');
    const adminUrl = `${baseUrl()}/admin/submissions/${encodeURIComponent(cleanText(record.id, ''))}`;
    const isThePLounge = isThePLoungeOrder(record);
    const recipients = [...new Set([
      NOTIFY_TO,
      ...(isThePLounge ? [THE_P_LOUNGE_NOTIFY_EMAIL] : []),
    ].map((email) => email.trim().toLowerCase()).filter(Boolean))];

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
    <h1>${isThePLounge ? 'New The P Lounge Order' : 'New Submission Received'}</h1>
    <p>${isThePLounge ? 'The P Lounge powered by PepScriptRX' : 'PepScriptRX'} - ${escapeHtml(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))} PT</p>
  </div>
  <div class="body">
    <span class="badge">Action required</span>
    <table>
      <tr><td>Name</td><td>${escapeHtml(record.full_name)}</td></tr>
      <tr><td>Email</td><td>${escapeHtml(record.email)}</td></tr>
      <tr><td>Phone</td><td>${escapeHtml(record.phone)}</td></tr>
      <tr><td>Medication</td><td>${escapeHtml(record.medication)}</td></tr>
      <tr><td>Current dose</td><td>${escapeHtml(record.current_dose)}</td></tr>
      <tr><td>Currently paying</td><td>${record.current_price ? escapeHtml(`$${Number(record.current_price).toFixed(2)}/mo`) : '-'}</td></tr>
      <tr><td>State</td><td>${escapeHtml(record.state)}</td></tr>
      <tr><td>Shipping</td><td>${escapeHtml(shippingLine)}</td></tr>
      <tr><td>Shipping speed</td><td>${escapeHtml(record.shipping_speed, 'standard')}</td></tr>
    </table>
    <a class="cta" href="${adminUrl}">Review Submission in Admin -&gt;</a>
  </div>
  <div class="footer">PepScriptRX - Nationwide Shipment</div>
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
        to: recipients,
        subject: `${isThePLounge ? 'New The P Lounge order' : 'New submission'}: ${cleanText(record.full_name, 'Unknown')} - ${cleanText(record.medication, 'Unknown')}`,
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

function baseUrl() {
  return SITE_URL.replace(/\/+$/, '');
}

function isThePLoungeOrder(record: Record<string, unknown>) {
  const values = [
    record.checkout_scope_code, record.store_slug, record.store_name, record.source_portal,
    record.source_store, record.source_admin, record.source_rep, record.admin_code, record.referral_code,
  ].map((value) => String(value ?? '').trim().toLowerCase());

  return values.includes('theplounge')
    || values.includes('the-p-lounge')
    || values.some((value) => value.includes('the p lounge'));
}

function cleanText(value: unknown, fallback = '-') {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return text || fallback;
}

function escapeHtml(value: unknown, fallback = '-') {
  return cleanText(value, fallback).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}
