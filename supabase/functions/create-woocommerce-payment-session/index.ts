import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { amountDueCents, hmac, randomToken, safeJson, sanitizeToken, sha256 } from '../_shared/woocommerce-bridge.ts';
import {
  checkoutFingerprint, PROCESSING_FEE_BASIS_POINTS, PROCESSING_FEE_RULE,
  processingFeeCents, structuredCheckoutItems,
} from '../_shared/woocommerce-contract.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ENABLED = (Deno.env.get('WOOCOMMERCE_BRIDGE_ENABLED') ?? 'false').toLowerCase() === 'true';
const BRIDGE_URL = (Deno.env.get('WOOCOMMERCE_BRIDGE_URL') ?? '').replace(/\/+$/, '');
const SECRET = Deno.env.get('WOOCOMMERCE_BRIDGE_SECRET') ?? '';
const KEY_ID = Deno.env.get('WOOCOMMERCE_BRIDGE_KEY_ID') ?? '';
const CALLBACK_URL = Deno.env.get('WOOCOMMERCE_CALLBACK_URL') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://pepscriptrx.com').replace(/\/+$/, '');
const ALLOWED_ORIGINS = (Deno.env.get('WOOCOMMERCE_ALLOWED_ORIGINS') ?? 'https://pepscriptrx.com,https://pepscriptrx.vercel.app')
  .split(',').map((value) => value.trim()).filter(Boolean);
const ALLOWED_STORE_SCOPES = (Deno.env.get('WOOCOMMERCE_ALLOWED_STORE_SCOPES') ?? '')
  .split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) return safeJson({ error: 'Origin not allowed' }, 403);
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Max-Age': '600',
    } });
  }
  if (req.method !== 'POST') return safeJson({ error: 'Method not allowed' }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return safeJson({ error: 'Origin not allowed' }, 403);
  if (!ENABLED) return safeJson({ error: 'Card checkout is not currently available', code: 'bridge_disabled' }, 503, origin);
  if (!BRIDGE_URL || !SECRET || !KEY_ID || !CALLBACK_URL) return safeJson({ error: 'Card checkout is not configured' }, 503, origin);

  try {
    const paymentToken = sanitizeToken((await req.json()).payment_token);
    if (!paymentToken) return safeJson({ error: 'Invalid payment token' }, 400, origin);
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: order } = await db.from('patient_submissions')
      .select('id,public_payment_token,order_number,medication,order_items,status,payment_status,quoted_price,discount_amount,discount_code,shipping_cost,shipping_speed,full_name,email,phone,shipping_address,shipping_city,shipping_state,shipping_zip,checkout_scope_code,source_portal,source_store,store_slug,store_name,referral_code,rep_id,source_rep,parent_admin_id')
      .eq('public_payment_token', paymentToken).single();
    if (!order) return safeJson({ error: 'Payment order not found' }, 404, origin);
    if (order.status !== 'payment_sent' || order.payment_status === 'paid') {
      return safeJson({ error: order.payment_status === 'paid' ? 'This order is already paid' : 'Order is not checkout-ready' }, 409, origin);
    }
    const pricedOrder = order;
    const orderScopes = [pricedOrder.checkout_scope_code, pricedOrder.source_portal, pricedOrder.source_store, pricedOrder.store_slug]
      .map((value) => String(value ?? '').trim().toUpperCase()).filter(Boolean);
    if (ALLOWED_STORE_SCOPES.length === 0) {
      return safeJson({ error: 'Card checkout is not configured for a pilot storefront', code: 'store_scope_not_configured' }, 503, origin);
    }
    if (!orderScopes.some((value) => ALLOWED_STORE_SCOPES.includes(value))) {
      return safeJson({ error: 'Card checkout is not available for this storefront', code: 'store_scope_not_allowed' }, 403, origin);
    }
    const discountTotalCents = Math.round(Math.max(0, Number(pricedOrder.discount_amount ?? 0)) * 100);
    const items = structuredCheckoutItems(pricedOrder.order_items, discountTotalCents);
    const merchandiseSubtotalCents = items.reduce((sum, item) => sum + item.line_subtotal_cents, 0);
    if (merchandiseSubtotalCents !== Math.round(Math.max(0, Number(pricedOrder.quoted_price ?? 0)) * 100)) {
      return safeJson({ error: 'Order pricing requires review', code: 'authoritative_cart_mismatch' }, 409, origin);
    }
    const shippingTotalCents = Math.round(Math.max(0, Number(pricedOrder.shipping_cost ?? 0)) * 100);
    const taxTotalCents = 0; // No server-authoritative PepScriptRX tax field exists; fail closed instead of estimating.
    const preFeeAmountCents = amountDueCents(pricedOrder) + taxTotalCents;
    const expectedProcessingFeeCents = processingFeeCents(preFeeAmountCents);
    const expectedCapturedTotalCents = preFeeAmountCents + expectedProcessingFeeCents;
    if (expectedCapturedTotalCents < 1500 || expectedCapturedTotalCents > 140000) {
      return safeJson({ error: expectedCapturedTotalCents < 1500 ? 'The minimum card payment is $15.00' : 'The maximum card payment is $1,400.00', code: 'amount_out_of_range' }, 422, origin);
    }

    const cartBinding = {
      order_id: pricedOrder.id, items, merchandise_subtotal_cents: merchandiseSubtotalCents,
      discount_total_cents: discountTotalCents, shipping_total_cents: shippingTotalCents,
      tax_total_cents: taxTotalCents, pre_fee_amount_cents: preFeeAmountCents,
      processing_fee_rule: PROCESSING_FEE_RULE, currency: 'USD',
    };
    const cartFingerprint = await checkoutFingerprint(cartBinding);
    const idempotencyKey = await sha256(`woocommerce:${pricedOrder.id}:${cartFingerprint}`);
    const { data: existing } = await db.from('woocommerce_payment_sessions')
      .select('id,status,expires_at').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing && new Date(existing.expires_at).getTime() > Date.now() && !['failed','declined','cancelled','expired'].includes(existing.status)) {
      return safeJson({ error: 'A card checkout is already active. Return to the payment page and try again if it expires.', code: 'session_active' }, 409, origin);
    }

    const sessionToken = randomToken();
    const tokenHash = await sha256(sessionToken);
    const publicTokenHash = await sha256(paymentToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const originStore = String(pricedOrder.source_portal ?? pricedOrder.store_name ?? pricedOrder.store_slug ?? pricedOrder.checkout_scope_code ?? 'PepScriptRX').slice(0, 160);
    const returnPath = `/pay/${encodeURIComponent(paymentToken)}?woocommerce=return`;
    const cancelPath = `/pay/${encodeURIComponent(paymentToken)}?woocommerce=cancel`;
    const appOrigin = new URL(APP_URL).origin;
    if (!ALLOWED_ORIGINS.includes(appOrigin)) throw new Error('Staging application origin is not allow-listed');
    const { data: session, error: insertError } = await db.from('woocommerce_payment_sessions').insert({
      session_token_hash: tokenHash,
      idempotency_key: existing ? `${idempotencyKey}:${Date.now()}` : idempotencyKey,
      submission_id: pricedOrder.id,
      public_payment_token_hash: publicTokenHash,
      key_id: KEY_ID,
      expected_amount_cents: expectedCapturedTotalCents,
      currency: 'USD',
      origin_store: originStore,
      return_path: returnPath,
      cancel_path: cancelPath,
      merchandise_subtotal_cents: merchandiseSubtotalCents,
      discount_total_cents: discountTotalCents,
      shipping_total_cents: shippingTotalCents,
      tax_total_cents: taxTotalCents,
      pre_fee_amount_cents: preFeeAmountCents,
      processing_fee_rule: PROCESSING_FEE_RULE,
      processing_fee_basis_points: PROCESSING_FEE_BASIS_POINTS,
      expected_processing_fee_cents: expectedProcessingFeeCents,
      expected_captured_total_cents: expectedCapturedTotalCents,
      cart_fingerprint: cartFingerprint,
      status: 'created',
      expires_at: expiresAt,
    }).select('id').single();
    if (insertError || !session) throw new Error('Could not create payment session');

    const payload = {
      version: 1, key_id: KEY_ID, timestamp: Math.floor(Date.now() / 1000),
      nonce: randomToken(18), session_token: sessionToken, expires_at: expiresAt,
      order_reference: String(pricedOrder.order_number ?? `PSRX-${String(pricedOrder.id).slice(0, 8)}`),
      amount_cents: expectedCapturedTotalCents,
      merchandise_subtotal_cents: merchandiseSubtotalCents,
      discount_total_cents: discountTotalCents,
      shipping_total_cents: shippingTotalCents,
      tax_total_cents: taxTotalCents,
      pre_fee_amount_cents: preFeeAmountCents,
      processing_fee_rule: PROCESSING_FEE_RULE,
      processing_fee_basis_points: PROCESSING_FEE_BASIS_POINTS,
      expected_processing_fee_cents: expectedProcessingFeeCents,
      expected_captured_total_cents: expectedCapturedTotalCents,
      cart_fingerprint: cartFingerprint,
      currency: 'USD', origin_store: originStore,
      origin_store_name: String(pricedOrder.store_name ?? originStore).slice(0, 160),
      attribution: {
        checkout_scope_code: String(pricedOrder.checkout_scope_code ?? '').slice(0, 100),
        source_portal: String(pricedOrder.source_portal ?? '').slice(0, 100),
        source_store: String(pricedOrder.source_store ?? '').slice(0, 100),
        store_slug: String(pricedOrder.store_slug ?? '').slice(0, 100),
        referral_code: String(pricedOrder.referral_code ?? '').slice(0, 100),
        rep_id: String(pricedOrder.rep_id ?? '').slice(0, 100),
        source_rep: String(pricedOrder.source_rep ?? '').slice(0, 100),
        parent_admin_id: String(pricedOrder.parent_admin_id ?? '').slice(0, 100),
      },
      items,
      shipping: {
        method: String(pricedOrder.shipping_speed ?? 'standard').slice(0, 40),
        amount_cents: shippingTotalCents,
      },
      customer: {
        full_name: String(pricedOrder.full_name ?? '').slice(0, 160),
        email: String(pricedOrder.email ?? '').slice(0, 254),
        phone: String(pricedOrder.phone ?? '').slice(0, 40),
        shipping_address: String(pricedOrder.shipping_address ?? '').slice(0, 240),
        shipping_city: String(pricedOrder.shipping_city ?? '').slice(0, 100),
        shipping_state: String(pricedOrder.shipping_state ?? '').slice(0, 40),
        shipping_zip: String(pricedOrder.shipping_zip ?? '').slice(0, 20),
      },
      callback_url: CALLBACK_URL,
      return_url: `${APP_URL}${returnPath}`,
      cancel_url: `${APP_URL}${cancelPath}`,
    };
    const body = JSON.stringify(payload);
    const signature = await hmac(SECRET, body);
    const response = await fetch(`${BRIDGE_URL}/wp-json/pepscriptrx-bridge/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PSRX-Key-Id': KEY_ID, 'X-PSRX-Signature': signature },
      body,
    });
    const result = await response.json().catch(() => ({}));
    const checkoutUrl = String(result.checkout_url ?? '');
    if (!response.ok || !checkoutUrl.startsWith(`${BRIDGE_URL}/`)) {
      await db.from('woocommerce_payment_sessions').update({ status: 'failed', error_category: 'wordpress_session_failed', updated_at: new Date().toISOString() }).eq('id', session.id);
      return safeJson({ error: 'Could not start card checkout. Please choose another payment method.', code: 'bridge_unavailable' }, 502, origin);
    }
    await db.from('woocommerce_payment_sessions').update({
      status: 'awaiting_payment',
      woo_order_id: Number(result.woo_order_id) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    return safeJson({ ok: true, url: checkoutUrl, expires_at: expiresAt }, 200, origin);
  } catch {
    return safeJson({ error: 'Could not start card checkout', code: 'internal_error' }, 500, origin);
  }
});
