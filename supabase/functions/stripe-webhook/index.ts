import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { finalizeVerifiedPaidOrder, recordManualReconciliation } from '../_shared/order-finalizer.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET must be set in Supabase Edge Function secrets.');

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
  wallet_account_type?: string;
  wallet_account_id?: string | null;
};

type WalletSubmission = {
  id: string;
  rep_id?: string | null;
  admin_code?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  account_type?: string | null;
  source_portal?: string | null;
  source_store?: string | null;
  source_admin?: string | null;
  source_rep?: string | null;
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  const verified = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!verified) return new Response('Invalid Stripe signature', { status: 400 });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const type = String(event.type ?? '');
  const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};

  try {
    if (type === 'checkout.session.completed') {
      await handleCheckoutCompleted(db, object, event);
    } else if (type === 'checkout.session.async_payment_succeeded') {
      await handleCheckoutCompleted(db, object, event);
    } else if (type === 'checkout.session.async_payment_failed') {
      await handleAsyncPaymentFailed(db, object, event);
    } else if (type === 'checkout.session.expired') {
      await handleCheckoutExpired(db, object, event);
    } else if (type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(db, object, event);
    } else if (['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'payment_intent.canceled'].includes(type)) {
      await handleReconciliationEvent(db, type, object, event);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe webhook failed', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function handleCheckoutCompleted(db: DbClient, session: Record<string, unknown>, event: Record<string, unknown>) {
  const sessionId = String(session.id ?? '');
  const paymentIntentId = String(session.payment_intent ?? '');
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const orderId = String(metadata.order_id ?? session.client_reference_id ?? '');
  const paymentToken = String(metadata.payment_token ?? '');
  const amountTotal = Number(session.amount_total ?? 0);
  const currency = String(session.currency ?? '').toUpperCase();

  if (!sessionId || !orderId) throw new Error('Stripe session missing order metadata');

  let query = db
    .from('patient_submissions')
    .select('id, status, quoted_price, discount_amount, shipping_cost, cost_of_goods, rep_id, admin_code, store_slug, store_name, account_type, checkout_scope_id, checkout_scope_code, source_portal, source_store, source_admin, source_rep, order_type, payment_status')
    .eq('id', orderId);
  if (paymentToken) query = query.eq('public_payment_token', paymentToken);
  const { data: submission, error: subError } = await query.single();

  if (subError || !submission) throw new Error('Submission not found for Stripe session');
  const alreadyPaid = submission.status === 'paid' || submission.status === 'fulfilled' || submission.payment_status === 'paid';
  if (!alreadyPaid && submission.status !== 'payment_sent') throw new Error(`Submission is not payable: ${submission.status}`);

  if (String(session.payment_status ?? '') !== 'paid') {
    await db.from('patient_submissions').update({
      payment_provider: 'stripe',
      payment_status: 'payment_pending',
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId || null,
      stripe_payment_status: String(session.payment_status ?? 'unpaid'),
      payment_reference: sessionId,
    }).eq('id', submission.id).eq('status', 'payment_sent');
    await audit(db, submission.id, 'stripe_checkout_payment_pending', {
      stripe_event_id: event.id,
      stripe_checkout_session_id: sessionId,
      payment_status: session.payment_status ?? null,
    });
    return;
  }

  const productTotal = Number(submission.quoted_price ?? 0);
  const discountAmt = Math.min(Number(submission.discount_amount ?? 0), productTotal);
  const shippingCost = Number(submission.shipping_cost ?? 0);
  const expectedCents = cents(Math.max(0, productTotal - discountAmt) + shippingCost);
  if (currency !== 'USD' || amountTotal !== expectedCents) {
    await db.from('patient_submissions').update({
      payment_provider: 'stripe',
      payment_status: 'payment_exception',
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId || null,
      stripe_payment_status: String(session.payment_status ?? 'amount_mismatch'),
      payment_reference: sessionId,
    }).eq('id', submission.id);
    await audit(db, submission.id, 'stripe_amount_mismatch', {
      event,
      expected: { amount_cents: expectedCents, currency: 'USD' },
      received: { amount_cents: amountTotal, currency },
    });
    throw new Error('Stripe payment amount does not match expected order total');
  }

  const result = await finalizeVerifiedPaidOrder(db, {
    provider: 'stripe',
    providerEventId: String(event.id ?? sessionId),
    providerOrderReference: sessionId,
    providerTransactionReference: paymentIntentId || sessionId,
    orderId: String(submission.id),
    amountCents: amountTotal,
    currency,
    paidAt: new Date(Number(event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    eventPayload: {
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId || null,
    },
    notificationEndpoint: { supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_KEY },
  });
  if (!['finalized', 'already_finalized'].includes(result.result)) {
    throw new Error(`Stripe payment finalization failed closed: ${result.result}`);
  }
}

async function handleReconciliationEvent(
  db: DbClient,
  eventType: string,
  object: Record<string, unknown>,
  event: Record<string, unknown>,
) {
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const paymentIntent = String(object.payment_intent ?? object.id ?? '');
  const orderId = String(metadata.order_id ?? '');
  let submission: Record<string, unknown> | null = null;
  if (orderId) {
    const result = await db.from('patient_submissions').select('id,quoted_price,discount_amount,shipping_cost').eq('id', orderId).maybeSingle();
    submission = result.data;
  } else if (paymentIntent) {
    const result = await db.from('patient_submissions').select('id,quoted_price,discount_amount,shipping_cost').eq('stripe_payment_intent_id', paymentIntent).maybeSingle();
    submission = result.data;
  }
  if (!submission) return;
  const expected = cents(Math.max(0, Number(submission.quoted_price ?? 0) - Number(submission.discount_amount ?? 0)) + Number(submission.shipping_cost ?? 0));
  const amount = Number(object.amount_refunded ?? object.amount ?? 0);
  const mapped = eventType === 'charge.refunded'
    ? (amount > 0 && amount < expected ? 'partial_refund' : 'refund')
    : eventType.includes('dispute') ? 'dispute' : 'void';
  await recordManualReconciliation(db, {
    provider: 'stripe',
    providerEventId: String(event.id ?? crypto.randomUUID()),
    providerTransactionReference: paymentIntent,
    orderId: String(submission.id),
    eventType: mapped,
    originalAmountCents: expected,
    eventAmountCents: amount,
    currency: String(object.currency ?? 'USD').toUpperCase(),
    occurredAt: new Date(Number(event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    privateDetails: { stripe_event_type: eventType },
  });
}

async function handleCheckoutExpired(db: DbClient, session: Record<string, unknown>, event: Record<string, unknown>) {
  const sessionId = String(session.id ?? '');
  if (!sessionId) return;
  const { data: submission } = await db
    .from('patient_submissions')
    .select('id, status, payment_status')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  if (!submission || submission.status !== 'payment_sent' || submission.payment_status === 'paid') return;
  await db.from('patient_submissions').update({
    payment_status: 'unpaid',
    stripe_payment_status: 'expired',
  }).eq('id', submission.id);
  await audit(db, submission.id, 'stripe_checkout_expired', event);
}

async function handlePaymentFailed(db: DbClient, paymentIntent: Record<string, unknown>, event: Record<string, unknown>) {
  const paymentIntentId = String(paymentIntent.id ?? '');
  if (!paymentIntentId) return;
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  const orderId = String(metadata.order_id ?? '');
  let { data: submission } = await db
    .from('patient_submissions')
    .select('id, status, payment_status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (!submission && orderId) {
    const result = await db
      .from('patient_submissions')
      .select('id, status, payment_status')
      .eq('id', orderId)
      .maybeSingle();
    submission = result.data;
  }
  if (!submission || submission.payment_status === 'paid') return;
  await db.from('patient_submissions').update({
    payment_provider: 'stripe',
    payment_status: 'failed',
    stripe_payment_intent_id: paymentIntentId,
    stripe_payment_status: String(paymentIntent.status ?? 'failed'),
  }).eq('id', submission.id);
  await audit(db, submission.id, 'stripe_payment_failed', event);
}

async function handleAsyncPaymentFailed(db: DbClient, session: Record<string, unknown>, event: Record<string, unknown>) {
  const sessionId = String(session.id ?? '');
  if (!sessionId) return;
  const { data: submission } = await db
    .from('patient_submissions')
    .select('id, payment_status')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  if (!submission || submission.payment_status === 'paid') return;
  await db.from('patient_submissions').update({
    payment_provider: 'stripe',
    payment_status: 'failed',
    stripe_payment_status: String(session.payment_status ?? 'unpaid'),
  }).eq('id', submission.id);
  await audit(db, submission.id, 'stripe_async_payment_failed', event);
}

export async function createCommissionsAndWalletEntries(db: DbClient, submission: Record<string, unknown>) {
  const productTotal = Number(submission.quoted_price ?? 0);
  const discountAmt = Math.min(Number(submission.discount_amount ?? 0), productTotal);
  const shippingCost = Number(submission.shipping_cost ?? 0);
  const cogs = Number(submission.cost_of_goods ?? 0);
  const grossSale = Math.max(0, productTotal - discountAmt) + shippingCost;
  const netProfit = Math.max(0, productTotal - discountAmt - cogs);
  const orderType = String(submission.order_type ?? 'CUSTOMER_ORDER').toUpperCase();
  if (orderType === 'REP_SAMPLE' || orderType === 'REP_INTERNAL') return;

  const { data: checkoutScope } = submission.checkout_scope_id || submission.checkout_scope_code
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
        ? await db.from('reps').select('id, rep_name, rep_slug').eq('id', scopedRep.parent_rep_id).maybeSingle()
        : { data: null };
      if (scopedRep?.id) {
        const rate = clampRate(Number(scopedRep.commission_rate ?? checkoutScope.default_commission_rate ?? 0));
        const overrideRate = clampRate(Number(scopedRep.override_percent ?? 0));
        const platformRate = clampRate(Number(scopedRep.platform_percent ?? Math.max(0, 1 - rate - overrideRate)));
        const rows: CommissionRow[] = [{
          submission_id: String(submission.id),
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
            submission_id: String(submission.id),
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
            submission_id: String(submission.id),
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
        await createWalletEntries(db, submission as WalletSubmission, rows);
        return;
      }
    }

    const scopeRate = clampRate(Number(checkoutScope.default_commission_rate ?? 0));
    const scopeAmount = roundMoney(netProfit * scopeRate);
    const platformAmount = roundMoney(Math.max(0, netProfit - scopeAmount));
    const rows: CommissionRow[] = [];
    if (scopeAmount > 0) {
      rows.push({
        submission_id: String(submission.id),
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
        submission_id: String(submission.id),
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
    await createWalletEntries(db, submission as WalletSubmission, rows);
    return;
  }

  if (submission.rep_id) {
    const { data: rep } = await db
      .from('reps')
      .select('id, rep_name, rep_slug, commission_rate, parent_rep_id, override_percent, platform_percent')
      .eq('id', submission.rep_id)
      .single();
    const { data: parentRep } = rep?.parent_rep_id
      ? await db.from('reps').select('id, rep_name, rep_slug').eq('id', rep.parent_rep_id).maybeSingle()
      : { data: null };
    const rate = clampRate(Number(rep?.commission_rate ?? 0.2));
    const overrideRate = clampRate(Number(rep?.override_percent ?? 0));
    const platformRate = clampRate(Number(rep?.platform_percent ?? Math.max(0, 1 - rate - overrideRate)));
    const rows: CommissionRow[] = [{
      submission_id: String(submission.id),
      rep_id: String(submission.rep_id),
      gross_sale: grossSale,
      margin: netProfit,
      commission_rate: rate,
      commission_amount: roundMoney(netProfit * rate),
      commission_role: 'rep_commission_owner',
      owner_label: rep?.rep_name ?? rep?.rep_slug ?? 'Rep',
      status: 'pending',
    }];
    if (parentRep?.id && overrideRate > 0) {
      rows.push({
        submission_id: String(submission.id),
        rep_id: parentRep.id,
        gross_sale: grossSale,
        margin: netProfit,
        commission_rate: overrideRate,
        commission_amount: roundMoney(netProfit * overrideRate),
        commission_role: 'override_owner',
        owner_label: parentRep.rep_name ?? parentRep.rep_slug ?? 'Parent rep',
        status: 'pending',
      });
    }
    if (platformRate > 0) {
      rows.push({
        submission_id: String(submission.id),
        rep_id: String(submission.rep_id),
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
    await createWalletEntries(db, submission as WalletSubmission, rows);
    return;
  }

  await createWalletEntries(db, submission as WalletSubmission, [{
    submission_id: String(submission.id),
    rep_id: null,
    gross_sale: grossSale,
    margin: netProfit,
    commission_rate: 1,
    commission_amount: netProfit,
    commission_role: 'platform_margin_owner',
    owner_label: 'PepScriptRX',
    status: 'pending',
  }]);
}

async function upsertCommissionLedger(db: DbClient, rows: CommissionRow[]) {
  const ledgerRows = [];
  for (const row of rows) {
    const resolved = await resolveLedgerOwner(db, row);
    if (!resolved.rep_id) continue;
    ledgerRows.push({
      submission_id: row.submission_id,
      rep_id: resolved.rep_id,
      gross_sale: row.gross_sale,
      margin: row.margin,
      commission_rate: row.commission_rate,
      commission_amount: row.commission_amount,
      commission_role: resolved.commission_role,
      owner_label: row.owner_label,
      status: row.status ?? 'pending',
    });
  }
  if (ledgerRows.length === 0) return;
  const { error } = await db.from('commission_ledger').upsert(ledgerRows, { onConflict: 'submission_id,rep_id,commission_role' });
  if (error) console.error('Could not upsert commission ledger', error);
}

async function resolveLedgerOwner(db: DbClient, row: CommissionRow) {
  if (row.rep_id || row.commission_role !== 'scope_commission_owner') {
    return { rep_id: row.rep_id, commission_role: row.commission_role };
  }

  const ownerSlug = String(row.wallet_account_id ?? row.owner_label ?? '').trim();
  if (!ownerSlug) return { rep_id: null, commission_role: row.commission_role };

  const { data: rep } = await db
    .from('reps')
    .select('id')
    .ilike('rep_slug', ownerSlug)
    .maybeSingle();

  return {
    rep_id: (rep as { id?: string } | null)?.id ?? null,
    commission_role: (rep as { id?: string } | null)?.id ? 'rep_commission_owner' : row.commission_role,
  };
}

async function createWalletEntries(db: DbClient, submission: WalletSubmission, rows: CommissionRow[]) {
  for (const row of rows) {
    const amount = roundMoney(Number(row.commission_amount ?? 0));
    if (amount <= 0) continue;
    const walletTarget = walletTargetForRow(submission, row);
    await upsertWalletEntry(db, {
      ...walletTarget,
      orderId: row.submission_id,
      entryType: entryTypeForRole(row.commission_role),
      amount,
      description: `${row.owner_label} - ${row.commission_role.replace(/_/g, ' ')}`,
    });
  }
}

function walletTargetForRow(submission: WalletSubmission, row: CommissionRow) {
  if (row.commission_role === 'platform_margin_owner') {
    return { accountType: 'platform', accountId: 'platform', displayName: 'PepScriptRX' };
  }
  if (row.wallet_account_type && row.wallet_account_id) {
    return { accountType: row.wallet_account_type, accountId: row.wallet_account_id, displayName: row.owner_label || row.wallet_account_id };
  }
  const isAdminStoreOwner = row.commission_role === 'rep_commission_owner'
    && String(submission.account_type ?? '').toLowerCase() === 'admin'
    && Boolean(submission.admin_code);
  if (isAdminStoreOwner) {
    return {
      accountType: 'admin',
      accountId: String(submission.admin_code),
      displayName: submission.store_name || submission.source_portal || String(submission.admin_code),
    };
  }
  return {
    accountType: 'rep',
    accountId: row.rep_id || submission.source_rep || 'unassigned',
    displayName: row.owner_label || submission.source_portal || 'Rep',
  };
}

function entryTypeForRole(role: string) {
  if (role === 'override_owner') return 'override';
  if (role === 'platform_margin_owner') return 'platform_margin';
  return 'commission';
}

async function upsertWalletEntry(
  db: DbClient,
  input: { accountType: string; accountId: string; displayName: string; orderId: string; entryType: string; amount: number; description: string },
) {
  const { error } = await db
    .from('wallet_entries')
    .upsert({
      account_type: input.accountType,
      account_id: input.accountId,
      display_name: input.displayName,
      order_id: input.orderId,
      entry_type: input.entryType,
      amount: input.amount,
      description: input.description,
      status: 'pending',
    }, { onConflict: 'account_type,account_id,order_id,entry_type' });
  if (error) console.error('Could not upsert wallet entry', error);
}

export async function notifyPartnerSale(orderId: string, paymentProvider: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-partner-sale`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId, payment_provider: paymentProvider }),
    });
    if (!res.ok) console.error('Partner sale notification failed', await res.text());
  } catch (error) {
    console.error('Partner sale notification error', error);
  }
}

async function audit(db: DbClient, orderId: string, eventType: string, payload: unknown) {
  await db.from('payment_audit_log').insert({
    order_id: orderId,
    actor_type: 'system',
    event_type: eventType,
    event_payload: payload as Record<string, unknown>,
  });
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=');
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] ?? []), value];
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > 300) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function clampRate(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
