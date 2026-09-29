import type { DistributorCatalogProduct, DistributorProduct, RxPlusProduct } from '../data/rxPlus';

export const PURE_STORE = {
  slug: 'purepeptidelabs', name: 'Pure Peptide Labs', scope: 'PUREPEPTIDELABS', owner: 'LILY60',
  commissionRate: 0.6, assets: '/brands/purepeptidelabs',
} as const;

// Existing catalog and assignment models; never borrow another store's defaults.
export type PureCatalogRow = DistributorProduct & {
  enabled?: boolean | null;
  custom_retail_price?: number | null;
  product: (RxPlusProduct & { image_url?: string | null; partner_slug?: string | null }) | null;
};
export type PureCatalogProduct = DistributorCatalogProduct & { image_url?: string | null };

export const PURE_CATALOG_SELECT = `
  id, distributor_id, product_id, is_enabled, enabled, custom_price, custom_retail_price,
  featured, created_at, updated_at,
  distributor:distributors!inner(slug,is_active),
  product:rx_plus_products(id,product_name,category,strength,sku,active,visibility_type,description,image_url,partner_slug)
`;

export function mapPureCatalogRow(row: PureCatalogRow): PureCatalogProduct | null {
  const p = row.product;
  // Match create_public_patient_submission's authoritative price precedence.
  const configured = row.custom_price ?? row.custom_retail_price;
  const price = configured == null ? NaN : Number(configured);
  if (!p || !p.active || !row.is_enabled || row.enabled === false
    || !['public', 'rx_plus', 'distributor_only'].includes(p.visibility_type)
    || (p.partner_slug && p.partner_slug !== PURE_STORE.slug)
    || !Number.isFinite(price) || price <= 0) return null;
  return { ...p, distributorProduct: row, displayPrice: price };
}

// Product-specific brand photography can be supplied by approved product ID later.
export const PURE_PRODUCT_IMAGES: Readonly<Record<string, string>> = {};
export function pureProductImage(product: Pick<PureCatalogProduct, 'id'>): string {
  return PURE_PRODUCT_IMAGES[product.id] ?? `${PURE_STORE.assets}/vial.png`;
}

export function buildPureCart(products: PureCatalogProduct[], quantities: Record<string, number>) {
  const items = products.flatMap((p) => {
    const qty = quantities[p.id] ?? 0;
    if (!Number.isInteger(qty) || qty <= 0 || !p.inventoryStatus?.checkout_allowed) return [];
    return [{ id: p.id, sku: p.sku, name: p.product_name, strength: p.strength,
      technical_name: p.product_name, category: p.category, price: p.displayPrice!, qty,
      inventory_status_at_purchase: p.inventoryStatus.inventory_status,
      inventory_status_label_at_purchase: p.inventoryStatus.inventory_status_label,
      was_special_order: p.inventoryStatus.was_special_order,
      estimated_fulfillment_days_at_purchase: p.inventoryStatus.estimated_fulfillment_days }];
  });
  return {
    rep: PURE_STORE.owner, scope_code: PURE_STORE.scope, distributor: PURE_STORE.slug,
    source_portal: PURE_STORE.name, source_route: `/${PURE_STORE.slug}`, store_slug: PURE_STORE.slug,
    store_name: PURE_STORE.name, brand_id: PURE_STORE.slug, account_type: 'rep', parent_type: 'direct_store',
    parent_brand_id: null, commission_owner: PURE_STORE.owner, commission_rate: PURE_STORE.commissionRate,
    direct_store_commission: PURE_STORE.commissionRate, downline_commission: 0, override_commission: 0,
    items, total: items.reduce((sum, p) => sum + p.price * p.qty, 0), capturedAt: new Date().toISOString(),
  };
}
