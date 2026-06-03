import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ZELLE_ENABLED = (Deno.env.get('ZELLE_ENABLED') ?? Deno.env.get('NEXT_PUBLIC_ZELLE_ENABLED') ?? Deno.env.get('VITE_ZELLE_ENABLED') ?? '').toLowerCase() === 'true';
const ZELLE_DISCOUNT_BPS = numberEnv('ZELLE_DISCOUNT_BPS', 'NEXT_PUBLIC_ZELLE_DISCOUNT_BPS', 1000);
const ZELLE_DISPLAY_NAME = Deno.env.get('ZELLE_DISPLAY_NAME') ?? Deno.env.get('NEXT_PUBLIC_ZELLE_DISPLAY_NAME') ?? Deno.env.get('VITE_ZELLE_DISPLAY_NAME') ?? '';
const ZELLE_RECIPIENT_KIND = Deno.env.get('ZELLE_RECIPIENT_KIND') ?? Deno.env.get('NEXT_PUBLIC_ZELLE_RECIPIENT_KIND') ?? Deno.env.get('VITE_ZELLE_RECIPIENT_KIND') ?? 'email';
const ZELLE_RECIPIENT_VALUE = Deno.env.get('ZELLE_RECIPIENT_VALUE') ?? Deno.env.get('NEXT_PUBLIC_ZELLE_RECIPIENT_VALUE') ?? Deno.env.get('VITE_ZELLE_RECIPIENT_VALUE') ?? '';
const ZELLE_TTL_MINUTES = numberEnv('ZELLE_INTENT_TTL_MINUTES', '', 30);
const ZELLE_LOW_RISK_MAX_CENTS = numberEnv('ZELLE_LOW_RISK_MAX_CENTS', 'NEXT_PUBLIC_ZELLE_LOW_RISK_MAX_CENTS', 50000);
const PAYMENT_PROOFS_BUCKET = Deno.env.get('PAYMENT_PROOFS_BUCKET') ?? 'payment-proofs';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? '');
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authHeader = req.headers.get('Authorization') ?? '';
    console.log('zelle-payment action', {
      action,
      order_id: payload.submission_id ?? payload.order_id ?? null,
      intent_id: payload.intent_id ?? null,
      env: {
        zelle_enabled: ZELLE_ENABLED,
        display_name_present: Boolean(ZELLE_DISPLAY_NAME),
        recipient_kind: ZELLE_RECIPIENT_KIND,
        recipient_value_present: Boolean(ZELLE_RECIPIENT_VALUE),
        discount_bps: ZELLE_DISCOUNT_BPS,
        low_risk_max_cents: ZELLE_LOW_RISK_MAX_CENTS,
        proofs_bucket_present: Boolean(PAYMENT_PROOFS_BUCKET),
      },
    });

    if (action === 'create-intent') return await createIntent(db, payload);
    if (action === 'status') return await status(db, payload);
    if (action === 'mark-sent') return await markSent(db, payload);
    if (action === 'proof-upload-url') return await proofUploadUrl(db, payload);
    if (action === 'proof-complete') return await proofComplete(db, payload);
    if (action.startsWith('admin-')) return await adminAction(db, authHeader, payload, action);

    return json({ error: 'Unsupported Zelle action' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

async function createIntent(db: DbClient, payload: Record<string, unknown>) {
  if (!ZELLE_ENABLED) return json({ error: 'Zelle checkout is not enabled' }, 403);
  if (!ZELLE_DISPLAY_NAME) return json({ error: 'Zelle recipient name is not configured' }, 503);
  if (!ZELLE_RECIPIENT_VALUE) return json({ error: 'Zelle recipient is not configured' }, 503);

  const submissionId = String(payload.submission_id ?? '');
  if (!submissionId) return json({ error: 'submission_id required' }, 400);

  const { data: existing } = await db
    .from('zelle_payment_intents')
    .select('*')
    .eq('order_id', submissionId)
    .in('status', ['pending', 'sent', 'needs_info'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return json({ ok: true, intent: existing }, 200);

  const { data: sub, error } = await db
    .from('patient_submissions')
    .select('id, status, quoted_price, discount_amount, shipping_cost, checkout_scope_code, source_portal, store_slug, referral_code, payment_status')
    .eq('id', submissionId)
    .single();
  if (error || !sub) return json({ error: 'Payment request not found' }, 404);
  if (sub.status !== 'payment_sent') return json({ error: `Order is not checkout-ready: ${sub.status}` }, 409);
  const eligibility = classifyMainCheckout(sub);
  console.log('zelle-payment create-intent eligibility', {
    order_id: submissionId,
    ...eligibility.debug,
  });
  if (!eligibility.ok) return json({ error: 'Zelle pilot is only available on the main PepScriptRX checkout', reason: eligibility.reason, debug: eligibility.debug }, 403);

  const productTotal = Math.round(Number(sub.quoted_price ?? 0) * 100);
  const existingDiscount = Math.min(Math.round(Number(sub.discount_amount ?? 0) * 100), productTotal);
  const shipping = Math.round(Number(sub.shipping_cost ?? 0) * 100);
  const subtotal = Math.max(0, productTotal - existingDiscount + shipping);
  if (subtotal <= 0) return json({ error: 'Order total is not payable' }, 400);
  if (subtotal > ZELLE_LOW_RISK_MAX_CENTS) return json({ error: 'Zelle is not available for this order amount' }, 403);

  const discount = Math.min(subtotal, Math.floor((subtotal * ZELLE_DISCOUNT_BPS) / 10000));
  const amountDue = Math.max(0, subtotal - discount);
  const paymentReference = `PSR-ZELLE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + ZELLE_TTL_MINUTES * 60 * 1000).toISOString();

  const { data: intent, error: insertError } = await db
    .from('zelle_payment_intents')
    .insert({
      order_id: submissionId,
      subtotal_cents: subtotal,
      discount_cents: discount,
      amount_due_cents: amountDue,
      discount_bps: ZELLE_DISCOUNT_BPS,
      recipient_display_name: ZELLE_DISPLAY_NAME,
      recipient_kind: ZELLE_RECIPIENT_KIND,
      recipient_value: ZELLE_RECIPIENT_VALUE,
      payment_reference: paymentReference,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (insertError || !intent) return json({ error: insertError?.message ?? 'Could not create Zelle intent' }, 500);

  await db
    .from('patient_submissions')
    .update({
      payment_provider: 'zelle',
      payment_status: 'payment_pending',
      subtotal_cents: subtotal,
      discount_cents: discount,
      amount_due_cents: amountDue,
      payment_reference: paymentReference,
      payment_expires_at: expiresAt,
      payment_release_policy: 'paid_hold',
    })
    .eq('id', submissionId);

  await audit(db, submissionId, intent.id, 'customer', 'zelle_intent_created', { amount_due_cents: amountDue });
  return json({ ok: true, intent }, 200);
}

async function status(db: DbClient, payload: Record<string, unknown>) {
  const submissionId = String(payload.submission_id ?? '');
  const intentId = String(payload.intent_id ?? '');
  let query = db.from('zelle_payment_intents').select('*').order('created_at', { ascending: false }).limit(1);
  if (intentId) query = query.eq('id', intentId);
  else if (submissionId) query = query.eq('order_id', submissionId);
  else return json({ error: 'submission_id or intent_id required' }, 400);

  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, intent: data ?? null }, 200);
}

async function markSent(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const senderName = String(payload.sender_name ?? '').trim();
  if (!intentId || !senderName) return json({ error: 'intent_id and sender_name required' }, 400);

  const { data: intent } = await db
    .from('zelle_payment_intents')
    .select('id, order_id, status, expires_at')
    .eq('id', intentId)
    .single();
  if (!intent) return json({ error: 'Zelle intent not found' }, 404);
  if (!['pending', 'needs_info', 'sent'].includes(intent.status)) return json({ error: `Cannot mark ${intent.status} intent sent` }, 409);
  if (new Date(intent.expires_at).getTime() < Date.now()) {
    await expireIntent(db, intent.id, intent.order_id);
    return json({ error: 'This Zelle payment window has expired' }, 409);
  }

  const { data: updated, error } = await db
    .from('zelle_payment_intents')
    .update({
      status: 'sent',
      sender_name: senderName,
      sender_email: nullableText(payload.sender_email),
      sender_phone: nullableText(payload.sender_phone),
      claimed_amount_cents: nullableInt(payload.claimed_amount_cents),
      customer_marked_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', intentId)
    .select('*')
    .single();
  if (error || !updated) return json({ error: error?.message ?? 'Could not mark payment sent' }, 500);
  await audit(db, intent.order_id, intent.id, 'customer', 'zelle_customer_marked_sent', { sender_name: senderName });
  return json({ ok: true, intent: updated }, 200);
}

async function proofUploadUrl(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const fileName = safeFileName(String(payload.file_name ?? 'payment-proof'));
  const contentType = String(payload.content_type ?? 'application/octet-stream');
  if (!intentId) return json({ error: 'intent_id required' }, 400);

  const { data: intent } = await db.from('zelle_payment_intents').select('id, order_id').eq('id', intentId).single();
  if (!intent) return json({ error: 'Zelle intent not found' }, 404);

  const filePath = `${intent.order_id}/${intent.id}/${crypto.randomUUID()}-${fileName}`;
  const { data, error } = await db.storage.from(PAYMENT_PROOFS_BUCKET).createSignedUploadUrl(filePath, { upsert: false });
  if (error || !data?.signedUrl) return json({ error: error?.message ?? 'Could not create proof upload URL' }, 500);
  return json({ ok: true, uploadUrl: data.signedUrl, filePath, contentType }, 200);
}

async function proofComplete(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const filePath = String(payload.file_path ?? '');
  if (!intentId || !filePath) return json({ error: 'intent_id and file_path required' }, 400);
  const { data: intent } = await db.from('zelle_payment_intents').select('id, order_id, sender_email').eq('id', intentId).single();
  if (!intent) return json({ error: 'Zelle intent not found' }, 404);

  const { error } = await db.from('payment_proofs').insert({
    payment_intent_id: intentId,
    order_id: intent.order_id,
    file_path: filePath,
    file_name: nullableText(payload.file_name),
    content_type: nullableText(payload.content_type),
    file_size: nullableInt(payload.file_size),
    uploaded_by_email: intent.sender_email,
  });
  if (error) return json({ error: error.message }, 500);
  await audit(db, intent.order_id, intent.id, 'customer', 'zelle_proof_uploaded', { file_path: filePath });
  return json({ ok: true }, 200);
}

async function adminAction(db: DbClient, authHeader: string, payload: Record<string, unknown>, action: string) {
  const admin = await requireAdmin(db, authHeader);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const intentId = String(payload.intent_id ?? '');
  if (!intentId) return json({ error: 'intent_id required' }, 400);
  const { data: intent } = await db.from('zelle_payment_intents').select('*').eq('id', intentId).single();
  if (!intent) return json({ error: 'Zelle intent not found' }, 404);

  if (action === 'admin-confirm') {
    if (!['sent', 'needs_info', 'pending'].includes(intent.status)) return json({ error: `Cannot confirm ${intent.status} intent` }, 409);
    const { data: sub, error } = await db
      .from('patient_submissions')
      .select('id, status, quoted_price, discount_amount, shipping_cost, cost_of_goods, rep_id, admin_code, store_slug, store_name, account_type, checkout_scope_id, checkout_scope_code, source_portal, source_store, source_admin, source_rep')
      .eq('id', intent.order_id)
      .single();
    if (error || !sub) return json({ error: 'Order not found' }, 404);

    await db.from('zelle_payment_intents').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.userId,
      admin_note: nullableText(payload.note),
      updated_at: new Date().toISOString(),
    }).eq('id', intentId);

    await db.from('patient_submissions').update({
      status: 'paid',
      payment_provider: 'zelle',
      payment_status: 'paid',
      payout_status: 'pending',
      fulfillment_status: 'pending',
      paid_at: new Date().toISOString(),
      payment_release_policy: 'paid_hold',
    }).eq('id', intent.order_id);

    await createCommissionRows(db, sub, intent.discount_cents);
    await audit(db, intent.order_id, intent.id, 'admin', 'zelle_admin_confirmed', { note: payload.note }, admin.userId);
    return json({ ok: true }, 200);
  }

  const statusByAction: Record<string, string> = {
    'admin-reject': 'rejected',
    'admin-needs-info': 'needs_info',
    'admin-expire': 'expired',
  };
  const nextStatus = statusByAction[action];
  if (!nextStatus) return json({ error: 'Unsupported admin action' }, 400);

  await db.from('zelle_payment_intents').update({
    status: nextStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: admin.userId,
    admin_note: nullableText(payload.note),
    updated_at: new Date().toISOString(),
  }).eq('id', intentId);

  await db.from('patient_submissions').update({
    payment_status: nextStatus === 'needs_info' ? 'payment_pending' : 'payment_exception',
  }).eq('id', intent.order_id);

  await audit(db, intent.order_id, intent.id, 'admin', `zelle_${nextStatus}`, { note: payload.note }, admin.userId);
  return json({ ok: true }, 200);
}

async function createCommissionRows(db: DbClient, submission: Record<string, unknown>, zelleDiscountCents: number) {
  const submissionId = String(submission.id);
  const productTotal = Number(submission.quoted_price ?? 0);
  const existingDiscount = Math.min(Number(submission.discount_amount ?? 0), productTotal);
  const zelleDiscount = zelleDiscountCents / 100;
  const shippingCost = Number(submission.shipping_cost ?? 0);
  const cogs = Number(submission.cost_of_goods ?? 0);
  const grossSale = roundMoney(Math.max(0, productTotal - existingDiscount - zelleDiscount) + shippingCost);
  const netProfit = Math.max(0, productTotal - existingDiscount - zelleDiscount - cogs);

  const { data: checkoutScope } = (submission.checkout_scope_id || submission.checkout_scope_code)
    ? await db
      .from('checkout_scopes')
      .select('id, scope_code, display_name, account_type, account_id, parent_account_id, default_commission_rate')
      .or(`id.eq.${submission.checkout_scope_id ?? '00000000-0000-0000-0000-000000000000'},scope_code.eq.${submission.checkout_scope_code ?? ''}`)
      .eq('is_active', true)
      .maybeSingle()
    : { data: null };

  if (checkoutScope && checkoutScope.scope_code !== 'MAIN') {
    return;
  }

  if (submission.rep_id) {
    const { data: rep } = await db
      .from('reps')
      .select('id, rep_name, rep_slug, commission_rate, parent_rep_id, override_percent, platform_percent')
      .eq('id', submission.rep_id)
      .single();
    const rate = Number(rep?.commission_rate ?? 0.2);
    const rows = [{
      submission_id: submissionId,
      rep_id: submission.rep_id as string,
      gross_sale: grossSale,
      margin: netProfit,
      commission_rate: rate,
      commission_amount: roundMoney(netProfit * rate),
      commission_role: 'rep_commission_owner',
      owner_label: rep?.rep_name ?? rep?.rep_slug ?? 'Rep',
      status: 'pending',
    }];
    await upsertCommissionLedger(db, rows);
    await createWalletEntries(db, submission, rows);
  } else {
    await createWalletEntries(db, submission, [{
      submission_id: submissionId,
      rep_id: null,
      gross_sale: grossSale,
      margin: netProfit,
      commission_rate: 1,
      commission_amount: roundMoney(netProfit),
      commission_role: 'platform_margin_owner',
      owner_label: 'PepScriptRX',
      status: 'pending',
    }]);
  }
}

async function requireAdmin(db: DbClient, authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false as const, status: 401, error: 'Admin login required' };
  const { data: userData, error: userError } = await db.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return { ok: false as const, status: 401, error: 'Admin login required' };
  const { data: profile } = await db.from('profiles').select('role').eq('id', userId).single();
  if (profile?.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin role required' };
  return { ok: true as const, userId };
}

async function expireIntent(db: DbClient, intentId: string, orderId: string) {
  await db.from('zelle_payment_intents').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', intentId);
  await db.from('patient_submissions').update({ payment_status: 'payment_exception' }).eq('id', orderId);
}

function classifyMainCheckout(sub: Record<string, unknown>) {
  const scope = String(sub.checkout_scope_code ?? '').trim().toUpperCase();
  const source = String(sub.source_portal ?? '').trim().toLowerCase();
  const hasNonMainScope = Boolean(scope && scope !== 'MAIN');
  const sourceIsRoot = !source || source === 'main' || source === 'pepscriptrx' || source === 'root';
  const debug = {
    source_portal: sub.source_portal ?? null,
    store_slug: sub.store_slug ?? null,
    scope: sub.checkout_scope_code ?? null,
    referral_code: sub.referral_code ?? null,
    has_non_main_scope: hasNonMainScope,
    source_is_root: sourceIsRoot,
  };
  if (hasNonMainScope) return { ok: false as const, reason: `non-main scope ${scope}`, debug };
  if (!sourceIsRoot) return { ok: false as const, reason: `non-root source_portal ${sub.source_portal ?? '(missing)'}`, debug };
  if (sub.store_slug) return { ok: false as const, reason: `store_slug ${sub.store_slug}`, debug };
  if (sub.referral_code) return { ok: false as const, reason: `referral_code ${sub.referral_code}`, debug };
  return { ok: true as const, reason: null, debug };
}

async function audit(db: DbClient, orderId: string, intentId: string, actorType: string, eventType: string, eventPayload: Record<string, unknown>, actorProfileId?: string) {
  await db.from('payment_audit_log').insert({
    order_id: orderId,
    payment_intent_id: intentId,
    actor_profile_id: actorProfileId ?? null,
    actor_type: actorType,
    event_type: eventType,
    event_payload: eventPayload,
  });
}

async function upsertCommissionLedger(db: DbClient, rows: CommissionRow[]) {
  const ledgerRows = rows
    .filter((row) => row.rep_id)
    .map((row) => ({
      submission_id: row.submission_id,
      rep_id: row.rep_id,
      gross_sale: row.gross_sale,
      margin: row.margin,
      commission_rate: row.commission_rate,
      commission_amount: row.commission_amount,
      commission_role: row.commission_role,
      owner_label: row.owner_label,
      status: row.status ?? 'pending',
    }));
  if (ledgerRows.length === 0) return;
  await db.from('commission_ledger').upsert(ledgerRows, { onConflict: 'submission_id,rep_id,commission_role' });
}

async function createWalletEntries(db: DbClient, submission: Record<string, unknown>, rows: CommissionRow[]) {
  for (const row of rows) {
    const amount = roundMoney(Number(row.commission_amount ?? 0));
    if (amount <= 0) continue;
    const target = row.commission_role === 'platform_margin_owner'
      ? { accountType: 'platform', accountId: 'platform', displayName: 'PepScriptRX' }
      : { accountType: 'rep', accountId: String(row.rep_id ?? submission.source_rep ?? 'unassigned'), displayName: row.owner_label };
    const { data: wallet } = await db
      .from('internal_wallets')
      .upsert({
        account_type: target.accountType,
        account_id: target.accountId,
        display_name: target.displayName,
        status: 'active',
      }, { onConflict: 'account_type,account_id' })
      .select('id')
      .single();
    if (!wallet?.id) continue;
    await db.from('wallet_entries').upsert({
      wallet_id: wallet.id,
      order_id: row.submission_id,
      entry_type: row.commission_role === 'platform_margin_owner' ? 'platform_margin' : 'commission',
      amount,
      status: 'pending',
      description: `${row.owner_label} - ${row.commission_role.replace(/_/g, ' ')}`,
    }, { onConflict: 'wallet_id,order_id,entry_type' });
  }
}

function numberEnv(primary: string, fallback: string, defaultValue: number) {
  const raw = Deno.env.get(primary) ?? (fallback ? Deno.env.get(fallback) : undefined);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function nullableText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'payment-proof';
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

type DbClient = ReturnType<typeof createClient>;

type CommissionRow = {
  submission_id: string;
  rep_id: string | null;
  gross_sale?: number;
  margin?: number;
  commission_rate?: number;
  commission_amount: number;
  commission_role: string;
  owner_label: string;
  status?: string;
};
