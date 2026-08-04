import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BRIDGE_STATUSES, constantTimeEqual, hmac, safeJson, sha256 } from '../_shared/woocommerce-bridge.ts';
import { finalizeVerifiedPaidOrder, recordManualReconciliation } from '../_shared/order-finalizer.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CALLBACK_SECRET = Deno.env.get('WOOCOMMERCE_CALLBACK_SECRET') ?? '';
const EXPECTED_KEY_ID = Deno.env.get('WOOCOMMERCE_BRIDGE_KEY_ID') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') return safeJson({ error: 'Method not allowed' }, 405);
  const raw = await req.text();
  const keyId = req.headers.get('x-psrx-key-id') ?? '';
  const supplied = req.headers.get('x-psrx-signature') ?? '';
  if (!CALLBACK_SECRET || keyId !== EXPECTED_KEY_ID || !supplied) return safeJson({ error: 'Unauthorized' }, 401);
  const expected = await hmac(CALLBACK_SECRET, raw);
  if (!constantTimeEqual(expected, supplied.toLowerCase())) return safeJson({ error: 'Unauthorized' }, 401);

  let event: Record<string, unknown>;
  try { event = JSON.parse(raw); } catch { return safeJson({ error: 'Invalid JSON' }, 400); }
  const timestamp = Number(event.timestamp ?? 0);
  const eventId = String(event.event_id ?? '');
  const sessionToken = String(event.session_token ?? '');
  const status = String(event.status ?? '');
  const normalizedStatus = status === 'chargeback' ? 'disputed' : status;
  const amountCents = Number(event.amount_cents ?? 0);
  const capturedTotalCents = Number(event.captured_total_cents ?? -1);
  const processingFeeCents = Number(event.processing_fee_cents ?? -1);
  const processingFeeCount = Number(event.processing_fee_count ?? -1);
  const preFeeAmountCents = Number(event.pre_fee_amount_cents ?? -1);
  const cartFingerprint = String(event.cart_fingerprint ?? '');
  const currency = String(event.currency ?? '').toUpperCase();
  const wooOrderId = Number(event.woo_order_id ?? 0);
  const wooStatus = String(event.woo_status ?? '');
  const wooIsPaid = event.woo_is_paid === true;
  const paymentMethod = String(event.payment_method ?? '');
  if (!eventId || !sessionToken || !BRIDGE_STATUSES.has(status) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return safeJson({ error: 'Invalid event' }, 400);
  }

  const db = createClient(URL, KEY);
  const tokenHash = await sha256(sessionToken);
  const { data: session } = await db.from('woocommerce_payment_sessions')
    .select('id,submission_id,status,expected_amount_cents,shipping_total_cents,tax_total_cents,pre_fee_amount_cents,expected_processing_fee_cents,expected_captured_total_cents,cart_fingerprint,currency,last_event_id,expires_at,consumed_at,woo_order_id')
    .eq('session_token_hash', tokenHash).maybeSingle();
  if (!session) return safeJson({ error: 'Unknown session' }, 404);
  if (session.last_event_id === eventId) return safeJson({ received: true, duplicate: true }, 200);
  const sessionExpiresAt = new Date(session.expires_at).getTime();
  if (status === 'paid' && session.status !== 'paid'
    && (!Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now())) {
    await db.from('woocommerce_payment_sessions').update({
      status: 'reconciliation_required', reconciliation_required: true,
      error_category: 'expired_paid_callback', last_event_id: eventId,
      last_event_at: new Date(timestamp * 1000).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    return safeJson({ error: 'Expired checkout requires reconciliation' }, 410);
  }
  const feeContractMatches = [amountCents, capturedTotalCents, processingFeeCents, processingFeeCount, preFeeAmountCents]
    .every(Number.isSafeInteger)
    && processingFeeCount === 1
    && preFeeAmountCents === Number(session.pre_fee_amount_cents)
    && processingFeeCents === Number(session.expected_processing_fee_cents)
    && capturedTotalCents === Number(session.expected_captured_total_cents)
    && amountCents === capturedTotalCents
    && cartFingerprint.length === 64
    && cartFingerprint === session.cart_fingerprint;
  if (currency !== session.currency || amountCents !== session.expected_amount_cents || !feeContractMatches) {
    await db.from('woocommerce_payment_sessions').update({
      status: 'reconciliation_required', reconciliation_required: true,
      error_category: currency !== session.currency || amountCents !== session.expected_amount_cents
        ? 'amount_or_currency_mismatch'
        : 'fee_or_cart_contract_mismatch',
      last_event_id: eventId,
      last_event_at: new Date(timestamp * 1000).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    return safeJson({ error: 'Checkout contract mismatch' }, 409);
  }

  if (!wooOrderId || (session.woo_order_id && Number(session.woo_order_id) !== wooOrderId)) {
    await db.from('woocommerce_payment_sessions').update({
      status: 'reconciliation_required', reconciliation_required: true,
      error_category: 'woocommerce_order_mismatch', updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    return safeJson({ error: 'Order mismatch' }, 409);
  }

  if (status === 'paid') {
    if (!wooIsPaid || !['processing', 'completed'].includes(wooStatus) || !paymentMethod) {
      await db.from('woocommerce_payment_sessions').update({
        status: 'reconciliation_required', reconciliation_required: true,
        error_category: 'ambiguous_woocommerce_paid_state', updated_at: new Date().toISOString(),
      }).eq('id', session.id);
      return safeJson({ error: 'Ambiguous paid state' }, 409);
    }
    const finalized = await finalizeVerifiedPaidOrder(db, {
      provider: 'woocommerce',
      providerEventId: eventId,
      providerOrderReference: String(wooOrderId),
      providerTransactionReference: String(event.processor_reference ?? `wc-${wooOrderId}`),
      orderId: String(session.submission_id),
      amountCents,
      currency,
      paidAt: String(event.paid_at ?? new Date().toISOString()),
      eventPayload: { woo_order_id: wooOrderId, woo_status: wooStatus, payment_method: paymentMethod.slice(0, 100) },
      notificationEndpoint: { supabaseUrl: URL, serviceRoleKey: KEY },
    });
    if (!['finalized', 'already_finalized'].includes(finalized.result)) {
      await db.from('woocommerce_payment_sessions').update({
        status: 'reconciliation_required', reconciliation_required: true,
        error_category: finalized.result, updated_at: new Date().toISOString(),
      }).eq('id', session.id);
      return safeJson({ error: 'Finalization failed closed', result: finalized.result }, 409);
    }
    await db.from('woocommerce_payment_sessions').update({
      status: 'paid', woo_order_id: wooOrderId,
      processor_reference: String(event.processor_reference ?? '').slice(0, 200) || null,
      verified_callback_at: new Date().toISOString(), consumed_at: session.consumed_at ?? new Date().toISOString(),
      last_event_id: eventId, last_event_at: new Date(timestamp * 1000).toISOString(),
      reconciliation_required: false, error_category: null, updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    return safeJson({ received: true, finalization: finalized.result }, 200);
  }

  if (['refunded','partially_refunded','voided','disputed','chargeback'].includes(status)) {
    const suppliedBreakdown = event.reversal_breakdown && typeof event.reversal_breakdown === 'object'
      ? event.reversal_breakdown as Record<string, unknown>
      : {};
    const reversalBreakdown = {
      merchandise_refunded_cents: Number(suppliedBreakdown.merchandise_refunded_cents ?? 0),
      shipping_tax_refunded_cents: Number(suppliedBreakdown.shipping_tax_refunded_cents ?? 0),
      processing_fee_refunded_cents: Number(suppliedBreakdown.processing_fee_refunded_cents ?? 0),
    };
    const reversedAmountCents = Number(event.reversed_amount_cents ?? amountCents);
    const refundBreakdownTotal = Object.values(reversalBreakdown).reduce((sum, value) => sum + value, 0);
    const validReversal = Object.values(reversalBreakdown).every((value) => Number.isSafeInteger(value) && value >= 0)
      && Number.isSafeInteger(reversedAmountCents)
      && reversedAmountCents > 0
      && reversedAmountCents <= capturedTotalCents
      && reversalBreakdown.processing_fee_refunded_cents <= Number(session.expected_processing_fee_cents)
      && reversalBreakdown.shipping_tax_refunded_cents <= Number(session.shipping_total_cents) + Number(session.tax_total_cents)
      && reversalBreakdown.merchandise_refunded_cents
        <= Number(session.pre_fee_amount_cents) - Number(session.shipping_total_cents) - Number(session.tax_total_cents)
      && (!['refunded','partially_refunded'].includes(status) || refundBreakdownTotal === reversedAmountCents);
    if (!validReversal) {
      await db.from('woocommerce_payment_sessions').update({
        status: 'reconciliation_required', reconciliation_required: true,
        error_category: 'invalid_reversal_breakdown', last_event_id: eventId,
        last_event_at: new Date(timestamp * 1000).toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', session.id);
      return safeJson({ error: 'Invalid reversal breakdown' }, 409);
    }
    await recordManualReconciliation(db, {
      provider: 'woocommerce', providerEventId: eventId,
      providerTransactionReference: String(event.processor_reference ?? `wc-${wooOrderId}`),
      orderId: String(session.submission_id), eventType: status,
      originalAmountCents: Number(session.expected_amount_cents), eventAmountCents: reversedAmountCents,
      currency, occurredAt: new Date(timestamp * 1000).toISOString(),
      privateDetails: {
        woo_order_id: wooOrderId,
        woo_status: wooStatus,
        payment_method: paymentMethod.slice(0, 100),
        captured_total_cents: capturedTotalCents,
        processing_fee_cents: processingFeeCents,
        ...reversalBreakdown,
      },
    });
  }

  const terminal = ['refunded','partially_refunded','voided','disputed'];
  const lateAfterPaid = session.status === 'paid' && !terminal.includes(normalizedStatus);
  const nextStatus = lateAfterPaid
    ? 'paid'
    : terminal.includes(session.status) && session.status !== normalizedStatus
      ? 'reconciliation_required'
      : normalizedStatus;
  await db.from('woocommerce_payment_sessions').update({
    status: nextStatus,
    woo_order_id: Number(event.woo_order_id) || null,
    processor_reference: String(event.processor_reference ?? '').slice(0, 200) || null,
    verified_callback_at: new Date().toISOString(),
    consumed_at: session.consumed_at ?? new Date().toISOString(),
    last_event_id: eventId,
    last_event_at: new Date(timestamp * 1000).toISOString(),
    reconciliation_required: lateAfterPaid || nextStatus === 'reconciliation_required' || terminal.includes(normalizedStatus),
    error_category: lateAfterPaid || nextStatus === 'reconciliation_required' ? 'out_of_order_event' : null,
    updated_at: new Date().toISOString(),
  }).eq('id', session.id);

  await db.from('payment_audit_log').insert({
    order_id: session.submission_id,
    actor_type: 'system',
    event_type: `woocommerce_${status}`,
    event_payload: {
      bridge_event_id: eventId,
      woo_order_id: Number(event.woo_order_id) || null,
      amount_cents: amountCents,
      currency,
      finalization: 'not_applicable',
    },
  });
  return safeJson({ received: true }, 200);
});
