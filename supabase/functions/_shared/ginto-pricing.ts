const GINTO_TIRZEPATIDE_60_PRICE = 249;

type OrderRecord = Record<string, unknown>;

type NormalizedOrder<T extends OrderRecord> = {
  order: T;
  changed: boolean;
  updates: Record<string, unknown>;
};

export async function normalizeAndPersistGintoTirzepatide60Order<T extends OrderRecord>(
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
  const normalized = normalizeGintoTirzepatide60Order(order);
  if (!normalized.changed || !order.id) return normalized.order;

  await db
    .from('patient_submissions')
    .update(normalized.updates)
    .eq('id', String(order.id))
    .neq('payment_status', 'paid');

  return normalized.order;
}

export function normalizeGintoTirzepatide60Order<T extends OrderRecord>(order: T): NormalizedOrder<T> {
  if (!isGintoOrder(order)) return { order, changed: false, updates: {} };

  const items = Array.isArray(order.order_items) ? order.order_items as OrderRecord[] : [];
  if (items.length > 0) return normalizeFromItems(order, items);
  return normalizeFromMedication(order);
}

function normalizeFromItems<T extends OrderRecord>(order: T, items: OrderRecord[]): NormalizedOrder<T> {
  let touched = false;
  let subtotal = 0;
  const nextItems = items.map((item) => {
    const quantity = quantityOf(item);
    if (isTirzepatide60(item)) {
      touched = true;
      const total = roundMoney(GINTO_TIRZEPATIDE_60_PRICE * quantity);
      subtotal += total;
      return {
        ...item,
        price: GINTO_TIRZEPATIDE_60_PRICE,
        salePrice: GINTO_TIRZEPATIDE_60_PRICE,
        compareAtPrice: GINTO_TIRZEPATIDE_60_PRICE,
        quantity,
        qty: quantity,
        total,
      };
    }

    const price = money(item.price ?? item.salePrice ?? item.total);
    subtotal += roundMoney(price * quantity);
    return { ...item, quantity };
  });

  if (!touched) return { order, changed: false, updates: {} };
  return withTotals(order, roundMoney(subtotal), nextItems);
}

function normalizeFromMedication<T extends OrderRecord>(order: T): NormalizedOrder<T> {
  if (!isTirzepatide60(order)) return { order, changed: false, updates: {} };
  const quotedPrice = money(order.quoted_price);
  if (quotedPrice < 900) return { order, changed: false, updates: {} };

  const quantity = quantityFromMedication(order.medication) ?? Math.max(1, Math.round(quotedPrice / 950));
  return withTotals(order, roundMoney(GINTO_TIRZEPATIDE_60_PRICE * quantity), null);
}

function withTotals<T extends OrderRecord>(
  order: T,
  productTotal: number,
  orderItems: OrderRecord[] | null,
): NormalizedOrder<T> {
  const discount = Math.min(productTotal, money(order.discount_amount));
  const shipping = money(order.shipping_cost);
  const orderTotal = roundMoney(Math.max(0, productTotal - discount) + shipping);
  const updates: Record<string, unknown> = {
    quoted_price: productTotal,
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
    changed: true,
    updates,
  };
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

function isTirzepatide60(value: OrderRecord): boolean {
  const haystack = [
    value.id,
    value.sku,
    value.name,
    value.product_name,
    value.medication,
    value.strength,
  ].map((part) => String(part ?? '').toLowerCase()).join(' ');
  return (
    haystack.includes('tirzepatide-60mg') ||
    haystack.includes('rxp-glp-tirz-60') ||
    (haystack.includes('tirzepatide') && haystack.includes('60'))
  );
}

function quantityOf(item: OrderRecord): number {
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;
}

function quantityFromMedication(value: unknown): number | null {
  const match = String(value ?? '').match(/\bx\s*(\d{1,2})\b/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function money(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
