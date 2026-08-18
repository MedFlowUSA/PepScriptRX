import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_APP_URL') ?? 'https://pepscriptrx.vercel.app';
const KLOW_STORE_SCOPE = 'KLOW';
const KLOW_PARENT_STORE_SLUG = 'klow';
const ROCKPHORM_STORE_SCOPE = 'ROCKPHORM';
const ROCKPHORM_ADMIN_EMAIL = 'rick@blueprintadvocate.com';
const ROCKPHORM_ADMIN_EMAIL_ALIASES = [
  ROCKPHORM_ADMIN_EMAIL,
  'rick@blueprintadvocate.io',
  'rick.diaz.2222@gmail.com',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

type ProfileRow = {
  id: string;
  auth_user_id?: string | null;
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
    const actorEmail = cleanString(actorProfile.email).toLowerCase();
    const actorRole = cleanString(actorProfile.role).toLowerCase();
    const actorScope = cleanString(actorProfile.admin_scope).toUpperCase();
    const actorStore = cleanString(actorProfile.store_slug).toLowerCase();
    const isPlatformAdmin = ['admin', 'owner', 'platform_admin', 'super_admin'].includes(actorRole);
    const isRockPhormAdmin = ['admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited'].includes(actorRole)
      && (ROCKPHORM_ADMIN_EMAIL_ALIASES.includes(actorEmail) || actorScope === ROCKPHORM_STORE_SCOPE || actorStore === 'rockphorm');
    if (!isPlatformAdmin && !isRockPhormAdmin) {
      return json({ error: 'Only Rock Phorm or platform admins can grant KLOW rep portal login.' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const repId = cleanString(payload.repId);
    const email = cleanString(payload.email).toLowerCase();
    const fullName = cleanString(payload.fullName);
    const phone = cleanString(payload.phone);
    const repSlug = cleanString(payload.repSlug).toUpperCase();
    const storeScope = cleanString(payload.storeScope).toUpperCase() || KLOW_STORE_SCOPE;
    const redirectTo = cleanString(payload.redirectTo) || `${APP_URL}/rep`;
    const temporaryPassword = cleanString(payload.temporaryPassword);

    if (!repId) return json({ error: 'repId is required.' }, 400);
    if (!email || !email.includes('@')) return json({ error: 'A valid rep email is required.' }, 400);
    if (storeScope !== KLOW_STORE_SCOPE) return json({ error: 'Only KLOW rep login grants are supported here.' }, 400);

    const { data: rep, error: repError } = await adminClient
      .from('reps')
      .select('id, rep_slug, rep_name, payout_email, profile_id, managed_by_profile_id, parent_rep_id, custom_store_slug, brand_name, rep_channel, rep_tier')
      .eq('id', repId)
      .maybeSingle();
    if (repError || !rep) return json({ error: 'Rep not found.' }, 404);

    const repRow = rep as RepRow;
    if (!isKlowRep(repRow)) return json({ error: 'Rep is not scoped to KLOW.' }, 403);
    if (isRockPhormAdmin && repRow.managed_by_profile_id !== actorProfile.id && !(await isRockPhormParentedRep(adminClient, repRow, actorProfile.id))) {
      return json({ error: 'Rock Phorm admins can only grant login for KLOW reps they manage.' }, 403);
    }

    const metadata = {
      full_name: fullName || repRow.rep_name || repSlug || email,
      role: 'rep',
      store_scope: KLOW_STORE_SCOPE,
      admin_scope: KLOW_STORE_SCOPE,
      store_slug: KLOW_PARENT_STORE_SLUG,
      rep_slug: repSlug || repRow.rep_slug,
    };

    const existingProfile = await findProfileByEmail(adminClient, email);
    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    const profileAuthUser = !existingAuthUser?.id && existingProfile?.auth_user_id
      ? await findAuthUserById(adminClient, existingProfile.auth_user_id)
      : null;
    const repAuthUser = !existingAuthUser?.id && !profileAuthUser?.id && repRow.profile_id
      ? await findAuthUserById(adminClient, repRow.profile_id)
      : null;
    const resolvedAuthUser = existingAuthUser ?? profileAuthUser ?? repAuthUser;

    let repAuthUserId = resolvedAuthUser?.id ?? null;
    let invited = false;
    let createdWithTemporaryPassword = false;
    let updatedTemporaryPassword = false;
    const reusedExistingAuthUser = Boolean(repAuthUserId);

    if (!repAuthUserId) {
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
        repAuthUserId = created.data.user?.id ?? null;
        createdWithTemporaryPassword = Boolean(repAuthUserId);
      } else {
        const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo,
        });
        if (invite.error) return json({ error: invite.error.message }, 400);
        repAuthUserId = invite.data.user?.id ?? null;
        invited = Boolean(repAuthUserId);
      }
    } else if (temporaryPassword) {
      const updated = await adminClient.auth.admin.updateUserById(repAuthUserId, {
        password: temporaryPassword,
        user_metadata: {
          ...metadata,
          force_password_reset: true,
        },
      });
      if (updated.error) return json({ error: updated.error.message }, 400);
      updatedTemporaryPassword = true;
    }

    if (!repAuthUserId) return json({ error: 'Could not create or locate auth user for this rep.' }, 500);

    const repProfileId = existingProfile?.id ?? repAuthUserId;
    const profilePayload = {
      id: repProfileId,
      auth_user_id: repAuthUserId,
      full_name: fullName || repRow.rep_name || repSlug || email,
      email,
      phone: phone || null,
      role: 'rep',
      admin_scope: KLOW_STORE_SCOPE,
      store_slug: KLOW_PARENT_STORE_SLUG,
      owner_email: ROCKPHORM_ADMIN_EMAIL,
      brand_id: 'rockphorm',
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
      store_scope: KLOW_STORE_SCOPE,
      brand_id: 'rockphorm',
      actor_id: actorProfile.id,
      actor_email: actorProfile.email,
      action: 'klow_rep_portal_login_granted',
      target_table: 'reps',
      target_id: repId,
      rep_id: repId,
      old_value: { profile_id: repRow.profile_id, payout_email: repRow.payout_email },
      new_value: { profile_id: repProfileId, auth_user_id: repAuthUserId, invited, reusedExistingAuthUser, createdWithTemporaryPassword, updatedTemporaryPassword },
      audit_notes: createdWithTemporaryPassword || updatedTemporaryPassword
        ? 'KLOW rep portal login granted with temporary password and reset flag.'
        : 'KLOW rep portal login granted.',
    });

    return json({
      ok: true,
      profileId: repProfileId,
      authUserId: repAuthUserId,
      invited,
      createdWithTemporaryPassword,
      updatedTemporaryPassword,
      reusedExistingAuthUser,
      message: createdWithTemporaryPassword || updatedTemporaryPassword
        ? `KLOW rep auth user ${createdWithTemporaryPassword ? 'created' : 'updated'} with temporary password and portal login linked.`
        : invited
          ? 'KLOW rep invite sent and portal login linked.'
          : 'KLOW rep portal login linked.',
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}

function isKlowRep(rep: RepRow): boolean {
  const tokens = [
    rep.custom_store_slug,
    rep.brand_name,
    rep.rep_channel,
    rep.rep_tier,
    rep.rep_slug,
  ].map((value) => cleanString(value).toUpperCase());

  return tokens.some((token) => (
    token === KLOW_STORE_SCOPE ||
    token === KLOW_PARENT_STORE_SLUG.toUpperCase() ||
    token.includes('KLOW')
  ));
}

async function isRockPhormParentedRep(adminClient: ReturnType<typeof createClient>, rep: RepRow, actorProfileId: string): Promise<boolean> {
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
  const parentTokens = [parentRecord.rep_slug, parentRecord.custom_store_slug, parentRecord.brand_name]
    .map((value) => cleanString(value).toUpperCase());
  const isRockParent = parentTokens.some((token) => token === ROCKPHORM_STORE_SCOPE || token.includes('ROCKPHORM') || token.includes('ROCK PHORM'));
  return isRockParent && (parentRecord.profile_id === actorProfileId || parentRecord.managed_by_profile_id === actorProfileId);
}

async function findProfileByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<ProfileRow | null> {
  const { data } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, email, full_name, role')
    .ilike('email', email)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

async function findAuthUserById(adminClient: ReturnType<typeof createClient>, userId: string): Promise<{ id: string } | null> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;
    const found = data.users.find((user) => String(user.email ?? '').toLowerCase() === target);
    if (found) return { id: found.id };
    if (data.users.length < 1000) return null;
  }
  return null;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
