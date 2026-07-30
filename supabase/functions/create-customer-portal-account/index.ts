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
  email: string | null;
  full_name: string | null;
  phone: string | null;
  patient_profile_id: string | null;
  source_portal: string | null;
  store_slug: string | null;
  store_name: string | null;
  checkout_scope_code: string | null;
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
    .select('id, public_payment_token, email, full_name, phone, patient_profile_id, source_portal, store_slug, store_name, checkout_scope_code')
    .eq('public_payment_token', paymentToken)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as OrderRow | null;
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

function validEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cleanString(value: unknown) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
