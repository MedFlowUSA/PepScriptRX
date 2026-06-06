import type { DistributorCatalogProduct, DistributorProduct, RxPlusProduct } from '../data/rxPlus';
import { ROCKPHORM_COMMISSION_RATE } from './rockPhormScope';

export type RockPhormCatalogProduct = RxPlusProduct & {
  display_name?: string | null;
  retail_price?: number | null;
  partner_slug?: string | null;
  featured?: boolean | null;
  image_url?: string | null;
};

export type RockPhormProductRow = {
  id: string;
  distributor_id: string;
  product_id: string;
  is_enabled: boolean | null;
  enabled?: boolean | null;
  custom_price: number | null;
  custom_retail_price?: number | null;
  featured: boolean | null;
  commission_rate?: number | null;
  created_at: string;
  updated_at: string;
  product: RockPhormCatalogProduct | null;
};

export type RockPhormManagedProduct = DistributorCatalogProduct & {
  dbProductId: string;
  dbDistributorProductId: string;
  dbEnabled: boolean;
  dbFeatured: boolean;
};

export const ROCKPHORM_PRODUCT_SELECT = `
  id,
  distributor_id,
  product_id,
  is_enabled,
  enabled,
  custom_price,
  custom_retail_price,
  featured,
  commission_rate,
  created_at,
  updated_at,
  distributor:distributors!inner(slug),
  product:rx_plus_products(*)
`;

export const ROCKPHORM_MASTER_PRODUCT_SELECT = `
  id,
  product_name,
  display_name,
  category,
  strength,
  sku,
  suggested_retail_price,
  retail_price,
  base_cost,
  active,
  visibility_type,
  description,
  partner_slug,
  featured,
  image_url,
  created_at,
  updated_at
`;

export function mapRockPhormProductRow(row: RockPhormProductRow): RockPhormManagedProduct | null {
  if (!row.product) return null;
  const dbEnabled = Boolean(row.enabled ?? row.is_enabled);
  const dbFeatured = Boolean(row.featured ?? row.product.featured);
  const displayPrice = toNumber(
    row.custom_retail_price
    ?? row.custom_price
    ?? row.product.retail_price
    ?? row.product.suggested_retail_price
  );

  const distributorProduct: DistributorProduct = {
    id: row.id,
    distributor_id: row.distributor_id,
    product_id: row.product_id,
    is_enabled: dbEnabled,
    custom_price: displayPrice,
    featured: dbFeatured,
    commission_rate: row.commission_rate ?? ROCKPHORM_COMMISSION_RATE,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return {
    ...row.product,
    id: row.product.id,
    suggested_retail_price: toNumber(row.product.suggested_retail_price),
    base_cost: toNumber(row.product.base_cost),
    active: row.product.active !== false,
    badges: row.product.badges,
    distributorProduct,
    displayPrice,
    dbProductId: row.product.id,
    dbDistributorProductId: row.id,
    dbEnabled,
    dbFeatured,
  };
}

function toNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}
