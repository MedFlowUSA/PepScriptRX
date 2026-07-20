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

  const product = normalizeRockPhormManagedLabel(row.product);

  return {
    ...product,
    id: product.id,
    suggested_retail_price: toNumber(product.suggested_retail_price),
    base_cost: toNumber(product.base_cost),
    active: product.active !== false,
    badges: product.badges,
    distributorProduct,
    displayPrice,
    dbProductId: row.product.id,
    dbDistributorProductId: row.id,
    dbEnabled,
    dbFeatured,
  };
}

function normalizeRockPhormManagedLabel(product: RockPhormCatalogProduct): RockPhormCatalogProduct {
  const haystack = [
    product.id,
    product.sku,
    product.product_name,
    product.display_name,
    product.strength,
    product.category,
    product.description,
  ].join(' ').toLowerCase();

  if ((haystack.includes('bpc-157') && haystack.includes('tb-500')) || haystack.includes('wolverine')) {
    return {
      ...product,
      product_name: 'Wolverine Stack',
      display_name: 'Wolverine Stack BPC-157 10 mg + TB-500 10 mg, 20 mg total',
      strength: 'BPC-157 10 mg + TB-500 10 mg, 20 mg total',
    };
  }
  if (haystack.includes('cagrisema')) {
    return {
      ...product,
      product_name: 'CagriSema',
      display_name: 'CagriSema 2.4 mg + 2.4 mg, 4.8 mg total',
      strength: '2.4 mg + 2.4 mg, 4.8 mg total',
    };
  }
  if (haystack.includes('nad')) {
    return {
      ...product,
      product_name: 'NAD+',
      display_name: 'NAD+ 1000 mg',
      strength: '1000 mg',
    };
  }
  if (haystack.includes('glow')) {
    return {
      ...product,
      product_name: 'Glow Stack',
      display_name: 'Glow Stack 70 mg total',
      strength: '70 mg total',
    };
  }
  if (haystack.includes('cjc') && haystack.includes('ipamorelin')) {
    return {
      ...product,
      product_name: 'CJC-1295 / Ipamorelin',
      display_name: 'CJC-1295 / Ipamorelin 5 mg + 5 mg, 10 mg total',
      strength: '5 mg + 5 mg, 10 mg total',
    };
  }
  if (haystack.includes('ipamorelin') && !haystack.includes('cjc')) {
    return {
      ...product,
      product_name: 'Ipamorelin',
      display_name: 'Ipamorelin 5 mg',
      strength: '5 mg',
    };
  }
  if (haystack.includes('hgh') || haystack.includes('somatropin')) {
    const strength = '10 IU x 10, 100 IU total';
    return {
      ...product,
      product_name: 'HGH / Somatropin',
      display_name: `HGH / Somatropin ${strength}`,
      strength,
    };
  }
  return product;
}

function toNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}
