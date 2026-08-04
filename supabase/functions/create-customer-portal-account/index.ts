import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = (
  Deno.env.get('APP_URL')
  ?? Deno.env.get('PUBLIC_SITE_URL')
  ?? Deno.env.get('SITE_URL')
  ?? 'https://pepscriptrx.vercel.app'
).replace(/\/+$/, '');
const AACTIVATED_CUSTOMER_NOTIFY_EMAILS = parseEmailList(
  Deno.env.get('AACTIVATED_CUSTOMER_NOTIFY_EMAILS')
    ?? Deno.env.get('AACTIVATED_NOTIFY_EMAIL')
    ?? 'guy@aactivated.com',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type DbClient = ReturnType<typeof createClient>;

type OrderRow = {
  id: string;
  public_payment_token: string;
  order_number: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  patient_profile_id: string | null;
  order_total: number | null;
  payment_status: string | null;
  status: string | null;
  source_portal: string | null;
  store_slug: string | null;
  store_name: string | null;
  checkout_scope_code: string | null;
  source_admin: string | null;
  source_rep: string | null;
  admin_code: string | null;
  referral_code: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: 'Customer portal account service is not configured.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const paymentToken = cleanString(body.payment_token);
    const email = cleanString(body.email).toLowerCase();
    const password = String(body.password ?? '');
    const fullName = cleanString(body.full_name);
    const phone = cleanString(body.phone);

    if (!paymentToken) return json({ error: 'Payment token is required.' }, 400);
    if (!validEmail(email)) return json({ error: 'Enter the same email used on the order.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const order = await getOrder(db, paymentToken);
    if (!order) return json({ error: 'Order not found.' }, 404);

    const orderEmail = cleanString(order.email).toLowerCase();
    if (!orderEmail || orderEmail !== email) {
      return json({ error: 'That email does not match this order.' }, 403);
    }

    const existingProfile = await findProfileByEmail(db, email);
    if (existingProfile && !isCustomerRole(existingProfile.role)) {
      return json({ error: 'This email is already connected to a staff or partner account. Use a customer email for portal access.' }, 409);
    }

    const existingAuthUser = await findAuthUserByEmail(db, email);
    const desiredName = fullName || cleanString(order.full_name) || email;
    const desiredPhone = phone || cleanString(order.phone);
    let authUserId = existingAuthUser?.id ?? existingProfile?.auth_user_id ?? null;
    let created = false;

    if (authUserId) {
      const { error } = await db.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: desiredName,
          phone: desiredPhone,
          role: 'patient',
          source: 'order_backed_customer_portal',
          payment_token_tail: paymentToken.slice(-8),
        },
      });
      if (error) throw new Error(`Could not update customer login: ${error.message}`);
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: desiredName,
          phone: desiredPhone,
          role: 'patient',
          source: 'order_backed_customer_portal',
          payment_token_tail: paymentToken.slice(-8),
        },
      });
      if (error || !data.user) throw new Error(`Could not create customer login: ${error?.message ?? 'No user returned'}`);
      authUserId = data.user.id;
      created = true;
    }

    const authBackedProfile = await findProfileByAuthUserId(db, authUserId);
    const profileId = existingProfile?.auth_user_id === authUserId
      ? existingProfile.id
      : authBackedProfile?.id ?? authUserId;
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .upsert({
        id: profileId,
        auth_user_id: authUserId,
        email,
        full_name: desiredName,
        phone: desiredPhone || null,
        role: 'patient',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id, email, full_name, phone, role')
      .single();
    if (profileError || !profile) throw new Error(`Could not save customer profile: ${profileError?.message ?? 'No profile returned'}`);

    const { error: attachError } = await db
      .from('patient_submissions')
      .update({ patient_profile_id: profileId })
      .eq('id', order.id)
      .ilike('email', orderEmail)
      .or(`patient_profile_id.is.null,patient_profile_id.eq.${profileId}`);
    if (attachError) throw new Error(`Could not attach order to customer account: ${attachError.message}`);

    await db.from('payment_audit_log').insert({
      order_id: order.id,
      actor_type: 'customer',
      event_type: created ? 'customer_portal_account_created' : 'customer_portal_account_recovered',
      event_payload: {
        source_portal: order.source_portal,
        store_slug: order.store_slug,
        checkout_scope_code: order.checkout_scope_code,
      },
    });

    await notifyAactivatedCustomerAccount(db, order, profile as ProfileRow, created);

    const loginUrl = await createLoginUrl(db, email);

    return json({
      ok: true,
      created,
      profile_id: profileId,
      email,
      login_url: loginUrl,
      message: created ? 'Customer portal account created.' : 'Customer portal account updated.',
    }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function getOrder(db: DbClient, paymentToken: string): Promise<OrderRow | null> {
  const { data, error } = await db
    .from('patient_submissions')
    .select('id, public_payment_token, order_number, email, full_name, phone, patient_profile_id, order_total, payment_status, status, source_portal, store_slug, store_name, checkout_scope_code, source_admin, source_rep, admin_code, referral_code')
    .eq('public_payment_token', paymentToken)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as OrderRow | null;
}

async function notifyAactivatedCustomerAccount(
  db: DbClient,
  order: OrderRow,
  profile: ProfileRow,
  created: boolean,
) {
  if (!isAactivatedOrder(order)) return;
  if (AACTIVATED_CUSTOMER_NOTIFY_EMAILS.length === 0) return;

  const apiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('AACTIVATED customer account notification skipped: email provider key missing');
    return;
  }

  try {
    const message = buildAactivatedCustomerAccountEmail(order, profile, created);
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('NOTIFY_FROM') ?? 'PepScriptRX <service@pepscriptrx.com>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: AACTIVATED_CUSTOMER_NOTIFY_EMAILS,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const data = await res.json().catch(() => ({}));

    await db.from('payment_audit_log').insert({
      order_id: order.id,
      actor_type: 'system',
      event_type: res.ok ? 'aactivated_customer_account_notification_sent' : 'aactivated_customer_account_notification_failed',
      event_payload: {
        recipients: AACTIVATED_CUSTOMER_NOTIFY_EMAILS,
        email_provider_id: data.id ?? null,
        error: res.ok ? null : data,
      },
    });

    if (!res.ok) console.error('AACTIVATED customer account notification failed', data);
  } catch (error) {
    console.error('AACTIVATED customer account notification error', error);
  }
}

function buildAactivatedCustomerAccountEmail(order: OrderRow, profile: ProfileRow, created: boolean) {
  const orderNumber = order.order_number || `PSRX-${order.id.slice(0, 8).toUpperCase()}`;
  const action = created ? 'created' : 'updated';
  const customerName = cleanString(profile.full_name || order.full_name || 'Customer');
  const customerEmail = cleanString(profile.email || order.email);
  const adminUrl = `${APP_URL}/admin/submissions/${encodeURIComponent(order.id)}`;
  const customerLoginUrl = `${APP_URL}/login`;
  const total = typeof order.order_total === 'number' ? `$${order.order_total.toFixed(2)}` : '-';
  const text = [
    `AACTIVATED customer portal account ${action}`,
    '',
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
    `Phone: ${cleanString(profile.phone || order.phone) || '-'}`,
    `Order: ${orderNumber}`,
    `Order total: ${total}`,
    `Checkout scope: ${cleanString(order.checkout_scope_code) || 'AACTIVATEDRX'}`,
    `Source rep/admin: ${cleanString(order.source_rep || order.source_admin || order.admin_code || order.referral_code) || '-'}`,
    `Payment status: ${cleanString(order.payment_status || order.status) || '-'}`,
    '',
    `Review order: ${adminUrl}`,
    `Customer login: ${customerLoginUrl}`,
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
.badge{display:inline-block;background:#dcfce7;color:#166534;font-weight:800;font-size:12px;border-radius:999px;padding:5px 10px;margin-bottom:18px;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin:10px 0 22px}
td{border-bottom:1px solid #eef2f7;padding:10px 0;font-size:14px;vertical-align:top}
td:first-child{color:#667085;width:34%}
td:last-child{font-weight:700}
.cta{display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:800;border-radius:8px;padding:13px 18px;margin-right:10px}
.foot{padding:16px 32px;color:#98a2b3;font-size:12px;border-top:1px solid #eef2f7}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>Customer portal account ${escapeHtml(action)}</h1><p>AACTIVATED RX customer access</p></div>
<div class="body">
<span class="badge">Portal active</span>
<table>
<tr><td>Customer</td><td>${escapeHtml(customerName)}</td></tr>
<tr><td>Email</td><td>${escapeHtml(customerEmail)}</td></tr>
<tr><td>Phone</td><td>${escapeHtml(profile.phone || order.phone)}</td></tr>
<tr><td>Order</td><td>${escapeHtml(orderNumber)}</td></tr>
<tr><td>Order total</td><td>${escapeHtml(total)}</td></tr>
<tr><td>Scope</td><td>${escapeHtml(order.checkout_scope_code, 'AACTIVATEDRX')}</td></tr>
<tr><td>Rep/admin</td><td>${escapeHtml(order.source_rep || order.source_admin || order.admin_code || order.referral_code)}</td></tr>
<tr><td>Payment status</td><td>${escapeHtml(order.payment_status || order.status)}</td></tr>
</table>
<a class="cta" href="${adminUrl}">Review Order</a>
<a class="cta" href="${customerLoginUrl}">Customer Login</a>
</div>
<div class="foot">PepScriptRX AACTIVATED customer account notification</div>
</div></body></html>`;

  return {
    subject: `AACTIVATED customer account ${action}: ${customerName} - ${orderNumber}`,
    text,
    html,
  };
}

async function findProfileByEmail(db: DbClient, email: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, auth_user_id, email, full_name, phone, role')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  return data as ProfileRow | null;
}

async function findProfileByAuthUserId(db: DbClient, authUserId: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, auth_user_id, email, full_name, phone, role')
    .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Auth profile lookup failed: ${error.message}`);
  return data as ProfileRow | null;
}

async function findAuthUserByEmail(db: DbClient, email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return { id: found.id };
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function createLoginUrl(db: DbClient, email: string): Promise<string | null> {
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${APP_URL}/auth/callback`,
    },
  });
  if (error) {
    console.error('Customer portal magic link generation failed', error);
    return null;
  }
  const properties = data.properties as { action_link?: string } | undefined;
  return properties?.action_link ?? null;
}

function isCustomerRole(role: string | null | undefined) {
  return ['patient', 'customer', 'client'].includes(cleanString(role).toLowerCase());
}

function isAactivatedOrder(order: OrderRow) {
  const values = [
    order.checkout_scope_code,
    order.store_slug,
    order.store_name,
    order.source_portal,
    order.source_admin,
    order.source_rep,
    order.admin_code,
    order.referral_code,
  ].map((value) => cleanString(value).toUpperCase());

  return values.some((value) => (
    value === 'AACTIVATED'
    || value === 'AACTIVATEDRX'
    || value === 'AACTIVATEDRXPURE'
    || value === 'VITALITYINS'
    || value === 'GUY'
    || value === 'GUY60'
    || value.includes('AACTIVATED')
  ));
}

function validEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cleanString(value: unknown) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function parseEmailList(value: string) {
  return value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function escapeHtml(value: unknown, fallback = '-') {
  const text = cleanString(value) || fallback;
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
