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
const VENMO_ENABLED = (Deno.env.get('VENMO_ENABLED') ?? Deno.env.get('NEXT_PUBLIC_VENMO_ENABLED') ?? Deno.env.get('VITE_VENMO_ENABLED') ?? 'true').toLowerCase() !== 'false';
const VENMO_DISPLAY_NAME = Deno.env.get('VENMO_DISPLAY_NAME') ?? Deno.env.get('NEXT_PUBLIC_VENMO_DISPLAY_NAME') ?? Deno.env.get('VITE_VENMO_DISPLAY_NAME') ?? 'Vitality Holdings LLC';
const VENMO_HANDLE = Deno.env.get('VENMO_HANDLE') ?? Deno.env.get('NEXT_PUBLIC_VENMO_HANDLE') ?? Deno.env.get('VITE_VENMO_HANDLE') ?? '@PepScriptRX';
const VENMO_TTL_MINUTES = numberEnv('VENMO_INTENT_TTL_MINUTES', '', 1440);
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
      payment_token_present: Boolean(payload.payment_token),
      intent_id: payload.intent_id ?? null,
      env: {
        zelle_enabled: ZELLE_ENABLED,
        display_name_present: Boolean(ZELLE_DISPLAY_NAME),
        recipient_kind: ZELLE_RECIPIENT_KIND,
        recipient_value_present: Boolean(ZELLE_RECIPIENT_VALUE),
        discount_bps: ZELLE_DISCOUNT_BPS,
        low_risk_max_cents: ZELLE_LOW_RISK_MAX_CENTS,
        venmo_enabled: VENMO_ENABLED,
        venmo_display_name_present: Boolean(VENMO_DISPLAY_NAME),
        venmo_handle_present: Boolean(VENMO_HANDLE),
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
  const provider = normalizeProvider(payload.provider);
  const paymentConfig = getManualPaymentConfig(provider);
  if (!paymentConfig.enabled) return json({ error: `${paymentConfig.label} checkout is not enabled` }, 403);
  if (!paymentConfig.displayName) return json({ error: `${paymentConfig.label} recipient name is not configured` }, 503);
  if (!paymentConfig.recipientValue) return json({ error: `${paymentConfig.label} recipient is not configured` }, 503);

  const paymentToken = String(payload.payment_token ?? '');
  if (!paymentToken) return json({ error: 'payment_token required' }, 400);

  const submissionId = await resolveSubmissionIdByToken(db, paymentToken);
  if (!submissionId) return json({ error: 'Payment request not found' }, 404);

  const { data: existing } = await db
    .from('zelle_payment_intents')
    .select('*')
    .eq('order_id', submissionId)
    .eq('payment_provider', provider)
    .in('status', ['pending', 'sent', 'needs_info'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return json({ ok: true, intent: sanitizePublicIntent(existing) }, 200);

  const { data: sub, error } = await db
    .from('patient_submissions')
    .select('id, full_name, email, phone, status, quoted_price, discount_amount, shipping_cost, checkout_scope_code, source_portal, source_route, store_slug, referral_code, payment_status, admin_code, store_name, account_type, attribution_source, source_store, source_admin, source_rep')
    .eq('id', submissionId)
    .single();
  if (error || !sub) return json({ error: 'Payment request not found' }, 404);
  if (sub.status !== 'payment_sent') return json({ error: `Order is not checkout-ready: ${sub.status}` }, 409);
  const attribution = describeCheckoutAttribution(sub);
  console.log('zelle-payment create-intent attribution', {
    order_id: submissionId,
    ...attribution,
  });

  const productTotal = Math.round(Number(sub.quoted_price ?? 0) * 100);
  const existingDiscount = Math.min(Math.round(Number(sub.discount_amount ?? 0) * 100), productTotal);
  const shipping = Math.round(Number(sub.shipping_cost ?? 0) * 100);
  const subtotal = Math.max(0, productTotal - existingDiscount + shipping);
  if (subtotal <= 0) return json({ error: 'Order total is not payable' }, 400);
  if (provider === 'zelle' && subtotal > ZELLE_LOW_RISK_MAX_CENTS) return json({ error: 'Zelle is not available for this order amount' }, 403);

  const discount = Math.min(subtotal, Math.floor((subtotal * paymentConfig.discountBps) / 10000));
  const amountDue = Math.max(0, subtotal - discount);
  const paymentReference = `PSR-${provider.toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + paymentConfig.ttlMinutes * 60 * 1000).toISOString();

  const { data: intent, error: insertError } = await db
    .from('zelle_payment_intents')
    .insert({
      order_id: submissionId,
      payment_provider: provider,
      subtotal_cents: subtotal,
      discount_cents: discount,
      amount_due_cents: amountDue,
      discount_bps: paymentConfig.discountBps,
      recipient_display_name: paymentConfig.displayName,
      recipient_kind: paymentConfig.recipientKind,
      recipient_value: paymentConfig.recipientValue,
      payment_reference: paymentReference,
      expires_at: expiresAt,
      customer_name: nullableText(sub.full_name),
      customer_email: nullableText(sub.email),
      customer_phone: nullableText(sub.phone),
      checkout_scope_code: nullableText(sub.checkout_scope_code),
      source_portal: nullableText(sub.source_portal),
      source_route: nullableText(sub.source_route),
      store_slug: nullableText(sub.store_slug),
      referral_code: nullableText(sub.referral_code),
      admin_code: nullableText(sub.admin_code),
      store_name: nullableText(sub.store_name),
      account_type: nullableText(sub.account_type),
      attribution_source: nullableText(sub.attribution_source),
      source_store: nullableText(sub.source_store),
      source_admin: nullableText(sub.source_admin),
      source_rep: nullableText(sub.source_rep),
    })
    .select('*')
    .single();
  if (insertError || !intent) return json({ error: insertError?.message ?? 'Could not create Zelle intent' }, 500);

  await db
    .from('patient_submissions')
    .update({
      payment_provider: provider,
      payment_status: 'payment_pending',
      subtotal_cents: subtotal,
      discount_cents: discount,
      amount_due_cents: amountDue,
      payment_reference: paymentReference,
      payment_expires_at: expiresAt,
      payment_release_policy: 'released',
    })
    .eq('id', submissionId);

  await audit(db, submissionId, intent.id, 'customer', `${provider}_intent_created`, {
    amount_due_cents: amountDue,
    subtotal_cents: subtotal,
    discount_cents: discount,
    recipient_display_name: paymentConfig.displayName,
    recipient_kind: paymentConfig.recipientKind,
    recipient_value: paymentConfig.recipientValue,
    provider,
    attribution,
  });
  return json({ ok: true, intent: sanitizePublicIntent(intent) }, 200);
}

async function status(db: DbClient, payload: Record<string, unknown>) {
  const provider = normalizeProvider(payload.provider);
  const paymentToken = String(payload.payment_token ?? '');
  const intentId = String(payload.intent_id ?? '');
  let query = db.from('zelle_payment_intents').select('*').order('created_at', { ascending: false }).limit(1);
  if (intentId) {
    const resolved = await resolvePublicIntent(db, payload, '*');
    if (!resolved.ok) return json({ error: resolved.error }, resolved.status);
    return json({ ok: true, intent: sanitizePublicIntent(resolved.intent) }, 200);
  } else if (paymentToken) {
    const submissionId = await resolveSubmissionIdByToken(db, paymentToken);
    if (!submissionId) return json({ ok: true, intent: null }, 200);
    query = query.eq('order_id', submissionId).eq('payment_provider', provider);
  } else return json({ error: 'payment_token or intent_id required' }, 400);

  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, intent: data ? sanitizePublicIntent(data) : null }, 200);
}

async function markSent(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const senderName = String(payload.sender_name ?? '').trim();
  if (!intentId || !senderName) return json({ error: 'intent_id and sender_name required' }, 400);

  const resolved = await resolvePublicIntent(db, payload, 'id, order_id, payment_provider, status, expires_at');
  if (!resolved.ok) return json({ error: resolved.error }, resolved.status);
  const intent = resolved.intent;
  const currentStatus = String(intent.status ?? '');
  if (!['pending', 'needs_info', 'sent'].includes(currentStatus)) return json({ error: `Cannot mark ${currentStatus} intent sent` }, 409);
  if (new Date(String(intent.expires_at ?? '')).getTime() < Date.now()) {
    await expireIntent(db, String(intent.id), String(intent.order_id));
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
    .eq('id', String(intent.id))
    .select('*')
    .single();
  if (error || !updated) return json({ error: error?.message ?? 'Could not mark payment sent' }, 500);
  const provider = normalizeProvider(intent.payment_provider);
  await audit(db, String(intent.order_id), String(intent.id), 'customer', `${provider}_customer_marked_sent`, { sender_name: senderName });
  return json({ ok: true, intent: sanitizePublicIntent(updated) }, 200);
}

async function proofUploadUrl(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const fileName = safeFileName(String(payload.file_name ?? 'payment-proof'));
  const contentType = String(payload.content_type ?? 'application/octet-stream');
  if (!intentId) return json({ error: 'intent_id required' }, 400);

  const resolved = await resolvePublicIntent(db, payload, 'id, order_id');
  if (!resolved.ok) return json({ error: resolved.error }, resolved.status);
  const intent = resolved.intent;

  const filePath = `${intent.order_id}/${intent.id}/${crypto.randomUUID()}-${fileName}`;
  const { data, error } = await db.storage.from(PAYMENT_PROOFS_BUCKET).createSignedUploadUrl(filePath, { upsert: false });
  if (error || !data?.signedUrl) return json({ error: error?.message ?? 'Could not create proof upload URL' }, 500);
  return json({ ok: true, uploadUrl: data.signedUrl, filePath, contentType }, 200);
}

async function proofComplete(db: DbClient, payload: Record<string, unknown>) {
  const intentId = String(payload.intent_id ?? '');
  const filePath = String(payload.file_path ?? '');
  if (!intentId || !filePath) return json({ error: 'intent_id and file_path required' }, 400);
  const resolved = await resolvePublicIntent(db, payload, 'id, order_id, payment_provider, sender_email');
  if (!resolved.ok) return json({ error: resolved.error }, resolved.status);
  const intent = resolved.intent;
  const expectedPrefix = `${intent.order_id}/${intent.id}/`;
  if (!filePath.startsWith(expectedPrefix)) return json({ error: 'Invalid proof upload path' }, 400);
  const provider = normalizeProvider(intent.payment_provider);

  const { error } = await db.from('payment_proofs').insert({
    payment_intent_id: String(intent.id),
    order_id: intent.order_id,
    provider,
    file_path: filePath,
    file_name: nullableText(payload.file_name),
    content_type: nullableText(payload.content_type),
    file_size: nullableInt(payload.file_size),
    uploaded_by_email: intent.sender_email,
  });
  if (error) return json({ error: error.message }, 500);
  await audit(db, String(intent.order_id), String(intent.id), 'customer', `${provider}_proof_uploaded`, { file_path: filePath });
  return json({ ok: true }, 200);
}

async function adminAction(db: DbClient, authHeader: string, payload: Record<string, unknown>, action: string) {
  const admin = await requireAdmin(db, authHeader);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const intentId = String(payload.intent_id ?? '');
  if (!intentId) return json({ error: 'intent_id required' }, 400);
  const { data: intent } = await db.from('zelle_payment_intents').select('*').eq('id', intentId).single();
  if (!intent) return json({ error: 'Payment intent not found' }, 404);
  const provider = normalizeProvider(intent.payment_provider);

  if (action === 'admin-confirm') {
    if (!['sent', 'needs_info', 'pending'].includes(intent.status)) return json({ error: `Cannot confirm ${intent.status} intent` }, 409);
    const { data: sub, error } = await db
      .from('patient_submissions')
      .select('id, status, quoted_price, discount_amount, shipping_cost, cost_of_goods, rep_id, admin_code, store_slug, store_name, account_type, checkout_scope_id, checkout_scope_code, source_portal, source_store, source_admin, source_rep, order_type')
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
      payment_provider: provider,
      payment_status: 'paid',
      payout_status: 'pending',
      fulfillment_status: 'pending',
      paid_at: new Date().toISOString(),
      payment_release_policy: 'released',
    }).eq('id', intent.order_id);

    await createCommissionRows(db, sub, intent.discount_cents);
    await audit(db, intent.order_id, intent.id, 'admin', `${provider}_admin_confirmed`, { note: payload.note }, admin.userId);
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

  await audit(db, intent.order_id, intent.id, 'admin', `${provider}_${nextStatus}`, { note: payload.note }, admin.userId);
  return json({ ok: true }, 200);
}

async function createCommissionRows(db: DbClient, submission: Record<string, unknown>, zelleDiscountCents: number) {
  const orderType = String(submission.order_type ?? 'CUSTOMER_ORDER').toUpperCase();
  if (orderType === 'REP_SAMPLE' || orderType === 'REP_INTERNAL') return;

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
    if (['rep', 'sub_account', 'admin'].includes(String(checkoutScope.account_type)) && checkoutScope.account_id) {
      const { data: scopedRep } = await db
        .from('reps')
        .select('id, rep_name, rep_slug, commission_rate, parent_rep_id, override_percent, platform_percent')
        .ilike('rep_slug', String(checkoutScope.account_id))
        .maybeSingle();
      const { data: parentRep } = scopedRep?.parent_rep_id
        ? await db
          .from('reps')
          .select('id, rep_name, rep_slug')
          .eq('id', scopedRep.parent_rep_id)
          .maybeSingle()
        : { data: null };

      if (scopedRep?.id) {
        const rate = Math.max(0, Math.min(1, Number(scopedRep.commission_rate ?? checkoutScope.default_commission_rate ?? 0)));
        const overrideRate = Math.max(0, Math.min(1, Number(scopedRep.override_percent ?? 0)));
        const platformRate = Math.max(0, Math.min(1, Number(scopedRep.platform_percent ?? Math.max(0, 1 - rate - overrideRate))));
        const rows: CommissionRow[] = [{
          submission_id: submissionId,
          rep_id: scopedRep.id,
          gross_sale: grossSale,
          margin: netProfit,
          commission_rate: rate,
          commission_amount: roundMoney(netProfit * rate),
          commission_role: 'rep_commission_owner',
          owner_label: checkoutScope.display_name ?? scopedRep.rep_name ?? scopedRep.rep_slug ?? checkoutScope.scope_code,
          status: 'pending',
          wallet_account_type: checkoutScope.account_type,
          wallet_account_id: checkoutScope.account_id,
        }];

        if (parentRep?.id && overrideRate > 0) {
          rows.push({
            submission_id: submissionId,
            rep_id: parentRep.id,
            gross_sale: grossSale,
            margin: netProfit,
            commission_rate: overrideRate,
            commission_amount: roundMoney(netProfit * overrideRate),
            commission_role: 'override_owner',
            owner_label: parentRep.rep_name ?? parentRep.rep_slug ?? 'Parent rep',
            status: 'pending',
            wallet_account_type: 'rep',
            wallet_account_id: parentRep.rep_slug ?? parentRep.id,
          });
        }

        if (platformRate > 0) {
          rows.push({
            submission_id: submissionId,
            rep_id: null,
            gross_sale: grossSale,
            margin: netProfit,
            commission_rate: platformRate,
            commission_amount: roundMoney(netProfit * platformRate),
            commission_role: 'platform_margin_owner',
            owner_label: 'PepScriptRX',
            status: 'pending',
          });
        }

        await upsertCommissionLedger(db, rows);
        await createWalletEntries(db, submission, rows);
        return;
      }
    }

    const scopeRate = Math.max(0, Math.min(1, Number(checkoutScope.default_commission_rate ?? 0)));
    const scopeAmount = roundMoney(netProfit * scopeRate);
    const platformAmount = roundMoney(Math.max(0, netProfit - scopeAmount));
    const rows: CommissionRow[] = [];

    if (scopeAmount > 0) {
      rows.push({
        submission_id: submissionId,
        rep_id: null,
        gross_sale: grossSale,
        margin: netProfit,
        commission_rate: scopeRate,
        commission_amount: scopeAmount,
        commission_role: 'scope_commission_owner',
        owner_label: checkoutScope.display_name ?? checkoutScope.scope_code,
        status: 'pending',
        wallet_account_type: checkoutScope.account_type,
        wallet_account_id: checkoutScope.account_id ?? checkoutScope.scope_code,
      });
    }

    if (platformAmount > 0) {
      rows.push({
        submission_id: submissionId,
        rep_id: null,
        gross_sale: grossSale,
        margin: netProfit,
        commission_rate: 1 - scopeRate,
        commission_amount: platformAmount,
        commission_role: 'platform_margin_owner',
        owner_label: 'PepScriptRX',
        status: 'pending',
      });
    }

    await upsertCommissionLedger(db, rows);
    await createWalletEntries(db, submission, rows);
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
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin role required' };
  return { ok: true as const, userId };
}

async function expireIntent(db: DbClient, intentId: string, orderId: string) {
  await db.from('zelle_payment_intents').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', intentId);
  await db.from('patient_submissions').update({ payment_status: 'payment_exception' }).eq('id', orderId);
}

function describeCheckoutAttribution(sub: Record<string, unknown>) {
  const scope = String(sub.checkout_scope_code ?? '').trim().toUpperCase();
  const source = String(sub.source_portal ?? '').trim().toLowerCase();
  const hasNonMainScope = Boolean(scope && scope !== 'MAIN');
  const sourceIsRoot = !source || source === 'main' || source === 'pepscriptrx' || source === 'root';
  return {
    source_portal: sub.source_portal ?? null,
    source_route: sub.source_route ?? null,
    store_slug: sub.store_slug ?? null,
    store_name: sub.store_name ?? null,
    admin_code: sub.admin_code ?? null,
    account_type: sub.account_type ?? null,
    scope: sub.checkout_scope_code ?? null,
    referral_code: sub.referral_code ?? null,
    attribution_source: sub.attribution_source ?? null,
    source_store: sub.source_store ?? null,
    source_admin: sub.source_admin ?? null,
    source_rep: sub.source_rep ?? null,
    has_non_main_scope: hasNonMainScope,
    source_is_root: sourceIsRoot,
  };
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
      : {
        accountType: row.wallet_account_type ?? 'rep',
        accountId: String(row.wallet_account_id ?? row.rep_id ?? submission.source_rep ?? 'unassigned'),
        displayName: row.owner_label,
      };
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

async function resolveSubmissionIdByToken(db: DbClient, paymentToken: string) {
  const token = paymentToken.trim();
  if (!token) return null;
  const { data } = await db
    .from('patient_submissions')
    .select('id')
    .eq('public_payment_token', token)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolvePublicIntent(db: DbClient, payload: Record<string, unknown>, select: string): Promise<PublicIntentResult> {
  const intentId = String(payload.intent_id ?? '').trim();
  const paymentToken = String(payload.payment_token ?? '').trim();
  if (!intentId || !paymentToken) return { ok: false, status: 400, error: 'intent_id and payment_token required' };

  const submissionId = await resolveSubmissionIdByToken(db, paymentToken);
  if (!submissionId) return { ok: false, status: 404, error: 'Payment intent not found' };

  const { data, error } = await db
    .from('zelle_payment_intents')
    .select(select)
    .eq('id', intentId)
    .eq('order_id', submissionId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: 'Payment intent not found' };
  return { ok: true, intent: data as Record<string, unknown> };
}

function sanitizePublicIntent(intent: Record<string, unknown>) {
  return {
    id: intent.id,
    payment_provider: normalizeProvider(intent.payment_provider),
    status: intent.status,
    subtotal_cents: intent.subtotal_cents,
    discount_cents: intent.discount_cents,
    amount_due_cents: intent.amount_due_cents,
    recipient_display_name: intent.recipient_display_name,
    recipient_kind: intent.recipient_kind,
    recipient_value: intent.recipient_value,
    payment_reference: intent.payment_reference,
    expires_at: intent.expires_at,
  };
}

function normalizeProvider(value: unknown): ManualPaymentProvider {
  return String(value ?? '').trim().toLowerCase() === 'venmo' ? 'venmo' : 'zelle';
}

function getManualPaymentConfig(provider: ManualPaymentProvider) {
  if (provider === 'venmo') {
    return {
      label: 'Venmo',
      enabled: VENMO_ENABLED,
      displayName: VENMO_DISPLAY_NAME,
      recipientKind: 'handle',
      recipientValue: VENMO_HANDLE,
      discountBps: 0,
      ttlMinutes: VENMO_TTL_MINUTES,
    };
  }

  return {
    label: 'Zelle',
    enabled: ZELLE_ENABLED,
    displayName: ZELLE_DISPLAY_NAME,
    recipientKind: ZELLE_RECIPIENT_KIND,
    recipientValue: ZELLE_RECIPIENT_VALUE,
    discountBps: ZELLE_DISCOUNT_BPS,
    ttlMinutes: ZELLE_TTL_MINUTES,
  };
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

type ManualPaymentProvider = 'zelle' | 'venmo';

type PublicIntentResult =
  | { ok: true; intent: Record<string, unknown> }
  | { ok: false; status: number; error: string };

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
  wallet_account_type?: string | null;
  wallet_account_id?: string | null;
};
