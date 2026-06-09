import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('APP_BASE_URL') ?? 'https://pepscriptrx.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

const STATUS_MESSAGES: Record<string, (name: string, price?: number, medication?: string) => string> = {
  injection_reminder: (name, _price, medication) =>
    `Hi ${name}! This is your PepScriptRX reminder to take your ${medication ?? 'medication'}. Log your progress at ${SITE_URL}/patient. Reply STOP to opt out.`,
  under_review: (name) =>
    `Hi ${name}, your PepScriptRX submission is being reviewed. We'll text you with next steps within 1-2 business days.`,
  physician_review: (name) =>
    `Hi ${name}, your PepScriptRX order is undergoing physician review, typically 1-2 more days. We'll be in touch soon.`,
  fulfillment_review: (name) =>
    `Hi ${name}, your PepScriptRX order is with our fulfillment partner. Almost there. We'll send your payment link shortly.`,
  eligible: (name, price) =>
    `Great news ${name}. You're eligible for savings through PepScriptRX${price ? ` at $${price.toFixed(2)}` : ''}. Your payment link is on its way. Check your email.`,
  payment_sent: (name, price) =>
    `Hi ${name}, your PepScriptRX payment link has been sent to your email${price ? ` for $${price.toFixed(2)}` : ''}. Complete checkout to start your refill.`,
  paid: (name) =>
    `Payment received, ${name}. Your PepScriptRX order is being processed. We'll update you when it ships.`,
  fulfilled: (name) =>
    `Your PepScriptRX order is on its way, ${name}. Thank you for choosing us. Reply STOP to opt out.`,
  missing_info: (name) =>
    `Hi ${name}, we need a bit more information to complete your PepScriptRX order. Please check your email or call us.`,
  not_eligible: (name) =>
    `Hi ${name}, we were not able to process your PepScriptRX request at this time. Reply for details or call us.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authError = await requireRole(req, db, ['admin', 'rx_plus_admin']);
    if (authError) return authError;

    const { phone, name, status, quoted_price, medication } = await req.json() as {
      phone: string;
      name: string;
      status: string;
      quoted_price?: number;
      medication?: string;
    };

    if (!phone || !name || !status) {
      return json({ error: 'phone, name, and status are required' }, 400);
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      return json({ error: 'Twilio credentials not configured' }, 500);
    }

    const msgFn = STATUS_MESSAGES[status];
    if (!msgFn) {
      return json({ error: `No SMS template for status: ${status}` }, 400);
    }

    const body = msgFn(name.split(' ')[0], quoted_price, medication);
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: phone, Body: body }),
      },
    );

    const data = await twilioRes.json();
    return json(
      twilioRes.ok
        ? { ok: true, sid: data.sid, status: data.status }
        : { ok: false, error: data.message ?? 'Twilio request failed' },
      twilioRes.ok ? 200 : 500,
    );
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

async function requireRole(
  req: Request,
  db: ReturnType<typeof createClient>,
  allowedRoles: string[],
) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing authorization token' }, 401);

  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData.user?.id;
  if (authError || !userId) return json({ error: 'Invalid authorization token' }, 401);

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();

  if (profileError || !profile || !allowedRoles.includes(String(profile.role))) {
    return json({ error: 'Forbidden' }, 403);
  }

  return null;
}
