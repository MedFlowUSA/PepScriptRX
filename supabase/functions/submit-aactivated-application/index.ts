import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return response({}, 200);
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const origin = req.headers.get('origin') ?? '';
  if (!allowedOrigin(origin)) return response({ error: 'Application origin is not allowed' }, 403);

  const db = createClient(SUPABASE_URL, SERVICE);
  const applicantAuth = createClient(SUPABASE_URL, ANON);
  let applicantUserId = '';
  let createdNewUser = false;
  let accountEmailDelayed = false;
  let applicationId = '';
  let stage = 'request';

  try {
    const body = await req.json();
    validate(body);
    const email = clean(body.email).toLowerCase();
    stage = 'existing-application';
    const { data: existing } = await db.from('rep_store_intake_submissions')
      .select('id,approval_status').eq('source_portal_id', 'aactivated').ilike('email', email).maybeSingle();
    if (existing) return response({ ok: false, error: 'An AACTIVATEDRX application already exists for this email. Sign in to view its status.' });

    const accessToken = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    stage = 'account';
    const { data: authenticated } = accessToken ? await db.auth.getUser(accessToken) : { data: { user: null } };
    if (authenticated.user) {
      if ((authenticated.user.email ?? '').toLowerCase() !== email) {
        return response({ ok: false, error: 'The application email must match your signed-in account email.' });
      }
      applicantUserId = authenticated.user.id;
    } else {
      const { data: existingProfile } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
      if (existingProfile) return response({ ok: false, error: 'An account already exists for this email. Sign in first, then submit the application again.' });
      const redirectTo = `${SITE}/auth/callback`;
      const { data: userResult, error: userError } = await applicantAuth.auth.signUp({
        email,
        password: String(body.password),
        options: {
          emailRedirectTo:redirectTo,
          data: { full_name: `${clean(body.first_name)} ${clean(body.last_name)}`, role:'rep_applicant', brand_id:'aactivated' },
        },
      });
      if (userError || !userResult.user) {
        if (isEmailRateLimitError(userError?.message ?? '')) {
          accountEmailDelayed = true;
        } else {
          throw userError ?? new Error('Account creation failed');
        }
      } else {
        applicantUserId = userResult.user.id;
        createdNewUser = true;
      }
    }

    const now = new Date().toISOString();
    const fullName = `${clean(body.first_name)} ${clean(body.last_name)}`;
    stage = 'profile';
    if (createdNewUser) {
      const { error: profileError } = await db.from('profiles').upsert({
        id: applicantUserId, auth_user_id: applicantUserId, email, full_name: fullName,
        role: 'rep_applicant', brand_id: 'aactivated', store_slug: 'aactivated',
      }, { onConflict: 'id' });
      if (profileError) throw profileError;
    }

    stage = 'application';
    const { data: application, error: applicationError } = await db.from('rep_store_intake_submissions').insert({
      status: 'new', approval_status: 'pending', applicant_user_id: applicantUserId || null,
      full_name: fullName, first_name: clean(body.first_name), last_name: clean(body.last_name), email,
      phone: clean(body.phone), city: clean(body.city), state: clean(body.state),
      social_profile: optional(body.social_profile), referral_rep: optional(body.referral_rep),
      parent_rep_or_admin_name: optional(body.referral_rep) ?? 'AACTIVATEDRX',
      discovery_source: clean(body.discovery_source), motivation: clean(body.motivation),
      application_terms_accepted_at: now, privacy_accepted_at: now, selected_products: [], custom_products: [],
      store_type: 'Rep under another admin / parent account', store_brand_name: `${fullName} — AACTIVATEDRX Rep Application`,
      source_portal_id: 'aactivated', source_portal: 'AACTIVATEDRX', source_route: '/aactivated/apply',
      parent_store_slug: 'aactivated', parent_store_name: 'AACTIVATEDRX', partner_admin_email: 'guy@aactivated.com',
      approval_owner_email: 'guy@aactivated.com', review_queue: 'aactivated', review_admin_code: 'GUY60',
      review_admin_name: 'AACTIVATEDRX Administration',
      internal_notes: accountEmailDelayed
        ? 'Application accepted while confirmation email delivery was rate limited. Create or invite the applicant account during approval.'
        : 'Authenticated AACTIVATEDRX applicant account. Representative capabilities remain disabled pending approval.',
    }).select('id').single();
    if (applicationError) throw applicationError;
    applicationId = application.id;

    stage = 'onboarding';
    const { data: onboarding, error: onboardingError } = await db.from('aactivated_onboarding_profiles').insert({
      application_id: applicationId, user_id: applicantUserId || null, state: 'application_pending',
      account_status: 'pending', commissions_enabled: false, referral_enabled: false,
    }).select('id').single();
    if (onboardingError) throw onboardingError;
    stage = 'audit';
    await db.from('aactivated_onboarding_audit').insert({
      onboarding_id: onboarding.id, actor_id: applicantUserId || null, action: 'application_submitted',
      metadata: {
        authenticated_applicant: Boolean(applicantUserId),
        existing_account: Boolean(applicantUserId) && !createdNewUser,
        confirmation_email_delayed: accountEmailDelayed,
      },
    });
    return response({ ok: true, confirmation_email_delayed: accountEmailDelayed }, 201);
  } catch (error) {
    if (applicationId) await db.from('rep_store_intake_submissions').delete().eq('id', applicationId);
    if (createdNewUser && applicantUserId) await db.auth.admin.deleteUser(applicantUserId);
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    console.error('AACTIVATED application failed', errorMessage);
    return response({
      ok: false,
      error: stage === 'account'
        ? accountSetupError(errorMessage)
        : `We could not submit your application. Please contact support with reference: ${stage}.`,
    }, 200);
  }
});

function validate(body: Record<string, unknown>) {
  for (const key of ['first_name', 'last_name', 'email', 'phone', 'city', 'state', 'discovery_source', 'motivation', 'password']) {
    if (!clean(body[key])) throw new Error('Required application information is missing');
  }
  if (!body.consent) throw new Error('Consent is required');
  if (!/^\S+@\S+\.\S+$/.test(clean(body.email))) throw new Error('Email is invalid');
  if (!strongPassword(String(body.password))) {
    throw new Error('Password must be at least 10 characters and include uppercase, lowercase, number, and symbol characters');
  }
}

function strongPassword(password: string) {
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password)
    && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function accountSetupError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Account email limits were reached. Please wait a few minutes and submit again.';
  }
  if (normalized.includes('already') || normalized.includes('registered') || normalized.includes('exists')) {
    return 'An account already exists for this email. Sign in first, then submit the application again.';
  }
  if (normalized.includes('password')) {
    return 'Choose a password with at least 10 characters including uppercase, lowercase, a number, and a symbol.';
  }
  if (normalized.includes('signup') && normalized.includes('disabled')) {
    return 'New account registration is temporarily disabled. Please contact AACTIVATEDRX support.';
  }
  return `Account setup failed: ${message.slice(0, 180)}`;
}

function isEmailRateLimitError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('rate limit') || normalized.includes('email limits')
    || normalized.includes('email rate') || normalized.includes('too many');
}

function allowedOrigin(origin: string) {
  if (!origin) return false;
  try {
    // Some proxies combine repeated Origin headers. Evaluate the browser's
    // first origin and normalize hostname casing before applying the allowlist.
    const url = new URL(origin.split(',', 1)[0].trim());
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'pepscriptrx.vercel.app'
      || hostname.endsWith('-manuel-rodriguezs-projects-f5946c44.vercel.app');
  } catch { return false; }
}

const clean = (value: unknown) => String(value ?? '').trim();
const optional = (value: unknown) => clean(value) || null;
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
