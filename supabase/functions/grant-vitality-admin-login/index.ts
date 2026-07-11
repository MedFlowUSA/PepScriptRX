import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_APP_URL') ?? 'https://pepscriptrx.vercel.app';
const VITALITY_SCOPE = 'VITALITY';
const VITALITY_STORE_SLUG = 'vitality';
const DEFAULT_EMAIL = 'Jane@touchofvitality.life';
const DEFAULT_NAME = 'Jane';

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
  global_admin?: boolean | null;
  super_admin?: boolean | null;
  can_view_all_brands?: boolean | null;
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
    if (userError || !authUser) return json({ error: 'Authenticated platform admin session required.' }, 401);

    const { data: actor, error: actorError } = await adminClient
      .from('profiles')
      .select('id, auth_user_id, email, full_name, role, global_admin, super_admin, can_view_all_brands')
      .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
      .maybeSingle();
    if (actorError || !actor) return json({ error: 'Admin profile not found.' }, 403);

    const actorProfile = actor as ProfileRow;
    if (!isPlatformAdmin(actorProfile)) {
      return json({ error: 'Only platform admins can grant Vitality admin login.' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const email = cleanString(payload.email || DEFAULT_EMAIL);
    const fullName = cleanString(payload.fullName || DEFAULT_NAME);
    const temporaryPassword = cleanString(payload.temporaryPassword);
    const redirectTo = cleanString(payload.redirectTo) || `${APP_URL}/admin`;

    if (!email || !email.includes('@')) return json({ error: 'A valid admin email is required.' }, 400);

    const metadata = {
      full_name: fullName,
      role: 'partner_admin_limited',
      brand_id: VITALITY_STORE_SLUG,
      store_scope: VITALITY_SCOPE,
      admin_scope: VITALITY_SCOPE,
      store_slug: VITALITY_STORE_SLUG,
    };

    const existingProfile = await findProfileByEmail(adminClient, email);
    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    const profileAuthUser = !existingAuthUser?.id && existingProfile?.auth_user_id
      ? await findAuthUserById(adminClient, existingProfile.auth_user_id)
      : null;
    const resolvedAuthUser = existingAuthUser ?? profileAuthUser;

    let adminAuthUserId = resolvedAuthUser?.id ?? null;
    let invited = false;
    let createdWithTemporaryPassword = false;
    let updatedTemporaryPassword = false;
    const reusedExistingAuthUser = Boolean(adminAuthUserId);

    if (!adminAuthUserId) {
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
        adminAuthUserId = created.data.user?.id ?? null;
        createdWithTemporaryPassword = Boolean(adminAuthUserId);
      } else {
        const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo,
        });
        if (invite.error) return json({ error: invite.error.message }, 400);
        adminAuthUserId = invite.data.user?.id ?? null;
        invited = Boolean(adminAuthUserId);
      }
    } else if (temporaryPassword) {
      const updated = await adminClient.auth.admin.updateUserById(adminAuthUserId, {
        password: temporaryPassword,
        user_metadata: {
          ...metadata,
          force_password_reset: true,
        },
      });
      if (updated.error) return json({ error: updated.error.message }, 400);
      updatedTemporaryPassword = true;
    }

    if (!adminAuthUserId) return json({ error: 'Could not create or locate auth user for this admin.' }, 500);

    const profileId = existingProfile?.id ?? adminAuthUserId;
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: profileId,
        auth_user_id: adminAuthUserId,
        full_name: fullName,
        email,
        role: 'partner_admin_limited',
        brand_id: VITALITY_STORE_SLUG,
        partner_access_level: 'limited',
        access_scope: 'brand_only',
        admin_scope: VITALITY_SCOPE,
        store_slug: VITALITY_STORE_SLUG,
        owner_email: email,
        global_admin: false,
        super_admin: false,
        can_view_all_brands: false,
        can_view_all_reps: false,
        can_view_all_orders: false,
        can_view_all_customers: false,
        can_edit_global_catalog: false,
        can_edit_global_settings: false,
        can_view_platform_financials: false,
        can_view_other_partner_financials: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (profileError) return json({ error: profileError.message }, 500);

    const { error: assignmentError } = await adminClient
      .from('partner_admin_brand_assignments')
      .upsert({
        profile_id: profileId,
        brand_id: VITALITY_STORE_SLUG,
        access_level: 'limited',
        status: 'active',
      }, { onConflict: 'profile_id,brand_id' });
    if (assignmentError) return json({ error: assignmentError.message }, 500);

    const { error: repUpdateError } = await adminClient
      .from('reps')
      .update({
        profile_id: profileId,
        managed_by_profile_id: profileId,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('rep_slug', VITALITY_SCOPE);
    if (repUpdateError) return json({ error: repUpdateError.message }, 500);

    await adminClient.from('partner_rep_setup_audit').insert({
      store_scope: VITALITY_SCOPE,
      brand_id: VITALITY_STORE_SLUG,
      actor_id: actorProfile.id,
      actor_email: actorProfile.email,
      action: 'vitality_admin_login_granted',
      target_table: 'profiles',
      target_id: profileId,
      old_value: { email },
      new_value: { profile_id: profileId, auth_user_id: adminAuthUserId, invited, reusedExistingAuthUser, createdWithTemporaryPassword, updatedTemporaryPassword },
      audit_notes: createdWithTemporaryPassword || updatedTemporaryPassword
        ? 'Vitality admin login granted with temporary password and reset flag.'
        : 'Vitality admin login granted.',
    });

    return json({
      ok: true,
      profileId,
      authUserId: adminAuthUserId,
      invited,
      createdWithTemporaryPassword,
      updatedTemporaryPassword,
      reusedExistingAuthUser,
      message: createdWithTemporaryPassword || updatedTemporaryPassword
        ? `Vitality admin auth user ${createdWithTemporaryPassword ? 'created' : 'updated'} with temporary password and portal login linked.`
        : invited
          ? 'Vitality admin invite sent and portal login linked.'
          : 'Vitality admin portal login linked.',
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}

function isPlatformAdmin(profile: ProfileRow): boolean {
  const role = cleanString(profile.role).toLowerCase();
  return ['admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin'].includes(role)
    || profile.global_admin === true
    || profile.super_admin === true
    || profile.can_view_all_brands === true;
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
