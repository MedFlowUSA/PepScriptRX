import type { InventoryStatusSnapshot } from './inventoryStatus';

// Until an owner is configured, checkout is administered by MAIN; brand attribution stays 316.
export const POWERED316 = { name: 'POWERED BY 316', slug: '316', scope: 'MAIN', assets: '/brands/powered-by-316' } as const;
export type Powered316Product = {
  id: string; sku: string; product_name: string; strength: string; category: string;
  description: string | null; retail_price: number | null; suggested_retail_price: number | null;
  inventoryStatus?: InventoryStatusSnapshot;
};
export function standardRetailPrice(p: Powered316Product): number | null {
  const value = p.retail_price ?? p.suggested_retail_price;
  return value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}
export function buildPowered316Cart(products: Powered316Product[], quantities: Record<string, number>) {
  const items = products.flatMap(p => {
    const qty = quantities[p.id];
    const price = standardRetailPrice(p);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 20 || price === null || !p.inventoryStatus?.checkout_allowed) return [];
    return [{ id: p.id, sku: p.sku, name: p.product_name, strength: p.strength, category: p.category, price, qty,
      inventory_status_at_purchase: p.inventoryStatus.inventory_status,
      inventory_status_label_at_purchase: p.inventoryStatus.inventory_status_label,
      was_special_order: p.inventoryStatus.was_special_order,
      estimated_fulfillment_days_at_purchase: p.inventoryStatus.estimated_fulfillment_days }];
  });
  return { rep: '', scope_code: POWERED316.scope, distributor: POWERED316.slug, source_portal: POWERED316.name,
    source_route: '/316', store_slug: '316', store_name: POWERED316.name, brand_id: '316',
    account_type: 'partner', commission_owner: null, commission_rate: null, partner_payout_eligible: false,
    commission_configuration_status: 'pending', parent_brand_id: null,
    items, total: items.reduce((sum, p) => sum + p.price * p.qty, 0), capturedAt: new Date().toISOString() };
}
