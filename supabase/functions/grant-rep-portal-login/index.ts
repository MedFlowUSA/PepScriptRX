import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_APP_URL') ?? 'https://pepscriptrx.vercel.app';
const AACTIVATED_STORE_SCOPE = 'AACTIVATEDRX';
const AACTIVATED_PARTNER_ADMIN_EMAIL = 'guy@aactivated.com';
const AACTIVATED_PARENT_STORE_SLUG = 'aactivated';

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
      .select('id, email, full_name, role')
      .eq('id', authUser.id)
      .maybeSingle();
    if (actorError || !actor) return json({ error: 'Admin profile not found.' }, 403);

    const actorProfile = actor as ProfileRow;
    const actorEmail = String(actorProfile.email ?? '').toLowerCase();
    const actorRole = String(actorProfile.role ?? '').toLowerCase();
    const isPlatformAdmin = ['admin', 'owner', 'platform_admin', 'super_admin'].includes(actorRole);
    const isGuy = actorRole === 'rx_plus_admin' && actorEmail === AACTIVATED_PARTNER_ADMIN_EMAIL;
    if (!isPlatformAdmin && !isGuy) return json({ error: 'Only Guy or a platform admin can grant AACTIVATEDRX rep portal login.' }, 403);

    const payload = await req.json().catch(() => ({}));
    const repId = cleanString(payload.repId);
    const email = cleanString(payload.email).toLowerCase();
    const fullName = cleanString(payload.fullName);
    const phone = cleanString(payload.phone);
    const repSlug = cleanString(payload.repSlug);
    const storeScope = cleanString(payload.storeScope).toUpperCase() || AACTIVATED_STORE_SCOPE;
    const redirectTo = cleanString(payload.redirectTo) || `${APP_URL}/rep`;
    const temporaryPassword = cleanString(payload.temporaryPassword);

    if (!repId) return json({ error: 'repId is required.' }, 400);
    if (!email || !email.includes('@')) return json({ error: 'A valid rep email is required.' }, 400);
    if (storeScope !== AACTIVATED_STORE_SCOPE) return json({ error: 'Only AACTIVATEDRX rep login grants are supported here.' }, 400);

    const { data: rep, error: repError } = await adminClient
      .from('reps')
      .select('id, rep_slug, rep_name, payout_email, profile_id, managed_by_profile_id, parent_rep_id, custom_store_slug, brand_name, rep_channel, rep_tier')
      .eq('id', repId)
      .maybeSingle();
    if (repError || !rep) return json({ error: 'Rep not found.' }, 404);

    const repRow = rep as RepRow;
    if (!isAactivatedRep(repRow)) return json({ error: 'Rep is not scoped to AACTIVATEDRX.' }, 403);
    if (isGuy && repRow.managed_by_profile_id !== actorProfile.id && !(await isGuyParentedRep(adminClient, repRow, actorProfile.id))) {
      return json({ error: 'Guy can only grant login for AACTIVATEDRX reps he manages.' }, 403);
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
        store_scope: AACTIVATED_STORE_SCOPE,
        rep_slug: repSlug || repRow.rep_slug,
      };

      if (temporaryPassword) {
        if (temporaryPassword.length < 12) return json({ error: 'Temporary passwords must be at least 12 characters.' }, 400);
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
    };
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });
    if (profileError) return json({ error: profileError.message }, 500);

    const { error: repUpdateError } = await adminClient
      .from('reps')
      .update({
        profile_id: repProfileId,
        payout_email: email,
        active: true,
      })
      .eq('id', repId);
    if (repUpdateError) return json({ error: repUpdateError.message }, 500);

    await adminClient.from('partner_rep_setup_audit').insert({
      store_scope: AACTIVATED_STORE_SCOPE,
      actor_id: actorProfile.id,
      actor_email: actorProfile.email,
      action: 'rep_portal_login_granted',
      target_table: 'reps',
      target_id: repId,
      rep_id: repId,
      old_value: { profile_id: repRow.profile_id, payout_email: repRow.payout_email },
      new_value: { profile_id: repProfileId, payout_email: email, invited, reusedExistingAuthUser, createdWithTemporaryPassword },
      audit_notes: createdWithTemporaryPassword
        ? 'AACTIVATEDRX rep portal login granted with temporary password and reset flag.'
        : 'AACTIVATEDRX rep portal login granted.',
    });

    return json({
      ok: true,
      profileId: repProfileId,
      invited,
      createdWithTemporaryPassword,
      reusedExistingAuthUser,
      message: createdWithTemporaryPassword
        ? 'Rep auth user created with temporary password and portal login linked.'
        : invited
          ? 'Rep invite sent and portal login linked.'
          : 'Rep portal login linked.',
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}

function isAactivatedRep(rep: RepRow): boolean {
  const tokens = [
    rep.custom_store_slug,
    rep.brand_name,
    rep.rep_channel,
    rep.rep_tier,
    rep.rep_slug,
  ].map((value) => cleanString(value).toUpperCase());

  return tokens.some((token) => (
    token === AACTIVATED_PARENT_STORE_SLUG.toUpperCase()
    || token === AACTIVATED_STORE_SCOPE
    || token.includes('AACTIVATED')
  ));
}

async function findProfileByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<{ id: string } | null> {
  const { data } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

async function isGuyParentedRep(adminClient: ReturnType<typeof createClient>, rep: RepRow, actorProfileId: string): Promise<boolean> {
  if (!rep.parent_rep_id) return false;
  const { data } = await adminClient
    .from('reps')
    .select('id')
    .eq('id', rep.parent_rep_id)
    .eq('profile_id', actorProfileId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return { id: found.id };
    if (data.users.length < 1000) return null;
  }
  return null;
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
