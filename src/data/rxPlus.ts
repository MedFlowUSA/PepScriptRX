import type { InventoryStatusSnapshot } from '../lib/inventoryStatus';
import { anatoliaStorefront } from '../config/anatolia';
import { INTAKE_PRODUCTS } from './products';

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
  inventoryStatus?: InventoryStatusSnapshot;
  inventoryStatusSource?: 'main' | 'store_override' | 'fallback';
  scopedSortOrder?: number | null;
  scopedRetailPrice?: number | null;
  scopedSalePrice?: number | null;
  scopedProductNote?: string | null;
  scopedBundleGroupKey?: string | null;
  scopedBundleGroupName?: string | null;
  scopedBundleDiscountPercent?: number | null;
  scopedBundleDiscountAmount?: number | null;
  scopedBundleNote?: string | null;
};

const now = '2026-05-20T00:00:00.000Z';

export const RX_PLUS_DISTRIBUTORS: RxPlusDistributor[] = [
  {
    id: 'dist_guy',
    name: 'Guy',
    slug: 'guy',
    portal_name: 'AACTIVATED-RX',
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
  {
    id: 'dist_ehwsub',
    name: 'Ellie Beyer',
    slug: 'ehwsub',
    portal_name: 'Ellie',
    commission_rate: 0.45,
    is_active: true,
    white_label_enabled: false,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_robert',
    name: 'Robert Luevano',
    slug: 'robert',
    portal_name: 'WarXlabz',
    commission_rate: 0.4,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_scott',
    name: 'Scott Bowman',
    slug: 'scott',
    portal_name: 'Peak Form Peptides',
    commission_rate: 0.4,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_alpha',
    name: 'John Ayala',
    slug: 'alpha',
    portal_name: 'Alpha Pride Wellness',
    commission_rate: 0.45,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_optimax',
    name: 'Gabriel Martinez',
    slug: 'optimax',
    portal_name: 'Optimax Peptide Therapy',
    commission_rate: 0,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_ronin',
    name: 'Matthew Thomas',
    slug: 'ronin',
    portal_name: 'Ronin',
    commission_rate: 0.5,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_agprime',
    name: 'Angel Gallardo',
    slug: 'agprime',
    portal_name: 'AG Prime Lab',
    commission_rate: 0.45,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_vyigenix',
    name: 'John Paul Theis',
    slug: 'vyigenix',
    portal_name: 'Vyigenix Pharmaceuticals',
    commission_rate: 0.5,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_rockphorm',
    name: 'Rick Diaz',
    slug: 'rockphorm',
    portal_name: 'Rock Phorm',
    commission_rate: 0.6,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_aurora',
    name: 'Mike',
    slug: 'aurora',
    portal_name: 'Aurora Labs',
    commission_rate: 0.4,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_zenora',
    name: 'Jessica Hinojosa',
    slug: 'zenora',
    portal_name: 'ZENORA Precision Wellness & Peptide Therapy',
    commission_rate: 0.45,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_physiopeptides',
    name: 'Dr. Roman Felix',
    slug: 'physiopeptides',
    portal_name: 'PhysioPeptides',
    commission_rate: 0.99,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_ginto',
    name: 'Ginto Wellness Labs',
    slug: 'ginto',
    portal_name: 'Ginto Wellness Labs',
    commission_rate: 0.5,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_anatolia',
    name: anatoliaStorefront.brandName,
    slug: anatoliaStorefront.slug,
    portal_name: anatoliaStorefront.brandName,
    commission_rate: 0,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'dist_glow',
    name: 'Vanessa Cosio',
    slug: 'glow',
    portal_name: 'GLOW',
    commission_rate: 0.8,
    is_active: true,
    white_label_enabled: true,
    wholesale_enabled: false,
    created_at: now,
    updated_at: now,
  },
];

export const RX_PLUS_PRODUCTS: RxPlusProduct[] = [
  { id: 'retatrutide-5mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '5mg', sku: 'RXP-GLP-RETA-5', suggested_retail_price: 150, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', badges: ['AACTIVATED-RX Exclusive'], created_at: now, updated_at: now },
  { id: 'retatrutide-10mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-RETA-10', suggested_retail_price: 200, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', badges: ['AACTIVATED-RX Exclusive', 'popular'], created_at: now, updated_at: now },
  { id: 'retatrutide-15mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '15mg', sku: 'RXP-GLP-RETA-15', suggested_retail_price: 250, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Partner catalog GLP option for weight-management review.', created_at: now, updated_at: now },
  { id: 'retatrutide-20mg', product_name: 'Retatrutide', category: 'GLP / Weight Management', strength: '20mg', sku: 'RXP-GLP-RETA-20', suggested_retail_price: 350, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded GLP option available through partner catalog review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'tirzepatide-10mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-TIRZ-10', suggested_retail_price: 200, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'GLP/GIP weight-management option available through partner review.', badges: ['popular'], created_at: now, updated_at: now },
  { id: 'tirzepatide-15mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '15mg', sku: 'RXP-GLP-TIRZ-15', suggested_retail_price: 250, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'GLP/GIP weight-management option available through partner review.', created_at: now, updated_at: now },
  { id: 'tirzepatide-20mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '20mg', sku: 'RXP-GLP-TIRZ-20', suggested_retail_price: 350, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded GLP/GIP option available through partner catalog review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'tirzepatide-30mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '30mg', sku: 'RXP-GLP-TIRZ-30', suggested_retail_price: 600, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Higher-strength GLP/GIP partner catalog option.', badges: ['best seller'], created_at: now, updated_at: now },
  { id: 'tirzepatide-60mg', product_name: 'Tirzepatide', category: 'GLP / Weight Management', strength: '60mg', sku: 'RXP-GLP-TIRZ-60', suggested_retail_price: 950, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded high-strength GLP/GIP partner catalog option.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'semaglutide-10mg', product_name: 'Semaglutide', category: 'GLP / Weight Management', strength: '10mg', sku: 'RXP-GLP-SEMA-10', suggested_retail_price: 99, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'GLP weight-management option available through partner review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'cagrisema', product_name: 'CagriSema', category: 'GLP / Weight Management', strength: 'Blend', sku: 'RXP-GLP-CAGRISEMA', suggested_retail_price: 450, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Expanded partner catalog blend for weight-management review.', badges: ['AACTIVATED-RX Exclusive'], created_at: now, updated_at: now },
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
  { id: 'glow-peptide-blend', product_name: 'Glow Peptide Blend', category: 'Recovery / Repair', strength: 'Blend', sku: 'RXP-REC-GLOW', suggested_retail_price: 169, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Recovery and skin-support blend available through partner review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
  { id: 'klow-peptide-blend', product_name: 'Klow Peptide Blend', category: 'Recovery / Repair', strength: 'Blend', sku: 'RXP-REC-KLOW', suggested_retail_price: 169, base_cost: 0, active: true, visibility_type: 'rx_plus', description: 'Recovery and repair blend available through partner review.', badges: ['Partner Catalog'], created_at: now, updated_at: now },
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
  { id: 'igf-1-lr3-1mg', product_name: 'IGF-1 LR3', category: 'Growth / Performance', strength: '1mg', sku: 'RXP-GROW-IGF1-LR3-1', suggested_retail_price: 199, base_cost: 0, active: true, visibility_type: 'distributor_only', description: 'Growth and performance support item requiring additional verification.', badges: ['Physician Review'], created_at: now, updated_at: now },
];

export const GUY_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = RX_PLUS_PRODUCTS.map((product) => ({
  id: `guy-${product.id}`,
  distributor_id: 'dist_guy',
  product_id: product.id,
  is_enabled: true,
  custom_price: null,
  featured: false,
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

export const EHW_SUB_PORTAL_PRODUCTS: RxPlusProduct[] = MARK_CATALOG_SEED.map((item) => ({
  id: item.id.replace(/^mark-/, 'ehwsub-'),
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `EHWSUB-${item.id.replace(/^mark-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Ellie catalog item. Availability subject to verification and fulfillment status.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const EHW_SUB_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = EHW_SUB_PORTAL_PRODUCTS.map((product, index) => ({
  id: `ehwsub-${product.id}`,
  distributor_id: 'dist_ehwsub',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 6 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.45,
  created_at: now,
  updated_at: now,
}));

const ZENORA_EXTRA_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'mark-retatrutide-20mg', product_name: 'Retatrutide', strength: '20mg', category: 'Weight Loss / GLP-1', price: 250 },
  { id: 'mark-tirzepatide-20mg', product_name: 'Tirzepatide', strength: '20mg', category: 'Weight Loss / GLP-1', price: 200 },
  { id: 'mark-tirzepatide-60mg', product_name: 'Tirzepatide', strength: '60mg', category: 'Weight Loss / GLP-1', price: 600 },
];

function zenoraPriceFor(item: MarkCatalogSeed): number {
  const key = `${item.product_name.toLowerCase()}|${item.strength.toLowerCase()}`;
  const name = item.product_name.toLowerCase();
  const overrides: Record<string, number> = {
    'retatrutide|5mg': 80,
    'retatrutide|10mg': 100,
    'retatrutide|15mg': 150,
    'retatrutide|20mg': 250,
    'retatrutide|30mg': 350,
    'tirzepatide|10mg': 100,
    'tirzepatide|15mg': 150,
    'tirzepatide|20mg': 200,
    'tirzepatide|30mg': 350,
    'tirzepatide|60mg': 600,
    'semaglutide|10mg': 150,
    'nad+|standard': 250,
    'nad+|1000mg': 250,
    'glutathione|standard': 100,
    'ghk-cu|50mg': 100,
    'ghk-cu|100mg': 100,
    'mots-c|10mg': 250,
    'kisspeptin|10mg': 200,
    'selank|standard': 200,
    'semax|10mg': 200,
  };

  if (overrides[key] !== undefined) return overrides[key];
  if (name === 'bpc-157') return 150;
  if (name === 'tb-500') return 150;
  if (name.includes('wolverine')) return 300;
  if (name === 'glow' || name === 'glow blend') return 300;
  return item.price;
}

const ZENORA_CATALOG_SEED: MarkCatalogSeed[] = [...MARK_CATALOG_SEED, ...ZENORA_EXTRA_CATALOG_SEED]
  .map((item) => ({
    ...item,
    id: item.id.replace(/^mark-/, 'zenora-'),
    product_name: item.product_name === 'GLOW' ? 'Glow Blend' : item.product_name,
    price: zenoraPriceFor(item),
    badges: item.badges,
  }));

export const ZENORA_PORTAL_PRODUCTS: RxPlusProduct[] = ZENORA_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `ZENORA-${item.id.replace(/^zenora-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'ZENORA catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const ZENORA_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = ZENORA_PORTAL_PRODUCTS.map((product, index) => ({
  id: `zenora-dist-${product.id}`,
  distributor_id: 'dist_zenora',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 6 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.45,
  created_at: now,
  updated_at: now,
}));

export const ALPHA_PORTAL_PRODUCTS: RxPlusProduct[] = MARK_CATALOG_SEED.map((item) => ({
  id: item.id.replace(/^mark-/, 'alpha-'),
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `ALPHA-${item.id.replace(/^mark-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Alpha Pride Wellness catalog item. Availability subject to verification and fulfillment status.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const ALPHA_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = ALPHA_PORTAL_PRODUCTS.map((product, index) => ({
  id: `alpha-dist-${product.id}`,
  distributor_id: 'dist_alpha',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 6 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.45,
  created_at: now,
  updated_at: now,
}));

const ROBERT_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'warxlabz-reta-10mg', product_name: 'Reta', strength: '10mg', category: 'Weight Loss / GLP-1', price: 95, badges: ['WarXlabz Pricing'] },
  { id: 'warxlabz-reta-20mg', product_name: 'Reta', strength: '20mg', category: 'Weight Loss / GLP-1', price: 160 },
  { id: 'warxlabz-reta-30mg', product_name: 'Reta', strength: '30mg', category: 'Weight Loss / GLP-1', price: 220 },
  { id: 'warxlabz-reta-50mg', product_name: 'Reta', strength: '50mg', category: 'Weight Loss / GLP-1', price: 375 },
  { id: 'warxlabz-reta-oral-500mcg', product_name: 'Reta Oral', strength: '500mcg', category: 'Weight Loss / GLP-1', price: 175 },
  { id: 'warxlabz-tirzepatide-10mg', product_name: 'Tirzepatide', strength: '10mg', category: 'Weight Loss / GLP-1', price: 90, badges: ['popular'] },
  { id: 'warxlabz-tirzepatide-20mg', product_name: 'Tirzepatide', strength: '20mg', category: 'Weight Loss / GLP-1', price: 145 },
  { id: 'warxlabz-tirzepatide-30mg', product_name: 'Tirzepatide', strength: '30mg', category: 'Weight Loss / GLP-1', price: 199, badges: ['best seller'] },
  { id: 'warxlabz-tirzepatide-oral-500mcg', product_name: 'Tirzepatide Oral', strength: '500mcg', category: 'Weight Loss / GLP-1', price: 125 },
  { id: 'warxlabz-ghk-cu-50mg', product_name: 'GHK-Cu', strength: '50mg', category: 'Recovery / Repair', price: 45 },
  { id: 'warxlabz-ghk-cu-100mg', product_name: 'GHK-Cu', strength: '100mg', category: 'Recovery / Repair', price: 85 },
  { id: 'warxlabz-mots-c-10mg', product_name: 'MOTS-c', strength: '10mg', category: 'Wellness / Anti-Aging', price: 65 },
  { id: 'warxlabz-mots-c-40mg', product_name: 'MOTS-c', strength: '40mg', category: 'Wellness / Anti-Aging', price: 150 },
  { id: 'warxlabz-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Growth Hormone / Longevity', price: 100 },
  { id: 'warxlabz-tesamorelin-20mg', product_name: 'Tesamorelin', strength: '20mg', category: 'Growth Hormone / Longevity', price: 185 },
  { id: 'warxlabz-cjc-ipamorelin-10mg', product_name: 'CJC + Ipamorelin', strength: '10mg', category: 'Growth Hormone / Longevity', price: 100, badges: ['popular'] },
  { id: 'warxlabz-igf-1-lr3-1mg', product_name: 'IGF-1 LR3', strength: '1mg', category: 'Growth Hormone / Longevity', price: 150 },
  { id: 'warxlabz-hgh-kit-100iu', product_name: 'HGH Kit', strength: '100iu', category: 'Growth Hormone / Longevity', price: 220 },
  { id: 'warxlabz-hgh-kit-240iu', product_name: 'HGH Kit', strength: '240iu', category: 'Growth Hormone / Longevity', price: 360 },
  { id: 'warxlabz-hgh-kit-360iu', product_name: 'HGH Kit', strength: '360iu', category: 'Growth Hormone / Longevity', price: 500 },
  { id: 'warxlabz-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Repair', price: 65 },
  { id: 'warxlabz-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Repair', price: 70 },
  { id: 'warxlabz-klow-80mg', product_name: 'Klow', strength: '80mg', category: 'Recovery / Repair', price: 125 },
  { id: 'warxlabz-wolverine-stack-10mg', product_name: 'Wolverine Stack', strength: '10mg', category: 'Recovery / Repair', price: 100 },
  { id: 'warxlabz-wolverine-stack-20mg', product_name: 'Wolverine Stack', strength: '20mg', category: 'Recovery / Repair', price: 140 },
  { id: 'warxlabz-nad-1000mg', product_name: 'NAD+', strength: '1000mg', category: 'Wellness / Anti-Aging', price: 100 },
  { id: 'warxlabz-lipo-c-b12', product_name: 'Lipo-C B12', strength: 'Standard', category: 'Wellness / Anti-Aging', price: 100 },
  { id: 'warxlabz-hcg-10000iu', product_name: 'HCG', strength: '10000iu', category: 'Growth Hormone / Longevity', price: 125 },
  { id: 'warxlabz-semax-10mg', product_name: 'Semax', strength: '10mg', category: 'Neuro / Cognitive / Mood', price: 55 },
  { id: 'warxlabz-selank-10mg', product_name: 'Selank', strength: '10mg', category: 'Neuro / Cognitive / Mood', price: 55 },
  { id: 'warxlabz-mt-2-10mg', product_name: 'MT-2', strength: '10mg', category: 'Wellness / Anti-Aging', price: 50 },
  { id: 'warxlabz-pt-141-10mg', product_name: 'PT-141', strength: '10mg', category: 'Wellness / Anti-Aging', price: 55 },
  { id: 'warxlabz-glutathione', product_name: 'Glutathione', strength: 'Standard', category: 'Wellness / Anti-Aging', price: 90 },
  { id: 'warxlabz-bac-water-10ml', product_name: 'Bac Water', strength: '10ml', category: 'Functional / Supplies', price: 15 },
  { id: 'warxlabz-bac-water-30ml', product_name: 'Bac Water', strength: '30ml', category: 'Functional / Supplies', price: 25 },
  { id: 'warxlabz-needles-31g-10-pack', product_name: 'Needles 31g', strength: '10 pack', category: 'Functional / Supplies', price: 10 },
];

export const ROBERT_PORTAL_PRODUCTS: RxPlusProduct[] = ROBERT_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `WARX-${item.id.replace(/^warxlabz-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'WarXlabz custom catalog item. Availability subject to verification, clinical review, and fulfillment status.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const ROBERT_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = ROBERT_PORTAL_PRODUCTS.map((product, index) => ({
  id: `robert-${product.id}`,
  distributor_id: 'dist_robert',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.4,
  created_at: now,
  updated_at: now,
}));

const SCOTT_CATALOG_SEED: MarkCatalogSeed[] = [
  // GLP / Weight Management
  { id: 'scott-retatrutide-10mg',  product_name: 'Retatrutide',   strength: '10mg',     category: 'GLP / Weight Management', price: 130, badges: ['popular'] },
  { id: 'scott-retatrutide-15mg',  product_name: 'Retatrutide',   strength: '15mg',     category: 'GLP / Weight Management', price: 150, badges: ['best seller'] },
  { id: 'scott-retatrutide-30mg',  product_name: 'Retatrutide',   strength: '30mg',     category: 'GLP / Weight Management', price: 180 },
  { id: 'scott-tirzepatide-10mg',  product_name: 'Tirzepatide',   strength: '10mg',     category: 'GLP / Weight Management', price: 200, badges: ['popular'] },
  { id: 'scott-tirzepatide-15mg',  product_name: 'Tirzepatide',   strength: '15mg',     category: 'GLP / Weight Management', price: 250 },
  { id: 'scott-tirzepatide-30mg',  product_name: 'Tirzepatide',   strength: '30mg',     category: 'GLP / Weight Management', price: 600, badges: ['best seller'] },
  { id: 'scott-hgh-somatropin-10iu-10-vials', product_name: 'HGH Somatropin', strength: '10 vials x 10iu', category: 'Growth / Performance', price: 175, badges: ['popular'] },
  // Healing / Recovery
  { id: 'scott-aod9604-5mg',       product_name: 'AOD-9604',      strength: '5mg',      category: 'Recovery / Repair', price: 50 },
  { id: 'scott-5amino1mq',         product_name: '5-Amino-1MQ',   strength: 'Standard', category: 'Recovery / Repair', price: 100 },
  { id: 'scott-bpc157-5mg',        product_name: 'BPC-157',       strength: '5mg',      category: 'Recovery / Repair', price: 50 },
  { id: 'scott-bpc157-10mg',       product_name: 'BPC-157',       strength: '10mg',     category: 'Recovery / Repair', price: 60 },
  { id: 'scott-tb500-5mg',         product_name: 'TB-500',        strength: '5mg',      category: 'Recovery / Repair', price: 50 },
  { id: 'scott-tb500-10mg',        product_name: 'TB-500',        strength: '10mg',     category: 'Recovery / Repair', price: 60 },
  { id: 'scott-wolverine-stack',   product_name: 'Wolverine Stack', strength: '10mg',   category: 'Recovery / Repair', price: 80, badges: ['best seller'] },
  { id: 'scott-glow-stack',        product_name: 'Glow Stack',    strength: 'Blend',    category: 'Recovery / Repair', price: 120, badges: ['popular'] },
  { id: 'scott-klow-stack',        product_name: 'Klow Stack',    strength: 'Blend',    category: 'Recovery / Repair', price: 130 },
  { id: 'scott-ghkcu',             product_name: 'GHK-CU',        strength: 'Standard', category: 'Recovery / Repair', price: 60 },
  { id: 'scott-tesamorelin-10mg',  product_name: 'Tesamorelin',   strength: '10mg',     category: 'Recovery / Repair', price: 70 },
  { id: 'scott-nad-500mg',         product_name: 'NAD+',          strength: '500mg',    category: 'Longevity / Wellness', price: 90, badges: ['popular'] },
  { id: 'scott-glutathione-1500mg',product_name: 'Glutathione',   strength: '1500mg',   category: 'Longevity / Wellness', price: 60 },
  { id: 'scott-mots-c-10mg',       product_name: 'MOTS-C',        strength: '10mg',     category: 'Longevity / Wellness', price: 50 },
  // Accessories
  { id: 'scott-bac-water',         product_name: 'Bacteriostatic Water', strength: 'Standard', category: 'Functional / Supplies', price: 15 },
  { id: 'scott-insulin-needles',   product_name: 'Insulin Needles',      strength: 'Supply',   category: 'Functional / Supplies', price: 15 },
];

export const SCOTT_PORTAL_PRODUCTS: RxPlusProduct[] = SCOTT_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `PFP-${item.id.replace(/^scott-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Peak Form Peptides catalog item. Availability subject to verification and clinical review.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const SCOTT_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = SCOTT_PORTAL_PRODUCTS.map((product, index) => ({
  id: `scott-dist-${product.id}`,
  distributor_id: 'dist_scott',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 6 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.4,
  created_at: now,
  updated_at: now,
}));

const OPTIMAX_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'optimax-retatrutide-5mg', product_name: 'Retatrutide', strength: '5mg', category: 'GLP / Weight Management', price: 119 },
  { id: 'optimax-retatrutide-10mg', product_name: 'Retatrutide', strength: '10mg', category: 'GLP / Weight Management', price: 169, badges: ['popular'] },
  { id: 'optimax-retatrutide-15mg', product_name: 'Retatrutide', strength: '15mg', category: 'GLP / Weight Management', price: 229 },
  { id: 'optimax-retatrutide-20mg', product_name: 'Retatrutide', strength: '20mg', category: 'GLP / Weight Management', price: 289 },
  { id: 'optimax-retatrutide-30mg', product_name: 'Retatrutide', strength: '30mg', category: 'GLP / Weight Management', price: 379, badges: ['best seller'] },
  { id: 'optimax-tirzepatide-10mg', product_name: 'Tirzepatide', strength: '10mg', category: 'GLP / Weight Management', price: 109 },
  { id: 'optimax-tirzepatide-15mg', product_name: 'Tirzepatide', strength: '15mg', category: 'GLP / Weight Management', price: 149, badges: ['popular'] },
  { id: 'optimax-tirzepatide-20mg', product_name: 'Tirzepatide', strength: '20mg', category: 'GLP / Weight Management', price: 189 },
  { id: 'optimax-tirzepatide-30mg', product_name: 'Tirzepatide', strength: '30mg', category: 'GLP / Weight Management', price: 259, badges: ['best seller'] },
  { id: 'optimax-tirzepatide-60mg', product_name: 'Tirzepatide', strength: '60mg', category: 'GLP / Weight Management', price: 429 },
  { id: 'optimax-semaglutide-10mg', product_name: 'Semaglutide', strength: '10mg', category: 'GLP / Weight Management', price: 99 },
  { id: 'optimax-cagrisema', product_name: 'CagriSema', strength: 'Blend', category: 'GLP / Weight Management', price: 299, badges: ['popular'] },
  { id: 'optimax-cagrilintide-5mg', product_name: 'Cagrilintide', strength: '5mg', category: 'GLP / Weight Management', price: 179 },

  { id: 'optimax-bpc-157', product_name: 'BPC-157', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 89 },
  { id: 'optimax-tb-500', product_name: 'TB-500', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 99 },
  { id: 'optimax-bpc-157-tb-500-blend', product_name: 'BPC-157 / TB-500 Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 129, badges: ['best seller'] },
  { id: 'optimax-nad-plus', product_name: 'NAD+', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 119 },
  { id: 'optimax-glutathione', product_name: 'Glutathione', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 79 },
  { id: 'optimax-ghk-cu', product_name: 'GHK-Cu', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 119 },
  { id: 'optimax-glow-peptide-blend', product_name: 'Glow Peptide Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 139 },
  { id: 'optimax-tesamorelin', product_name: 'Tesamorelin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 179 },
  { id: 'optimax-sermorelin', product_name: 'Sermorelin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'optimax-ipamorelin', product_name: 'Ipamorelin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 109 },
  { id: 'optimax-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 149, badges: ['popular'] },
  { id: 'optimax-hgh-somatropin', product_name: 'HGH / Somatropin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 399 },

  { id: 'optimax-aod-9604', product_name: 'AOD-9604', strength: 'Standard', category: 'Additional Catalog / Optional', price: 129 },
  { id: 'optimax-pt-141', product_name: 'PT-141', strength: 'Standard', category: 'Additional Catalog / Optional', price: 109 },
  { id: 'optimax-melanotan-ii', product_name: 'Melanotan II', strength: 'Standard', category: 'Additional Catalog / Optional', price: 89 },
  { id: 'optimax-epitalon', product_name: 'Epitalon', strength: 'Standard', category: 'Additional Catalog / Optional', price: 119 },
  { id: 'optimax-mots-c', product_name: 'MOTS-c', strength: 'Standard', category: 'Additional Catalog / Optional', price: 159 },
  { id: 'optimax-ss-31', product_name: 'SS-31', strength: 'Standard', category: 'Additional Catalog / Optional', price: 169 },
  { id: 'optimax-kisspeptin', product_name: 'Kisspeptin', strength: 'Standard', category: 'Additional Catalog / Optional', price: 149 },
  { id: 'optimax-thymosin-alpha-1', product_name: 'Thymosin Alpha-1', strength: 'Standard', category: 'Additional Catalog / Optional', price: 149 },
  { id: 'optimax-dsip', product_name: 'DSIP', strength: 'Standard', category: 'Additional Catalog / Optional', price: 119 },
  { id: 'optimax-selank', product_name: 'Selank', strength: 'Standard', category: 'Additional Catalog / Optional', price: 109 },
  { id: 'optimax-semax', product_name: 'Semax', strength: 'Standard', category: 'Additional Catalog / Optional', price: 109 },
  { id: 'optimax-ll-37', product_name: 'LL-37', strength: 'Standard', category: 'Additional Catalog / Optional', price: 179 },
];

export const OPTIMAX_PORTAL_PRODUCTS: RxPlusProduct[] = OPTIMAX_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `OPT-${item.id.replace(/^optimax-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Optimax Peptide Therapy catalog item. Products and availability may vary. All requests are reviewed before fulfillment.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const OPTIMAX_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = OPTIMAX_PORTAL_PRODUCTS.map((product, index) => ({
  id: `optimax-dist-${product.id}`,
  distributor_id: 'dist_optimax',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0,
  created_at: now,
  updated_at: now,
}));

const RONIN_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'ronin-retatrutide-10mg', product_name: 'Retatrutide', strength: '10mg', category: 'GLP / Weight Management', price: 229, badges: ['popular'] },
  { id: 'ronin-retatrutide-20mg', product_name: 'Retatrutide', strength: '20mg', category: 'GLP / Weight Management', price: 299, badges: ['best seller'] },
  { id: 'ronin-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Repair', price: 139, badges: ['popular'] },
  { id: 'ronin-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Repair', price: 149 },
  { id: 'ronin-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Growth / Performance', price: 199, badges: ['popular'] },
  { id: 'ronin-sermorelin', product_name: 'Sermorelin', strength: 'Standard', category: 'Growth / Performance', price: 129 },
  { id: 'ronin-ipamorelin', product_name: 'Ipamorelin', strength: 'Standard', category: 'Growth / Performance', price: 129 },
  { id: 'ronin-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', strength: 'Blend', category: 'Growth / Performance', price: 169, badges: ['best seller'] },
  { id: 'ronin-hgh-somatropin', product_name: 'HGH / Somatropin', strength: 'Standard', category: 'Growth / Performance', price: 199 },
  { id: 'ronin-mots-c-10mg', product_name: 'MOTS-c', strength: '10mg', category: 'Longevity / Wellness', price: 149 },
  { id: 'ronin-bac-water-syringe-kit', product_name: 'BAC Water + 8-Pack Syringe Kit', strength: 'Kit', category: 'Functional / Supplies', price: 12 },
  { id: 'ronin-insulin-syringe-pack', product_name: 'Insulin Syringe Pack', strength: 'Pack', category: 'Functional / Supplies', price: 12 },
];

export const RONIN_PORTAL_PRODUCTS: RxPlusProduct[] = RONIN_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `RONIN-${item.id.replace(/^ronin-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Ronin catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const RONIN_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = RONIN_PORTAL_PRODUCTS.map((product, index) => ({
  id: `ronin-dist-${product.id}`,
  distributor_id: 'dist_ronin',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.5,
  created_at: now,
  updated_at: now,
}));

const AG_PRIME_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'agprime-retatrutide-10mg', product_name: 'Retatrutide', strength: '10mg', category: 'GLP / Weight Management', price: 229, badges: ['popular'] },
  { id: 'agprime-retatrutide-20mg', product_name: 'Retatrutide', strength: '20mg', category: 'GLP / Weight Management', price: 299, badges: ['best seller'] },
  { id: 'agprime-retatrutide-30mg', product_name: 'Retatrutide', strength: '30mg', category: 'GLP / Weight Management', price: 349 },
  { id: 'agprime-tirzepatide-10mg', product_name: 'Tirzepatide', strength: '10mg', category: 'GLP / Weight Management', price: 129, badges: ['popular'] },
  { id: 'agprime-tirzepatide-20mg', product_name: 'Tirzepatide', strength: '20mg', category: 'GLP / Weight Management', price: 169 },
  { id: 'agprime-tirzepatide-30mg', product_name: 'Tirzepatide', strength: '30mg', category: 'GLP / Weight Management', price: 199, badges: ['best seller'] },
  { id: 'agprime-semaglutide-10mg', product_name: 'Semaglutide', strength: '10mg', category: 'GLP / Weight Management', price: 99 },

  { id: 'agprime-bpc-157-5mg', product_name: 'BPC-157', strength: '5mg', category: 'Recovery / Performance / Wellness', price: 99 },
  { id: 'agprime-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 139, badges: ['popular'] },
  { id: 'agprime-tb-500-5mg', product_name: 'TB-500', strength: '5mg', category: 'Recovery / Performance / Wellness', price: 99 },
  { id: 'agprime-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'agprime-bpc-157-tb-500-blend', product_name: 'BPC-157 / TB-500 Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 159, badges: ['best seller'] },
  { id: 'agprime-nad-plus', product_name: 'NAD+', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'agprime-glutathione-1500mg', product_name: 'Glutathione', strength: '1500mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'agprime-ghk-cu-100mg', product_name: 'GHK-Cu', strength: '100mg', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'agprime-glow-peptide-blend', product_name: 'Glow Peptide Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 169 },
  { id: 'agprime-tesamorelin-5mg', product_name: 'Tesamorelin', strength: '5mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'agprime-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 199, badges: ['popular'] },
  { id: 'agprime-sermorelin', product_name: 'Sermorelin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'agprime-ipamorelin', product_name: 'Ipamorelin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'agprime-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 169, badges: ['best seller'] },
  { id: 'agprime-hgh-somatropin', product_name: 'HGH / Somatropin', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 199 },

  { id: 'agprime-aod-9604-10mg', product_name: 'AOD-9604', strength: '10mg', category: 'Additional Catalog / Optional', price: 169 },
  { id: 'agprime-melanotan-ii', product_name: 'Melanotan II', strength: 'Standard', category: 'Additional Catalog / Optional', price: 119 },
  { id: 'agprime-mots-c-10mg', product_name: 'MOTS-c', strength: '10mg', category: 'Additional Catalog / Optional', price: 149 },
  { id: 'agprime-selank', product_name: 'Selank', strength: 'Standard', category: 'Additional Catalog / Optional', price: 119 },
  { id: 'agprime-semax', product_name: 'Semax', strength: 'Standard', category: 'Additional Catalog / Optional', price: 119 },

  { id: 'agprime-bac-water-syringe-kit', product_name: 'BAC Water + 8-Pack Syringe Kit', strength: 'Kit', category: 'Functional / Supplies', price: 12 },
  { id: 'agprime-reusable-pen-kit', product_name: 'Reusable Pen Kit', strength: 'Kit', category: 'Functional / Supplies', price: 19 },
  { id: 'agprime-insulin-syringe-pack', product_name: 'Insulin Syringe Pack', strength: 'Pack', category: 'Functional / Supplies', price: 12 },
];

export const AG_PRIME_PORTAL_PRODUCTS: RxPlusProduct[] = AG_PRIME_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `AGPRIME-${item.id.replace(/^agprime-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'AG Prime Lab catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const AG_PRIME_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = AG_PRIME_PORTAL_PRODUCTS.map((product, index) => ({
  id: `agprime-dist-${product.id}`,
  distributor_id: 'dist_agprime',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.45,
  created_at: now,
  updated_at: now,
}));

const VYIGENIX_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'vyigenix-retatrutide-10mg', product_name: 'Retatrutide', strength: '10mg', category: 'GLP / Weight Management', price: 229, badges: ['popular'] },
  { id: 'vyigenix-retatrutide-20mg', product_name: 'Retatrutide', strength: '20mg', category: 'GLP / Weight Management', price: 299, badges: ['best seller'] },
  { id: 'vyigenix-tirzepatide-10mg', product_name: 'Tirzepatide', strength: '10mg', category: 'GLP / Weight Management', price: 129, badges: ['popular'] },
  { id: 'vyigenix-tirzepatide-20mg', product_name: 'Tirzepatide', strength: '20mg', category: 'GLP / Weight Management', price: 169 },
  { id: 'vyigenix-semaglutide-10mg', product_name: 'Semaglutide', strength: '10mg', category: 'GLP / Weight Management', price: 99 },
  { id: 'vyigenix-cagrilintide-5mg', product_name: 'Cagrilintide', strength: '5mg', category: 'GLP / Weight Management', price: 179 },
  { id: 'vyigenix-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 139, badges: ['popular'] },
  { id: 'vyigenix-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'vyigenix-bpc-157-tb-500-blend', product_name: 'BPC-157 / TB-500 Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 159, badges: ['best seller'] },
  { id: 'vyigenix-nad-plus', product_name: 'NAD+', strength: 'Standard', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'vyigenix-glutathione-1500mg', product_name: 'Glutathione', strength: '1500mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'vyigenix-ghk-cu-100mg', product_name: 'GHK-Cu', strength: '100mg', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'vyigenix-glow-peptide-blend', product_name: 'Glow Peptide Blend', strength: 'Blend', category: 'Recovery / Performance / Wellness', price: 169 },
  { id: 'vyigenix-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Growth / Performance', price: 199, badges: ['popular'] },
  { id: 'vyigenix-sermorelin', product_name: 'Sermorelin', strength: 'Standard', category: 'Growth / Performance', price: 129 },
  { id: 'vyigenix-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', strength: 'Blend', category: 'Growth / Performance', price: 169, badges: ['best seller'] },
  { id: 'vyigenix-hgh-somatropin', product_name: 'HGH / Somatropin', strength: 'Standard', category: 'Growth / Performance', price: 199 },
];

export const VYIGENIX_PORTAL_PRODUCTS: RxPlusProduct[] = VYIGENIX_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `VYIGENIX-${item.id.replace(/^vyigenix-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Vyigenix Pharmaceuticals catalog item. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const VYIGENIX_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = VYIGENIX_PORTAL_PRODUCTS.map((product, index) => ({
  id: `vyigenix-dist-${product.id}`,
  distributor_id: 'dist_vyigenix',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.5,
  created_at: now,
  updated_at: now,
}));

const ROCKPHORM_CATALOG_SEED: MarkCatalogSeed[] = [
  { id: 'rockphorm-retatrutide-15mg', product_name: 'Retatrutide', strength: '15mg', category: 'GLP / Weight Management', price: 168, badges: ['popular'] },
  { id: 'rockphorm-retatrutide-30mg', product_name: 'Retatrutide', strength: '30mg', category: 'GLP / Weight Management', price: 298, badges: ['best seller'] },
  { id: 'rockphorm-tirzepatide-15mg', product_name: 'Tirzepatide', strength: '15mg', category: 'GLP / Weight Management', price: 149, badges: ['popular'] },
  { id: 'rockphorm-tirzepatide-30mg', product_name: 'Tirzepatide', strength: '30mg', category: 'GLP / Weight Management', price: 199, badges: ['best seller'] },
  { id: 'rockphorm-semaglutide-10mg', product_name: 'Semaglutide', strength: '10mg', category: 'GLP / Weight Management', price: 99 },
  { id: 'rockphorm-cagrisema', product_name: 'CagriSema', strength: '2.4 mg + 2.4 mg, 4.8 mg total', category: 'GLP / Weight Management', price: 198, badges: ['popular'] },
  { id: 'rockphorm-cagrilintide-5mg', product_name: 'Cagrilintide', strength: '5mg', category: 'GLP / Weight Management', price: 169 },
  { id: 'rockphorm-bpc-157-10mg', product_name: 'BPC-157', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 139, badges: ['popular'] },
  { id: 'rockphorm-tb-500-10mg', product_name: 'TB-500', strength: '10mg', category: 'Recovery / Performance / Wellness', price: 149 },
  { id: 'rockphorm-bpc-157-tb-500-blend', product_name: 'Wolverine Stack', strength: 'BPC-157 10 mg + TB-500 10 mg, 20 mg total', category: 'Recovery / Performance / Wellness', price: 159, badges: ['best seller'] },
  { id: 'rockphorm-nad-plus', product_name: 'NAD+', strength: '1000 mg', category: 'Longevity / Wellness', price: 149 },
  { id: 'rockphorm-glutathione-1500mg', product_name: 'Glutathione', strength: '1500mg', category: 'Longevity / Wellness', price: 149 },
  { id: 'rockphorm-ghk-cu-100mg', product_name: 'GHK-Cu', strength: '100mg', category: 'Recovery / Performance / Wellness', price: 129 },
  { id: 'rockphorm-glow-peptide-blend', product_name: 'Glow Stack', strength: '70 mg total', category: 'Recovery / Performance / Wellness', price: 169 },
  { id: 'rockphorm-tesamorelin-10mg', product_name: 'Tesamorelin', strength: '10mg', category: 'Growth / Performance', price: 169, badges: ['popular'] },
  { id: 'rockphorm-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', strength: '5 mg + 5 mg, 10 mg total', category: 'Growth / Performance', price: 169, badges: ['best seller'] },
  { id: 'rockphorm-hgh-somatropin', product_name: 'HGH / Somatropin', strength: 'Standard', category: 'Growth / Performance', price: 199 },
];

export const ROCKPHORM_PORTAL_PRODUCTS: RxPlusProduct[] = ROCKPHORM_CATALOG_SEED.map((item) => ({
  id: item.id,
  product_name: item.product_name,
  category: item.category,
  strength: item.strength,
  sku: `ROCKPHORM-${item.id.replace(/^rockphorm-/, '').toUpperCase()}`,
  suggested_retail_price: item.price,
  base_cost: 0,
  active: true,
  visibility_type: 'distributor_only',
  description: 'Availability and fulfillment are subject to verification, product availability, and applicable requirements.',
  badges: item.badges,
  created_at: now,
  updated_at: now,
}));

export const ROCKPHORM_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = ROCKPHORM_PORTAL_PRODUCTS.map((product, index) => ({
  id: `rockphorm-dist-${product.id}`,
  distributor_id: 'dist_rockphorm',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.6,
  created_at: now,
  updated_at: now,
}));

export const AURORA_PORTAL_PRODUCTS: RxPlusProduct[] = ROCKPHORM_PORTAL_PRODUCTS;

export const AURORA_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = AURORA_PORTAL_PRODUCTS.map((product, index) => ({
  id: `aurora-dist-${product.id}`,
  distributor_id: 'dist_aurora',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.4,
  created_at: now,
  updated_at: now,
}));

export const PHYSIOPEPTIDES_PORTAL_PRODUCTS: RxPlusProduct[] = RX_PLUS_PRODUCTS;

export const PHYSIOPEPTIDES_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = PHYSIOPEPTIDES_PORTAL_PRODUCTS.map((product, index) => ({
  id: `physiopeptides-dist-${product.id}`,
  distributor_id: 'dist_physiopeptides',
  product_id: product.id,
  is_enabled: true,
  custom_price: product.suggested_retail_price,
  featured: index < 8 || Boolean(product.badges?.includes('best seller')),
  commission_rate: 0.99,
  created_at: now,
  updated_at: now,
}));

function mainProductStrengthLabel(name: string): string {
  const match = name.match(/(\d+(?:\.\d+)?\s*(?:mg|iu)|\d+\s*-\s*Pack|Kit|Blend)/i);
  return match?.[1]?.replace(/\s+/g, '') ?? 'Standard';
}

export const GINTO_PORTAL_PRODUCTS: RxPlusProduct[] = RX_PLUS_PRODUCTS.map((product) => ({
  ...product,
  visibility_type: 'public',
  description: product.description || 'Products and treatment options are available only where permitted and may require intake, eligibility review, and/or provider review. Availability is not guaranteed. Results vary.',
}));

export const GINTO_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = GINTO_PORTAL_PRODUCTS.map((product, index) => ({
  id: `ginto-dist-${product.id}`,
  distributor_id: 'dist_ginto',
  product_id: product.id,
  is_enabled: true,
  custom_price: null,
  featured: index < 6,
  commission_rate: 0.5,
  created_at: now,
  updated_at: now,
}));

const ANATOLIA_INTAKE_PRODUCTS = INTAKE_PRODUCTS
  .slice()
  .sort((a, b) => {
    const aIsSupply = a.product_type === 'supply' || a.product_type === 'accessory' || /bac|syringe|needle/i.test(`${a.id} ${a.name}`);
    const bIsSupply = b.product_type === 'supply' || b.product_type === 'accessory' || /bac|syringe|needle/i.test(`${b.id} ${b.name}`);
    if (aIsSupply !== bIsSupply) return aIsSupply ? 1 : -1;
    return a.sort_order - b.sort_order;
  });

export const ANATOLIA_PORTAL_PRODUCTS: RxPlusProduct[] = ANATOLIA_INTAKE_PRODUCTS.map((product) => ({
  id: product.id,
  product_name: product.name,
  category: product.category,
  strength: mainProductStrengthLabel(product.name),
  sku: `ANATOLIA-${product.id.toUpperCase()}`,
  suggested_retail_price: product.price,
  base_cost: 0,
  active: true,
  visibility_type: 'public',
  description: product.display_note || 'Anatolia Wellness Labs catalog item powered by PepScriptRX. Availability, eligibility, and fulfillment are subject to standard platform review.',
  badges: product.sort_order <= 3 ? ['Main PepScriptRX Catalog'] : undefined,
  created_at: now,
  updated_at: now,
}));

export const ANATOLIA_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = ANATOLIA_PORTAL_PRODUCTS.map((product, index) => ({
  id: `anatolia-dist-${product.id}`,
  distributor_id: 'dist_anatolia',
  product_id: product.id,
  is_enabled: true,
  custom_price: null,
  featured: index < 6,
  commission_rate: 0,
  created_at: now,
  updated_at: now,
}));

const GLOW_PRIORITY_PRODUCT_IDS = [
  'glow-peptide-blend',
  'ghk-cu-100mg',
  'glutathione-1500mg',
  'nad-500iu',
  'nad-1000iu',
  'klow-peptide-blend',
  'tesamorelin-10mg',
  'aod-9604-10mg',
  'semaglutide-10mg',
  'tirzepatide-30mg',
  'tirzepatide-60mg',
  'retatrutide-15mg',
  'cagrisema',
  'cjc-ipamorelin-10mg',
  'mots-c-10mg',
  'bpc-157-10mg',
  'tb-500-10mg',
  'wolverine-bpc-tb',
  'igf-1-lr3-1mg',
  'hgh-10iu',
  'hgh-15iu',
  'hgh-24iu',
  'hgh-36iu',
];

const GLOW_PRODUCT_COPY: Record<string, string> = {
  'glow-peptide-blend': 'The signature beauty-centered peptide complex for radiance, renewal, recovery support, and confidence from within.',
  'ghk-cu-100mg': 'A beauty and skin-support peptide commonly associated with skin quality, cosmetic wellness routines, and repair-focused support.',
  'glutathione-1500mg': 'A master antioxidant option commonly selected for beauty, wellness, and cellular support routines.',
  'nad-100iu': 'A cellular energy support option for customers focused on energy, clarity, recovery, and longevity routines.',
  'nad-500iu': 'A premium cellular energy support option for customers focused on energy, clarity, recovery, and longevity routines.',
  'nad-1000iu': 'An elevated longevity and cellular energy support option for wellness optimization and fatigue-conscious routines.',
  'klow-peptide-blend': 'A wellness and recovery support blend designed for customers interested in repair, calm, and whole-body wellness support.',
  'tesamorelin-10mg': 'A wellness and body-composition support option often selected by customers interested in advanced metabolic routines.',
  'aod-9604-10mg': 'A body-composition-focused peptide option commonly selected by customers interested in metabolic and physique support.',
  'semaglutide-10mg': 'A popular metabolic wellness option commonly selected by customers looking for structured support on their wellness journey.',
  'tirzepatide-30mg': 'A physician-reviewed metabolic wellness option commonly selected for structured body-goal support under appropriate guidance.',
  'tirzepatide-60mg': 'A higher-strength physician-reviewed metabolic wellness option for structured body-goal support under appropriate guidance.',
  'retatrutide-15mg': 'An advanced metabolic wellness option for customers looking for a physician-reviewed body-goal support pathway.',
  cagrisema: 'An advanced metabolic support blend for customers pursuing a structured, physician-reviewed wellness pathway.',
  'mots-c-10mg': 'A mitochondrial wellness option commonly selected for energy, longevity, and recovery-focused routines.',
  'bpc-157-10mg': 'A recovery support peptide commonly selected for repair-focused wellness routines.',
  'tb-500-10mg': 'A recovery support option commonly selected for mobility, repair, and wellness routines.',
  'wolverine-bpc-tb': 'A BPC-157 and TB-500 recovery stack commonly selected by advanced wellness customers.',
  'cjc-ipamorelin-10mg': 'An advanced performance and recovery support blend placed lower in the GLOW catalog.',
};

export const GLOW_PORTAL_PRODUCTS: RxPlusProduct[] = RX_PLUS_PRODUCTS.map((product) => ({
  ...product,
  description: GLOW_PRODUCT_COPY[product.id] ?? product.description,
  badges: product.id === 'glow-peptide-blend'
    ? ['Signature GLOW', 'Beauty & Radiance']
    : product.id === 'ghk-cu-100mg' || product.id === 'glutathione-1500mg' || product.id.startsWith('nad-')
      ? ['Beauty & Radiance']
      : product.badges,
}));

export const GLOW_DISTRIBUTOR_PRODUCTS: DistributorProduct[] = GLOW_PORTAL_PRODUCTS.map((product) => {
  const priority = GLOW_PRIORITY_PRODUCT_IDS.indexOf(product.id);
  return {
    id: `glow-dist-${product.id}`,
    distributor_id: 'dist_glow',
    product_id: product.id,
    is_enabled: true,
    custom_price: null,
    featured: priority >= 0 && priority < 6,
    commission_rate: 0.8,
    created_at: now,
    updated_at: now,
  };
});

export const WHOLESALE_TIERS: WholesaleTier[] = [
  { id: 'tier-1', tier_name: 'Tier 1 Partner', min_vials: 50, max_vials: 99, discount_type: 'custom_quote', discount_value: null, description: '50 vials per quarter. Minimum 5 vials per SKU per wholesale order.' },
  { id: 'tier-2', tier_name: 'Tier 2 Distributor', min_vials: 100, max_vials: 249, discount_type: 'custom_quote', discount_value: null, description: '100 vials per quarter. Expanded distributor pricing and reorder planning.' },
  { id: 'tier-3', tier_name: 'Tier 3 Scale Partner', min_vials: 250, max_vials: 499, discount_type: 'custom_quote', discount_value: null, description: '250 vials per quarter. Priority catalog planning and promo-link support.' },
  { id: 'tier-4', tier_name: 'Tier 4 Strategic Account', min_vials: 500, max_vials: null, discount_type: 'custom_quote', discount_value: null, description: '500+ vials per quarter. Strategic inventory, white-label, and split-model planning.' },
];

export const RX_PLUS_CATEGORIES: RxPlusCategory[] = [
  'GLP / Weight Management',
  'Growth / Performance',
  'Recovery / Repair',
  'Recovery / Performance / Wellness',
  'Longevity / Wellness',
  'Cognitive / Wellness',
  'Additional Catalog / Optional',
];

export function getDistributorProducts(distributorSlug: string): DistributorCatalogProduct[] {
  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === distributorSlug);
  if (!distributor) return [];
  const distributorProducts = distributor.slug === 'mark'
    ? MARK_DISTRIBUTOR_PRODUCTS
    : distributor.slug === 'ehwsub'
      ? EHW_SUB_DISTRIBUTOR_PRODUCTS
    : distributor.slug === 'robert'
      ? ROBERT_DISTRIBUTOR_PRODUCTS
      : distributor.slug === 'scott'
        ? SCOTT_DISTRIBUTOR_PRODUCTS
        : distributor.slug === 'alpha'
          ? ALPHA_DISTRIBUTOR_PRODUCTS
          : distributor.slug === 'optimax'
            ? OPTIMAX_DISTRIBUTOR_PRODUCTS
            : distributor.slug === 'ronin'
              ? RONIN_DISTRIBUTOR_PRODUCTS
              : distributor.slug === 'agprime'
                ? AG_PRIME_DISTRIBUTOR_PRODUCTS
                : distributor.slug === 'vyigenix'
                  ? VYIGENIX_DISTRIBUTOR_PRODUCTS
                  : distributor.slug === 'rockphorm'
                    ? ROCKPHORM_DISTRIBUTOR_PRODUCTS
                    : distributor.slug === 'aurora'
                      ? AURORA_DISTRIBUTOR_PRODUCTS
                      : distributor.slug === 'zenora'
                        ? ZENORA_DISTRIBUTOR_PRODUCTS
                        : distributor.slug === 'physiopeptides'
                          ? PHYSIOPEPTIDES_DISTRIBUTOR_PRODUCTS
                          : distributor.slug === 'ginto'
                            ? GINTO_DISTRIBUTOR_PRODUCTS
                            : distributor.slug === 'anatolia'
                              ? ANATOLIA_DISTRIBUTOR_PRODUCTS
                              : distributor.slug === 'glow'
                                ? GLOW_DISTRIBUTOR_PRODUCTS
              : GUY_DISTRIBUTOR_PRODUCTS;
  const productPool = distributor.slug === 'mark'
    ? MARK_PORTAL_PRODUCTS
    : distributor.slug === 'ehwsub'
      ? EHW_SUB_PORTAL_PRODUCTS
    : distributor.slug === 'robert'
      ? ROBERT_PORTAL_PRODUCTS
      : distributor.slug === 'scott'
        ? SCOTT_PORTAL_PRODUCTS
        : distributor.slug === 'alpha'
          ? ALPHA_PORTAL_PRODUCTS
          : distributor.slug === 'optimax'
            ? OPTIMAX_PORTAL_PRODUCTS
            : distributor.slug === 'ronin'
              ? RONIN_PORTAL_PRODUCTS
              : distributor.slug === 'agprime'
                ? AG_PRIME_PORTAL_PRODUCTS
                : distributor.slug === 'vyigenix'
                  ? VYIGENIX_PORTAL_PRODUCTS
                  : distributor.slug === 'rockphorm'
                    ? ROCKPHORM_PORTAL_PRODUCTS
                    : distributor.slug === 'aurora'
                      ? AURORA_PORTAL_PRODUCTS
                      : distributor.slug === 'zenora'
                        ? ZENORA_PORTAL_PRODUCTS
                        : distributor.slug === 'physiopeptides'
                          ? PHYSIOPEPTIDES_PORTAL_PRODUCTS
                          : distributor.slug === 'ginto'
                            ? GINTO_PORTAL_PRODUCTS
                            : distributor.slug === 'anatolia'
                              ? ANATOLIA_PORTAL_PRODUCTS
                              : distributor.slug === 'glow'
                                ? GLOW_PORTAL_PRODUCTS
              : RX_PLUS_PRODUCTS;

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
