import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')  ?? '';
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')       ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL           = Deno.env.get('SITE_URL')           ?? 'https://pepscriptrx.com';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Collect profiles that have opted out so we can skip them
  const { data: optedOutProfiles } = await db
    .from('profiles')
    .select('id')
    .eq('sms_opted_out', true);
  const optedOutIds = new Set<string>((optedOutProfiles ?? []).map((p: { id: string }) => p.id));

  // Fetch all active patients with phone numbers — one record per unique phone
  const { data: submissions, error } = await db
    .from('patient_submissions')
    .select('id, full_name, phone, medication, status, patient_profile_id')
    .in('status', ['paid', 'fulfilled'])
    .not('phone', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }

  if (!submissions || submissions.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No active patients with phone numbers' }), { headers: corsHeaders });
  }

  // One message per unique phone — skip opted-out patients, use most recent submission's medication
  const seen = new Map<string, typeof submissions[0]>();
  for (const s of submissions) {
    if (s.phone && !seen.has(s.phone) && !optedOutIds.has(s.patient_profile_id ?? '')) {
      seen.set(s.phone, s);
    }
  }

  let sent = 0;
  const errors: string[] = [];

  for (const [phone, sub] of seen) {
    const firstName = sub.full_name?.split(' ')[0] ?? 'there';
    const body = [
      `Hi ${firstName}! This is your weekly PepScriptRX reminder to take your ${sub.medication}.`,
      `Log your weight and track progress: ${SITE_URL}/patient`,
      `Reply STOP to opt out.`,
    ].join(' ');

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
        },
      );

      if (res.ok) {
        sent++;
      } else {
        const errData = await res.json().catch(() => ({}));
        errors.push(`${phone}: ${res.status} — ${(errData as { message?: string }).message ?? 'unknown'}`);
      }
    } catch (err) {
      errors.push(`${phone}: ${String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, total: seen.size, errors }),
    { headers: corsHeaders },
  );
});
