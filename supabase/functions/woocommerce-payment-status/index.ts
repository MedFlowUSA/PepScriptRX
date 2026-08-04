import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { safeJson, sanitizeToken, sha256 } from '../_shared/woocommerce-bridge.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ORIGINS = (Deno.env.get('WOOCOMMERCE_ALLOWED_ORIGINS') ?? 'https://pepscriptrx.com,https://pepscriptrx.vercel.app').split(',').map((x) => x.trim());

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (!origin || !ORIGINS.includes(origin)) return safeJson({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
  if (req.method !== 'POST') return safeJson({ error: 'Method not allowed' }, 405, origin);
  const paymentToken = sanitizeToken((await req.json().catch(() => ({}))).payment_token);
  if (!paymentToken) return safeJson({ error: 'Invalid payment token' }, 400, origin);
  const db = createClient(URL, KEY);
  const hash = await sha256(paymentToken);
  const { data } = await db.from('woocommerce_payment_sessions')
    .select('status,expires_at,updated_at').eq('public_payment_token_hash', hash)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return safeJson({ status: 'not_started' }, 200, origin);
  const status = new Date(data.expires_at).getTime() <= Date.now() && ['created','awaiting_payment','redirected','payment_processing'].includes(data.status)
    ? 'expired' : data.status;
  return safeJson({ status, expires_at: data.expires_at, updated_at: data.updated_at }, 200, origin);
});
