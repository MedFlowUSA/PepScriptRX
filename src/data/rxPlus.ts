export type RxPlusCategory =
  | 'Weight Loss / GLP'
  | 'Recovery'
  | 'Growth / GH'
  | 'Metabolic / Longevity'
  | 'Longevity'
  | 'Cognitive / Wellness'
  | 'Hormonal / Libido'
  | 'Advanced / Invite Only'
  | 'White Label / Wholesale';

export type RxPlusVisibility =
  | 'public'
  | 'rx_plus'
  | 'distributor_only'
  | 'wholesale_only'
  | 'invite_only';

export interface RxPlusDistributor {
  id: string;
  name: string;
  slug: string;
  portal_name: string;
  commission_rate: number;
  is_active: boolean;
  white_label_enabled: boolean;
  wholesale_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RxPlusProduct {
  id: string;
  product_name: string;
  category: RxPlusCategory;
  strength: string;
  sku: string;
  suggested_retail_price: number;
  base_cost: number;
  active: boolean;
  visibility_type: RxPlusVisibility;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DistributorProduct {
  id: string;
  distributor_id: string;
  product_id: string;
  is_enabled: boolean;
  custom_price: number | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface WholesaleTier {
  id: string;
  tier_name: string;
  min_vials: number;
  max_vials: number | null;
  discount_type: 'custom_quote' | 'percent';
  discount_value: number | null;
  description: string;
}

export type DistributorCatalogProduct = RxPlusProduct & {
  distributorProduct: DistributorProduct;
  displayPrice: number;
};

const now = '2026-05-20T00:00:00.000Z';

export const RX_PLUS_DISTRIBUTORS: RxPlusDistributor[] = [
  {
    id: 'dist_guy',
    name: 'Guy',
    slug: 'guy',
    portal_name: 'PepScriptRX+ Guy Portal',
    commission_rate: 0.6,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: true,
    created_at: now,
    updated_at: now,
  },
];

export const RX_PLUS_PRODUCTS: RxPlusProduct[] = [
  { id: 'tesamorelin-2mg', product_name: 'Tesamorelin', category: 'Growth / GH', strength: '2mg', sku: 'RXP-GH-TESA-2', suggested_retail_price: 79, base_cost: 39, active: true, visibility_type: 'rx_plus', description: 'Expanded catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'tesamorelin-5mg', product_name: 'Tesamorelin', category: 'Growth / GH', strength: '5mg', sku: 'RXP-GH-TESA-5', suggested_retail_price: 129, base_cost: 62, active: true, visibility_type: 'rx_plus', description: 'Expanded catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'tesamorelin-10mg', product_name: 'Tesamorelin', category: 'Growth / GH', strength: '10mg', sku: 'RXP-GH-TESA-10', suggested_retail_price: 229, base_cost: 112, active: true, visibility_type: 'rx_plus', description: 'Expanded catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-10iu', product_name: 'HGH', category: 'Growth / GH', strength: '10iu', sku: 'RXP-GH-HGH-10', suggested_retail_price: 99, base_cost: 48, active: true, visibility_type: 'distributor_only', description: 'Distributor catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-15iu', product_name: 'HGH', category: 'Growth / GH', strength: '15iu', sku: 'RXP-GH-HGH-15', suggested_retail_price: 149, base_cost: 74, active: true, visibility_type: 'distributor_only', description: 'Distributor catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-24iu', product_name: 'HGH', category: 'Growth / GH', strength: '24iu', sku: 'RXP-GH-HGH-24', suggested_retail_price: 199, base_cost: 98, active: true, visibility_type: 'distributor_only', description: 'Distributor catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-36iu', product_name: 'HGH', category: 'Growth / GH', strength: '36iu', sku: 'RXP-GH-HGH-36', suggested_retail_price: 279, base_cost: 139, active: true, visibility_type: 'distributor_only', description: 'Distributor catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'cjc-ipamorelin-10mg', product_name: 'CJC + Ipamorelin', category: 'Growth / GH', strength: '10mg', sku: 'RXP-GH-CJCIPA-10', suggested_retail_price: 149, base_cost: 72, active: true, visibility_type: 'rx_plus', description: 'Expanded catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'mk-677', product_name: 'MK-677', category: 'Growth / GH', strength: 'Standard', sku: 'RXP-GH-MK677', suggested_retail_price: 79, base_cost: 38, active: true, visibility_type: 'rx_plus', description: 'Expanded catalog item. Availability subject to verification.', created_at: now, updated_at: now },

  { id: 'wolverine-bpc-tb', product_name: 'Wolverine BPC/TB', category: 'Recovery', strength: 'Blend', sku: 'RXP-REC-WOLV', suggested_retail_price: 149, base_cost: 72, active: true, visibility_type: 'rx_plus', description: 'Recovery category item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'tb-500-10mg', product_name: 'TB-500', category: 'Recovery', strength: '10mg', sku: 'RXP-REC-TB500-10', suggested_retail_price: 169, base_cost: 84, active: true, visibility_type: 'rx_plus', description: 'Recovery category item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'bpc-157-10mg', product_name: 'BPC-157', category: 'Recovery', strength: '10mg', sku: 'RXP-REC-BPC157-10', suggested_retail_price: 99, base_cost: 48, active: true, visibility_type: 'rx_plus', description: 'Recovery category item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'ghk-cu-100mg', product_name: 'GHK-CU', category: 'Recovery', strength: '100mg', sku: 'RXP-REC-GHKCU-100', suggested_retail_price: 119, base_cost: 58, active: true, visibility_type: 'rx_plus', description: 'Recovery category item. Availability subject to verification.', created_at: now, updated_at: now },

  { id: 'mots-c-10mg', product_name: 'MOTS-C', category: 'Metabolic / Longevity', strength: '10mg', sku: 'RXP-MET-MOTSC-10', suggested_retail_price: 129, base_cost: 64, active: true, visibility_type: 'rx_plus', description: 'Optimization catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'aod-9604-5mg', product_name: 'AOD-9604', category: 'Metabolic / Longevity', strength: '5mg', sku: 'RXP-MET-AOD-5', suggested_retail_price: 119, base_cost: 58, active: true, visibility_type: 'rx_plus', description: 'Optimization catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'aod-9604-10mg', product_name: 'AOD-9604', category: 'Metabolic / Longevity', strength: '10mg', sku: 'RXP-MET-AOD-10', suggested_retail_price: 199, base_cost: 98, active: true, visibility_type: 'rx_plus', description: 'Optimization catalog item. Availability subject to verification.', created_at: now, updated_at: now },

  { id: 'nad-100iu', product_name: 'NAD+', category: 'Longevity', strength: '100iu', sku: 'RXP-LONG-NAD-100', suggested_retail_price: 69, base_cost: 32, active: true, visibility_type: 'rx_plus', description: 'Longevity catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'nad-500iu', product_name: 'NAD+', category: 'Longevity', strength: '500iu', sku: 'RXP-LONG-NAD-500', suggested_retail_price: 119, base_cost: 58, active: true, visibility_type: 'rx_plus', description: 'Longevity catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'nad-1000iu', product_name: 'NAD+', category: 'Longevity', strength: '1000iu', sku: 'RXP-LONG-NAD-1000', suggested_retail_price: 179, base_cost: 88, active: true, visibility_type: 'rx_plus', description: 'Longevity catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'glutathione-1500mg', product_name: 'Glutathione', category: 'Longevity', strength: '1500mg', sku: 'RXP-LONG-GLUTA-1500', suggested_retail_price: 179, base_cost: 88, active: true, visibility_type: 'rx_plus', description: 'Longevity catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'epithalon-10mg', product_name: 'Epithalon', category: 'Longevity', strength: '10mg', sku: 'RXP-LONG-EPI-10', suggested_retail_price: 99, base_cost: 48, active: true, visibility_type: 'rx_plus', description: 'Longevity catalog item. Availability subject to verification.', created_at: now, updated_at: now },

  { id: 'ss-31', product_name: 'SS-31', category: 'Advanced / Invite Only', strength: 'Invite only', sku: 'RXP-ADV-SS31', suggested_retail_price: 399, base_cost: 210, active: true, visibility_type: 'invite_only', description: 'Invite-only catalog item. Availability subject to verification and approval.', created_at: now, updated_at: now },
  { id: 'selank', product_name: 'Selank', category: 'Cognitive / Wellness', strength: 'Standard', sku: 'RXP-COG-SELANK', suggested_retail_price: 89, base_cost: 42, active: true, visibility_type: 'rx_plus', description: 'Wellness catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'semax', product_name: 'Semax', category: 'Cognitive / Wellness', strength: 'Standard', sku: 'RXP-COG-SEMAX', suggested_retail_price: 89, base_cost: 42, active: true, visibility_type: 'rx_plus', description: 'Wellness catalog item. Availability subject to verification.', created_at: now, updated_at: now },
  { id: 'pt-141', product_name: 'PT-141', category: 'Hormonal / Libido', strength: 'Standard', sku: 'RXP-HORM-PT141', suggested_retail_price: 129, base_cost: 64, active: true, visibility_type: 'rx_plus', description: 'Wellness catalog item. Availability subject to verification.', created_at: now, updated_at: now },
];

export const GUY_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = RX_PLUS_PRODUCTS.map((product, index) => ({
  id: `guy-${product.id}`,
  distributor_id: 'dist_guy',
  product_id: product.id,
  is_enabled: true,
  custom_price: null,
  featured: index < 6 || product.visibility_type === 'invite_only',
  created_at: now,
  updated_at: now,
}));

export const WHOLESALE_TIERS: WholesaleTier[] = [
  { id: 'tier-1', tier_name: 'Tier 1 Partner', min_vials: 10, max_vials: 49, discount_type: 'custom_quote', discount_value: null, description: 'Entry wholesale access for approved partners.' },
  { id: 'tier-2', tier_name: 'Tier 2 Distributor', min_vials: 50, max_vials: 99, discount_type: 'custom_quote', discount_value: null, description: 'Expanded distributor pricing and portal support.' },
  { id: 'tier-3', tier_name: 'Tier 3 White Label', min_vials: 100, max_vials: 249, discount_type: 'custom_quote', discount_value: null, description: 'White-label-ready volume for approved accounts.' },
  { id: 'tier-4', tier_name: 'Tier 4 Strategic Account', min_vials: 250, max_vials: null, discount_type: 'custom_quote', discount_value: null, description: 'Custom quote and strategic fulfillment planning.' },
];

export const RX_PLUS_CATEGORIES: RxPlusCategory[] = [
  'Weight Loss / GLP',
  'Recovery',
  'Growth / GH',
  'Metabolic / Longevity',
  'Longevity',
  'Cognitive / Wellness',
  'Hormonal / Libido',
  'Advanced / Invite Only',
  'White Label / Wholesale',
];

export function getDistributorProducts(distributorSlug: string): DistributorCatalogProduct[] {
  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === distributorSlug);
  if (!distributor) return [];

  return GUY_DISTRIBUTOR_PRODUCTS
    .filter((item) => item.distributor_id === distributor.id && item.is_enabled)
    .map((item) => {
      const product = RX_PLUS_PRODUCTS.find((p) => p.id === item.product_id);
      return product ? { ...product, distributorProduct: item, displayPrice: item.custom_price ?? product.suggested_retail_price } : null;
    })
    .filter((product): product is DistributorCatalogProduct => product !== null);
}

export function estimateDistributorCommission(grossSale: number, productCost: number, commissionRate = 0.6) {
  const shippingCost = 18;
  const processingFee = grossSale * 0.032;
  const discounts = 0;
  const refunds = 0;
  const netProfit = Math.max(0, grossSale - productCost - shippingCost - processingFee - discounts - refunds);
  const distributorCommission = netProfit * commissionRate;
  return {
    grossSale,
    productCost,
    shippingCost,
    processingFee,
    discounts,
    refunds,
    netProfit,
    distributorCommission,
    platformProfit: netProfit - distributorCommission,
  };
}
