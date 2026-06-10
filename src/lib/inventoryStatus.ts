export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_SPECIAL_ORDER_FULFILLMENT_DAYS = 14;
export const SPECIAL_ORDER_ITEM_NOTICE = 'Special order item - fulfillment may take up to 14 business days.';
export const SPECIAL_ORDER_CHECKOUT_NOTICE = 'Your order includes one or more special order items. Fulfillment may take up to 14 business days.';
export const SPECIAL_ORDER_CONFIRMATION_NOTICE = 'Special order items may take up to 14 business days to fulfill.';

export type InventoryDisplayStatus = 'in_stock' | 'low_stock' | 'special_order' | 'out_of_stock' | 'hidden';

export type InventoryStatusInput = {
  active?: boolean | null;
  sellable?: boolean | null;
  customer_visible?: boolean | null;
  admin_manageable?: boolean | null;
  quantity_on_hand?: number | null;
  current_qty?: number | null;
  low_stock_threshold?: number | null;
  reorder_level?: number | null;
  stock_status?: string | null;
  allow_special_order?: boolean | null;
  allow_backorder?: boolean | null;
  estimated_fulfillment_days?: number | null;
};

export type InventoryStatusSnapshot = {
  inventory_status: InventoryDisplayStatus;
  inventory_status_label: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  allow_special_order: boolean;
  estimated_fulfillment_days: number;
  was_special_order: boolean;
  checkout_allowed: boolean;
  supporting_copy: string | null;
};

export type OrderInventorySnapshot = {
  inventory_status_at_purchase: InventoryDisplayStatus;
  was_special_order: boolean;
  estimated_fulfillment_days_at_purchase: number;
};

function numberOrDefault(value: number | null | undefined, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function computeInventoryStatus(input?: InventoryStatusInput | null): InventoryStatusSnapshot {
  const quantity = numberOrDefault(input?.quantity_on_hand ?? input?.current_qty, 0);
  const threshold = Math.max(0, numberOrDefault(input?.low_stock_threshold ?? input?.reorder_level, DEFAULT_LOW_STOCK_THRESHOLD));
  const allowSpecialOrder = input?.allow_special_order ?? input?.allow_backorder ?? true;
  const estimatedFulfillmentDays = Math.max(1, numberOrDefault(input?.estimated_fulfillment_days, DEFAULT_SPECIAL_ORDER_FULFILLMENT_DAYS));
  const active = input?.active ?? true;
  const sellable = input?.sellable ?? true;
  const customerVisible = input?.customer_visible ?? true;
  const manualStatus = String(input?.stock_status ?? '').toLowerCase();

  let inventoryStatus: InventoryDisplayStatus;
  if (!active || !sellable || !customerVisible || manualStatus === 'hidden' || manualStatus === 'inactive') {
    inventoryStatus = 'hidden';
  } else if (manualStatus === 'in_stock') {
    inventoryStatus = 'in_stock';
  } else if (manualStatus === 'low_stock') {
    inventoryStatus = 'low_stock';
  } else if (manualStatus === 'special_order' || manualStatus === 'backorder') {
    inventoryStatus = 'special_order';
  } else if (manualStatus === 'out_of_stock' && !allowSpecialOrder) {
    inventoryStatus = 'out_of_stock';
  } else if (quantity <= 0) {
    inventoryStatus = allowSpecialOrder ? 'special_order' : 'out_of_stock';
  } else if (quantity <= threshold) {
    inventoryStatus = 'low_stock';
  } else {
    inventoryStatus = 'in_stock';
  }

  const wasSpecialOrder = inventoryStatus === 'special_order';
  return {
    inventory_status: inventoryStatus,
    inventory_status_label: inventoryStatusLabel(inventoryStatus),
    quantity_on_hand: quantity,
    low_stock_threshold: threshold,
    allow_special_order: allowSpecialOrder,
    estimated_fulfillment_days: estimatedFulfillmentDays,
    was_special_order: wasSpecialOrder,
    checkout_allowed: inventoryStatus !== 'hidden' && inventoryStatus !== 'out_of_stock',
    supporting_copy: inventoryStatusSupportingCopy(inventoryStatus, estimatedFulfillmentDays),
  };
}

export function inventoryStatusLabel(status: InventoryDisplayStatus): string {
  if (status === 'in_stock') return 'In Stock';
  if (status === 'low_stock') return 'Low Stock';
  if (status === 'special_order') return 'Special Order';
  if (status === 'hidden') return 'Hidden';
  return 'Out of Stock';
}

export function inventoryStatusSupportingCopy(status: InventoryDisplayStatus, estimatedFulfillmentDays = DEFAULT_SPECIAL_ORDER_FULFILLMENT_DAYS): string | null {
  if (status === 'low_stock') return 'Limited availability';
  if (status === 'special_order') return `Fulfillment may take up to ${estimatedFulfillmentDays} business days.`;
  if (status === 'out_of_stock') return 'This item is not currently sellable.';
  return null;
}

export function orderInventorySnapshot(input?: InventoryStatusInput | null): OrderInventorySnapshot {
  const status = computeInventoryStatus(input);
  return {
    inventory_status_at_purchase: status.inventory_status,
    was_special_order: status.was_special_order,
    estimated_fulfillment_days_at_purchase: status.estimated_fulfillment_days,
  };
}

