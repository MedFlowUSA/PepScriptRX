const GINTO_TIRZEPATIDE_PRICES = {
  30: 199,
  60: 249,
} as const;

type GintoTirzepatideStrength = keyof typeof GINTO_TIRZEPATIDE_PRICES;
type OrderRecord = Record<string, unknown>;

type NormalizedOrder<T extends OrderRecord> = {
  order: T;
  changed: boolean;
  updates: Record<string, unknown>;
};

export async function normalizeAndPersistGintoTirzepatideOrder<T extends OrderRecord>(
  db: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => {
          neq: (column: string, value: unknown) => PromiseLike<unknown>;
        };
      };
    };
  },
  order: T,
): Promise<T> {
  const normalized = normalizeGintoTirzepatideOrder(order);
  if (!normalized.changed || !order.id) return normalized.order;

  await db
    .from('patient_submissions')
    .update(normalized.updates)
    .eq('id', String(order.id))
    .neq('payment_status', 'paid');

  return normalized.order;
}

export function normalizeGintoTirzepatideOrder<T extends OrderRecord>(order: T): NormalizedOrder<T> {
  if (!isGintoOrder(order)) return { order, changed: false, updates: {} };

  const items = Array.isArray(order.order_items) ? order.order_items as OrderRecord[] : [];
  if (items.length > 0) return normalizeFromItems(order, items);
  return normalizeFromMedication(order);
}

function normalizeFromItems<T extends OrderRecord>(order: T, items: OrderRecord[]): NormalizedOrder<T> {
  let matched = false;
  let lineItemsChanged = false;
  let subtotal = 0;
  const nextItems = items.map((item) => {
    const quantity = quantityOf(item);
    const strength = gintoTirzepatideStrength(item);
    if (strength) {
      matched = true;
      const price = GINTO_TIRZEPATIDE_PRICES[strength];
      const total = roundMoney(price * quantity);
      const expectedId = `tirzepatide-${strength}mg`;
      const expectedSku = `RXP-GLP-TIRZ-${strength}`;
      if (
        String(item.id ?? '').toLowerCase() !== expectedId
        || String(item.sku ?? '').toUpperCase() !== expectedSku
        || money(item.price) !== price
        || (item.salePrice != null && money(item.salePrice) !== price)
        || (item.compareAtPrice != null && money(item.compareAtPrice) !== price)
        || Number(item.quantity ?? item.qty ?? 1) !== quantity
        || (item.total != null && money(item.total) !== total)
      ) lineItemsChanged = true;
      subtotal += total;
      return {
        ...item,
        id: expectedId,
        sku: expectedSku,
        name: `Tirzepatide ${strength}mg`,
        display_name_at_purchase: `Tirzepatide ${strength}mg`,
        strength: `${strength}mg`,
        price,
        salePrice: price,
        compareAtPrice: price,
        quantity,
        qty: quantity,
        total,
      };
    }

    const price = money(item.price ?? item.salePrice ?? item.total);
    subtotal += roundMoney(price * quantity);
    return { ...item, quantity };
  });

  if (!matched) return { order, changed: false, updates: {} };
  return withTotals(order, roundMoney(subtotal), nextItems, lineItemsChanged);
}

function normalizeFromMedication<T extends OrderRecord>(order: T): NormalizedOrder<T> {
  const strength = gintoTirzepatideStrength(order);
  if (!strength) return { order, changed: false, updates: {} };

  const quantity = quantityFromMedication(order.medication) ?? 1;
  return withTotals(order, roundMoney(GINTO_TIRZEPATIDE_PRICES[strength] * quantity), null, false);
}

function withTotals<T extends OrderRecord>(
  order: T,
  productTotal: number,
  orderItems: OrderRecord[] | null,
  lineItemsChanged: boolean,
): NormalizedOrder<T> {
  const discount = discountForOrder(order, productTotal);
  const shipping = money(order.shipping_cost);
  const orderTotal = roundMoney(Math.max(0, productTotal - discount) + shipping);
  const updates: Record<string, unknown> = {
    quoted_price: productTotal,
    discount_amount: discount,
    order_total: orderTotal,
    amount_due_cents: Math.round(orderTotal * 100),
    final_customer_paid_amount: orderTotal,
    payment_status: 'unpaid',
    payment_provider: null,
    payment_reference: null,
    stripe_checkout_session_id: null,
    stripe_payment_status: null,
    updated_at: new Date().toISOString(),
  };
  if (orderItems) updates.order_items = orderItems;

  return {
    order: {
      ...order,
      ...updates,
      order_items: orderItems ?? order.order_items,
    },
    changed: lineItemsChanged || pricingChanged(order, updates),
    updates,
  };
}

function pricingChanged(order: OrderRecord, updates: Record<string, unknown>): boolean {
  if (money(order.quoted_price) !== money(updates.quoted_price)) return true;
  if (money(order.discount_amount) !== money(updates.discount_amount)) return true;
  if (money(order.order_total) !== money(updates.order_total)) return true;
  return false;
}

function discountForOrder(order: OrderRecord, productTotal: number): number {
  const discountRateByCode: Record<string, number> = {
    BROOKS25: 0.25,
    EHWSUB10: 0.10,
    PEP10: 0.10,
    PORTAL10: 0.10,
    PSRX15: 0.15,
  };
  const rate = discountRateByCode[String(order.discount_code ?? '').trim().toUpperCase()];
  if (rate) return roundMoney(productTotal * rate);
  return Math.min(productTotal, money(order.discount_amount));
}

function isGintoOrder(order: OrderRecord): boolean {
  const haystack = [
    order.checkout_scope_code,
    order.source_portal,
    order.source_store,
    order.store_slug,
    order.store_name,
    order.referral_code,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ');
  return haystack.includes('ginto');
}

function gintoTirzepatideStrength(value: OrderRecord): GintoTirzepatideStrength | null {
  const haystack = [
    value.id,
    value.sku,
    value.name,
    value.product_name,
    value.medication,
    value.strength,
  ].map((part) => String(part ?? '').toLowerCase()).join(' ');
  if (!haystack.includes('tirzepatide') && !haystack.includes('rxp-glp-tirz')) return null;
  if (/(?:tirzepatide|tirz)[^0-9]*60\s*mg|rxp-glp-tirz-60/.test(haystack)) return 60;
  if (/(?:tirzepatide|tirz)[^0-9]*30\s*mg|rxp-glp-tirz-30/.test(haystack)) return 30;
  return null;
}

function quantityOf(item: OrderRecord): number {
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.min(20, Math.round(quantity)) : 1;
}

function quantityFromMedication(value: unknown): number | null {
  const match = String(value ?? '').match(/\bx\s*(\d{1,2})\b/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) && quantity > 0 ? Math.min(20, quantity) : null;
}

function money(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
