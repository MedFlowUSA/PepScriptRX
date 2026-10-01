import type { DistributorCatalogProduct, DistributorProduct, RxPlusProduct } from '../data/rxPlus';

export const PURE_STORE = {
  slug: 'purepeptidelabs', name: 'Pure Peptide Labs', scope: 'PUREPEPTIDELABS', owner: 'LILY60',
  commissionRate: 0.65, assets: '/brands/purepeptidelabs',
} as const;

// Shared master records explicitly approved to match GLOW on 2026-09-28.
// The legacy "guy" source tag is catalog provenance, not Pure's commission parent.
// Publication and prices still come exclusively from Pure's own assignments.
export const PURE_APPROVED_SHARED_SKUS: ReadonlySet<string> = new Set([
  'RXP-GLP-RETA-5',
  'RXP-GLP-RETA-10',
  'RXP-GLP-RETA-15',
  'RXP-GLP-RETA-20',
  'RXP-GLP-TIRZ-10',
  'RXP-GLP-TIRZ-15',
  'RXP-GLP-TIRZ-20',
  'RXP-GLP-TIRZ-30',
  'RXP-GLP-TIRZ-60',
  'RXP-GLP-SEMA-10',
  'RXP-GLP-CAGRISEMA',
  'RXP-GLP-CAGRI-5',
  'RXP-GLP-AOD-5',
  'RXP-GLP-AOD-10',
  'RXP-GROW-HGH-10',
  'RXP-GROW-TESA-2',
  'RXP-GROW-TESA-5',
  'RXP-GROW-TESA-10',
  'RXP-GROW-CJCIPA-10',
  'RXP-GROW-MK677',
  'RXP-REC-WOLV',
  'RXP-REC-GLOW',
  'RXP-REC-KLOW',
  'RXP-REC-BPC157-10',
  'RXP-REC-TB500-10',
  'RXP-REC-GHKCU-100',
  'RXP-LONG-MOTSC-10',
  'RXP-LONG-NAD-100',
  'RXP-LONG-NAD-500',
  'RXP-LONG-NAD-1000',
  'RXP-LONG-GLUTA-1500',
  'RXP-LONG-EPI-10',
  'RXP-LONG-SS31',
  'RXP-COG-SELANK',
  'RXP-COG-SEMAX',
  'RXP-COG-PT141',
  'RXP-GROW-IGF1-LR3-1',
]);
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
    || (p.partner_slug && p.partner_slug !== PURE_STORE.slug
      && !(p.partner_slug === 'guy' && PURE_APPROVED_SHARED_SKUS.has(p.sku)))
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
