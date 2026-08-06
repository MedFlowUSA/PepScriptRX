import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = (
  Deno.env.get('APP_URL')
  ?? Deno.env.get('PUBLIC_SITE_URL')
  ?? Deno.env.get('SITE_URL')
  ?? 'https://pepscriptrx.vercel.app'
).replace(/\/+$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

type PackageRow = {
  package_id: string;
  package_tier: string;
  package_name: string;
  promo_label: string | null;
  retail_value: number;
  promo_price: number;
  savings: number;
  purchase_limit: number;
  enabled: boolean;
};

type VariationRow = {
  package_id: string;
  variation_id: string;
  variation_name: string;
  retail_value: number;
  promo_price: number;
  savings: number;
};

type ComponentRow = {
  inventory_sku: string;
  display_name: string;
  quantity: number;
  sort_order: number;
};

type InventoryRow = {
  id: string;
  sku: string;
  product_name: string;
  strength: string | null;
  current_qty: number;
  active: boolean;
};

type ProfileRow = {
  id: string;
  auth_user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

type RepRow = {
  id: string;
  profile_id: string | null;
  rep_slug: string;
  rep_name?: string | null;
  payout_email?: string | null;
  active?: boolean | null;
  brand_id?: string | null;
  parent_brand_id?: string | null;
  custom_store_slug?: string | null;
  assigned_store_slug?: string | null;
  brand_name?: string | null;
  rep_channel?: string | null;
  rep_tier?: string | null;
  parent_type?: string | null;
  managed_by_profile_id?: string | null;
  parent_rep_id?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: 'Authentication required.' }, 401);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await db.auth.getUser(bearer);
    if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);

    const payload = await req.json().catch(() => ({})) as {
      package_id?: string;
      variation_id?: string | null;
      override_id?: string | null;
      shipping_speed?: string | null;
    };
    const packageId = cleanToken(payload.package_id);
    const variationId = cleanToken(payload.variation_id);
    if (!packageId) return json({ error: 'package_id required.' }, 400);

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id,auth_user_id,full_name,email,phone,role')
      .or(`auth_user_id.eq.${userData.user.id},id.eq.${userData.user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profileError || !profile) return json({ error: 'Profile not found.' }, 403);

    const profileRow = profile as ProfileRow;
    const isAdmin = isPlatformAdmin(profileRow.role) || await isAactivatedAdmin(db, profileRow.id);
    const { data: repsData } = await db
      .from('reps')
      .select('id,profile_id,rep_slug,rep_name,parent_rep_id')
      .eq('profile_id', profileRow.id)
      .order('created_at', { ascending: false });
    const rep = ((repsData as RepRow[] | null) ?? [])[0];
    const { data: onboarding } = rep ? await db.from('aactivated_onboarding_profiles').select('id').eq('user_id',userData.user.id).eq('rep_id',rep.id).not('state','in','(application_pending,application_more_info_required,application_declined,suspended)').maybeSingle() : { data: null };

    if (!isAdmin && (!rep || !onboarding)) return json({ error: 'Approved AACTIVATEDRX onboarding is required.' }, 403);
    if (!rep) return json({ error: 'A linked AACTIVATEDRX rep profile is required to purchase a starter kit.' }, 403);

    const { data: kit, error: packageError } = await db
      .from('aactivated_starter_kit_packages')
      .select('package_id,package_tier,package_name,promo_label,retail_value,promo_price,savings,purchase_limit,enabled')
      .eq('package_id', packageId)
      .maybeSingle();
    if (packageError || !kit) return json({ error: 'Starter kit not found.' }, 404);
    const packageRow = kit as PackageRow;
    if (!packageRow.enabled && !isAdmin) return json({ error: 'This starter kit is not currently available.' }, 409);

    let selectedName: string | null = null;
    let retailValue = Number(packageRow.retail_value);
    let promoPrice = Number(packageRow.promo_price);
    let savings = Number(packageRow.savings);
    const isStarterExperience = packageRow.package_id === 'starter-experience-kit';
    if (isStarterExperience) {
      if (!variationId) return json({ error: 'Choose a starter-kit variation.' }, 400);
      const { data: variation, error: variationError } = await db
        .from('aactivated_starter_kit_variations')
        .select('package_id,variation_id,variation_name,retail_value,promo_price,savings')
        .eq('package_id', packageRow.package_id)
        .eq('variation_id', variationId)
        .maybeSingle();
      if (variationError || !variation) return json({ error: 'Starter-kit variation not found.' }, 404);
      const variationRow = variation as VariationRow;
      selectedName = variationRow.variation_name;
      retailValue = Number(variationRow.retail_value);
      promoPrice = Number(variationRow.promo_price);
      savings = Number(variationRow.savings);
    } else if (variationId) {
      return json({ error: 'This package does not use a variation.' }, 400);
    }

    const overrideId = cleanUuid(payload.override_id);
    const override = overrideId
      ? await findActiveOverride(db, overrideId, rep, packageRow.package_id, variationId, profileRow.id)
      : null;
    if (overrideId && !override) return json({ error: 'Eligibility override is not active for this rep/package.' }, 403);

    const duplicateBlocked = await hasDuplicatePurchase(db, rep, packageRow.package_id);
    if (duplicateBlocked && !override && !isAdmin) {
      return json({ error: 'Purchase limit reached for this starter-kit tier.' }, 409);
    }

    const components = await loadComponents(db, packageRow.package_id, variationId);
    if (components.length === 0) return json({ error: 'Starter kit has no inventory components configured.' }, 500);
    const snapshot = await inventorySnapshot(db, components);
    const missing = snapshot.find((row) => !row.inventory_item_id || !row.active || row.current_qty < row.quantity);
    if (missing) {
      return json({ error: `Inventory unavailable for ${missing.name}.`, sku: missing.sku }, 409);
    }

    const submissionId = crypto.randomUUID();
    const paymentToken = `${crypto.randomUUID().replace(/-/g, '')}${randomLetters(8)}`;
    const orderNumber = `AAKIT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomLetters(5).toUpperCase()}`;
    const amountCents = Math.round(promoPrice * 100);
    const displayName = selectedName ? `${packageRow.package_name} - ${selectedName}` : packageRow.package_name;
    const repEmail = cleanEmail(profileRow.email) || userData.user.email || '';

    const orderItem = {
      type: 'aactivated_starter_kit',
      package_id: packageRow.package_id,
      package_tier: packageRow.package_tier,
      package_name: packageRow.package_name,
      variation_id: variationId || null,
      variation_name: selectedName,
      quantity: 1,
      unit_price: promoPrice,
      retail_value: retailValue,
      savings,
      commission_enabled: false,
      components: snapshot,
    };

    const { error: insertError } = await db.from('patient_submissions').insert({
      id: submissionId,
      patient_profile_id: profileRow.id,
      full_name: profileRow.full_name || rep.rep_name || rep.rep_slug,
      email: repEmail,
      phone: profileRow.phone || '0000000000',
      rep_id: rep.id,
      medication: displayName,
      product_name: displayName,
      submission_type: 'aactivated_rep_starter_kit',
      inquiry_notes: 'Private AACTIVATEDRX rep starter kit purchase.',
      status: 'payment_sent',
      quoted_price: promoPrice,
      current_price: retailValue,
      estimated_savings: savings,
      discount_amount: 0,
      discount_code: null,
      shipping_speed: cleanShippingSpeed(payload.shipping_speed),
      shipping_cost: 0,
      order_total: promoPrice,
      subtotal_cents: amountCents,
      discount_cents: 0,
      amount_due_cents: amountCents,
      public_payment_token: paymentToken,
      order_number: orderNumber,
      order_items: [orderItem],
      order_type: 'REP_INTERNAL',
      checkout_scope_code: 'GUY60',
      source_portal: 'AACTIVATEDRX',
      source_route: '/aactivated/rep/starter-kits',
      source_store: 'aactivated',
      source_admin: 'GUY60',
      source_rep: rep.rep_slug,
      store_slug: 'aactivated',
      store_name: 'AACTIVATEDRX',
      referral_code: null,
      admin_code: 'GUY60',
      brand_id: 'aactivated',
      account_type: 'rep',
      commission_rate: 0,
      partner_payout_eligible: false,
      payment_provider: null,
      payment_status: 'unpaid',
      payment_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });
    if (insertError) return json({ error: insertError.message }, 500);

    const { error: kitOrderError } = await db.from('aactivated_starter_kit_orders').insert({
      submission_id: submissionId,
      package_id: packageRow.package_id,
      variation_id: variationId || null,
      package_name: packageRow.package_name,
      package_tier: packageRow.package_tier,
      variation_name: selectedName,
      rep_profile_id: profileRow.id,
      rep_id: rep.id,
      rep_slug: rep.rep_slug,
      rep_name: rep.rep_name || profileRow.full_name || rep.rep_slug,
      rep_email: repEmail,
      brand_id: 'aactivated',
      retail_value: retailValue,
      promo_price: promoPrice,
      savings,
      component_snapshot: snapshot,
      payment_status: 'pending',
      eligibility_override_id: override?.id ?? null,
    });
    if (kitOrderError) {
      await db.from('patient_submissions').delete().eq('id', submissionId);
      return json({ error: kitOrderError.message }, 500);
    }

    await db.from('aactivated_starter_kit_audit_log').insert({
      actor_profile_id: profileRow.id,
      actor_email: profileRow.email ?? userData.user.email ?? null,
      action: 'starter_kit_checkout_created',
      target_table: 'aactivated_starter_kit_orders',
      target_id: submissionId,
      new_value: { package_id: packageRow.package_id, variation_id: variationId || null, rep_slug: rep.rep_slug, amount_cents: amountCents },
    });

    return json({
      ok: true,
      submission_id: submissionId,
      order_number: orderNumber,
      public_payment_token: paymentToken,
      payment_path: `/pay/${encodeURIComponent(paymentToken)}`,
      payment_url: `${APP_URL}/pay/${encodeURIComponent(paymentToken)}`,
    }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
}

function cleanUuid(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function cleanEmail(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? text : '';
}

function cleanShippingSpeed(value: unknown): 'standard' | 'expedited' | 'overnight' {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'expedited' || text === 'overnight' ? text : 'standard';
}

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function isPlatformAdmin(role: unknown): boolean {
  return ['admin', 'owner', 'platform_admin', 'master_admin', 'super_admin'].includes(String(role ?? '').toLowerCase());
}

async function isAactivatedAdmin(db: ReturnType<typeof createClient>, profileId: string): Promise<boolean> {
  const { data } = await db
    .from('partner_admin_brand_assignments')
    .select('id')
    .eq('profile_id', profileId)
    .eq('brand_id', 'aactivated')
    .eq('status', 'active')
    .limit(1);
  return Boolean(data?.length);
}

async function findActiveOverride(
  db: ReturnType<typeof createClient>,
  overrideId: string,
  rep: RepRow,
  packageId: string,
  variationId: string,
  profileId: string,
) {
  const { data } = await db
    .from('aactivated_starter_kit_eligibility_overrides')
    .select('id,override_type,expires_at,active')
    .eq('id', overrideId)
    .eq('active', true)
    .or(`rep_id.eq.${rep.id},rep_profile_id.eq.${profileId}`)
    .or(`package_id.is.null,package_id.eq.${packageId}`)
    .maybeSingle();
  const row = data as { id: string; override_type: string; expires_at: string | null; active: boolean } | null;
  if (!row || row.override_type !== 'reopen') return null;
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;
  void variationId;
  return row;
}

async function hasDuplicatePurchase(db: ReturnType<typeof createClient>, rep: RepRow, packageId: string): Promise<boolean> {
  const { data } = await db
    .from('aactivated_starter_kit_orders')
    .select('id')
    .eq('rep_id', rep.id)
    .eq('package_id', packageId)
    .in('payment_status', ['pending', 'paid'])
    .limit(1);
  return Boolean(data?.length);
}

async function loadComponents(db: ReturnType<typeof createClient>, packageId: string, variationId: string): Promise<ComponentRow[]> {
  let query = db
    .from('aactivated_starter_kit_components')
    .select('inventory_sku,display_name,quantity,sort_order')
    .eq('package_id', packageId);
  query = variationId ? query.eq('variation_id', variationId) : query.is('variation_id', null);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as ComponentRow[] | null) ?? [];
}

async function inventorySnapshot(db: ReturnType<typeof createClient>, components: ComponentRow[]) {
  const skus = components.map((row) => row.inventory_sku);
  const { data, error } = await db
    .from('inventory_items')
    .select('id,sku,product_name,strength,current_qty,active')
    .in('sku', skus);
  if (error) throw error;
  const bySku = new Map(((data as InventoryRow[] | null) ?? []).map((row) => [row.sku.toUpperCase(), row]));
  return components.map((component) => {
    const item = bySku.get(component.inventory_sku.toUpperCase());
    return {
      sku: component.inventory_sku,
      name: component.display_name,
      quantity: component.quantity,
      inventory_item_id: item?.id ?? null,
      product_name: item?.product_name ?? null,
      strength: item?.strength ?? null,
      current_qty: Number(item?.current_qty ?? 0),
      active: item?.active === true,
    };
  });
}
