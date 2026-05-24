export type RxPlusCategory = string;

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
  suggested_retail_price: number | null;
  base_cost: number;
  active: boolean;
  visibility_type: RxPlusVisibility;
  description: string;
  badges?: string[];
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
  commission_rate?: number;
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
  displayPrice: number | null;
};

const now = '2026-05-20T00:00:00.000Z';

export const RX_PLUS_DISTRIBUTORS: RxPlusDistributor[] = [
  {
    id: 'dist_guy',
    name: 'Guy',
    slug: 'guy',
    portal_name: 'AACTIVATEDRX',
    commission_rate: 0.6,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_mark',
    name: 'Mark Ayala',
    slug: 'mark',
    portal_name: 'Empire Health & Wellness',
    commission_rate: 0.65,
    is_active: true,
    white_label_enabled: false,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
];

export const RX_PLUS_PRODUCTS: RxPlusProduct[] = [
  { id: 'retatrutide-5mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '5mg', sku: 'RXP-GLP-RETA-5', suggested_retail_price: 150, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', badges: ['AACTIVATEDRX Exclusive'], created_at: now, updated_at: now },
  { id: 'retatrutide-10mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-RETA-10', suggested_retail_price: 200, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', badges: ['AACTIVATEDRX Exclusive', 'popular'], created_at: now, updated_at: now },
  { id: 'retatrutide-15mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '15mg', sku: 'RXP-GLP-RETA-15', suggested_retail_price: 250, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', created_at: now, updated_at: now },
  { id: 'retatrutide-20mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '20mg', sku: 'RXP-GLP-RETA-20', suggested_retail_price: 350, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded GLP option available through AACTIVATEDRX review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'tirzepatide-10mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-TIRZ-10', suggested_retail_price: 200, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'GLP/GIP weight-management option available through partner review.', badges: ['popular'], created_at: now, updated_at: now },
  { id: 'tirzepatide-15mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '15mg', sku: 'RXP-GLP-TIRZ-15', suggested_retail_price: 250, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'GLP/GIP weight-management option available through partner review.', created_at: now, updated_at: now },
  { id: 'tirzepatide-20mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '20mg', sku: 'RXP-GLP-TIRZ-20', suggested_retail_price: 350, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded GLP/GIP option available through AACTIVATEDRX review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'tirzepatide-30mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '30mg', sku: 'RXP-GLP-TIRZ-30', suggested_retail_price: 600, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Higher-strength GLP/GIP partner catalog option.', badges: ['best seller'], created_at: now, updated_at: now },
  { id: 'tirzepatide-60mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '60mg', sku: 'RXP-GLP-TIRZ-60', suggested_retail_price: 950, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded high-strength GLP/GIP partner catalog option.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'cagrisema', product_name: 'CagriSema', category: 'GLP / Weight Management', strength: 'Blend', sku: 'RXP-GLP-CAGRISEMA', suggested_retail_price: 450, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded partner catalog blend for weight-management review.', badges: ['AACTIVATEDRX Exclusive'], created_at: now, updated_at: now },
  { id: 'cagrilintide-5mg', product_name: 'Cagrilintide', category: 'GLP / Weight Management', strength: '5mg', sku: 'RXP-GLP-CAGRI-5', suggested_retail_price: 220, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog metabolic-support option for clinical review.', created_at: now, updated_at: now },
  { id: 'aod-9604-5mg', product_name: 'AOD-9604', category: 'GLP / Weight Management', strength: '5mg', sku: 'RXP-GLP-AOD-5', suggested_retail_price: 119, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Metabolic-support peptide available through partner review.', created_at: now, updated_at: now },
  { id: 'aod-9604-10mg', product_name: 'AOD-9604', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-AOD-10', suggested_retail_price: 199, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Metabolic-support peptide available through partner review.', created_at: now, updated_at: now },

  { id: 'hgh-10iu', product_name: 'HGH', category: 'Growth / Performance', strength: '10iu', sku: 'RXP-GROW-HGH-10', suggested_retail_price: 99, base_cost: 0, active: true, visibility_type: 'distributor_only', description: 'Growth and performance support item subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-15iu', product_name: 'HGH', category: 'Growth / Performance', strength: '15iu', sku: 'RXP-GROW-HGH-15', suggested_retail_price: 149, base_cost: 0, active: true, visibility_type: 'distributor_only', description: 'Growth and performance support item subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-24iu', product_name: 'HGH', category: 'Growth / Performance', strength: '24iu', sku: 'RXP-GROW-HGH-24', suggested_retail_price: 199, base_cost: 0, active: true, visibility_type: 'distributor_only', description: 'Growth and performance support item subject to verification.', created_at: now, updated_at: now },
  { id: 'hgh-36iu', product_name: 'HGH', category: 'Growth / Performance', strength: '36iu', sku: 'RXP-GROW-HGH-36', suggested_retail_price: 279, base_cost: 0, active: true, visibility_type: 'distributor_only', description: 'Growth and performance support item subject to verification.', created_at: now, updated_at: now },
  { id: 'tesamorelin-2mg', product_name: 'Tesamorelin', category: 'Growth / Performance', strength: '2mg', sku: 'RXP-GROW-TESA-2', suggested_retail_price: 79, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Growth-hormone pathway support option for clinical review.', created_at: now, updated_at: now },
  { id: 'tesamorelin-5mg', product_name: 'Tesamorelin', category: 'Growth / Performance', strength: '5mg', sku: 'RXP-GROW-TESA-5', suggested_retail_price: 129, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Growth-hormone pathway support option for clinical review.', created_at: now, updated_at: now },
  { id: 'tesamorelin-10mg', product_name: 'Tesamorelin', category: 'Growth / Performance', strength: '10mg', sku: 'RXP-GROW-TESA-10', suggested_retail_price: 229, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Growth-hormone pathway support option for clinical review.', badges: ['popular'], created_at: now, updated_at: now },
  { id: 'cjc-ipamorelin-10mg', product_name: 'CJC + Ipamorelin', category: 'Growth / Performance', strength: '10mg', sku: 'RXP-GROW-CJCIPA-10', suggested_retail_price: 149, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Performance and recovery support blend for clinical review.', badges: ['popular'], created_at: now, updated_at: now },
  { id: 'mk-677', product_name: 'MK-677', category: 'Growth / Performance', strength: 'Standard', sku: 'RXP-GROW-MK677', suggested_retail_price: 79, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Growth and performance support item in the partner catalog.', created_at: now, updated_at: now },

  { id: 'wolverine-bpc-tb', product_name: 'Wolverine BPC/TB Blend', category: 'Recovery / Repair', strength: 'Blend', sku: 'RXP-REC-WOLV', suggested_retail_price: 149, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Recovery blend commonly requested for repair and training support review.', badges: ['best seller'], created_at: now, updated_at: now },
  { id: 'bpc-157-10mg', product_name: 'BPC-157', category: 'Recovery / Repair', strength: '10mg', sku: 'RXP-REC-BPC157-10', suggested_retail_price: 99, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Recovery and repair support peptide available through partner review.', created_at: now, updated_at: now },
  { id: 'tb-500-10mg', product_name: 'TB-500', category: 'Recovery / Repair', strength: '10mg', sku: 'RXP-REC-TB500-10', suggested_retail_price: 169, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Recovery-support peptide available through partner review.', created_at: now, updated_at: now },
  { id: 'ghk-cu-100mg', product_name: 'GHK-CU', category: 'Recovery / Repair', strength: '100mg', sku: 'RXP-REC-GHKCU-100', suggested_retail_price: 119, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Repair and skin-support peptide available through partner review.', created_at: now, updated_at: now },

  { id: 'mots-c-10mg', product_name: 'MOTS-C', category: 'Longevity / Wellness', strength: '10mg', sku: 'RXP-LONG-MOTSC-10', suggested_retail_price: 129, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Longevity and mitochondrial-support option for wellness review.', created_at: now, updated_at: now },
  { id: 'nad-100iu', product_name: 'NAD+', category: 'Longevity / Wellness', strength: '100iu', sku: 'RXP-LONG-NAD-100', suggested_retail_price: 69, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Longevity wellness item available through partner review.', created_at: now, updated_at: now },
  { id: 'nad-500iu', product_name: 'NAD+', category: 'Longevity / Wellness', strength: '500iu', sku: 'RXP-LONG-NAD-500', suggested_retail_price: 119, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Longevity wellness item available through partner review.', badges: ['popular'], created_at: now, updated_at: now },
  { id: 'nad-1000iu', product_name: 'NAD+', category: 'Longevity / Wellness', strength: '1000iu', sku: 'RXP-LONG-NAD-1000', suggested_retail_price: 179, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Longevity wellness item available through partner review.', created_at: now, updated_at: now },
  { id: 'glutathione-1500mg', product_name: 'Glutathione', category: 'Longevity / Wellness', strength: '1500mg', sku: 'RXP-LONG-GLUTA-1500', suggested_retail_price: 179, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Wellness-support antioxidant option for clinical review.', created_at: now, updated_at: now },
  { id: 'epithalon-10mg', product_name: 'Epithalon', category: 'Longevity / Wellness', strength: '10mg', sku: 'RXP-LONG-EPI-10', suggested_retail_price: 99, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Longevity support item available through partner review.', created_at: now, updated_at: now },
  { id: 'ss-31', product_name: 'SS-31', category: 'Longevity / Wellness', strength: 'Standard', sku: 'RXP-LONG-SS31', suggested_retail_price: 399, base_cost: 0, active: true, visibility_type: 'invite_only', description: 'Advanced longevity option subject to availability and approval.', badges: ['Partner Catalog'], created_at: now, updated_at: now },

  { id: 'selank', product_name: 'Selank', category: 'Cognitive / Wellness', strength: 'Standard', sku: 'RXP-COG-SELANK', suggested_retail_price: 89, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Cognitive wellness item available through partner review.', created_at: now, updated_at: now },
  { id: 'semax', product_name: 'Semax', category: 'Cognitive / Wellness', strength: 'Standard', sku: 'RXP-COG-SEMAX', suggested_retail_price: 89, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Cognitive wellness item available through partner review.', created_at: now, updated_at: now },
  { id: 'pt-141', product_name: 'PT-141', category: 'Cognitive / Wellness', strength: 'Standard', sku: 'RXP-COG-PT141', suggested_retail_price: 129, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Wellness support item available through partner review.', created_at: now, updated_at: now },
];

export const GUY_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = RX_PLUS_PRODUCTS.map((product, index) => ({
  id: `guy-${product.id}`,
  distributor_id: 'dist_guy',
  product_id: product.id,
  is_enabled: true,
  custom_price: null,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.6,
  created_at: now,
  updated_at: now,
}));

type MarkCatalogSeed = {
  id: string;
  product_name: string;
  strength: string;
  category: RxPlusCategory;
  price: number;
  badges?: string[];
};

const MARK_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'mark-retatrutide-5mg', product_name: 'Retatrutide', strength: '5mg', category: 'Weight Loss / GLP-1', price: 150, badges: ['popular'] },
  { id: 'mark-retatrutide-10mg', product_name: 'Retatrutide', strength: '10mg', category: 'Weight Loss / GLP-1', price: 200, badges: ['best seller'] },
  { id: 'mark-retatrutide-15mg', product_name: 'Retatrutide', strength: '15mg', category: 'Weight Loss / GLP-1', price: 250 },
  { id: 'mark-retatrutide-30mg', product_name: 'Retatrutide', strength: '30mg', category: 'Weight Loss / GLP-1', price: 600 },
  { id: 'mark-tirzepatide-10mg', product_name: 'Tirzepatide', strength: '10mg', category: 'Weight Loss / GLP-1', price: 200, badges: ['popular'] },
  { id: 'mark-tirzepatide-15mg', product_name: 'Tirzepatide', strength: '15mg', category: 'Weight Loss / GLP-1', price: 250 },
  { id: 'mark-tirzepatide-30mg', product_name: 'Tirzepatide', strength: '30mg', category: 'Weight Loss / GLP-1', price: 600, badges: ['best seller'] },
  { id: 'mark-semaglutide-10mg', product_name: 'Semaglutide', strength: '10mg', category: 'Weight Loss / GLP-1', price: 200, badges: ['popular'] },
  { id: 'mark-semaglutide-15mg', product_name: 'Semaglutide', strength: '15mg', category: 'Weight Loss / GLP-1', price: 250 },
  { id: 'mark-semaglutide-3mg-oral-30ct', product_name: 'Semaglutide Oral', strength: '3mg Oral 30ct', category: 'Weight Loss / GLP-1', price: 300 },
  { id: 'mark-cagrilintide-10mg', product_name: 'Cagrilintide', strength: '10mg', category: 'Weight Loss / GLP-1', price: 300 },
  { id: 'mark-mazdutide', product_name: 'Mazdutide', strength: 'Standard', category: 'Weight Loss / GLP-1', price: 200 },
  { id: 'mark-survodutide', product_name: 'Survodutide', strength: 'Standard', category: 'Weight Loss / GLP-1', price: 200 },
  { id: 'mark-aod9604-5mg', product_name: 'AOD9604', strength: '5mg', category: 'Weight Loss / GLP-1', price: 200 },
  { id: 'mark-5-amino-1mq', product_name: '5 Amino-1MQ', strength: 'Standard', category: 'Weight Loss / GLP-1', price: 200 },

  { id: 'mark-bpc-157-5mg', product_name: 'BPC-157', strength: '5mg', category: 'Recovery / Repair', price: 150 },
  { id: 'mark-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Repair', price: 200, badges: ['popular'] },
  { id: 'mark-tb-500-5mg', product_name: 'TB-500', strength: '5mg', category: 'Recovery / Repair', price: 150 },
  { id: 'mark-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Repair', price: 200 },
  { id: 'mark-wolverine-stack', product_name: 'Wolverine Stack', strength: 'TB500 + BPC157', category: 'Recovery / Repair', price: 300, badges: ['best seller'] },
  { id: 'mark-glow', product_name: 'GLOW', strength: '70mg', category: 'Recovery / Repair', price: 300 },
  { id: 'mark-klow', product_name: 'KLOW', strength: 'Standard', category: 'Recovery / Repair', price: 300 },
  { id: 'mark-kpv', product_name: 'KPV', strength: 'Standard', category: 'Recovery / Repair', price: 150 },
  { id: 'mark-ghk-cu-50mg', product_name: 'GHK-CU', strength: '50mg', category: 'Recovery / Repair', price: 200 },
  { id: 'mark-ss-31', product_name: 'SS-31', strength: 'Standard', category: 'Recovery / Repair', price: 250 },

  { id: 'mark-cjc-1295', product_name: 'CJC-1295', strength: 'Standard', category: 'Growth Hormone / Longevity', price: 200 },
  { id: 'mark-cjc-ipamorelin-10mg', product_name: 'CJC + Ipamorelin', strength: '10mg', category: 'Growth Hormone / Longevity', price: 300, badges: ['popular'] },
  { id: 'mark-ipamorelin-5mg', product_name: 'Ipamorelin', strength: '5mg', category: 'Growth Hormone / Longevity', price: 150 },
  { id: 'mark-kisspeptin-10mg', product_name: 'Kisspeptin', strength: '10mg', category: 'Growth Hormone / Longevity', price: 200 },
  { id: 'mark-mk-677', product_name: 'MK-677', strength: 'Standard', category: 'Growth Hormone / Longevity', price: 200 },
  { id: 'mark-igf', product_name: 'IGF', strength: 'Standard', category: 'Growth Hormone / Longevity', price: 300 },
  { id: 'mark-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Growth Hormone / Longevity', price: 300 },
  { id: 'mark-sermorelin', product_name: 'Sermorelin', strength: 'Standard', category: 'Growth Hormone / Longevity', price: 300 },
  { id: 'mark-hgh-100iu-kit', product_name: 'HGH Kit', strength: '100iu', category: 'Growth Hormone / Longevity', price: 600 },
  { id: 'mark-hgh-150iu-kit', product_name: 'HGH Kit', strength: '150iu', category: 'Growth Hormone / Longevity', price: 700 },
  { id: 'mark-hcg-5000iu', product_name: 'HCG', strength: '5000iu', category: 'Growth Hormone / Longevity', price: 150 },
  { id: 'mark-hcg-10000iu', product_name: 'HCG', strength: '10,000iu', category: 'Growth Hormone / Longevity', price: 200 },
  { id: 'mark-hmg-75iu', product_name: 'HMG', strength: '75iu', category: 'Growth Hormone / Longevity', price: 150 },

  { id: 'mark-nad-plus', product_name: 'NAD+', strength: 'Standard', category: 'Wellness / Anti-Aging', price: 300, badges: ['popular'] },
  { id: 'mark-nad-1000mg', product_name: 'NAD+', strength: '1000mg', category: 'Wellness / Anti-Aging', price: 300 },
  { id: 'mark-glutathione', product_name: 'Glutathione', strength: 'Standard', category: 'Wellness / Anti-Aging', price: 300 },
  { id: 'mark-pt-141', product_name: 'PT-141', strength: 'Standard', category: 'Wellness / Anti-Aging', price: 200 },
  { id: 'mark-melanotan-i-10mg', product_name: 'Melanotan I', strength: '10mg', category: 'Wellness / Anti-Aging', price: 150 },
  { id: 'mark-melanotan-ii-10mg', product_name: 'Melanotan II', strength: '10mg', category: 'Wellness / Anti-Aging', price: 150 },
  { id: 'mark-mots-c-10mg', product_name: 'MOTS-C', strength: '10mg', category: 'Wellness / Anti-Aging', price: 200 },
  { id: 'mark-epithalon-10mg', product_name: 'Epithalon', strength: '10mg', category: 'Wellness / Anti-Aging', price: 300 },

  { id: 'mark-semax-10mg', product_name: 'Semax', strength: '10mg', category: 'Neuro / Cognitive / Mood', price: 200 },
  { id: 'mark-selank', product_name: 'Selank', strength: 'Standard', category: 'Neuro / Cognitive / Mood', price: 200 },
  { id: 'mark-dsip-2mg', product_name: 'DSIP', strength: '2mg', category: 'Neuro / Cognitive / Mood', price: 150 },

  { id: 'mark-mixing-water', product_name: 'Mixing Water', strength: 'Supply', category: 'Functional / Supplies', price: 20 },
  { id: 'mark-needles', product_name: 'Needles', strength: 'Supply', category: 'Functional / Supplies', price: 20 },
  { id: 'mark-b12', product_name: 'B12', strength: 'Standard', category: 'Functional / Supplies', price: 150 },
];

export const MARK_PORTAL_PRODUCTS: RxPlusProduct[] = MARK_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `MARK-${item.id.replace(/^mark-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Approved portal item. Availability subject to verification and fulfillment status.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const MARK_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = MARK_PORTAL_PRODUCTS.map((product, index) => ({
  id: `mark-${product.id}`,
  distributor_id: 'dist_mark',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 6 || Boolean(product.badges?.includes('best seller')),
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
  'GLP / Weight Management',
  'Growth / Performance',
  'Recovery / Repair',
  'Longevity / Wellness',
  'Cognitive / Wellness',
];

export function getDistributorProducts(distributorSlug: string): DistributorCatalogProduct[] {
  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === distributorSlug);
  if (!distributor) return [];
  const distributorProducts = distributor.slug === 'mark' ? MARK_DISTRIBUTOR_PRODUCTS : GUY_DISTRIBUTOR_PRODUCTS;
  const productPool = distributor.slug === 'mark' ? MARK_PORTAL_PRODUCTS : RX_PLUS_PRODUCTS;

  return distributorProducts
    .filter((item) => item.distributor_id === distributor.id && item.is_enabled)
    .map((item) => {
      const product = productPool.find((p) => p.id === item.product_id);
      return product ? { ...product, distributorProduct: item, displayPrice: item.custom_price ?? product.suggested_retail_price } : null;
    })
    .filter((product): product is DistributorCatalogProduct => product !== null);
}

export function getDistributorProductById(distributorSlug: string, productId: string): DistributorCatalogProduct | null {
  return getDistributorProducts(distributorSlug).find((product) => product.id === productId) ?? null;
}

export function estimateDistributorCommission(grossSale: number, productCost: number, commissionRate = 0.6) {
  const netProfit = Math.max(0, grossSale - productCost);
  const distributorCommission = netProfit * commissionRate;
  return {
    grossSale,
    productCost,
    shippingCost: 0,
    processingFee: 0,
    discounts: 0,
    refunds: 0,
    netProfit,
    distributorCommission,
    platformProfit: netProfit - distributorCommission,
  };
}
