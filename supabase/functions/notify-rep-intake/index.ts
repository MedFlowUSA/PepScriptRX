import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AACTIVATED_NOTIFY_EMAILS = parseEmailList(
  Deno.env.get('AACTIVATED_REP_NOTIFY_EMAILS')
    ?? Deno.env.get('AACTIVATED_NOTIFY_EMAIL')
    ?? 'guy@aactivated.com',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type RepRequest = {
  id: string;
  created_at?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  desired_rep_code?: string | null;
  parent_rep_or_admin_name?: string | null;
  store_type?: string | null;
  parent_store_slug?: string | null;
  parent_store_name?: string | null;
  partner_admin_email?: string | null;
  approval_owner_email?: string | null;
  review_queue?: string | null;
  review_admin_code?: string | null;
  review_admin_name?: string | null;
  source_portal_id?: string | null;
  source_portal?: string | null;
  source_route?: string | null;
  source_url?: string | null;
  approval_status?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!isServiceRequest(req)) return json({ error: 'Service authorization required' }, 401);
    if (AACTIVATED_NOTIFY_EMAILS.length === 0) return json({ error: 'AACTIVATED recipient email is not configured' }, 500);

    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const incoming = body.record ?? body;
    const requestId = cleanText(incoming?.id ?? body.rep_request_id, '');
    if (!requestId) return json({ error: 'rep request id is required' }, 400);

    const repRequest = await getRepRequest(db, requestId);
    if (!repRequest) return json({ error: 'Rep request not found' }, 404);
    if (!isAactivatedRepRequest(repRequest)) return json({ skipped: 'not an AACTIVATED rep request' }, 200);

    const primaryRecipient = AACTIVATED_NOTIFY_EMAILS[0];
    const existing = await getPartnerEvent(db, repRequest.id, primaryRecipient);
    if (existing?.status === 'sent') return json({ skipped: 'rep request notification already sent', recipient: primaryRecipient }, 200);

    const apiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('NOTIFY_FROM') ?? 'PepScriptRX <service@pepscriptrx.com>';
    if (!apiKey) return json({ error: 'EMAIL_PROVIDER_API_KEY or RESEND_API_KEY is not configured' }, 500);

    const message = buildRepIntakeEmail(repRequest);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: AACTIVATED_NOTIFY_EMAILS,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      await markPartnerEvent(db, repRequest.id, primaryRecipient, 'failed', null, JSON.stringify(data));
      return json({ error: data, recipient: primaryRecipient }, 500);
    }

    await markPartnerEvent(db, repRequest.id, primaryRecipient, 'sent', cleanText(data.id, ''), null);
    return json({ ok: true, recipient: primaryRecipient, email_provider_id: data.id ?? null }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function getDb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function isServiceRequest(req: Request) {
  return req.headers.get('Authorization') === `Bearer ${SUPABASE_SERVICE_KEY}`;
}

async function getRepRequest(db: ReturnType<typeof getDb>, requestId: string): Promise<RepRequest | null> {
  const { data, error } = await db
    .from('rep_store_intake_submissions')
    .select(`
      id,
      created_at,
      full_name,
      email,
      phone,
      desired_rep_code,
      parent_rep_or_admin_name,
      store_type,
      parent_store_slug,
      parent_store_name,
      partner_admin_email,
      approval_owner_email,
      review_queue,
      review_admin_code,
      review_admin_name,
      source_portal_id,
      source_portal,
      source_route,
      source_url,
      approval_status
    `)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(`Rep request lookup failed: ${error.message}`);
  return data as RepRequest | null;
}

async function getPartnerEvent(db: ReturnType<typeof getDb>, requestId: string, recipientEmail: string) {
  const { data, error } = await db
    .from('partner_notification_events')
    .select('id, status')
    .eq('rep_request_id', requestId)
    .eq('event_type', 'aactivated_rep_request_submitted_partner_admin')
    .eq('recipient_email', recipientEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Partner event lookup failed: ${error.message}`);
  return data as { id: string; status: string } | null;
}

async function markPartnerEvent(
  db: ReturnType<typeof getDb>,
  requestId: string,
  recipientEmail: string,
  status: 'sent' | 'failed',
  emailProviderId: string | null,
  errorMessage: string | null,
) {
  const now = new Date().toISOString();
  const { error } = await db
    .from('partner_notification_events')
    .update({
      status,
      sent_at: status === 'sent' ? now : null,
      email_provider_id: emailProviderId,
      last_error_message: errorMessage,
    })
    .eq('rep_request_id', requestId)
    .eq('event_type', 'aactivated_rep_request_submitted_partner_admin')
    .eq('recipient_email', recipientEmail);
  if (error) throw new Error(`Partner event update failed: ${error.message}`);
}

function buildRepIntakeEmail(record: RepRequest) {
  const appUrl = trimTrailingSlash(Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://pepscriptrx.vercel.app');
  const adminUrl = `${appUrl}/admin/rep-requests`;
  const submittedAt = record.created_at ? new Date(record.created_at) : new Date();
  const desiredCode = cleanText(record.desired_rep_code, 'Pending');
  const text = [
    'New AACTIVATED rep request',
    '',
    `Name: ${cleanText(record.full_name)}`,
    `Email: ${cleanText(record.email)}`,
    `Phone: ${cleanText(record.phone)}`,
    `Desired rep code: ${desiredCode}`,
    `Parent/admin: ${cleanText(record.parent_rep_or_admin_name ?? record.review_admin_name)}`,
    `Queue: ${cleanText(record.review_queue, 'aactivated')}`,
    `Submitted: ${submittedAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`,
    '',
    `Review request: ${adminUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fa;color:#101828;margin:0;padding:0}
.wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.hdr{background:#082032;color:#fff;padding:28px 32px}
.hdr h1{font-size:22px;margin:0 0 6px}
.hdr p{margin:0;color:rgba(255,255,255,.72)}
.body{padding:28px 32px}
.badge{display:inline-block;background:#e0f2fe;color:#075985;font-weight:800;font-size:12px;border-radius:999px;padding:5px 10px;margin-bottom:18px;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin:10px 0 22px}
td{border-bottom:1px solid #eef2f7;padding:10px 0;font-size:14px;vertical-align:top}
td:first-child{color:#667085;width:34%}
td:last-child{font-weight:700}
.cta{display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:800;border-radius:8px;padding:13px 18px}
.foot{padding:16px 32px;color:#98a2b3;font-size:12px;border-top:1px solid #eef2f7}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>New AACTIVATED rep request</h1><p>AACTIVATED RX rep intake</p></div>
<div class="body">
<span class="badge">Needs review</span>
<table>
<tr><td>Name</td><td>${escapeHtml(record.full_name)}</td></tr>
<tr><td>Email</td><td>${escapeHtml(record.email)}</td></tr>
<tr><td>Phone</td><td>${escapeHtml(record.phone)}</td></tr>
<tr><td>Desired code</td><td>${escapeHtml(desiredCode)}</td></tr>
<tr><td>Parent/admin</td><td>${escapeHtml(record.parent_rep_or_admin_name ?? record.review_admin_name)}</td></tr>
<tr><td>Source</td><td>${escapeHtml(record.source_route ?? record.source_url)}</td></tr>
<tr><td>Submitted</td><td>${escapeHtml(submittedAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))} PT</td></tr>
</table>
<a class="cta" href="${adminUrl}">Review Rep Request</a>
</div>
<div class="foot">PepScriptRX partner rep-intake notification</div>
</div></body></html>`;

  return {
    subject: `New AACTIVATED rep request: ${cleanText(record.full_name, 'Unknown')} (${desiredCode})`,
    text,
    html,
  };
}

function isAactivatedRepRequest(record: RepRequest) {
  const values = [
    record.parent_store_slug,
    record.review_queue,
    record.source_portal_id,
    record.source_portal,
    record.parent_store_name,
    record.partner_admin_email,
    record.approval_owner_email,
    record.review_admin_code,
  ].map((value) => String(value ?? '').trim().toLowerCase());

  return values.includes('aactivated')
    || values.includes('aactivatedrx')
    || values.includes('guy60')
    || values.includes('guy@aactivated.com')
    || values.some((value) => value.includes('aactivated'));
}

function parseEmailList(value: string) {
  return value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
