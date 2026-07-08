import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_APP_URL') ?? 'https://pepscriptrx.vercel.app';
const AURORA_STORE_SCOPE = 'AURORA';
const AURORA_ADMIN_EMAIL = 'mnsgroup107@gmail.com';
const AURORA_PARENT_STORE_SLUG = 'aurora';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  admin_scope?: string | null;
  store_slug?: string | null;
};

type RepRow = {
  id: string;
  rep_slug: string;
  rep_name: string | null;
  payout_email: string | null;
  profile_id: string | null;
  managed_by_profile_id: string | null;
  parent_rep_id: string | null;
  custom_store_slug: string | null;
  brand_name: string | null;
  rep_channel: string | null;
  rep_tier: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
      return json({ error: 'Supabase function is not configured.' }, 503);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const authUser = userData.user;
    if (userError || !authUser) return json({ error: 'Authenticated admin session required.' }, 401);

    const { data: actor, error: actorError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, admin_scope, store_slug')
      .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
      .maybeSingle();
    if (actorError || !actor) return json({ error: 'Admin profile not found.' }, 403);

    const actorProfile = actor as ProfileRow;
    const actorEmail = String(actorProfile.email ?? '').toLowerCase();
    const actorRole = String(actorProfile.role ?? '').toLowerCase();
    const actorScope = String(actorProfile.admin_scope ?? '').toUpperCase();
    const actorStore = String(actorProfile.store_slug ?? '').toLowerCase();
    const isPlatformAdmin = ['admin', 'owner', 'platform_admin', 'super_admin'].includes(actorRole);
    const isAuroraAdmin = actorRole === 'admin'
      && (actorEmail === AURORA_ADMIN_EMAIL || actorScope === AURORA_STORE_SCOPE || actorStore === AURORA_PARENT_STORE_SLUG);
    if (!isPlatformAdmin && !isAuroraAdmin) {
      return json({ error: 'Only Aurora or platform admins can grant Aurora rep portal login.' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const repId = cleanString(payload.repId);
    const email = cleanString(payload.email).toLowerCase();
    const fullName = cleanString(payload.fullName);
    const phone = cleanString(payload.phone);
    const repSlug = cleanString(payload.repSlug).toUpperCase();
    const storeScope = cleanString(payload.storeScope).toUpperCase() || AURORA_STORE_SCOPE;
    const redirectTo = cleanString(payload.redirectTo) || `${APP_URL}/rep`;
    const temporaryPassword = cleanString(payload.temporaryPassword);

    if (!repId) return json({ error: 'repId is required.' }, 400);
    if (!email || !email.includes('@')) return json({ error: 'A valid rep email is required.' }, 400);
    if (storeScope !== AURORA_STORE_SCOPE) return json({ error: 'Only Aurora rep login grants are supported here.' }, 400);

    const { data: rep, error: repError } = await adminClient
      .from('reps')
      .select('id, rep_slug, rep_name, payout_email, profile_id, managed_by_profile_id, parent_rep_id, custom_store_slug, brand_name, rep_channel, rep_tier')
      .eq('id', repId)
      .maybeSingle();
    if (repError || !rep) return json({ error: 'Rep not found.' }, 404);

    const repRow = rep as RepRow;
    if (!isAuroraRep(repRow)) return json({ error: 'Rep is not scoped to Aurora Labs.' }, 403);
    if (isAuroraAdmin && repRow.managed_by_profile_id !== actorProfile.id && !(await isAuroraParentedRep(adminClient, repRow, actorProfile.id))) {
      return json({ error: 'Aurora admins can only grant login for Aurora reps they manage.' }, 403);
    }

    const existingProfile = await findProfileByEmail(adminClient, email);
    let repProfileId = existingProfile?.id ?? repRow.profile_id ?? null;
    let invited = false;
    let createdWithTemporaryPassword = false;
    let reusedExistingAuthUser = Boolean(repProfileId);

    if (!repProfileId) {
      const existingAuthUser = await findAuthUserByEmail(adminClient, email);
      if (existingAuthUser?.id) {
        repProfileId = existingAuthUser.id;
        reusedExistingAuthUser = true;
      }
    }

    if (!repProfileId) {
      const metadata = {
        full_name: fullName || repRow.rep_name || repSlug || email,
        role: 'rep',
        store_scope: AURORA_STORE_SCOPE,
        admin_scope: AURORA_STORE_SCOPE,
        store_slug: AURORA_PARENT_STORE_SLUG,
        rep_slug: repSlug || repRow.rep_slug,
      };

      if (temporaryPassword) {
        const created = await adminClient.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            ...metadata,
            force_password_reset: true,
          },
        });
        if (created.error) return json({ error: created.error.message }, 400);
        repProfileId = created.data.user?.id ?? null;
        createdWithTemporaryPassword = Boolean(repProfileId);
      } else {
        const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo,
        });
        if (invite.error) return json({ error: invite.error.message }, 400);
        repProfileId = invite.data.user?.id ?? null;
        invited = Boolean(repProfileId);
      }
    }

    if (!repProfileId) return json({ error: 'Could not create or locate auth user for this rep.' }, 500);

    const profilePayload = {
      id: repProfileId,
      auth_user_id: repProfileId,
      full_name: fullName || repRow.rep_name || repSlug || email,
      email,
      phone: phone || null,
      role: 'rep',
      admin_scope: AURORA_STORE_SCOPE,
      store_slug: AURORA_PARENT_STORE_SLUG,
      owner_email: AURORA_ADMIN_EMAIL,
    };
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });
    if (profileError) return json({ error: profileError.message }, 500);

    const { error: repUpdateError } = await adminClient
      .from('reps')
      .update({
        profile_id: repProfileId,
        active: true,
      })
      .eq('id', repId);
    if (repUpdateError) return json({ error: repUpdateError.message }, 500);

    await adminClient.from('partner_rep_setup_audit').insert({
      store_scope: AURORA_STORE_SCOPE,
      actor_id: actorProfile.id,
      actor_email: actorProfile.email,
      action: 'aurora_rep_portal_login_granted',
      target_table: 'reps',
      target_id: repId,
      rep_id: repId,
      old_value: { profile_id: repRow.profile_id, payout_email: repRow.payout_email },
      new_value: { profile_id: repProfileId, invited, reusedExistingAuthUser, createdWithTemporaryPassword },
      audit_notes: createdWithTemporaryPassword
        ? 'Aurora rep portal login granted with temporary password and reset flag.'
        : 'Aurora rep portal login granted.',
    });

    return json({
      ok: true,
      profileId: repProfileId,
      invited,
      createdWithTemporaryPassword,
      reusedExistingAuthUser,
      message: createdWithTemporaryPassword
        ? 'Aurora rep auth user created with temporary password and portal login linked.'
        : invited
          ? 'Aurora rep invite sent and portal login linked.'
          : 'Aurora rep portal login linked.',
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}

function isAuroraRep(rep: RepRow): boolean {
  const tokens = [
    rep.custom_store_slug,
    rep.brand_name,
    rep.rep_channel,
    rep.rep_tier,
    rep.rep_slug,
  ].map((value) => String(value ?? '').toUpperCase());

  return tokens.some((token) => (
    token === AURORA_STORE_SCOPE ||
    token === AURORA_PARENT_STORE_SLUG.toUpperCase() ||
    token.includes('AURORA')
  ));
}

async function isAuroraParentedRep(adminClient: ReturnType<typeof createClient>, rep: RepRow, actorProfileId: string): Promise<boolean> {
  if (!rep.parent_rep_id) return false;
  const { data: parent } = await adminClient
    .from('reps')
    .select('profile_id, managed_by_profile_id, rep_slug, custom_store_slug, brand_name')
    .eq('id', rep.parent_rep_id)
    .maybeSingle();

  if (!parent) return false;
  const parentRecord = parent as {
    profile_id: string | null;
    managed_by_profile_id: string | null;
    rep_slug: string | null;
    custom_store_slug: string | null;
    brand_name: string | null;
  };
  return parentRecord.profile_id === actorProfileId
    || parentRecord.managed_by_profile_id === actorProfileId
    || String(parentRecord.rep_slug ?? '').toUpperCase() === AURORA_STORE_SCOPE
    || String(parentRecord.custom_store_slug ?? '').toLowerCase() === AURORA_PARENT_STORE_SLUG
    || String(parentRecord.brand_name ?? '').toUpperCase().includes('AURORA');
}

async function findProfileByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<ProfileRow | null> {
  const { data } = await adminClient
    .from('profiles')
    .select('id, email, full_name, role')
    .ilike('email', email)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}
