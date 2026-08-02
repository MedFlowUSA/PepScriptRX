import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type CartItem = {
  id?: string;
  sku?: string;
  quantity?: number | string;
  qty?: number | string;
  display_name_at_purchase?: string;
  inventory_status_at_purchase?: string;
  inventory_status_label_at_purchase?: string;
  was_special_order?: boolean;
  estimated_fulfillment_days_at_purchase?: number;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: 'AACTIVATED checkout service is not configured.' }, 503);
    }

    const payload = await req.json().catch(() => ({}));
    if (!isAactivatedPayload(payload)) return json({ error: 'Unsupported checkout scope.' }, 403);

    const rawItems = Array.isArray(payload.order_items) ? payload.order_items as CartItem[] : [];
    if (rawItems.length < 2) return json({ error: 'Use the standard checkout path for single-item orders.' }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const priced = [];
    let productTotal = 0;
    let costOfGoods = 0;
    for (const item of rawItems) {
      const product = await priceAactivatedItem(db, item);
      const quantity = clampQuantity(item.quantity ?? item.qty);
      priced.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        strength: product.strength,
        price: product.price,
        quantity,
        display_name_at_purchase: item.display_name_at_purchase ?? product.name,
        inventory_status_at_purchase: item.inventory_status_at_purchase ?? null,
        inventory_status_label_at_purchase: item.inventory_status_label_at_purchase ?? null,
        was_special_order: Boolean(item.was_special_order),
        estimated_fulfillment_days_at_purchase: item.estimated_fulfillment_days_at_purchase ?? null,
      });
      productTotal += product.price * quantity;
      costOfGoods += product.cost * quantity;
    }

    const scopeCode = normalizeScope(payload.checkout_scope_code ?? payload.source_rep ?? payload.admin_code ?? 'GUY60');
    const repCode = clean(payload.source_rep ?? payload.referral_code ?? payload.admin_code ?? scopeCode);
    const repId = await findRepId(db, repCode, payload.discount_code);
    const discountAmount = await calculateDiscount(db, payload.discount_code, productTotal);
    const shippingSpeed = normalizeShipping(payload.shipping_speed);
    const shippingCost = shippingSpeed === 'overnight' ? 50 : shippingSpeed === 'expedited' ? 25 : 0;
    const orderTotal = Math.max(0, roundMoney(productTotal - discountAmount + shippingCost));
    const submissionId = crypto.randomUUID();
    const paymentToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');

    const insert = {
      id: submissionId,
      public_payment_token: paymentToken,
      full_name: clean(payload.full_name) || null,
      email: clean(payload.email) || null,
      phone: clean(payload.phone) || null,
      rep_id: repId,
      medication: priced.map((item) => `${item.name}${item.strength ? ` - ${item.strength}` : ''} x${item.quantity}`).join(', '),
      current_dose: clean(payload.current_dose) || null,
      current_price: numericOrNull(payload.current_price),
      state: clean(payload.state ?? payload.shipping_state) || null,
      date_of_birth: dateOrNull(payload.date_of_birth),
      current_pharmacy: clean(payload.current_pharmacy) || null,
      shipping_address: clean(payload.shipping_address) || null,
      shipping_city: clean(payload.shipping_city) || null,
      shipping_state: clean(payload.shipping_state) || null,
      shipping_zip: clean(payload.shipping_zip) || null,
      shipping_speed: shippingSpeed,
      shipping_cost: shippingCost,
      referral_code: repCode || scopeCode,
      discount_code: clean(payload.discount_code).toUpperCase() || null,
      discount_amount: discountAmount,
      status: 'payment_sent',
      payment_status: 'unpaid',
      paid_at: null,
      quoted_price: roundMoney(productTotal),
      product_id: clean(payload.product_id) || null,
      product_name: priced.length === 1 ? priced[0].name : `${priced.length}-item order`,
      product_category: priced[0]?.category ?? null,
      product_type: clean(payload.product_type) || 'manual_review',
      selected_addons: Array.isArray(payload.selected_addons) ? payload.selected_addons : [],
      is_accessory_only: false,
      submission_type: clean(payload.submission_type) || 'rx_plus_order',
      inquiry_notes: clean(payload.inquiry_notes) || null,
      order_number: `PSRX-${submissionId.slice(0, 8).toUpperCase()}`,
      order_items: priced,
      order_total: orderTotal,
      cost_of_goods: roundMoney(costOfGoods),
      admin_code: clean(payload.admin_code) || 'GUY60',
      store_slug: clean(payload.store_slug) || 'guy',
      store_name: clean(payload.store_name) || 'AACTIVATED-RX',
      account_type: clean(payload.account_type) || 'rep',
      parent_type: clean(payload.parent_type) || null,
      checkout_scope_code: scopeCode,
      attribution_source: clean(payload.attribution_source) || 'url',
      source_portal: clean(payload.source_portal) || 'VITALITYINS',
      source_route: clean(payload.source_route) || null,
      source_store: clean(payload.source_store) || clean(payload.store_slug) || 'guy',
      source_admin: clean(payload.source_admin) || clean(payload.admin_code) || null,
      source_rep: clean(payload.source_rep) || repCode || null,
      locale: clean(payload.locale) || null,
      commission_owner: clean(payload.commission_owner) || null,
      commission_rate: numericOrNull(payload.commission_rate),
      partner_payout_eligible: boolOrNull(payload.partner_payout_eligible),
    };

    const { error } = await db.from('patient_submissions').insert(insert);
    if (error) throw error;

    return json({ submission_id: submissionId, public_payment_token: paymentToken }, 200);
  } catch (error) {
    console.error('create-aactivated-cart-submission failed', error);
    return json({ error: errorMessage(error) }, 500);
  }
});

async function priceAactivatedItem(db: ReturnType<typeof createClient>, item: CartItem) {
  const id = clean(item.id);
  const sku = clean(item.sku).toUpperCase();
  if (!id && !sku) throw new Error('Cart item is missing product id or SKU.');

  let scoped = null;
  if (id && isUuid(id)) {
    const { data, error } = await db
      .from('aactivated_store_product_prices')
      .select('product_id, product_name, sale_price, retail_price')
      .eq('store_slug', 'aactivated')
      .eq('is_active', true)
      .eq('product_id', id)
      .maybeSingle();
    if (error) throw error;
    scoped = data;
  }
  if (!scoped && sku) {
    const { data, error } = await db
      .from('aactivated_store_product_prices')
      .select('product_id, product_name, sale_price, retail_price')
      .eq('store_slug', 'aactivated')
      .eq('is_active', true)
      .ilike('product_id', sku)
      .maybeSingle();
    if (error) throw error;
    scoped = data;
  }

  let product = null;
  if (id && isUuid(id)) {
    const { data, error } = await db
      .from('rx_plus_products')
      .select('id, sku, display_name, product_name, category, strength, retail_price, suggested_retail_price, true_wholesale_cost_per_vial, base_cost')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    product = data;
  }
  if (!product && sku) {
    const { data, error } = await db
      .from('rx_plus_products')
      .select('id, sku, display_name, product_name, category, strength, retail_price, suggested_retail_price, true_wholesale_cost_per_vial, base_cost')
      .ilike('sku', sku)
      .maybeSingle();
    if (error) throw error;
    product = data;
  }

  const price = Number(scoped?.sale_price ?? scoped?.retail_price ?? product?.retail_price ?? product?.suggested_retail_price ?? 0);
  if (!price || price <= 0) throw new Error(`Could not price checkout item ${sku || id}`);

  return {
    id: product?.id ?? id ?? sku,
    sku: product?.sku ?? (sku || null),
    name: scoped?.product_name ?? product?.display_name ?? product?.product_name ?? 'AACTIVATED-RX order',
    category: product?.category ?? null,
    strength: product?.strength ?? null,
    price: roundMoney(price),
    cost: roundMoney(Number(product?.true_wholesale_cost_per_vial ?? product?.base_cost ?? 0)),
  };
}

async function findRepId(db: ReturnType<typeof createClient>, repCode: string, discountCode: unknown) {
  const code = clean(repCode);
  const discount = clean(discountCode).toUpperCase();
  if (!code && !discount) return null;
  let query = db.from('reps').select('id').eq('active', true).limit(1);
  if (code && discount) query = query.or(`rep_slug.ilike.${code},discount_code.ilike.${discount}`);
  else if (code) query = query.ilike('rep_slug', code);
  else query = query.ilike('discount_code', discount);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function calculateDiscount(db: ReturnType<typeof createClient>, rawCode: unknown, productTotal: number) {
  const code = clean(rawCode).toUpperCase();
  if (!code || productTotal <= 0) return 0;
  const percent = code === 'BROOKS25' ? 0.25 : ['PORTAL10', 'PEP10', 'EHWSUB10'].includes(code) ? 0.10 : 0;
  if (percent > 0) return roundMoney(productTotal * percent);
  const { data, error } = await db
    .from('reps')
    .select('discount_amount')
    .eq('active', true)
    .ilike('discount_code', code)
    .maybeSingle();
  if (error) throw error;
  return Math.min(roundMoney(productTotal), Math.max(0, roundMoney(Number(data?.discount_amount ?? 0))));
}

function isAactivatedPayload(payload: Record<string, unknown>) {
  const haystack = [
    payload.checkout_scope_code,
    payload.source_rep,
    payload.admin_code,
    payload.store_slug,
    payload.store_name,
    payload.source_store,
    payload.source_portal,
    payload.source_route,
    payload.brand_id,
  ].map(clean).join(' ').toLowerCase();
  return /\b(guy60|vitalityins|aactivated|aactivatedrx)\b/.test(haystack);
}

function normalizeScope(value: unknown) {
  const scope = clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return scope || 'GUY60';
}

function normalizeShipping(value: unknown) {
  const shipping = clean(value).toLowerCase();
  return ['standard', 'expedited', 'overnight'].includes(shipping) ? shipping : 'standard';
}

function clampQuantity(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(20, Math.trunc(parsed)));
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function numericOrNull(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function boolOrNull(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function dateOrNull(value: unknown) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.code ? `code ${record.code}` : null,
      record.details,
      record.hint,
      record.error_description,
    ].filter(Boolean).map(String);
    return parts.length > 0 ? parts.join(' - ') : JSON.stringify(record);
  }
  return 'Checkout submission failed.';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
