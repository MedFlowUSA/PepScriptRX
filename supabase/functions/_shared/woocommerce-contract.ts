export const PROCESSING_FEE_RULE = 'woocommerce_no_processing_fee_v1';
export const PROCESSING_FEE_BASIS_POINTS = 0;

export type StructuredCheckoutItem = {
  product_id: string;
  sku: string | null;
  name: string;
  variation: string | null;
  quantity: number;
  unit_amount_cents: number;
  line_subtotal_cents: number;
  discount_cents: number;
  line_total_cents: number;
};

function cents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function processingFeeCents(preFeeAmountCents: number): number {
  if (!Number.isSafeInteger(preFeeAmountCents) || preFeeAmountCents < 0) throw new Error('Invalid pre-fee amount');
  return Math.floor((preFeeAmountCents * PROCESSING_FEE_BASIS_POINTS + 5000) / 10000);
}

export function structuredCheckoutItems(raw: unknown, discountTotalCents: number): StructuredCheckoutItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Order has no authoritative line items');
  const base = raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    const productId = String(item.id ?? '').trim();
    const name = String(item.name ?? item.display_name_at_purchase ?? '').trim();
    const quantity = Number(item.quantity ?? 0);
    const unitAmountCents = cents(item.price);
    if (!productId || !name || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || unitAmountCents <= 0) {
      throw new Error('Order contains an invalid authoritative line item');
    }
    return {
      product_id: productId.slice(0, 160),
      sku: String(item.sku ?? '').trim().slice(0, 100) || null,
      name: name.slice(0, 180),
      variation: String(item.strength ?? '').trim().slice(0, 100) || null,
      quantity,
      unit_amount_cents: unitAmountCents,
      line_subtotal_cents: unitAmountCents * quantity,
    };
  });
  const subtotal = base.reduce((sum, item) => sum + item.line_subtotal_cents, 0);
  if (!Number.isSafeInteger(discountTotalCents) || discountTotalCents < 0 || discountTotalCents > subtotal) {
    throw new Error('Invalid authoritative discount');
  }
  let allocated = 0;
  return base.map((item, index) => {
    const discount = index === base.length - 1
      ? discountTotalCents - allocated
      : Math.floor((discountTotalCents * item.line_subtotal_cents) / subtotal);
    allocated += discount;
    return { ...item, discount_cents: discount, line_total_cents: item.line_subtotal_cents - discount };
  });
}

export function checkoutFingerprint(value: unknown): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
    .then((buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(''));
}
