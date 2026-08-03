import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type DbClient = ReturnType<typeof createClient>;

type OrderRecord = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  order_number?: string | null;
  order_items?: Array<Record<string, unknown>> | null;
  medication?: string | null;
  quoted_price?: number | null;
  discount_amount?: number | null;
  shipping_cost?: number | null;
  order_total?: number | null;
  status?: string | null;
  payment_status?: string | null;
  payment_provider?: string | null;
  paid_at?: string | null;
  brand_id?: string | null;
  checkout_scope_code?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  source_portal?: string | null;
  source_store?: string | null;
  source_admin?: string | null;
  source_rep?: string | null;
  admin_code?: string | null;
  referral_code?: string | null;
  discount_code?: string | null;
};

type PartnerBrand = {
  brand_id: string;
  store_slug: string;
  store_name: string;
  scope_code: string;
  owner_email: string | null;
  status: string | null;
};

const AACTIVATED_OWNER_EMAIL = Deno.env.get('AACTIVATED_NOTIFY_EMAIL') ?? 'guy@aactivated.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDb();
    const auth = await assertAuthorized(db, req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const orderId = cleanText(body.order_id ?? body.submission_id ?? body.id, '');
    const paymentProvider = cleanText(body.payment_provider ?? body.provider, '');
    if (!orderId) return json({ error: 'order_id is required' }, 400);

    const order = await getOrder(db, orderId);
    if (!order) return json({ error: 'Order not found' }, 404);
    if (!isPaidOrder(order)) return json({ skipped: 'order is not paid yet' }, 200);

    const partner = await resolvePartner(db, order);
    if (!partner) return json({ skipped: 'order is not attributed to a partner store' }, 200);
    if (!partner.owner_email) return json({ skipped: 'partner owner email is not configured', partner: partner.brand_id }, 200);

    const recipient = partner.owner_email.trim().toLowerCase();
    const existing = await getExistingNotification(db, order.id, recipient);
    if (existing?.status === 'sent') {
      return json({ skipped: 'partner sale notification already sent', recipient }, 200);
    }

    await upsertNotification(db, {
      submission_id: order.id,
      partner_brand_id: partner.brand_id,
      partner_store_slug: partner.store_slug,
      partner_scope_code: partner.scope_code,
      recipient_email: recipient,
      status: 'pending',
      payment_provider: paymentProvider || order.payment_provider || null,
      payload: buildNotificationPayload(order, partner),
    });

    const message = buildPartnerSaleEmail(order, partner);
    const apiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('NOTIFY_FROM') ?? 'PepScriptRX <service@pepscriptrx.com>';
    const cc = parseEmailList(Deno.env.get('PARTNER_SALE_NOTIFY_CC') ?? '');
    if (!apiKey) throw new Error('EMAIL_PROVIDER_API_KEY or RESEND_API_KEY is not configured');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        ...(cc.length > 0 ? { cc } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      await markNotification(db, order.id, recipient, 'failed', null, JSON.stringify(data));
      return json({ error: data, recipient }, 500);
    }

    await markNotification(db, order.id, recipient, 'sent', cleanText(data.id, ''), null);
    await audit(db, order.id, 'partner_sale_notification_sent', {
      partner_brand_id: partner.brand_id,
      partner_store_slug: partner.store_slug,
      recipient,
      email_provider_id: data.id ?? null,
    });

    return json({ ok: true, recipient, partner: partner.brand_id, email_provider_id: data.id ?? null }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function getDb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function assertAuthorized(db: DbClient, req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`) return { ok: true as const };
  if (!SUPABASE_ANON_KEY) return { ok: false as const, status: 503, error: 'Supabase anon key is not configured.' };

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return { ok: false as const, status: 401, error: 'Authenticated admin session required.' };

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();
  if (profileError || !profile) return { ok: false as const, status: 403, error: 'Admin profile not found.' };

  const role = String((profile as { role?: string | null }).role ?? '').toLowerCase();
  const allowedRoles = ['admin', 'owner', 'platform_admin', 'master_admin', 'super_admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited'];
  if (!allowedRoles.includes(role)) return { ok: false as const, status: 403, error: 'Admin role required.' };
  return { ok: true as const };
}

async function getOrder(db: DbClient, orderId: string): Promise<OrderRecord | null> {
  const { data, error } = await db
    .from('patient_submissions')
    .select(`
      id,
      full_name,
      email,
      phone,
      order_number,
      order_items,
      medication,
      quoted_price,
      discount_amount,
      shipping_cost,
      order_total,
      status,
      payment_status,
      payment_provider,
      paid_at,
      brand_id,
      checkout_scope_code,
      store_slug,
      store_name,
      source_portal,
      source_store,
      source_admin,
      source_rep,
      admin_code,
      referral_code,
      discount_code
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as OrderRecord | null;
}

async function resolvePartner(db: DbClient, order: OrderRecord): Promise<PartnerBrand | null> {
  const tokens = uniqueTokens([
    order.brand_id,
    order.store_slug,
    order.source_store,
    order.source_portal,
    order.checkout_scope_code,
    order.admin_code,
    order.source_admin,
    order.source_rep,
    order.referral_code,
  ]);

  if (tokens.length === 0 || tokens.every((token) => token === 'MAIN' || token === 'PEPSCRIPTRX')) return null;

  const { data, error } = await db
    .from('partner_brands')
    .select('brand_id, store_slug, store_name, scope_code, owner_email, status')
    .eq('status', 'active');

  if (error) throw new Error(`Partner lookup failed: ${error.message}`);

  const partners = (data as PartnerBrand[] | null) ?? [];
  const directPartner = partners.find((partner) => {
    const partnerTokens = uniqueTokens([partner.brand_id, partner.store_slug, partner.store_name, partner.scope_code]);
    return partnerTokens.some((token) => tokens.includes(token));
  });
  if (directPartner) return withAactivatedOwnerFallback(directPartner);

  const { data: rep } = await db
    .from('reps')
    .select('rep_slug, brand_id, parent_brand_id, custom_store_slug, assigned_store_slug, brand_name')
    .in('rep_slug', tokens)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (rep) {
    const repPartnerTokens = uniqueTokens([
      (rep as Record<string, unknown>).brand_id,
      (rep as Record<string, unknown>).parent_brand_id,
      (rep as Record<string, unknown>).custom_store_slug,
      (rep as Record<string, unknown>).assigned_store_slug,
      (rep as Record<string, unknown>).brand_name,
    ]);
    const repPartner = partners.find((partner) => {
      const partnerTokens = uniqueTokens([partner.brand_id, partner.store_slug, partner.store_name, partner.scope_code]);
      return partnerTokens.some((token) => repPartnerTokens.includes(token));
    }) ?? null;
    if (repPartner) return withAactivatedOwnerFallback(repPartner);
  }

  if (isAactivatedTokenSet(tokens)) {
    return {
      brand_id: 'aactivated',
      store_slug: 'aactivated',
      store_name: 'AACTIVATED RX',
      scope_code: 'AACTIVATEDRX',
      owner_email: AACTIVATED_OWNER_EMAIL,
      status: 'active',
    };
  }

  return null;
}

function withAactivatedOwnerFallback(partner: PartnerBrand): PartnerBrand {
  const partnerTokens = uniqueTokens([partner.brand_id, partner.store_slug, partner.store_name, partner.scope_code]);
  if (!isAactivatedTokenSet(partnerTokens)) return partner;
  return {
    ...partner,
    brand_id: partner.brand_id || 'aactivated',
    store_slug: partner.store_slug || 'aactivated',
    store_name: partner.store_name || 'AACTIVATED RX',
    scope_code: partner.scope_code || 'AACTIVATEDRX',
    owner_email: partner.owner_email || AACTIVATED_OWNER_EMAIL,
  };
}

function isAactivatedTokenSet(tokens: string[]) {
  const known = new Set(['AACTIVATED', 'AACTIVATEDRX', 'AACTIVATEDRXPURE', 'VITALITYINS', 'GUY', 'GUY60']);
  return tokens.some((token) => known.has(token) || token.includes('AACTIVATED'));
}

async function getExistingNotification(db: DbClient, submissionId: string, recipientEmail: string) {
  const { data, error } = await db
    .from('partner_sale_notifications')
    .select('id, status')
    .eq('submission_id', submissionId)
    .eq('recipient_email', recipientEmail)
    .maybeSingle();
  if (error) throw new Error(`Notification lookup failed: ${error.message}`);
  return data as { id: string; status: string } | null;
}

async function upsertNotification(db: DbClient, row: Record<string, unknown>) {
  const { error } = await db
    .from('partner_sale_notifications')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'submission_id,recipient_email' });
  if (error) throw new Error(`Notification upsert failed: ${error.message}`);
}

async function markNotification(
  db: DbClient,
  submissionId: string,
  recipientEmail: string,
  status: 'sent' | 'failed',
  emailProviderId: string | null,
  errorMessage: string | null,
) {
  const now = new Date().toISOString();
  const { error } = await db
    .from('partner_sale_notifications')
    .update({
      status,
      email_provider_id: emailProviderId,
      error_message: errorMessage,
      sent_at: status === 'sent' ? now : null,
      updated_at: now,
    })
    .eq('submission_id', submissionId)
    .eq('recipient_email', recipientEmail);
  if (error) throw new Error(`Notification status update failed: ${error.message}`);
}

async function audit(db: DbClient, orderId: string, eventType: string, eventPayload: Record<string, unknown>) {
  await db.from('payment_audit_log').insert({
    order_id: orderId,
    actor_type: 'system',
    event_type: eventType,
    event_payload: eventPayload,
  });
}

function buildPartnerSaleEmail(order: OrderRecord, partner: PartnerBrand) {
  const appUrl = trimTrailingSlash(Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://pepscriptrx.vercel.app');
  const orderNumber = order.order_number || `PSRX-${order.id.slice(0, 8).toUpperCase()}`;
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const total = money(order.order_total ?? ((Number(order.quoted_price ?? 0) - Number(order.discount_amount ?? 0)) + Number(order.shipping_cost ?? 0)));
  const itemLines = normalizeItems(order).map((item) => `- ${item}`).join('\n') || `- ${cleanText(order.medication, 'Order item')}`;
  const adminUrl = `${appUrl}/admin/submissions/${encodeURIComponent(order.id)}`;
  const text = [
    `New sale confirmed for ${partner.store_name}`,
    '',
    `Order: ${orderNumber}`,
    `Customer: ${cleanText(order.full_name, 'Customer')}`,
    `Email: ${cleanText(order.email, '-')}`,
    `Phone: ${cleanText(order.phone, '-')}`,
    `Total paid: ${total}`,
    `Payment: ${cleanText(order.payment_provider, 'confirmed')}`,
    `Scope: ${cleanText(order.checkout_scope_code, partner.scope_code)}`,
    `Paid at: ${paidAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`,
    '',
    'Items:',
    itemLines,
    '',
    `View order: ${adminUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fa;color:#101828;margin:0;padding:0}
.wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.hdr{background:#111827;color:#fff;padding:28px 32px}
.hdr h1{font-size:22px;margin:0 0 6px}
.hdr p{margin:0;color:rgba(255,255,255,.7)}
.body{padding:28px 32px}
.badge{display:inline-block;background:#dcfce7;color:#166534;font-weight:800;font-size:12px;border-radius:999px;padding:5px 10px;margin-bottom:18px;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin:10px 0 22px}
td{border-bottom:1px solid #eef2f7;padding:10px 0;font-size:14px;vertical-align:top}
td:first-child{color:#667085;width:34%}
td:last-child{font-weight:700}
.items{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:14px 0 22px}
.cta{display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:800;border-radius:8px;padding:13px 18px}
.foot{padding:16px 32px;color:#98a2b3;font-size:12px;border-top:1px solid #eef2f7}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>New sale confirmed</h1><p>${escapeHtml(partner.store_name)} powered by PepScriptRX</p></div>
<div class="body">
<span class="badge">Paid</span>
<table>
<tr><td>Order</td><td>${escapeHtml(orderNumber)}</td></tr>
<tr><td>Customer</td><td>${escapeHtml(order.full_name)}</td></tr>
<tr><td>Email</td><td>${escapeHtml(order.email)}</td></tr>
<tr><td>Phone</td><td>${escapeHtml(order.phone)}</td></tr>
<tr><td>Total paid</td><td>${escapeHtml(total)}</td></tr>
<tr><td>Payment</td><td>${escapeHtml(order.payment_provider, 'confirmed')}</td></tr>
<tr><td>Scope</td><td>${escapeHtml(order.checkout_scope_code, partner.scope_code)}</td></tr>
<tr><td>Paid at</td><td>${escapeHtml(paidAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))} PT</td></tr>
</table>
<div class="items"><strong>Items</strong><br>${normalizeItems(order).map(escapeHtml).join('<br>') || escapeHtml(order.medication)}</div>
<a class="cta" href="${adminUrl}">View Order</a>
</div>
<div class="foot">PepScriptRX partner sale notification</div>
</div></body></html>`;

  return {
    subject: `New ${partner.store_name} sale: ${orderNumber} - ${total}`,
    text,
    html,
  };
}

function buildNotificationPayload(order: OrderRecord, partner: PartnerBrand) {
  return {
    order_number: order.order_number,
    order_total: order.order_total,
    payment_provider: order.payment_provider,
    checkout_scope_code: order.checkout_scope_code,
    store_slug: order.store_slug,
    store_name: order.store_name,
    partner_brand_id: partner.brand_id,
  };
}

function isPaidOrder(order: OrderRecord) {
  return String(order.status ?? '').toLowerCase() === 'paid'
    || String(order.status ?? '').toLowerCase() === 'fulfilled'
    || String(order.payment_status ?? '').toLowerCase() === 'paid';
}

function normalizeItems(order: OrderRecord): string[] {
  const rawItems = Array.isArray(order.order_items) ? order.order_items : [];
  return rawItems.map((item) => {
    const name = cleanText(item.name ?? item.product_name ?? item.display_name_at_purchase ?? order.medication, 'Order item');
    const strength = cleanText(item.strength, '');
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const price = Number(item.price ?? 0);
    return `${name}${strength ? ` ${strength}` : ''} x${Number.isFinite(qty) && qty > 0 ? qty : 1}${price > 0 ? ` - ${money(price)}` : ''}`;
  });
}

function uniqueTokens(values: Array<unknown>): string[] {
  return [...new Set(values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .flatMap((value) => [
      value,
      value.replace(/[^a-zA-Z0-9]/g, ''),
    ])
    .map((value) => value.toUpperCase()))];
}

function parseEmailList(value: string): string[] {
  return value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
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
