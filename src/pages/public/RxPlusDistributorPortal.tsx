import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import AACTIVATEDRXVerificationBadge from '../../components/AACTIVATEDRXVerificationBadge';
import { RX_PLUS_DISTRIBUTORS, getDistributorProducts } from '../../data/rxPlus';
import type { RxPlusCategory, DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { supabase } from '../../lib/supabase';
import { scopedMixingCenterPath } from '../../lib/mixingCenter';
import {
  ROCKPHORM_PRODUCT_SELECT,
  mapRockPhormProductRow,
  type RockPhormManagedProduct,
  type RockPhormProductRow,
} from '../../lib/rockPhormProducts';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';
import {
  SPECIAL_ORDER_CHECKOUT_NOTICE,
  SPECIAL_ORDER_ITEM_NOTICE,
  computeInventoryStatus,
  type InventoryDisplayStatus,
  type InventoryStatusSnapshot,
} from '../../lib/inventoryStatus';
import { anatoliaOrderMetadata, anatoliaStorefront } from '../../config/anatolia';
import { t } from '../../lib/i18n';

type CartMap = Record<string, number>; // productId → qty

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const PORTAL_CART_STATE_KEY = 'pepscriptrx_portal_cart_state';
const MARK_PORTAL_PATH = '/EmpireHealth&Wellness';
const EHW_SUB_PORTAL_PATH = '/EHWSUB';
const GUY_PORTAL_PATH = '/aactivated';
const ROBERT_PORTAL_PATH = '/warxlabz';
const SCOTT_PORTAL_PATH = '/peakform';
const ALPHA_PORTAL_PATH = '/alphapride';
const OPTIMAX_PORTAL_PATH = '/optimax-peptide-therapy';
const RONIN_PORTAL_PATH = '/ronin';
const AG_PRIME_PORTAL_PATH = '/agprimelab';
const VYIGENIX_PORTAL_PATH = '/vyigenix';
const ROCKPHORM_PORTAL_PATH = '/rockphorm';
const AURORA_PORTAL_PATH = '/aurora';
const ZENORA_PORTAL_PATH = '/zenora';
const MARK_LOGO_SRC = '/marketing/empire-health-wellness-logo.png';
const MARK_PRODUCT_IMAGE_SRC = '/marketing/empire-product-vial.png';
const GUY_LOGO_SRC = '/marketing/aactivated-rx-logo-v2.png';
const GUY_PRODUCT_IMAGE_SRC = '/marketing/aactivated-product-vial.png';
const GUY_WEIGHT_MANAGEMENT_SUPPORT_SRC = '/marketing/aactivated/weight-management-support.jpeg';
const ROBERT_LOGO_SRC = '/marketing/warxlabz-logo.png';
const ROBERT_PRODUCT_IMAGE_SRC = '/marketing/warxlabz-vial.png';
const SCOTT_LOGO_SRC = '/marketing/peakform-logo.png';
const SCOTT_PRODUCT_IMAGE_SRC = '/marketing/peakform-vial.png';
const SCOTT_NEEDLES_IMAGE_SRC = '/marketing/peakform-needles.png';
const ALPHA_LOGO_SRC = '/marketing/alphapride-logo-readable.png';
const ALPHA_PRODUCT_IMAGE_SRC = '/marketing/alphapride-vial.png';
const OPTIMAX_LOGO_SRC = '/marketing/optimax-logo-clean.png';
const OPTIMAX_PRODUCT_IMAGE_SRC = '/marketing/optimax-vial.png';
const RONIN_LOGO_SRC = '/marketing/ronin-logo.png';
const RONIN_PRODUCT_IMAGE_SRC = '/marketing/ronin-vial.png';
const AG_PRIME_LOGO_SRC = '/marketing/ag-prime-lab-logo.png';
const AG_PRIME_PRODUCT_IMAGE_SRC = '/marketing/ag-prime-lab-vial-clean.png?v=1';
const VYIGENIX_LOGO_SRC = '/marketing/vyigenix-logo.png';
const VYIGENIX_PRODUCT_IMAGE_SRC = '/marketing/vyigenix-vial.png';
const ROCKPHORM_LOGO_SRC = '/marketing/rockphorm-logo.png';
const ROCKPHORM_PRODUCT_IMAGE_SRC = '/marketing/rockphorm-vial.png';
const AURORA_LOGO_SRC = '/marketing/aurora-logo.png';
const AURORA_PRODUCT_IMAGE_SRC = '/marketing/aurora-vial.png';
const AURORA_STANDARD_FLYER_SRC = '/marketing/aurora-standard-flyer.png';
const AURORA_ROUTE_REP_CODES: Record<string, string> = {
  '/aurora-labs/duffy': 'D026FIR',
  '/aurora labs/duffy': 'D026FIR',
  '/auroradd': 'D026FIR',
  '/megdel': 'MEGDEL',
  '/auroramd': 'MEGDEL',
  '/aurorajl': 'AURORAJL',
  '/auroraet': 'AURORAET',
  '/aurorato': 'AURORATO',
  '/aurorage': 'AURORAGE',
  '/aurora/mccall': 'AURORARM',
  '/aurorarm': 'AURORARM',
};
const ZENORA_LOGO_SRC = '/marketing/zenora-logo.jpeg';
const ZENORA_PRODUCT_IMAGE_SRC = '/marketing/zenora-vial.png';
const GINTO_PORTAL_PATH = '/ginto';
const GINTO_LOGO_SRC = '/brands/ginto/ginto-logo.png';
const GINTO_LV_STOREFRONT_SRC = '/brands/ginto/ginto-lv-storefront.png';
const GINTO_PRODUCT_IMAGE_SRC = '/brands/ginto/ginto-vial-placeholder.png';
const GINTO_SUPPLY_IMAGE_SRC = '/products/bac-water-kit.png';
const GINTO_NEEDLES_IMAGE_SRC = '/marketing/insulin-needles.png';
const GINTO_SCOPE_CODE = 'GINTO';
const GINTO_STORE_NAME = 'Ginto Wellness Labs';
const BEASTMODE_PORTAL_PATH = '/beastmode';
const BEASTMODE_LOGO_SRC = '/brands/beastmode/beastmode-logo.jpeg';
const BEASTMODE_HERO_SRC = '/brands/beastmode/beastmode-hero-vial.jpeg';
const BEASTMODE_WOLVERINE_SRC = '/brands/beastmode/wolverine-stack-art.jpeg';
const BEASTMODE_SCOPE_CODE = 'BEASTMODE';
const BEASTMODE_STORE_NAME = 'BEASTMODE Performance Labs';
const ANATOLIA_PORTAL_PATH = '/anatolia';
const ANATOLIA_LOGO_SRC = anatoliaStorefront.assets.logo;
const ANATOLIA_PRODUCT_IMAGE_SRC = anatoliaStorefront.assets.productPlaceholder;
const ANATOLIA_STORE_NAME = anatoliaStorefront.brandName;
const PHYSIOPEPTIDES_PORTAL_PATH = '/PhysioPeptides';
const PHYSIOPEPTIDES_LOGO_SRC = '/marketing/physiopeptides-logo.png';
const PHYSIOPEPTIDES_PRODUCT_IMAGE_SRC = '/marketing/physiopeptides-vial.png';
const PHYSIOPEPTIDES_SCOPE_CODE = 'PHYSIOPEPTIDES';
const PHYSIOPEPTIDES_STORE_SLUG = 'physiopeptides';
const PHYSIOPEPTIDES_STORE_NAME = 'PhysioPeptides';
const PHYSIOPEPTIDES_COMMISSION_RATE = 0.99;
const PHYSIOPEPTIDES_SPECIAL_ORDER_NOTICE = 'Special order item. Fulfillment may take up to 14 business days.';

function portalMixingCenterPath(product: DistributorCatalogProduct | null | undefined, portalPath?: string | null) {
  return scopedMixingCenterPath(product, portalPath);
}

const AACTIVATED_EDUCATION = [
  {
    title: 'GLP / Weight Management',
    body: 'Metabolic support options for customers exploring appetite, body-composition, and weight-management goals.',
    library: 'Use the library to compare GLP pathways, appetite support, metabolic cofactors, and support compounds before selecting products.',
    pairings: ['Tirzepatide or Retatrutide', 'AOD-9604', 'NAD+', 'MOTS-c', 'Glutathione'],
  },
  {
    title: 'Recovery / Repair',
    body: 'Performance recovery options commonly requested around training load, soft-tissue repair, joint comfort, and resilience goals.',
    library: 'Review tissue-support peptides, recovery blends, copper peptide support, and inflammation-oriented options in the branded library.',
    pairings: ['BPC-157', 'TB-500', 'BPC-157 / TB-500 Blend', 'GHK-Cu', 'Glow Peptide Blend'],
  },
  {
    title: 'Longevity / Wellness',
    body: 'Wellness-oriented compounds for energy, oxidative stress, mitochondrial support, skin health, and general optimization.',
    library: 'The library helps compare energy-support, antioxidant, mitochondrial, and skin-focused compounds by wellness interest.',
    pairings: ['NAD+', 'Glutathione', 'MOTS-c', 'GHK-Cu', 'Epitalon'],
  },
  {
    title: 'Growth / Performance',
    body: 'Performance-focused options with additional eligibility, documentation, and availability checks where required.',
    library: 'Use the library to understand growth-hormone secretagogue families, recovery pairings, sleep-support context, and fulfillment requirements.',
    pairings: ['Tesamorelin', 'Sermorelin', 'Ipamorelin', 'CJC-1295 / Ipamorelin', 'HGH / Somatropin'],
  },
];

const AACTIVATED_FALLBACK_TOP_SELLER_IDS = [
  'tirzepatide-10mg',
  'tirzepatide-30mg',
  'semaglutide-10mg',
  'retatrutide-10mg',
  'wolverine-bpc-tb',
  'glow-peptide-blend',
  'klow-peptide-blend',
  'igf-1-lr3-1mg',
  'cjc-ipamorelin-10mg',
  'nad-500iu',
];

type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'alpha';

type LuxuryStack = {
  title: string;
  copy: string;
  products: string[];
};

const LUXURY_HIS_STACKS: LuxuryStack[] = [
  {
    title: 'Performance Stack',
    copy: 'Training, output, and recovery-oriented peptides for a more performance-focused catalog path.',
    products: ['CJC-1295 / Ipamorelin', 'Tesamorelin', 'NAD+'],
  },
  {
    title: 'Recovery Stack',
    copy: 'Repair and resilience picks for customers building around recovery, soreness, and consistency.',
    products: ['Wolverine Stack', 'BPC-157', 'TB-500'],
  },
  {
    title: 'Metabolic Stack',
    copy: 'Body-composition and GLP-focused options for customers comparing metabolic support routes.',
    products: ['Tirzepatide', 'Retatrutide', 'Semaglutide'],
  },
];

const LUXURY_HERS_STACKS: LuxuryStack[] = [
  {
    title: 'Radiance Stack',
    copy: 'Beauty, skin-quality, and glow-oriented peptides for a refined wellness routine.',
    products: ['GHK-Cu', 'Glow Stack', 'Glutathione'],
  },
  {
    title: 'Metabolic Refinement',
    copy: 'GLP and body-goal support options grouped for a clear comparison path.',
    products: ['Semaglutide', 'Tirzepatide', 'Retatrutide'],
  },
  {
    title: 'Longevity Stack',
    copy: 'Energy, antioxidant, and cellular-wellness picks for a polished daily protocol.',
    products: ['NAD+', 'Glutathione', 'GHK-Cu'],
  },
];

function normalizeLuxuryProductName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findLuxuryProduct(products: DistributorCatalogProduct[], name: string): DistributorCatalogProduct | null {
  const target = normalizeLuxuryProductName(name);
  return products.find((product) => normalizeLuxuryProductName(product.product_name) === target)
    ?? products.find((product) => {
      const productName = normalizeLuxuryProductName(product.product_name);
      return productName.includes(target) || target.includes(productName);
    })
    ?? null;
}

type AactivatedPromoLink = {
  promo_title: string;
  discount_code: string;
  discount_amount: number;
  discount_type?: 'fixed_amount' | 'percentage' | null;
  discount_percent?: number | null;
  promo_kind?: 'customer_discount' | 'rep_sample' | 'rep_internal' | 'wholesale' | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  uses_count?: number | null;
  rep_slug?: string | null;
  product_id: string | null;
  store_scope_code: string;
  link_slug: string;
};

type AactivatedStorePriceRow = {
  product_id: string;
  retail_price: number;
  sale_price: number | null;
  is_active: boolean;
  featured: boolean;
  sort_order: number | null;
  product_note: string | null;
  bundle_group_key: string | null;
  bundle_group_name: string | null;
  bundle_discount_percent: number | null;
  bundle_discount_amount: number | null;
  bundle_note: string | null;
};

type AactivatedPublicRepStore = {
  id: string;
  rep_id: string | null;
  rep_slug: string | null;
  rep_name: string | null;
  public_display_name: string | null;
  store_slug: string | null;
  storefront_path: string | null;
  product_list_id: string | null;
  product_list_name: string | null;
  product_ids: string[] | null;
  pricing_mode: string | null;
  features: Record<string, boolean> | null;
  promo_config: Record<string, string | boolean | null> | null;
  status: string | null;
  discount_code: string | null;
  referral_path: string | null;
};

type PublicInventoryStatusRow = {
  catalog_source: 'products' | 'rx_plus_products' | string;
  product_id: string;
  sku: string | null;
  quantity_on_hand: number | null;
  low_stock_threshold: number | null;
  stock_status: InventoryDisplayStatus | string | null;
  allow_special_order: boolean | null;
  estimated_fulfillment_days: number | null;
  active: boolean | null;
  sellable: boolean | null;
  customer_visible: boolean | null;
  display_stock_status?: InventoryDisplayStatus | string | null;
  display_stock_label?: string | null;
  checkout_allowed?: boolean | null;
  was_special_order?: boolean | null;
  status_message?: string | null;
};

const CAT_ICONS: Record<string, string> = {
  'Recovery / Performance / Wellness': '+',
  'Additional Catalog / Optional': '*',
  'GLP / Weight Management': '⚡',
  'Growth / Performance': '🧬',
  'Longevity / Wellness': '✨',
  'Weight Loss / GLP-1':       '⚡',
  'Recovery / Repair':         '🔬',
  'Growth Hormone / Longevity':'🧬',
  'Wellness / Anti-Aging':     '✨',
  'Neuro / Cognitive / Mood':  '🧠',
  'Functional / Supplies':     '📦',
};

function categoryIcon(category: string, isAgPrimePortal = false): string {
  if (category.includes('GLP') || category.includes('Weight')) return '\u26a1';
  if (category.includes('Functional')) return '\ud83d\udce6';
  if (isAgPrimePortal && category.includes('Additional Catalog')) return '\ud83d\udc89';
  if (isAgPrimePortal && category.includes('Recovery')) return '\ud83d\udc8a';
  return CAT_ICONS[category] ?? '\ud83d\udc8a';
}

function categoryLabel(category: string, isAgPrimePortal = false, isAnatoliaPortal = false): string {
  if (isAnatoliaPortal) {
    if (category.includes('GLP') || category.includes('Weight')) return 'GLP / Kilo Yönetimi';
    if (category.includes('Recovery')) return 'Toparlanma / Wellness';
    if (category.includes('Growth') || category.includes('Performance')) return 'Performans';
    if (category.includes('Longevity') || category.includes('Wellness')) return 'Uzun Yaşam / Wellness';
    if (category.includes('Additional') || category.includes('Supplies')) return 'Ek Ürünler';
  }
  if (!isAgPrimePortal) return category;
  if (category === 'Recovery / Performance / Wellness') return 'Recovery / Wellness';
  if (category === 'Additional Catalog / Optional') return 'Additional Catalog';
  return category;
}

function auroraCategoryLabel(category: string): string {
  if (category.includes('GLP') || category.includes('Weight')) return 'Weight Management';
  if (category.includes('Recovery')) return 'Recovery';
  if (category.includes('Performance') || category.includes('Growth')) return 'Performance';
  if (category.includes('Longevity') || category.includes('Wellness')) return 'Longevity';
  if (category.includes('Functional') || category.includes('Supplies') || category.includes('Additional')) return 'Essentials';
  return category;
}

function beastModeCategoryLabel(category: string): string {
  if (category.includes('GLP') || category.includes('Weight')) return 'Weight Management';
  if (category.includes('Recovery')) return 'Recovery';
  if (category.includes('Performance') || category.includes('Growth')) return 'Performance';
  if (category.includes('Longevity')) return 'Longevity';
  if (category.includes('Wellness') || category.includes('Cognitive') || category.includes('Mood')) return 'Wellness';
  if (category.includes('Additional') || category.includes('Supplies') || category.includes('Functional')) return 'Bundles';
  return category;
}

function beastModeProductBadge(product: DistributorCatalogProduct): string {
  const text = `${product.id} ${product.product_name}`.toLowerCase();
  if (text.includes('wolverine') || text.includes('bpc') || text.includes('tb-500')) return 'Recovery';
  if (product.category.includes('Weight') || product.category.includes('GLP')) return 'Body Composition';
  if (product.category.includes('Growth') || product.category.includes('Performance')) return 'Performance';
  if (product.category.includes('Longevity') || product.category.includes('Wellness')) return 'Longevity';
  return 'Research Catalog';
}

const BEASTMODE_CATEGORIES = [
  { title: 'Recovery', category: 'Recovery / Repair', copy: 'Repair and resilience options for hard training days.' },
  { title: 'Performance', category: 'Growth / Performance', copy: 'High-output selections for disciplined performance routines.' },
  { title: 'Body Composition', category: 'GLP / Weight Management', copy: 'Metabolic support options for focused body-composition goals.' },
  { title: 'Longevity', category: 'Longevity / Wellness', copy: 'Cellular wellness, energy, and long-range optimization picks.' },
  { title: 'Wellness', category: 'Neuro / Cognitive / Mood', copy: 'Focused wellness options for clarity, calm, and daily resilience.' },
  { title: 'Bundles', category: 'Recovery / Repair', copy: 'Stack-focused options anchored by the Wolverine Stack.' },
];

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  'best seller': { bg: 'rgba(34,197,94,.15)', color: '#16a34a' },
  'popular':     { bg: 'rgba(37,199,217,.15)', color: '#0e9ab0' },
  'AACTIVATED-RX Exclusive': { bg: 'rgba(37,199,217,.18)', color: '#0891b2' },
  'Partner Catalog': { bg: 'rgba(15,23,42,.08)', color: '#0f172a' },
  'WarXlabz Pricing': { bg: 'rgba(202,138,4,.18)', color: '#92400e' },
  'Main PepScriptRX Catalog': { bg: 'rgba(29,78,216,.12)', color: '#1d4ed8' },
};

const GINTO_TRUST_POINTS = [
  { mark: '01', label: 'Third Party Tested' },
  { mark: '02', label: 'High Purity Standards' },
  { mark: '03', label: 'Cold Chain Shipping' },
  { mark: '04', label: 'Sterile Packaging' },
  { mark: '05', label: 'Discreet Delivery' },
  { mark: '06', label: 'Premium Support' },
];

const GINTO_COLLECTIONS = [
  { title: 'Weight Management', category: 'GLP / Weight Management', products: ['Tirzepatide', 'Retatrutide', 'CagriSema'] },
  { title: 'Performance', category: 'Growth / Performance', products: ['CJC + Ipamorelin', 'Tesamorelin', 'MK-677'] },
  { title: 'Recovery', category: 'Recovery / Repair', products: ['BPC-157', 'TB-500', 'Wolverine Blend'] },
  { title: 'Anti-Aging', category: 'Longevity / Wellness', products: ['NAD+', 'Glutathione', 'Epithalon'] },
  { title: 'Wellness', category: 'Cognitive / Wellness', products: ['Selank', 'Semax', 'PT-141'] },
];

function gintoProductBadge(product: DistributorCatalogProduct): string {
  const text = `${product.product_name} ${product.category}`.toLowerCase();
  if (text.includes('tirzepatide') || text.includes('retatrutide')) return 'Most Popular';
  if (text.includes('nad') || text.includes('glow')) return 'Luxury Collection';
  if (text.includes('bpc') || text.includes('tb-500')) return 'Doctor Favorite';
  if (text.includes('longevity') || text.includes('epithalon')) return 'Elite Formula';
  return 'Premium Choice';
}

const CATEGORY_DETAILS: Record<string, { focus: string; faq: string }> = {
  'Recovery / Performance / Wellness': {
    focus: 'Performance, recovery, and wellness options available through Optimax Peptide Therapy.',
    faq: 'Products and availability may vary. Orders remain subject to standard verification and state availability.',
  },
  'Additional Catalog / Optional': {
    focus: 'Additional peptide options available for qualifying wellness and optimization requests.',
    faq: 'Availability, suitability, and final fulfillment are confirmed through standard verification.',
  },
  'GLP / Weight Management': {
    focus: 'Expanded GLP and metabolic-support options for weight-management goals through this portal.',
    faq: 'Eligibility depends on health history, current medications, state availability, and standard verification.',
  },
  'Growth / Performance': {
    focus: 'Growth and performance support options for vitality, body-composition, and training goals.',
    faq: 'Some products require additional provider context, lab context, or documentation before fulfillment.',
  },
  'Longevity / Wellness': {
    focus: 'Longevity and wellness compounds requested for energy, oxidative stress, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and verification requirements.',
  },
  'Weight Loss / GLP-1': {
    focus: 'Metabolic support options commonly requested for appetite, weight-management, and glucose-related goals.',
    faq: 'Eligibility depends on health history, current medications, state availability, and standard verification.',
  },
  'Recovery / Repair': {
    focus: 'Recovery-focused compounds often requested for tissue support, joint comfort, and training recovery goals.',
    faq: 'Use should be supervised by a qualified licensed provider and considered against your medical history.',
  },
  'Growth Hormone / Longevity': {
    focus: 'Hormone-support and longevity products commonly requested for sleep, body-composition, and vitality goals.',
    faq: 'Some therapies require extra verification, lab context, or provider documentation before fulfillment.',
  },
  'Wellness / Anti-Aging': {
    focus: 'Wellness compounds requested for oxidative stress, energy, skin, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and verification requirements.',
  },
  'Neuro / Cognitive / Mood': {
    focus: 'Cognitive and mood-support options for customers exploring focus, calm, sleep, or resilience support.',
    faq: 'These products are not emergency care and are not substitutes for mental-health treatment.',
  },
  'Functional / Supplies': {
    focus: 'Supplies and functional add-ons that may support eligible orders and fulfillment workflows.',
    faq: 'Supplies may ship with eligible orders or require confirmation from the care team.',
  },
};

type BundleDiscountRow = {
  groupKey: string;
  groupName: string;
  discount: number;
  itemCount: number;
  note?: string | null;
};

function cartSubtotal(cart: CartMap, products: DistributorCatalogProduct[]): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === id);
    return sum + (p?.displayPrice ? p.displayPrice * qty : 0);
  }, 0);
}

function bundleDiscountSummary(cart: CartMap, products: DistributorCatalogProduct[]): { rows: BundleDiscountRow[]; totalDiscount: number } {
  const groups = new Map<string, { groupName: string; note?: string | null; percent: number | null; amount: number | null; items: { product: DistributorCatalogProduct; qty: number }[] }>();

  Object.entries(cart).forEach(([id, qty]) => {
    const product = products.find((item) => item.id === id);
    const groupKey = product?.scopedBundleGroupKey?.trim();
    if (!product || !groupKey || qty <= 0) return;
    const existing = groups.get(groupKey) ?? {
      groupName: product.scopedBundleGroupName || 'Bundle',
      note: product.scopedBundleNote,
      percent: product.scopedBundleDiscountPercent ?? null,
      amount: product.scopedBundleDiscountAmount ?? null,
      items: [],
    };
    existing.groupName = existing.groupName || product.scopedBundleGroupName || 'Bundle';
    existing.note = existing.note || product.scopedBundleNote;
    existing.percent = existing.percent ?? product.scopedBundleDiscountPercent ?? null;
    existing.amount = existing.amount ?? product.scopedBundleDiscountAmount ?? null;
    existing.items.push({ product, qty });
    groups.set(groupKey, existing);
  });

  const rows = Array.from(groups.entries()).reduce<BundleDiscountRow[]>((nextRows, [groupKey, group]) => {
    const distinctItemCount = group.items.length;
    if (distinctItemCount < 2) return nextRows;
    const subtotal = group.items.reduce((sum, { product, qty }) => sum + Number(product.displayPrice ?? 0) * qty, 0);
    const percentDiscount = group.percent != null && group.percent > 0 ? subtotal * (group.percent / 100) : 0;
    const fixedDiscount = group.amount != null && group.amount > 0 ? group.amount : 0;
    const discount = Math.min(subtotal, Math.round((percentDiscount || fixedDiscount) * 100) / 100);
    if (discount <= 0) return nextRows;
    nextRows.push({
      groupKey,
      groupName: group.groupName,
      discount,
      itemCount: distinctItemCount,
      note: group.note,
    });
    return nextRows;
  }, []);

  return {
    rows,
    totalDiscount: Math.round(rows.reduce((sum, row) => sum + row.discount, 0) * 100) / 100,
  };
}

function cartTotal(cart: CartMap, products: DistributorCatalogProduct[]): number {
  return Math.max(0, Math.round((cartSubtotal(cart, products) - bundleDiscountSummary(cart, products).totalDiscount) * 100) / 100);
}

function bundleDiscountLabel(product: DistributorCatalogProduct): string {
  const percent = product.scopedBundleDiscountPercent;
  const amount = product.scopedBundleDiscountAmount;
  if (percent != null && percent > 0) return `${percent}% bundle savings`;
  if (amount != null && amount > 0) return `$${amount.toFixed(2)} bundle savings`;
  return 'Bundle savings available';
}

function normalizeAactivatedDiscountCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

function safeDecodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeProductRouteSlug(value: string | null | undefined): string {
  return safeDecodePath(String(value ?? '')).trim().toLowerCase();
}

function findProductByRouteSlug(products: DistributorCatalogProduct[], routeSlug: string): DistributorCatalogProduct | null {
  const normalizedRouteSlug = normalizeProductRouteSlug(routeSlug);
  if (!normalizedRouteSlug) return null;
  return products.find((product) => (
    normalizeProductRouteSlug(product.id) === normalizedRouteSlug
  )) ?? null;
}

function aactivatedRetailPrice(product: DistributorCatalogProduct): number | null {
  return product.scopedRetailPrice ?? product.suggested_retail_price ?? product.displayPrice;
}

function aactivatedSalePrice(product: DistributorCatalogProduct): number | null {
  return product.scopedSalePrice ?? product.displayPrice;
}

function aactivatedPriceDiscount(product: DistributorCatalogProduct): { retail: number | null; sale: number | null; savings: number; hasDiscount: boolean } {
  const retail = aactivatedRetailPrice(product);
  const sale = aactivatedSalePrice(product);
  const hasDiscount = typeof retail === 'number' && typeof sale === 'number' && retail > sale;
  return {
    retail,
    sale,
    savings: hasDiscount ? Math.round((retail - sale) * 100) / 100 : 0,
    hasDiscount,
  };
}

function promoAppliesToCart(promo: AactivatedPromoLink | null, cart: CartMap): boolean {
  if (!promo) return false;
  if (promo.promo_kind && promo.promo_kind !== 'customer_discount') return false;
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) return false;
  if (promo.usage_limit != null && Number(promo.usage_limit) > 0 && Number(promo.uses_count ?? 0) >= Number(promo.usage_limit)) return false;
  return !promo.product_id || Boolean(cart[promo.product_id]);
}

function promoDiscountForCart(promo: AactivatedPromoLink | null, cart: CartMap, products: DistributorCatalogProduct[]): number {
  if (!promoAppliesToCart(promo, cart)) return 0;
  const activePromo = promo!;
  const eligibleTotal = activePromo.product_id
    ? Object.entries(cart).reduce((sum, [id, qty]) => {
        if (id !== activePromo.product_id) return sum;
        const product = products.find((item) => item.id === id);
        return sum + Number(product?.displayPrice ?? 0) * qty;
      }, 0)
    : cartTotal(cart, products);
  const amount = activePromo.discount_type === 'percentage'
    ? eligibleTotal * (Number(activePromo.discount_percent ?? 0) / 100)
    : Number(activePromo.discount_amount ?? 0);
  const cap = activePromo.product_id ? eligibleTotal : cartTotal(cart, products);
  return Math.min(Math.round(Math.max(0, amount) * 100) / 100, cap);
}

function promoDiscountLabel(promo: AactivatedPromoLink): string {
  return promo.discount_type === 'percentage'
    ? `${Number(promo.discount_percent ?? 0).toFixed(2).replace(/\.00$/, '')}% off`
    : `$${Number(promo.discount_amount ?? 0).toFixed(2)} off`;
}

function normalizeCartState(value: unknown): CartMap {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<CartMap>((cart, [productId, qty]) => {
    const quantity = Number(qty);
    if (productId && Number.isFinite(quantity) && quantity > 0) {
      cart[productId] = Math.floor(quantity);
    }
    return cart;
  }, {});
}

function readPortalCartState(portalSlug: string): CartMap {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PORTAL_CART_STATE_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw) as Record<string, unknown>;
    return normalizeCartState(stored[portalSlug]);
  } catch {
    return {};
  }
}

function writePortalCartState(portalSlug: string, cart: CartMap) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(PORTAL_CART_STATE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const cleanCart = normalizeCartState(cart);

    if (Object.keys(cleanCart).length > 0) {
      stored[portalSlug] = cleanCart;
    } else {
      delete stored[portalSlug];
    }

    window.localStorage.setItem(PORTAL_CART_STATE_KEY, JSON.stringify(stored));
  } catch {
    // Cart persistence is a convenience; checkout still uses live React state.
  }
}

function cartCount(cart: CartMap): number {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function cartEntries(cart: CartMap, products: DistributorCatalogProduct[]) {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((e) => e.product);
}

function formatRetailPrice(price: number | null): string {
  return typeof price === 'number' ? `$${price.toFixed(2)}` : 'Retail price not configured';
}

function mapInventoryStatusRow(row: PublicInventoryStatusRow | undefined): InventoryStatusSnapshot {
  const computed = computeInventoryStatus(row);
  if (!row?.display_stock_status) return computed;
  const status = String(row.display_stock_status) as InventoryDisplayStatus;
  const isConfirmedOutOfStockNotice = Boolean(row.was_special_order) && Number(row.quantity_on_hand ?? 0) <= 0;
  return {
    ...computed,
    inventory_status: status,
    inventory_status_label: row.display_stock_label ?? computed.inventory_status_label,
    checkout_allowed: row.checkout_allowed ?? computed.checkout_allowed,
    was_special_order: row.was_special_order ?? computed.was_special_order,
    supporting_copy: isConfirmedOutOfStockNotice
      ? row.status_message ?? computed.supporting_copy
      : row.status_message ?? (status === 'low_stock' ? computed.supporting_copy : null),
  };
}

function inventoryStatusForProduct(product: DistributorCatalogProduct): InventoryStatusSnapshot {
  return product.inventoryStatus ?? computeInventoryStatus({ active: product.active, sellable: true, customer_visible: true });
}

function inventoryBadgeClass(status: InventoryDisplayStatus): string {
  if (status === 'in_stock') return 'badge-success';
  if (status === 'low_stock') return 'badge-warning';
  if (status === 'special_order') return 'badge-info';
  if (status === 'hidden') return 'badge-default';
  return 'badge-error';
}

function hasSpecialOrderItems(products: DistributorCatalogProduct[], cart: CartMap): boolean {
  return cartEntries(cart, products).some(({ product }) => inventoryStatusForProduct(product).was_special_order);
}

type RockPhormIntakeOverride = {
  match: (value: string) => boolean;
  productName?: string;
  strength: string;
  price?: number;
  description?: string;
};

const ROCKPHORM_INTAKE_OVERRIDES: RockPhormIntakeOverride[] = [
  { match: (value) => value.includes('bpc-157') && value.includes('10') && !value.includes('tb-500') && !value.includes('blend'), strength: '10 mg', price: 139 },
  { match: (value) => value.includes('cagrilintide'), strength: '5 mg', price: 169 },
  { match: (value) => value.includes('retatrutide') && value.includes('15'), strength: '15 mg', price: 168 },
  { match: (value) => value.includes('retatrutide') && value.includes('30'), strength: '30 mg', price: 298 },
  { match: (value) => value.includes('semaglutide'), strength: '10 mg', price: 99 },
  { match: (value) => value.includes('cagrisema'), strength: '2.4 mg + 2.4 mg, 4.8 mg total', price: 198 },
  { match: (value) => value.includes('tirzepatide') && value.includes('15'), strength: '15 mg', price: 149 },
  { match: (value) => value.includes('tirzepatide') && value.includes('30'), strength: '30 mg', price: 199 },
  { match: (value) => value.includes('mots') && value.includes('10'), strength: '10 mg', price: 149 },
  { match: (value) => value.includes('ghk') && value.includes('100'), strength: '100 mg', price: 129 },
  { match: (value) => value.includes('glow') && value.includes('blend'), productName: 'Glow Stack', strength: '70 mg total', price: 169 },
  { match: (value) => value.includes('glutathione'), strength: '1,500 mg', price: 149 },
  { match: (value) => value.includes('cjc') && value.includes('ipamorelin'), strength: '5 mg + 5 mg, 10 mg total', price: 169 },
  { match: (value) => value.includes('tb-500') && value.includes('10') && !value.includes('bpc-157') && !value.includes('blend'), strength: '10 mg', price: 149 },
  { match: (value) => value.includes('tesamorelin') && value.includes('10'), strength: '10 mg', price: 169 },
  { match: (value) => (value.includes('ipamorelin') || value.includes('ipa')) && value.includes('5') && !value.includes('cjc'), strength: '5 mg' },
  { match: (value) => (value.includes('ipamorelin') || value.includes('ipa')) && value.includes('10') && !value.includes('cjc'), strength: '10 mg' },
  { match: (value) => value.includes('ipamorelin') && !value.includes('cjc'), strength: '5 mg' },
  { match: (value) => (value.includes('hgh') || value.includes('somatropin')) && (value.includes('24') || value.includes('240')), productName: 'HGH / Somatropin', strength: '24 IU x 10, 240 IU total', price: 199 },
  { match: (value) => (value.includes('hgh') || value.includes('somatropin')) && !value.includes('24') && !value.includes('240') && (value.includes('10') || value.includes('100')), productName: 'HGH / Somatropin', strength: '10 IU x 10, 100 IU total' },
  { match: (value) => value.includes('hgh') || value.includes('somatropin'), productName: 'HGH / Somatropin', strength: '24 IU x 10, 240 IU total', price: 199 },
  {
    match: (value) => (value.includes('bpc-157') && value.includes('tb-500')) || value.includes('wolverine'),
    productName: 'Wolverine Stack',
    strength: 'BPC-157 10 mg + TB-500 10 mg, 20 mg total',
    description: 'Rock Phorm BPC-157 10 mg + TB-500 10 mg blend, 20 mg total bottle. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
  },
  { match: (value) => value.includes('bac') && (value.includes('water') || value.includes('syringe')), strength: 'Kit' },
];

function normalizeRockPhormProduct(product: DistributorCatalogProduct): DistributorCatalogProduct {
  const haystack = [product.id, product.sku, product.product_name, product.strength, product.category, product.description]
    .join(' ')
    .toLowerCase();
  const override = ROCKPHORM_INTAKE_OVERRIDES.find((item) => item.match(haystack));
  if (!override) return product;

  const savedDisplayPrice = typeof product.displayPrice === 'number' && product.displayPrice > 0
    ? product.displayPrice
    : null;
  const displayPrice = savedDisplayPrice ?? override.price ?? product.displayPrice;
  return {
    ...product,
    product_name: override.productName ?? product.product_name,
    strength: override.strength,
    description: override.description ?? product.description,
    suggested_retail_price: displayPrice ?? product.suggested_retail_price,
    distributorProduct: {
      ...product.distributorProduct,
      custom_price: displayPrice ?? product.distributorProduct.custom_price,
    },
    displayPrice,
  };
}

function isRockPhormWolverineBlend(product: DistributorCatalogProduct): boolean {
  const haystack = [product.id, product.sku, product.product_name, product.strength, product.category, product.description]
    .join(' ')
    .toLowerCase();
  return haystack.includes('wolverine')
    || haystack.includes('bpc/tb')
    || (haystack.includes('bpc-157') && haystack.includes('tb-500'))
    || haystack.includes('bb10');
}

function collapseRockPhormDuplicateProducts(products: DistributorCatalogProduct[]): DistributorCatalogProduct[] {
  const wolverineCandidates = products.filter(isRockPhormWolverineBlend);
  if (wolverineCandidates.length <= 1) return products;

  const canonical = wolverineCandidates
    .filter((product) => typeof product.displayPrice === 'number' && product.displayPrice > 0)
    .sort((a, b) => (a.displayPrice ?? Number.MAX_SAFE_INTEGER) - (b.displayPrice ?? Number.MAX_SAFE_INTEGER))[0]
    ?? wolverineCandidates[0];
  const canonicalPrice = canonical.displayPrice;
  const canonicalWolverine = {
    ...canonical,
    product_name: 'Wolverine Stack',
    strength: 'BPC-157 10 mg + TB-500 10 mg, 20 mg total',
    category: 'Recovery / Performance / Wellness' as RxPlusCategory,
    description: 'Rock Phorm BPC-157 10 mg + TB-500 10 mg blend, 20 mg total bottle. Availability, suitability, and fulfillment are subject to standard verification and applicable state requirements.',
    badges: Array.from(new Set([...(canonical.badges ?? []), 'best seller'])),
    suggested_retail_price: canonicalPrice ?? canonical.suggested_retail_price,
    distributorProduct: {
      ...canonical.distributorProduct,
      custom_price: canonicalPrice ?? canonical.distributorProduct.custom_price,
    },
    displayPrice: canonicalPrice,
  };

  let inserted = false;
  return products.reduce<DistributorCatalogProduct[]>((acc, product) => {
    if (!isRockPhormWolverineBlend(product)) {
      acc.push(product);
      return acc;
    }
    if (!inserted) {
      acc.push(canonicalWolverine);
      inserted = true;
    }
    return acc;
  }, []);
}

function normalizeCatalogProduct(product: DistributorCatalogProduct): DistributorCatalogProduct {
  const metadata = getProductMetadata(product);
  return {
    ...product,
    product_name: metadata.commonName,
    strength: metadata.doseLabel,
  };
}

function retailUnitLabel(product: DistributorCatalogProduct): string {
  const label = `${product.product_name} ${product.strength}`.toLowerCase();
  if (label.includes('10 vials') || label.includes('10-vial')) return '10-vial pack';
  return 'vial';
}

function isAactivatedTopSeller(product: DistributorCatalogProduct): boolean {
  return product.distributorProduct.featured;
}

function portalSpecialPriceLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal = false, isAlphaPortal = false, isZenoraPortal = false, isAuroraPortal = false, isPhysioPeptidesPortal = false, isGintoPortal = false, isAnatoliaPortal = false, isBeastModePortal = false): string | null {
  if (isAnatoliaPortal) return 'Anatolia Wellness Labs siparişleri ana PepScriptRX platformuna bağlı kalır.';
  if (isMarkPortal) return 'Special Empire member pricing is attached through checkout.';
  if (isZenoraPortal) return 'ZENORA pricing and JESS8 attribution are attached through checkout.';
  if (isAuroraPortal) return 'Aurora Labs preferred pricing is applied at checkout.';
  if (isPhysioPeptidesPortal) return 'PhysioPeptides pricing and attribution stay attached through checkout.';
  if (isGintoPortal) return 'Ginto Wellness Labs attribution stays attached through checkout.';
  if (isBeastModePortal) return null;
  if (isAlphaPortal) return 'Alpha Pride member pricing is attached through checkout.';
  if (isRobertPortal) return null;
  if (isGuyPortal) return 'AACTIVATEDRX account pricing stays attached through checkout.';
  return null;
}

function portalPoweredByLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal: boolean, isOptimaxPortal: boolean, isAlphaPortal: boolean, isRoninPortal = false, isAgPrimePortal = false, isVyigenixPortal = false, isRockPhormPortal = false, isZenoraPortal = false, isAuroraPortal = false, isPhysioPeptidesPortal = false, isGintoPortal = false, isAnatoliaPortal = false, isBeastModePortal = false): string {
  if (isAnatoliaPortal) return 'Anatolia Wellness Labs, PepScriptRX altyapısıyla desteklenir.';
  if (isGintoPortal) return 'Ginto Wellness Labs ordering is powered by PepScriptRX.';
  if (isBeastModePortal) return 'BEASTMODE Performance Labs. WE NOT THE SAME. Powered by PepScriptRX.';
  if (isPhysioPeptidesPortal) return 'Secure PhysioPeptides ordering with PepScriptRX checkout support.';
  if (isAuroraPortal) return 'Aurora Labs secure ordering is powered by PepScriptRX.';
  if (isZenoraPortal) return 'ZENORA is powered under Empire Health & Wellness and PepScriptRX.';
  if (isRockPhormPortal) return 'Rock Phorm is powered by PepScriptRX.';
  if (isVyigenixPortal) return 'Vyigenix Pharmaceuticals is powered under Empire Health & Wellness and PepScriptRX.';
  if (isAgPrimePortal) return 'AG Prime Lab is powered under Empire Health & Wellness and PepScriptRX.';
  if (isRoninPortal) return 'Ronin is powered by PepScriptRX.';
  if (isRobertPortal) return 'Powered by Empire Health & Wellness and PepScriptRX.';
  if (isAlphaPortal) return 'Alpha Pride Wellness is powered under Empire Health & Wellness and PepScriptRX.';
  if (isOptimaxPortal) return 'Powered by Optimax Peptide Therapy and PepScriptRX.';
  if (isMarkPortal) return 'Powered by PepScriptRX.';
  if (isGuyPortal) return 'AACTIVATEDRX private partner ecosystem.';
  return 'Powered by PepScriptRX.';
}

function portalProductImageSrc(
  product: DistributorCatalogProduct,
  isMarkPortal: boolean,
  isGuyPortal: boolean,
  isRobertPortal: boolean,
  isScottPortal: boolean,
  isAlphaPortal: boolean,
  isOptimaxPortal: boolean,
  isRoninPortal = false,
  isAgPrimePortal = false,
  isVyigenixPortal = false,
  isRockPhormPortal = false,
  isZenoraPortal = false,
  isAuroraPortal = false,
  isPhysioPeptidesPortal = false,
  isGintoPortal = false,
  isAnatoliaPortal = false,
  isBeastModePortal = false,
): string | undefined {
  if (isAnatoliaPortal) return ANATOLIA_PRODUCT_IMAGE_SRC;
  if (isBeastModePortal) {
    const productText = `${product.id} ${product.product_name} ${product.category}`.toLowerCase();
    if (productText.includes('wolverine') || productText.includes('bpc') || productText.includes('tb-500')) return BEASTMODE_WOLVERINE_SRC;
    return BEASTMODE_HERO_SRC;
  }
  if (isGintoPortal) {
    const productText = `${product.id} ${product.product_name} ${product.category}`.toLowerCase();
    if (productText.includes('bac water') || productText.includes('bacteriostatic') || productText.includes('supply')) return GINTO_SUPPLY_IMAGE_SRC;
    if (productText.includes('needle') || productText.includes('syringe')) return GINTO_NEEDLES_IMAGE_SRC;
    return GINTO_PRODUCT_IMAGE_SRC;
  }
  if (isPhysioPeptidesPortal) return PHYSIOPEPTIDES_PRODUCT_IMAGE_SRC;
  if (isAuroraPortal) return AURORA_PRODUCT_IMAGE_SRC;
  if (isZenoraPortal) return ZENORA_PRODUCT_IMAGE_SRC;
  if (isRockPhormPortal) return ROCKPHORM_PRODUCT_IMAGE_SRC;
  if (isVyigenixPortal) return VYIGENIX_PRODUCT_IMAGE_SRC;
  if (isAgPrimePortal) return AG_PRIME_PRODUCT_IMAGE_SRC;
  if (isRoninPortal) return RONIN_PRODUCT_IMAGE_SRC;
  if (isScottPortal && product.id === 'scott-insulin-needles') return SCOTT_NEEDLES_IMAGE_SRC;
  if (isMarkPortal) return MARK_PRODUCT_IMAGE_SRC;
  if (isRobertPortal) return ROBERT_PRODUCT_IMAGE_SRC;
  if (isScottPortal) return SCOTT_PRODUCT_IMAGE_SRC;
  if (isAlphaPortal) return ALPHA_PRODUCT_IMAGE_SRC;
  if (isOptimaxPortal) return OPTIMAX_PRODUCT_IMAGE_SRC;
  if (isGuyPortal) return GUY_PRODUCT_IMAGE_SRC;
  return undefined;
}

function ProductThumbnail({ product, imageSrc }: { product: DistributorCatalogProduct; imageSrc?: string }) {
  const isAgPrimeImage = imageSrc === AG_PRIME_PRODUCT_IMAGE_SRC || imageSrc === '/marketing/ag-prime-lab-vial-cutout.png';
  const isRockPhormImage = imageSrc === ROCKPHORM_PRODUCT_IMAGE_SRC;
  const isAuroraImage = imageSrc === AURORA_PRODUCT_IMAGE_SRC;
  const isPhysioPeptidesImage = imageSrc === PHYSIOPEPTIDES_PRODUCT_IMAGE_SRC;
  const isGintoImage = imageSrc === GINTO_PRODUCT_IMAGE_SRC;
  const isAnatoliaImage = imageSrc === ANATOLIA_PRODUCT_IMAGE_SRC;
  const isBeastModeImage = imageSrc === BEASTMODE_HERO_SRC || imageSrc === BEASTMODE_WOLVERINE_SRC;
  const initials = product.product_name
    .split(/\s|\+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const accent = product.category.includes('Weight')
    ? '#25C7D9'
    : product.category.includes('Recovery')
      ? '#22c55e'
      : product.category.includes('Growth')
        ? '#8b5cf6'
        : '#f59e0b';

  return (
    <div
      className={isRockPhormImage || isAuroraImage ? 'luxury-catalog-thumb' : isBeastModeImage ? 'beastmode-catalog-thumb' : undefined}
      style={{
      height: imageSrc ? (isAgPrimeImage || isRockPhormImage || isAuroraImage || isPhysioPeptidesImage || isGintoImage || isAnatoliaImage || isBeastModeImage ? 150 : 132) : 96,
      borderRadius: isAgPrimeImage || isRockPhormImage || isAuroraImage || isPhysioPeptidesImage || isGintoImage || isAnatoliaImage || isBeastModeImage ? 10 : 12,
      background: imageSrc
        ? isAgPrimeImage
          ? 'linear-gradient(145deg, #ffffff 0%, #f8fafc 58%, #e7eef7 100%)'
          : isPhysioPeptidesImage
            ? 'radial-gradient(circle at 50% 34%, rgba(255,255,255,.92), rgba(20,184,166,.16) 48%, rgba(239,246,255,.96) 78%), linear-gradient(145deg,#ffffff,#e6f7f3)'
          : isAuroraImage
            ? 'radial-gradient(circle at 50% 38%, rgba(255,250,244,.88), rgba(196,166,111,.24) 43%, rgba(13,44,35,.92) 78%), linear-gradient(145deg,#0d2c23,#123a30)'
            : isGintoImage
              ? 'radial-gradient(circle at 50% 34%, rgba(255,250,240,.78), rgba(200,169,106,.20) 48%, rgba(5,5,5,.92) 78%), linear-gradient(145deg,#17130c,#050505)'
            : isAnatoliaImage
              ? 'radial-gradient(circle at 50% 34%, rgba(255,255,255,.94), rgba(0,109,119,.16) 48%, rgba(212,175,55,.22) 78%), linear-gradient(145deg,#ffffff,#f8fafc)'
            : isBeastModeImage
              ? 'linear-gradient(145deg,#050505,#181a1d 48%,#32070b)'
            : isRockPhormImage
              ? 'radial-gradient(circle at 50% 42%, rgba(255,250,244,.72), rgba(196,166,111,.22) 44%, rgba(9,33,27,.96) 76%), linear-gradient(145deg,#071a16,#0d2c23)'
          : 'radial-gradient(circle at 50% 42%, rgba(37,199,217,.28), #07111f 72%)'
        : `linear-gradient(145deg, ${accent}22, #ffffff 60%)`,
      border: imageSrc ? (isAgPrimeImage ? '1px solid rgba(0,104,217,.18)' : isPhysioPeptidesImage ? '1px solid rgba(20,184,166,.30)' : isAuroraImage ? '1px solid rgba(45,212,191,.34)' : isGintoImage ? '1px solid rgba(200,169,106,.34)' : isBeastModeImage ? '1px solid rgba(193,18,31,.42)' : isRockPhormImage ? '1px solid rgba(20,184,166,.28)' : '1px solid rgba(37,199,217,.24)') : '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 14,
      boxShadow: isAgPrimeImage
        ? 'inset 0 1px 0 rgba(255,255,255,.94), 0 12px 28px rgba(15,23,42,.08)'
        : isPhysioPeptidesImage
          ? 'inset 0 1px 0 rgba(255,255,255,.94), 0 16px 34px rgba(14,116,144,.14)'
        : isAuroraImage
          ? 'inset 0 1px 0 rgba(255,255,255,.94), 0 16px 34px rgba(14,165,233,.16)'
          : isGintoImage
          ? 'inset 0 1px 0 rgba(255,255,255,.12), 0 16px 34px rgba(0,0,0,.28), 0 0 26px rgba(200,169,106,.12)'
          : isRockPhormImage
          ? 'inset 0 1px 0 rgba(255,255,255,.10), 0 16px 34px rgba(2,6,23,.24)'
          : isBeastModeImage
          ? 'inset 0 1px 0 rgba(255,255,255,.10), 0 16px 34px rgba(0,0,0,.36), 0 0 28px rgba(193,18,31,.18)'
          : undefined,
    }}>
      {isAgPrimeImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(255,255,255,.98) 0%, rgba(255,255,255,.9) 42%, rgba(219,234,254,.34) 100%)' }} />
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, height: 2, borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(0,104,217,.52), transparent)' }} />
        </>
      )}
      {(isRockPhormImage || isAuroraImage) && (
        <>
          <div className="luxury-catalog-thumb-pattern" />
          <div className="luxury-catalog-thumb-ribbon" />
        </>
      )}
      {isPhysioPeptidesImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,.78), transparent 52%)' }} />
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, height: 2, borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(34,197,94,.62), rgba(14,165,233,.62), transparent)' }} />
        </>
      )}
      {isGintoImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.08), transparent 46%, rgba(200,169,106,.16))' }} />
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, height: 2, borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(200,169,106,.82), transparent)' }} />
        </>
      )}
      {isAnatoliaImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 38%, rgba(255,255,255,.82), transparent 54%)' }} />
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, height: 2, borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(0,109,119,.70), rgba(212,175,55,.78), rgba(244,162,97,.50), transparent)' }} />
        </>
      )}
      {isBeastModeImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.08), transparent 46%, rgba(193,18,31,.20))' }} />
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, height: 2, borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(193,18,31,.9), transparent)' }} />
        </>
      )}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${product.product_name} ${product.strength}`}
          loading="lazy"
          style={{
            width: isAgPrimeImage ? '118%' : isBeastModeImage ? '100%' : isRockPhormImage || isAuroraImage || isPhysioPeptidesImage || isGintoImage || isAnatoliaImage ? '112%' : '100%',
            height: isAgPrimeImage ? '118%' : isBeastModeImage ? '100%' : isRockPhormImage || isAuroraImage || isPhysioPeptidesImage || isGintoImage || isAnatoliaImage ? '112%' : '100%',
            objectFit: isBeastModeImage ? 'cover' : 'contain',
            objectPosition: 'center',
            padding: isAgPrimeImage || isRockPhormImage || isAuroraImage || isPhysioPeptidesImage || isBeastModeImage ? 0 : 8,
            transform: isAgPrimeImage ? 'scale(1.46)' : isRockPhormImage ? 'scale(1.22)' : isAuroraImage ? 'scale(1.16)' : isPhysioPeptidesImage ? 'scale(1.14)' : undefined,
            filter: isAgPrimeImage
              ? 'contrast(1.04) saturate(1.03) drop-shadow(0 18px 20px rgba(15,23,42,.14))'
              : isPhysioPeptidesImage
                ? 'contrast(1.03) saturate(1.08) drop-shadow(0 20px 24px rgba(15,23,42,.16))'
              : isAuroraImage
                ? 'contrast(1.03) saturate(1.08) drop-shadow(0 20px 24px rgba(15,23,42,.18))'
              : isRockPhormImage
                ? 'contrast(1.05) saturate(1.08) drop-shadow(0 20px 26px rgba(0,0,0,.38))'
                : isBeastModeImage
                  ? 'contrast(1.08) saturate(1.04) drop-shadow(0 18px 24px rgba(193,18,31,.20))'
                : undefined,
            position: 'relative',
            zIndex: isRockPhormImage || isAuroraImage ? 3 : 1,
          }}
        />
      ) : (
        <>
          <div style={{ width: 28, height: 74, borderRadius: '10px 10px 6px 6px', border: `2px solid ${accent}`, background: '#fff', boxShadow: '0 10px 20px rgba(7,20,34,.10)' }} />
          <div style={{ position: 'absolute', width: 54, height: 54, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, boxShadow: `0 10px 24px ${accent}44` }}>
            {initials || 'RX'}
          </div>
        </>
      )}
    </div>
  );
}

// ── Quantity Stepper ─────────────────────────────────────────────────────────
function AgPrimeBrandShowcase() {
  return (
    <div className="agprime-brand-showcase" aria-label="AG Prime Lab product showcase">
      <div className="agprime-brand-card">
        <div className="agprime-logo-shell">
          <img className="agprime-brand-logo" src={AG_PRIME_LOGO_SRC} alt="AG Prime Lab" />
        </div>
        <div className="agprime-brand-rule" />
        <div className="agprime-brand-copy">
          <span>Performance Wellness Catalog</span>
          <strong>Recover Better. Perform Stronger.</strong>
          <small>Premium AG Prime Lab pricing with secure PepScriptRX checkout.</small>
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, label = 'item' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div className="portal-qty-stepper" role="group" aria-label={`Quantity for ${label}`} style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: 36 }}>
      <button
        type="button"
        className="portal-qty-stepper-btn portal-qty-stepper-btn-minus"
        aria-label={`Decrease ${label} quantity`}
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >−</button>
      <output aria-live="polite" style={{ minWidth: 36, textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--navy)', background: '#fff' }}>{value}</output>
      <button
        type="button"
        className="portal-qty-stepper-btn portal-qty-stepper-btn-plus"
        aria-label={`Increase ${label} quantity`}
        onClick={() => onChange(value + 1)}
        style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >+</button>
    </div>
  );
}

// ── Cart Drawer (mobile overlay / sidebar) ───────────────────────────────────
function CartDrawer({
  open,
  onClose,
  showDiscountCode,
  cart,
  products,
  discountCodeInput,
  discountCodeMessage,
  discountCodeApplying,
  appliedPromo,
  promoDiscountAmount,
  onQtyChange,
  onClear,
  onDiscountCodeInputChange,
  onApplyDiscountCode,
  onCheckout,
  isAnatoliaPortal = false,
}: {
  open: boolean;
  onClose: () => void;
  showDiscountCode: boolean;
  cart: CartMap;
  products: DistributorCatalogProduct[];
  discountCodeInput: string;
  discountCodeMessage: string;
  discountCodeApplying: boolean;
  appliedPromo: AactivatedPromoLink | null;
  promoDiscountAmount: number;
  onQtyChange: (id: string, qty: number) => void;
  onClear: () => void;
  onDiscountCodeInputChange: (value: string) => void;
  onApplyDiscountCode: () => void;
  onCheckout: () => void;
  isAnatoliaPortal?: boolean;
}) {
  if (!open) return null;

  const entries = cartEntries(cart, products);
  const subtotal = cartSubtotal(cart, products);
  const bundleSummary = bundleDiscountSummary(cart, products);
  const total = Math.max(0, cartTotal(cart, products) - promoDiscountAmount);
  const count = cartCount(cart);
  const promoNeedsProduct = Boolean(appliedPromo?.product_id && !cart[appliedPromo.product_id]);
  const cartHasSpecialOrder = hasSpecialOrderItems(products, cart);
  const orderLabel = isAnatoliaPortal ? 'Siparişiniz' : 'Your Order';
  const itemLabel = isAnatoliaPortal ? 'ürün' : count === 1 ? 'item' : 'items';

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
        />
      )}
      <div role="dialog" aria-modal="true" aria-label={isAnatoliaPortal ? 'Alışveriş sepeti' : 'Shopping cart'} aria-hidden={!open} style={{
        position: 'fixed', top: 0, right: 0, height: '100dvh', width: Math.min(420, window.innerWidth - 48),
        background: '#fff', zIndex: 1001, boxShadow: '-8px 0 40px rgba(0,0,0,.18)',
        transform: open ? 'translateX(0)' : 'translateX(110%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--navy)' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>{orderLabel}</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 2 }}>{count} {itemLabel}</div>
          </div>
          <button type="button" aria-label={isAnatoliaPortal ? 'Sepeti kapat' : 'Close cart'} onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{isAnatoliaPortal ? 'Sepetiniz boş' : 'Your cart is empty'}</div>
              <div style={{ fontSize: 13 }}>{isAnatoliaPortal ? 'Ürünleri inceleyin ve eklemek için + düğmesine dokunun.' : 'Browse products and tap + to add items.'}</div>
            </div>
          ) : entries.map(({ product, qty }) => {
            const metadata = getProductMetadata(product);
            const inventoryStatus = inventoryStatusForProduct(product);
            return (
            <div key={product.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14, lineHeight: 1.3 }}>{product.product_name}</div>
                  <button
                    type="button"
                    onClick={() => onQtyChange(product.id, 0)}
                    aria-label={isAnatoliaPortal ? `${product.product_name} ürününü sepetten çıkar` : `Remove ${product.product_name} from cart`}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      border: '1px solid rgba(15,23,42,.18)',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 16,
                      fontWeight: 900,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{product.strength} · {product.category}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{isAnatoliaPortal ? 'Teknik ad' : 'Technical'}: {metadata.technicalName}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
                  <span className={`badge ${inventoryBadgeClass(inventoryStatus.inventory_status)}`}>{inventoryStatus.inventory_status_label}</span>
                  {inventoryStatus.was_special_order && (
                    <span style={{ fontSize: 12, color: '#0e7490', fontWeight: 800 }}>{SPECIAL_ORDER_ITEM_NOTICE}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700, marginTop: 4 }}>{formatRetailPrice(product.displayPrice ? product.displayPrice * qty : null)}</div>
              </div>
              <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
            </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px 14px', borderTop: '1px solid var(--border)', background: 'var(--card-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{isAnatoliaPortal ? `Ara toplam (${count} ürün)` : `Subtotal (${count} items)`}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>${subtotal.toFixed(2)}</span>
          </div>
          {bundleSummary.rows.map((row) => (
            <div key={row.groupKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#0f766e', fontWeight: 800, marginBottom: 4 }}>
              <span>{row.groupName} {isAnatoliaPortal ? 'paket indirimi' : 'bundle savings'}</span>
              <span>-${row.discount.toFixed(2)}</span>
            </div>
          ))}
          {showDiscountCode && (
            <div style={{ display: 'grid', gap: 8, margin: '12px 0', padding: 10, border: '1px solid rgba(8,145,178,.18)', borderRadius: 10, background: '#fff' }}>
              <div style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 900 }}>{isAnatoliaPortal ? 'İndirim kodu' : 'Discount code'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={discountCodeInput}
                  onChange={(event) => onDiscountCodeInputChange(event.target.value)}
                  placeholder={isAnatoliaPortal ? 'Kodu girin' : 'Enter code'}
                  autoCapitalize="characters"
                  style={{ minWidth: 0 }}
                />
                <button className="btn btn-outline btn-sm" type="button" onClick={onApplyDiscountCode} disabled={discountCodeApplying}>
                  {discountCodeApplying ? (isAnatoliaPortal ? 'Kontrol ediliyor...' : 'Checking...') : (isAnatoliaPortal ? 'Uygula' : 'Apply')}
                </button>
              </div>
              {discountCodeMessage && (
                <div style={{ fontSize: 12, color: promoDiscountAmount > 0 ? '#047857' : promoNeedsProduct ? '#a16207' : 'var(--text-muted)', fontWeight: 800 }}>
                  {discountCodeMessage}
                </div>
              )}
            </div>
          )}
          {showDiscountCode && promoDiscountAmount > 0 && appliedPromo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#0f766e', fontWeight: 900, marginBottom: 4 }}>
              <span>{isAnatoliaPortal ? 'Kod' : 'Code'} {appliedPromo.discount_code}</span>
              <span>-${promoDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {cartHasSpecialOrder && (
            <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, background: '#ecfeff', border: '1px solid rgba(14,116,144,.22)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              {SPECIAL_ORDER_CHECKOUT_NOTICE}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>{isAnatoliaPortal ? 'Toplam' : 'Total'}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${total.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{isAnatoliaPortal ? 'Sırada güvenli ödeme açılır. Teslimat bilgileri ödeme sırasında doğrulanır.' : 'Secure checkout opens next. Shipping is confirmed at checkout.'}</div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 0', borderRadius: 10 }}
            disabled={entries.length === 0}
            onClick={onCheckout}
          >
            {isAnatoliaPortal ? 'Ödemeye Devam Et' : 'Continue to Secure Checkout'} →
          </button>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#b91c1c', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '7px 0' }}
            >
              {isAnatoliaPortal ? 'Sepeti Temizle' : 'Clear Cart'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}
          >
            {isAnatoliaPortal ? 'Alışverişe Devam Et' : 'Continue Shopping'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────
function AddedToCartModal({
  product,
  onContinue,
  onViewCart,
  onCheckout,
  compact = false,
  isAnatoliaPortal = false,
}: {
  product: DistributorCatalogProduct | null;
  onContinue: () => void;
  onViewCart: () => void;
  onCheckout: () => void;
  compact?: boolean;
  isAnatoliaPortal?: boolean;
}) {
  if (!product) return null;
  const inventoryStatus = inventoryStatusForProduct(product);
  return (
    <>
      {!compact && (
        <div
          onClick={onContinue}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,23,.48)', zIndex: 1200, backdropFilter: 'blur(3px)' }}
        />
      )}
      <div
        role={compact ? 'status' : 'dialog'}
        aria-modal={compact ? undefined : true}
        aria-label={isAnatoliaPortal ? 'Sepete eklendi' : 'Added to cart'}
        style={{
          position: 'fixed',
          left: compact ? 'auto' : '50%',
          right: compact ? 18 : 'auto',
          top: compact ? 'auto' : '50%',
          bottom: compact ? 18 : 'auto',
          transform: compact ? 'none' : 'translate(-50%, -50%)',
          zIndex: 1201,
          width: compact ? 'min(360px, calc(100vw - 28px))' : 'min(420px, calc(100vw - 32px))',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid rgba(15,23,42,.12)',
          boxShadow: compact ? '0 16px 42px rgba(2,8,23,.22)' : '0 26px 80px rgba(2,8,23,.32)',
          padding: compact ? 16 : 22,
        }}
      >
        <button
          type="button"
          aria-label={isAnatoliaPortal ? 'Sepete eklendi penceresini kapat' : 'Close added to cart'}
          onClick={onContinue}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '1px solid rgba(15,23,42,.14)',
            background: '#fff',
            color: '#0f172a',
            cursor: 'pointer',
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          ×
        </button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 22, flexShrink: 0 }}>
            ✓
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: '0 0 5px', color: 'var(--navy)', fontSize: 24, lineHeight: 1.1 }}>{isAnatoliaPortal ? 'Sepete Eklendi' : 'Added To Cart'}</h2>
            <p style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.45 }}>
              {isAnatoliaPortal ? `${product.product_name} ${product.strength && product.strength !== 'Standard' ? product.strength : ''} sepetinizde.` : `${product.product_name} ${product.strength && product.strength !== 'Standard' ? product.strength : ''} is in your cart.`}
            </p>
            {inventoryStatus.was_special_order && (
              <p style={{ margin: '6px 0 0', color: '#0e7490', fontSize: 13, lineHeight: 1.45, fontWeight: 800 }}>
                {SPECIAL_ORDER_ITEM_NOTICE}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: compact ? 'flex' : 'grid', gap: 10, marginTop: compact ? 14 : 20, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="button" onClick={onCheckout} style={{ justifyContent: 'center' }}>
            {isAnatoliaPortal ? 'Şimdi Öde' : 'Continue to Secure Checkout'}
          </button>
          <button className="btn btn-outline" type="button" onClick={onViewCart} style={{ justifyContent: 'center' }}>
            {isAnatoliaPortal ? 'Sepeti Görüntüle' : 'View Cart'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onContinue} style={{ justifyContent: 'center' }}>
            {isAnatoliaPortal ? 'Alışverişe Devam Et' : 'Continue Shopping'}
          </button>
        </div>
      </div>
    </>
  );
}

function AddedToCartInlineNotice({
  product,
  onContinue,
  onViewCart,
}: {
  product: DistributorCatalogProduct | null;
  onContinue: () => void;
  onViewCart: () => void;
}) {
  if (!product) return null;

  const inventoryStatus = inventoryStatusForProduct(product);
  const strengthLabel = product.strength && product.strength !== 'Standard' ? ` ${product.strength}` : '';

  return (
    <div
      role="status"
      aria-label="Added to cart"
      style={{
        background: '#f0fdfa',
        border: '1px solid rgba(20,184,166,.38)',
        borderRadius: 14,
        boxShadow: '0 10px 26px rgba(15,118,110,.10)',
        color: '#0f172a',
        display: 'grid',
        gap: 12,
        marginBottom: 18,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: '#ccfbf1', color: '#0f766e', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>
          OK
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#064e3b', fontWeight: 900, fontSize: 15, lineHeight: 1.25 }}>Added to cart</div>
          <div style={{ color: '#334155', fontSize: 13, fontWeight: 700, lineHeight: 1.45, marginTop: 2 }}>
            {product.product_name}{strengthLabel} is in your cart.
          </div>
          {inventoryStatus.was_special_order && (
            <div style={{ color: '#0e7490', fontSize: 12, fontWeight: 800, lineHeight: 1.45, marginTop: 5 }}>
              {SPECIAL_ORDER_ITEM_NOTICE}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" type="button" onClick={onViewCart} style={{ justifyContent: 'center' }}>
          View Cart
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={onContinue} style={{ justifyContent: 'center' }}>
          Continue Shopping
        </button>
      </div>
    </div>
  );
}

function AactivatedShowcaseCard({
  product,
  qty,
  onQtyChange,
  onAdd,
  onLearnMore,
}: {
  product: DistributorCatalogProduct;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
  onAdd: (id: string) => void;
  onLearnMore: (product: DistributorCatalogProduct) => void;
}) {
  const inCart = qty > 0;
  const canAddToCart = typeof product.displayPrice === 'number';
  const metadata = getProductMetadata(product);
  const category = product.category.replace(/\s*\/\s*/g, ' / ');
  const strengthLabel = product.strength && product.strength !== 'Standard'
    ? product.strength
    : retailUnitLabel(product);
  const showStrengthInline = product.strength && product.strength !== 'Standard' && !product.product_name.toLowerCase().includes(product.strength.toLowerCase());
  const title = showStrengthInline ? `${product.product_name} ${strengthLabel}` : product.product_name;
  const isTopSeller = isAactivatedTopSeller(product);
  const mixingPath = portalMixingCenterPath(product, GUY_PORTAL_PATH);
  const publicNote = product.scopedProductNote;
  const bundleName = product.scopedBundleGroupName;
  const bundleNote = product.scopedBundleNote;
  const pricing = aactivatedPriceDiscount(product);
  const inventoryStatus = inventoryStatusForProduct(product);
  const openDetails = () => onLearnMore(product);
  const handleCardClick = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    openDetails();
  };
  const renderActions = () => (
    <>
      {inCart ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) minmax(0,1fr)', gap: 10, alignItems: 'center' }}>
          <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onAdd(product.id)}
            style={{ minHeight: 52, borderRadius: 14, justifyContent: 'center', fontWeight: 950 }}
          >
            Add One More
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onLearnMore(product)}
            style={{ minHeight: 52, borderRadius: 14, justifyContent: 'center', fontWeight: 900, color: '#075985', borderColor: 'rgba(8,145,178,.35)', background: 'rgba(255,255,255,.78)' }}
          >
            View Details
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, .65fr)', gap: 10 }}>
          <button
            type="button"
            disabled={!canAddToCart || !inventoryStatus.checkout_allowed}
            onClick={() => onAdd(product.id)}
            style={{
              width: '100%',
              minHeight: 56,
              border: '1px solid rgba(103,232,249,.72)',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
              color: '#fff',
              fontSize: 17,
              fontWeight: 950,
              cursor: canAddToCart && inventoryStatus.checkout_allowed ? 'pointer' : 'not-allowed',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 12px 22px rgba(8,145,178,.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
            }}
          >
            <span style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,.58)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>+</span>
            Add to Cart
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={openDetails}
            style={{ minHeight: 56, borderRadius: 16, justifyContent: 'center', fontWeight: 900, color: '#075985', borderColor: 'rgba(8,145,178,.35)', background: 'rgba(255,255,255,.84)' }}
          >
            Details
          </button>
        </div>
      )}
      <Link
        to={mixingPath}
        className="btn btn-outline btn-sm"
        style={{ width: '100%', justifyContent: 'center', marginTop: 10, borderRadius: 14, background: 'rgba(255,255,255,.82)', fontWeight: 900 }}
      >
        Mixing Center
      </Link>
    </>
  );

  return (
    <article className={`aactivated-product-card ${inCart ? 'in-cart' : ''}`} onClick={handleCardClick}>
      <div className="aactivated-product-card-frame" />
      <div className="aactivated-product-card-glow" />

      <div className="aactivated-card-content">
        <header className="aactivated-card-header">
          <img
            src={GUY_LOGO_SRC}
            alt="AACTIVATED-RX"
            loading="lazy"
            className="aactivated-card-logo"
          />
          <AACTIVATEDRXVerificationBadge placement="card" productName={title} />
        </header>

        <div className="aactivated-card-main">
          <div className="aactivated-card-copy">
            {isTopSeller && (
              <span className="aactivated-top-seller-badge">
                Top seller
              </span>
            )}
            <span className={`badge ${inventoryBadgeClass(inventoryStatus.inventory_status)}`} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
              {inventoryStatus.inventory_status_label}
            </span>
            <div className="aactivated-card-category">
              <span>Rx</span>
              <strong>{category}</strong>
            </div>

            <h3 className="aactivated-card-title">
              {title}
            </h3>
            <div style={{ color: '#0f3654', fontSize: 12, fontWeight: 800, lineHeight: 1.35, margin: '-4px 0 10px' }}>
              Technical: {metadata.technicalName}
            </div>
            {!showStrengthInline && (
              <div className="aactivated-card-strength">
                {strengthLabel}
              </div>
            )}
            <div className="aactivated-card-rule" />

            <div style={{ display: 'grid', gridTemplateColumns: pricing.hasDiscount ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ border: '1px solid rgba(15,23,42,.12)', borderRadius: 12, padding: '8px 10px', background: 'rgba(255,255,255,.76)' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>Retail</div>
                <div style={{ color: pricing.hasDiscount ? '#64748b' : '#0f3654', fontSize: pricing.hasDiscount ? 17 : 25, fontWeight: 950, textDecoration: pricing.hasDiscount ? 'line-through' : 'none' }}>
                  {formatRetailPrice(pricing.retail)}
                </div>
              </div>
              {pricing.hasDiscount && (
                <div style={{ border: '1px solid rgba(34,197,94,.28)', borderRadius: 12, padding: '8px 10px', background: '#ecfdf5' }}>
                  <div style={{ color: '#047857', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>Discount</div>
                  <div style={{ color: '#047857', fontSize: 25, fontWeight: 950 }}>
                    {formatRetailPrice(pricing.sale)}
                  </div>
                  <div style={{ color: '#047857', fontSize: 10, fontWeight: 900 }}>Save ${pricing.savings.toFixed(2)}</div>
                </div>
              )}
            </div>

            <div className="aactivated-card-actions aactivated-card-actions-mobile">
              {renderActions()}
            </div>

            {bundleName && (
              <div className="aactivated-card-note" style={{ borderColor: 'rgba(34,197,94,.28)', background: 'rgba(236,253,245,.86)', color: '#047857' }}>
                Bundle: {bundleName}. {bundleDiscountLabel(product)}.
              </div>
            )}

            {inventoryStatus.supporting_copy && (
              <div className="aactivated-card-note" style={{ borderColor: inventoryStatus.was_special_order ? 'rgba(14,116,144,.25)' : undefined, background: inventoryStatus.was_special_order ? 'rgba(236,254,255,.88)' : undefined, color: inventoryStatus.was_special_order ? '#0e7490' : undefined }}>
                {inventoryStatus.supporting_copy}
              </div>
            )}

            {bundleNote && (
              <div className="aactivated-card-note">
                {bundleNote}
              </div>
            )}

            {publicNote && (
              <div className="aactivated-card-note">
                {publicNote}
              </div>
            )}

            <div className="aactivated-card-meta">
              <div>Account-code checkout</div>
              <div>Secure checkout available</div>
            </div>
          </div>

          <div className="aactivated-card-image-shell">
            <img
              src={GUY_PRODUCT_IMAGE_SRC}
              alt={`${product.product_name} vial`}
              loading="lazy"
              className="aactivated-card-image"
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, color: '#0f3654', fontSize: 10, fontWeight: 900, padding: '10px 0 12px' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', color: '#0891b2', border: '1px solid rgba(8,145,178,.35)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>OK</span>
          <span>{inventoryStatus.inventory_status_label}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0891b2' }} />
          <span>{inventoryStatus.was_special_order ? 'Fulfillment review' : 'Fulfillment after verification'}</span>
        </div>
      </div>

      <div className="aactivated-card-actions aactivated-card-actions-desktop">
        {renderActions()}
      </div>
    </article>
  );
}

function ProductCard({
  product,
  qty,
  onQtyChange,
  onAdd,
  onViewCart,
  onLearnMore,
  showDiscount,
  isMarkPortal,
  isGuyPortal,
  isRobertPortal,
  isScottPortal,
  isAlphaPortal,
  isOptimaxPortal,
  isRoninPortal,
  isAgPrimePortal,
  isVyigenixPortal,
  isRockPhormPortal,
  isZenoraPortal,
  isAuroraPortal,
  isPhysioPeptidesPortal,
  isGintoPortal,
  isAnatoliaPortal,
  isBeastModePortal,
  portalPath,
}: {
  product: DistributorCatalogProduct;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
  onAdd: (id: string) => void;
  onViewCart?: () => void;
  onLearnMore: (product: DistributorCatalogProduct) => void;
  showDiscount: boolean;
  isMarkPortal: boolean;
  isGuyPortal: boolean;
  isRobertPortal: boolean;
  isScottPortal: boolean;
  isAlphaPortal: boolean;
  isOptimaxPortal: boolean;
  isRoninPortal: boolean;
  isAgPrimePortal: boolean;
  isVyigenixPortal: boolean;
  isRockPhormPortal: boolean;
  isZenoraPortal: boolean;
  isAuroraPortal?: boolean;
  isPhysioPeptidesPortal?: boolean;
  isGintoPortal?: boolean;
  isAnatoliaPortal?: boolean;
  isBeastModePortal?: boolean;
  portalPath?: string | null;
}) {
  const catIcon = categoryIcon(product.category, isAgPrimePortal);
  const catLabel = categoryLabel(product.category, isAgPrimePortal, isAnatoliaPortal);
  const inCart = qty > 0;
  const inventoryStatus = inventoryStatusForProduct(product);
  const canAddToCart = typeof product.displayPrice === 'number' && inventoryStatus.checkout_allowed;
  const metadata = getProductMetadata(product);
  const isTurkish = Boolean(isAnatoliaPortal);
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal, isAlphaPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal, isBeastModePortal);
  const retailUnit = retailUnitLabel(product);
  const isTopSeller = isGuyPortal && isAactivatedTopSeller(product);
  const mixingPath = portalMixingCenterPath(product, portalPath);
  const isRockPhormLuxuryFamily = Boolean(isRockPhormPortal || isAuroraPortal);
  const luxuryBrandName = isAuroraPortal ? 'Aurora Labs' : 'Rock Phorm';
  const darkPortalSecondaryActionStyle = isRoninPortal
    ? { color: '#f8fafc', borderColor: 'rgba(226,232,240,.7)', background: 'rgba(248,250,252,.04)' }
    : isRockPhormPortal
      ? { color: '#0f172a', borderColor: 'rgba(20,184,166,.42)', background: '#ffffff' }
    : isVyigenixPortal
      ? { color: '#e0faff', borderColor: 'rgba(37,199,217,.58)', background: 'rgba(37,199,217,.06)' }
      : isAuroraPortal
        ? { color: '#075b6b', borderColor: 'rgba(20,184,166,.58)', background: 'rgba(240,253,250,.7)' }
      : isZenoraPortal
        ? { color: '#fef3c7', borderColor: 'rgba(212,175,55,.72)', background: 'rgba(212,175,55,.08)' }
        : undefined;

  if (isBeastModePortal) {
    return (
      <article className={`beastmode-product-card${inCart ? ' is-in-cart' : ''}`}>
        <div className="beastmode-product-media">
          <ProductThumbnail
            product={product}
            imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal, isBeastModePortal)}
          />
          <span className="beastmode-product-badge">{beastModeProductBadge(product)}</span>
          {inCart && <span className="beastmode-cart-pill">{qty} in cart</span>}
        </div>
        <div className="beastmode-product-body">
          <div className="beastmode-product-kicker">{beastModeCategoryLabel(product.category)}</div>
          <h3>{metadata.commonName}</h3>
          <p className="beastmode-product-strength">{metadata.doseLabel}</p>
          <p className="beastmode-product-copy">
            {product.description || 'Premium BEASTMODE research catalog item with secure checkout and quality references.'}
          </p>
          <div className="beastmode-product-trust">
            <span>{inventoryStatus.inventory_status_label}</span>
            <span>Research Catalog</span>
            <span>Secure Checkout</span>
          </div>
          <div className="beastmode-product-footer">
            <strong>{formatRetailPrice(product.displayPrice)}</strong>
            <span>{retailUnit}</span>
          </div>
          {specialPriceLabel && <p className="beastmode-price-note">{specialPriceLabel}</p>}
          <div className="beastmode-product-actions">
            {inCart ? (
              <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
            ) : (
              <button type="button" className="beastmode-add" disabled={!canAddToCart} onClick={() => onAdd(product.id)}>
                Add to Cart
              </button>
            )}
            <button type="button" className="beastmode-details" onClick={() => onLearnMore(product)}>
              View Details
            </button>
          </div>
        </div>
      </article>
    );
  }

  if (isRockPhormLuxuryFamily) {
    return (
      <article className={`rock-lux-product-card${inCart ? ' is-in-cart' : ''}`}>
        <div className="rock-lux-product-visual">
          <ProductThumbnail
            product={product}
            imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal)}
          />
          {inCart && <span className="rock-lux-cart-pill">{qty} in cart</span>}
        </div>
        <div className="rock-lux-product-copy">
          <span className="rock-lux-product-category">{isAuroraPortal ? auroraCategoryLabel(product.category) : catLabel}</span>
          <h3>{metadata.commonName}</h3>
          <p className="rock-lux-strength">{metadata.doseLabel}</p>
          <p className="rock-lux-product-note">
            {isAuroraPortal
              ? 'A curated Aurora Labs catalog item selected for refined wellness routines, transparent standards, and discreet fulfillment.'
              : product.description || 'A Rock Phorm catalog item selected for premium performance, recovery, and longevity routines.'}
          </p>
          <div className="rock-lux-detail">
            <strong>Best For</strong>
            <span>{metadata.commonName} support, guided checkout, and premium wellness planning.</span>
          </div>
          <div className="rock-lux-detail">
            <strong>Luxury Standard</strong>
            <span>{luxuryBrandName} pricing, attribution, and secure PepScriptRX checkout stay connected from cart to payment.</span>
          </div>
          <div className="rock-lux-badges">
            <span>{inventoryStatus.inventory_status_label}</span>
            <span>Secure Checkout</span>
            <span>{isAuroraPortal ? 'Aurora Attribution' : 'Rock Phorm Catalog'}</span>
          </div>
          <div className="rock-lux-card-footer">
            <strong>{formatRetailPrice(product.displayPrice)}</strong>
            <Link to={mixingPath}>Mixing Center</Link>
          </div>
          {specialPriceLabel && <div className="rock-lux-price-note">{specialPriceLabel}</div>}
          {inCart ? (
            <div className="rock-lux-actions">
              <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
              {onViewCart && (
                <button type="button" className="rock-lux-view-cart" onClick={onViewCart}>
                  View Cart
                </button>
              )}
            </div>
          ) : (
            <button className="rock-lux-add" type="button" disabled={!canAddToCart} onClick={() => onAdd(product.id)}>
              Add to Cart
            </button>
          )}
          <button type="button" className="rock-lux-learn" onClick={() => onLearnMore(product)}>
            View Details
          </button>
        </div>
      </article>
    );
  }

  if (isGintoPortal) {
    return (
      <article className={`ginto-lux-product-card${inCart ? ' is-in-cart' : ''}`}>
        <div className="ginto-lux-product-media">
          <ProductThumbnail
            product={product}
            imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal)}
          />
          <span className="ginto-lux-badge">{gintoProductBadge(product)}</span>
          {inCart && <span className="ginto-lux-cart-pill">{qty} in cart</span>}
        </div>
        <div className="ginto-lux-product-body">
          <div className="ginto-lux-product-kicker">{catLabel}</div>
          <h3>{metadata.commonName}</h3>
          <p className="ginto-lux-product-strength">{metadata.doseLabel}</p>
          <p className="ginto-lux-product-copy">
            {product.description || 'Premium wellness catalog item with secure checkout, discreet fulfillment, and GINTO attribution preserved.'}
          </p>
          <div className="ginto-lux-product-trust">
            <span>{inventoryStatus.inventory_status_label}</span>
            <span>COA Available</span>
            <span>Discreet Ship</span>
          </div>
          <div className="ginto-lux-product-footer">
            <div>
              <span>Collection Price</span>
              <strong>{formatRetailPrice(product.displayPrice)}</strong>
            </div>
            <Link to={mixingPath}>Mixing Center</Link>
          </div>
          {specialPriceLabel && <p className="ginto-lux-price-note">{specialPriceLabel}</p>}
          <div className="ginto-lux-product-actions">
            {inCart ? (
              <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
            ) : (
              <button type="button" className="ginto-lux-add" disabled={!canAddToCart} onClick={() => onAdd(product.id)}>
                Add to Cart
              </button>
            )}
            <button type="button" className="ginto-lux-details" onClick={() => onLearnMore(product)}>
              View Details
            </button>
          </div>
        </div>
      </article>
    );
  }

  if (isGuyPortal) {
    return (
      <AactivatedShowcaseCard
        product={product}
        qty={qty}
        onQtyChange={onQtyChange}
        onAdd={onAdd}
        onLearnMore={onLearnMore}
      />
    );
  }

  return (
    <article style={{
      background: isRoninPortal ? 'linear-gradient(180deg, #15171c, #08090c)' : isZenoraPortal ? 'linear-gradient(180deg,#16110a,#080705)' : isAnatoliaPortal ? 'linear-gradient(180deg,#ffffff,#fbf8ef)' : isPhysioPeptidesPortal ? 'linear-gradient(180deg,#ffffff,#f7fffc)' : isVyigenixPortal ? 'linear-gradient(180deg,#ffffff,#f8fbfc)' : '#fff', borderRadius: 14,
      border: inCart ? (isRoninPortal ? '2px solid #b91c1c' : isZenoraPortal ? '2px solid #D4AF37' : isAnatoliaPortal ? '2px solid #D4AF37' : isAgPrimePortal ? '2px solid #0068d9' : isPhysioPeptidesPortal ? '2px solid #0d9488' : isVyigenixPortal ? '2px solid #25C7D9' : '2px solid var(--teal)') : isRoninPortal ? '1.5px solid rgba(226,232,240,.16)' : isZenoraPortal ? '1.5px solid rgba(212,175,55,.28)' : isAnatoliaPortal ? '1.5px solid rgba(212,175,55,.34)' : isAgPrimePortal ? '1.5px solid rgba(0,104,217,.22)' : isPhysioPeptidesPortal ? '1.5px solid rgba(20,184,166,.24)' : isVyigenixPortal ? '1.5px solid rgba(37,199,217,.26)' : '1.5px solid var(--border)',
      boxShadow: inCart ? (isRoninPortal ? '0 8px 30px rgba(185,28,28,.24)' : isZenoraPortal ? '0 8px 30px rgba(212,175,55,.2)' : isAnatoliaPortal ? '0 10px 34px rgba(212,175,55,.20)' : isAgPrimePortal ? '0 8px 30px rgba(0,104,217,.18)' : isPhysioPeptidesPortal ? '0 10px 34px rgba(20,184,166,.18)' : isVyigenixPortal ? '0 10px 34px rgba(37,199,217,.22)' : '0 4px 24px rgba(37,199,217,.14)') : isRoninPortal ? '0 18px 42px rgba(0,0,0,.28)' : isZenoraPortal ? '0 18px 42px rgba(0,0,0,.34)' : isAnatoliaPortal ? '0 16px 38px rgba(11,31,51,.10)' : isAgPrimePortal ? '0 12px 30px rgba(15,23,42,.08)' : isPhysioPeptidesPortal ? '0 16px 38px rgba(15,118,110,.10)' : isVyigenixPortal ? '0 18px 42px rgba(15,23,42,.12)' : '0 1px 4px rgba(0,0,0,.06)',
      display: 'flex', flexDirection: 'column', transition: 'border-color .2s, box-shadow .2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {inCart && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--teal)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 10px' }}>
          {isTurkish ? `Sepette ×${qty}` : `×${qty} in cart`}
        </div>
      )}
      {showDiscount && !inCart && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#ecfdf5', color: '#15803d', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '4px 10px', border: '1px solid rgba(34,197,94,.25)' }}>
          {isAnatoliaPortal ? 'Platform Fiyatı' : isGuyPortal ? 'Guarantee Review' : 'Member Pricing'}
        </div>
      )}
      <div style={{ padding: '20px 20px 0' }}>
        <ProductThumbnail
          product={product}
          imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{catIcon}</span>
          <span title={product.category} style={{ fontSize: 11, color: isRoninPortal ? '#f87171' : isZenoraPortal ? '#D4AF37' : isAnatoliaPortal ? '#006D77' : isAgPrimePortal ? '#0068d9' : isPhysioPeptidesPortal ? '#047857' : isVyigenixPortal ? '#0891b2' : '#0f766e', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{catLabel}</span>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: isRoninPortal || isZenoraPortal ? '#f8fafc' : 'var(--navy)', margin: '0 0 4px', lineHeight: 1.2 }}>{product.product_name}</h3>
        <div style={{ fontSize: 13, color: isRoninPortal ? '#cbd5e1' : isZenoraPortal ? '#fde68a' : '#475569', fontWeight: 700, marginBottom: 10 }}>{product.strength}</div>
        <div style={{ fontSize: 12, color: isRoninPortal ? '#cbd5e1' : isZenoraPortal ? '#fef3c7' : '#475569', fontWeight: 700, margin: '-4px 0 10px' }}>{isTurkish ? 'Teknik ad' : 'Technical'}: {metadata.technicalName}</div>
        {!isAuroraPortal && (
          <p style={{ fontSize: 12, color: isRoninPortal ? '#b6c0ce' : isZenoraPortal ? '#e7d7af' : '#334155', fontWeight: 500, lineHeight: 1.55, margin: '0 0 12px' }}>
            {product.description}
          </p>
        )}

        {product.badges && product.badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {product.badges.map((badge) => {
              const style = BADGE_COLORS[badge] ?? { bg: 'var(--surface-2)', color: 'var(--navy)' };
              return (
                <span key={badge} style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', padding: '3px 10px', borderRadius: 20, background: style.bg, color: style.color }}>
                  {badge}
                </span>
              );
            })}
          </div>
        )}
        {isTopSeller && (
          <div style={{ fontSize: 11, color: '#155e75', fontWeight: 900, background: '#cffafe', border: '1px solid rgba(8,145,178,.24)', borderRadius: 8, padding: '7px 9px', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            AACTIVATEDRX top seller
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span className={`badge ${inventoryBadgeClass(inventoryStatus.inventory_status)}`}>
            {inventoryStatus.inventory_status_label}
          </span>
          {inventoryStatus.supporting_copy && (
            <span style={{ fontSize: 12, color: isRoninPortal ? '#cbd5e1' : isZenoraPortal ? '#fef3c7' : '#475569', fontWeight: 800 }}>
              {inventoryStatus.supporting_copy}
            </span>
          )}
          {isPhysioPeptidesPortal && inventoryStatus.was_special_order && (
            <span style={{ fontSize: 12, color: '#075985', fontWeight: 800 }}>
              {PHYSIOPEPTIDES_SPECIAL_ORDER_NOTICE}
            </span>
          )}
        </div>

        <div style={{ marginBottom: specialPriceLabel ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: isRoninPortal || isZenoraPortal ? '#f8fafc' : '#102033' }}>{formatRetailPrice(product.displayPrice)}</span>
            {canAddToCart && <span style={{ fontSize: 13, fontWeight: 800, color: isRoninPortal ? '#94a3b8' : isZenoraPortal ? '#fef3c7' : '#475569' }}>{isTurkish ? 'perakende fiyat' : 'retail price'} / {retailUnit}</span>}
          </div>
        </div>
        {specialPriceLabel && (
          <div style={{ fontSize: 12, color: '#0f5132', fontWeight: 800, background: '#ecfdf5', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            {specialPriceLabel}
          </div>
        )}
        {isGuyPortal && (
          <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, background: '#ecfeff', border: '1px solid rgba(37,199,217,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            Partner catalog item. Account credit: VITALITYINS.
          </div>
        )}
        {showDiscount && !isAnatoliaPortal && (
          <div style={{ fontSize: 12, color: isRoninPortal ? '#fecaca' : isZenoraPortal ? '#fef3c7' : isAgPrimePortal ? '#0756a4' : isPhysioPeptidesPortal ? '#075985' : isVyigenixPortal ? '#075985' : '#0f766e', fontWeight: 800, background: isRoninPortal ? 'rgba(127,29,29,.22)' : isZenoraPortal ? 'rgba(212,175,55,.12)' : isAgPrimePortal ? '#eff6ff' : isPhysioPeptidesPortal ? '#eff6ff' : isVyigenixPortal ? '#ecfeff' : '#f0fdfa', border: `1px solid ${isRoninPortal ? 'rgba(248,113,113,.24)' : isZenoraPortal ? 'rgba(212,175,55,.28)' : isAgPrimePortal ? 'rgba(0,104,217,.2)' : isPhysioPeptidesPortal ? 'rgba(14,165,233,.22)' : isVyigenixPortal ? 'rgba(37,199,217,.28)' : 'rgba(20,184,166,.25)'}`, borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            Retail pricing shown.
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        {inCart ? (
          <>
            <Stepper value={qty} label={product.product_name} onChange={(v) => onQtyChange(product.id, v)} />
            {isRockPhormPortal && onViewCart && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onViewCart}
                style={{ flex: '1 1 140px', justifyContent: 'center' }}
              >
                View Cart
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!canAddToCart}
            onClick={() => onAdd(product.id)}
          >
            + {t(isTurkish ? 'tr' : 'en', 'Add to Cart')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ flex: inCart ? 1 : '0 0 100%', justifyContent: 'center', ...darkPortalSecondaryActionStyle }}
          onClick={() => onLearnMore(product)}
        >
          {t(isTurkish ? 'tr' : 'en', 'Learn more')}
        </button>
        {!isAuroraPortal && (
          <Link
            to={mixingPath}
            className="btn btn-outline btn-sm"
            style={{ flex: '0 0 100%', justifyContent: 'center', whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2, ...darkPortalSecondaryActionStyle }}
          >
            {isTurkish ? 'Karışım desteği için Karışım Merkezini kullanın' : 'Need help mixing? Use Mixing Center'}
          </Link>
        )}
      </div>
    </article>
  );
}

function portalCategoryButtonStyle(active: boolean, isRoninPortal: boolean, isVyigenixPortal: boolean, isZenoraPortal = false, isRockPhormPortal = false, isGintoPortal = false, isBeastModePortal = false) {
  if (isBeastModePortal) {
    return {
      borderRadius: 8,
      color: active ? '#ffffff' : '#d4d4d8',
      borderColor: active ? '#C1121F' : 'rgba(193,18,31,.38)',
      background: active ? 'linear-gradient(135deg,#C1121F,#7f1119)' : 'rgba(193,18,31,.08)',
      boxShadow: active ? '0 12px 26px rgba(193,18,31,.22)' : 'none',
    };
  }
  if (isGintoPortal) {
    return {
      borderRadius: 999,
      color: active ? '#050505' : '#f3e2bd',
      borderColor: active ? '#C8A96A' : 'rgba(200,169,106,.48)',
      background: active ? 'linear-gradient(135deg,#F3DFA1,#C8A96A)' : 'rgba(200,169,106,.06)',
      boxShadow: active ? '0 12px 26px rgba(200,169,106,.20)' : 'none',
    };
  }
  if (isRockPhormPortal) {
    return {
      borderRadius: 20,
      color: active ? '#031321' : '#0f172a',
      borderColor: active ? 'rgba(103,232,249,.68)' : 'rgba(20,184,166,.42)',
      background: active ? '#67e8f9' : '#ffffff',
    };
  }
  if (active) return { borderRadius: 20 };
  if (isRoninPortal) {
    return {
      borderRadius: 20,
      color: '#f8fafc',
      borderColor: 'rgba(226,232,240,.68)',
      background: 'rgba(248,250,252,.05)',
    };
  }
  if (isVyigenixPortal) {
    return {
      borderRadius: 20,
      color: '#e0faff',
      borderColor: 'rgba(37,199,217,.58)',
      background: 'rgba(37,199,217,.06)',
    };
  }
  if (isZenoraPortal) {
    return {
      borderRadius: 20,
      color: '#fef3c7',
      borderColor: 'rgba(212,175,55,.62)',
      background: 'rgba(212,175,55,.08)',
    };
  }
  return { borderRadius: 20 };
}

function ProductDetailModal({
  product,
  onClose,
  onAdd,
  isMarkPortal,
  isGuyPortal,
  isRobertPortal,
  isScottPortal,
  isAlphaPortal,
  isOptimaxPortal,
  isRoninPortal,
  isAgPrimePortal,
  isVyigenixPortal,
  isRockPhormPortal,
  isZenoraPortal,
  isAuroraPortal,
  isPhysioPeptidesPortal,
  isGintoPortal,
  isAnatoliaPortal,
  isBeastModePortal,
  portalPath,
}: {
  product: DistributorCatalogProduct | null;
  onClose: () => void;
  onAdd: (id: string) => void;
  isMarkPortal: boolean;
  isGuyPortal: boolean;
  isRobertPortal: boolean;
  isScottPortal: boolean;
  isAlphaPortal: boolean;
  isOptimaxPortal: boolean;
  isRoninPortal: boolean;
  isAgPrimePortal: boolean;
  isVyigenixPortal: boolean;
  isRockPhormPortal: boolean;
  isZenoraPortal: boolean;
  isAuroraPortal?: boolean;
  isPhysioPeptidesPortal?: boolean;
  isGintoPortal?: boolean;
  isAnatoliaPortal?: boolean;
  isBeastModePortal?: boolean;
  portalPath?: string | null;
}) {
  if (!product) return null;
  const details = CATEGORY_DETAILS[product.category] ?? {
    focus: product.description,
    faq: 'Availability, eligibility, and fulfillment are confirmed after clinical review.',
  };
  const isTurkish = Boolean(isAnatoliaPortal);
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal, isAlphaPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal, isBeastModePortal);
  const retailUnit = retailUnitLabel(product);
  const mixingPath = portalMixingCenterPath(product, portalPath);
  const metadata = getProductMetadata(product);
  const bundleName = product.scopedBundleGroupName;
  const bundleNote = product.scopedBundleNote;
  const pricing = isGuyPortal ? aactivatedPriceDiscount(product) : null;
  const inventoryStatus = inventoryStatusForProduct(product);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(7,20,34,.55)', zIndex: 1200 }} />
      <div role="dialog" aria-modal="true" aria-label={`${product.product_name} details`} style={{ position: 'fixed', inset: '7vh 16px auto', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', margin: '0 auto', background: '#fff', borderRadius: 14, zIndex: 1201, boxShadow: '0 24px 70px rgba(0,0,0,.28)', border: '1px solid var(--border)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 86, flexShrink: 0 }}>
            <ProductThumbnail
              product={product}
              imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal, isBeastModePortal)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{isAuroraPortal ? auroraCategoryLabel(product.category) : product.category}</div>
            <h2 style={{ margin: '4px 0', color: 'var(--navy)', fontSize: 24, lineHeight: 1.15 }}>{metadata.commonName}</h2>
            <div style={{ color: '#334155', fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
              {isTurkish ? 'Teknik ad' : 'Technical'}: {metadata.technicalName}
            </div>
            <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>
              {product.strength} · {pricing?.hasDiscount
                ? `${isTurkish ? 'Perakende' : 'Retail'} ${formatRetailPrice(pricing.retail)} / ${isTurkish ? 'İndirim' : 'Discount'} ${formatRetailPrice(pricing.sale)}`
                : `${isTurkish ? 'Perakende fiyat' : 'Retail price'} ${formatRetailPrice(product.displayPrice)}`}{typeof product.displayPrice === 'number' ? ` / ${retailUnit}` : ''}
            </div>
            <div style={{ color: '#334155', fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {isTurkish ? 'Doz' : 'Dose'}: {metadata.doseLabel}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <span className={`badge ${inventoryBadgeClass(inventoryStatus.inventory_status)}`}>
                {inventoryStatus.inventory_status_label}
              </span>
              {inventoryStatus.supporting_copy && (
                <span style={{ color: '#0e7490', fontSize: 12, fontWeight: 800 }}>
                  {inventoryStatus.supporting_copy}
                </span>
              )}
              {isPhysioPeptidesPortal && inventoryStatus.was_special_order && (
                <span style={{ color: '#075985', fontSize: 12, fontWeight: 800 }}>
                  {PHYSIOPEPTIDES_SPECIAL_ORDER_NOTICE}
                </span>
              )}
            </div>
            {specialPriceLabel && (
              <div style={{ color: '#0f5132', fontSize: 12, fontWeight: 800, marginTop: 6 }}>
                {specialPriceLabel}
              </div>
            )}
            {isGuyPortal && bundleName && (
              <div style={{ color: '#047857', fontSize: 12, fontWeight: 900, marginTop: 6 }}>
                Bundle: {bundleName}. {bundleDiscountLabel(product)}.
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close details" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          {isGuyPortal ? (
            <AACTIVATEDRXVerificationBadge placement="detail" productName={`${product.product_name} ${product.strength}`} />
          ) : (
            <ProductPurityGuaranteeBadge compact variant="pepscriptrx" />
          )}
          <div>
            <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>{t(isTurkish ? 'tr' : 'en', 'Overview')}</div>
            <p style={{ margin: 0, color: '#1f2937', fontWeight: 500, lineHeight: 1.7 }}>
              {isAnatoliaPortal ? 'Anatolia Wellness Labs katalog ürünü. Uygunluk, stok ve teslimat standart PepScriptRX incelemesine tabidir.' : isPhysioPeptidesPortal ? 'A premium clinical recovery and wellness catalog item selected for PhysioPeptides ordering.' : isAuroraPortal ? 'A premium Aurora Labs catalog item selected for a clean, elevated wellness experience.' : details.focus}
            </p>
          </div>
          {!isAuroraPortal && <div>
            <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>{t(isTurkish ? 'tr' : 'en', 'Review notes')}</div>
            <p style={{ margin: 0, color: '#1f2937', fontWeight: 500, lineHeight: 1.7 }}>
              {isAnatoliaPortal ? 'Siparişler ana PepScriptRX katalog, fiyatlandırma, sertifika ve ödeme kurallarını kullanır.' : details.faq}
            </p>
          </div>}
          {isGuyPortal && (bundleName || bundleNote) && (
            <div style={{ background: '#ecfdf5', border: '1px solid rgba(34,197,94,.22)', borderRadius: 10, padding: 14, color: '#065f46', fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
              {bundleName && <div style={{ fontWeight: 900 }}>Bundle: {bundleName}</div>}
              <div>{bundleDiscountLabel(product)} when paired with another product from this bundle.</div>
              {bundleNote && <div style={{ marginTop: 4 }}>{bundleNote}</div>}
            </div>
          )}
          <div style={{ background: '#f8fbfc', border: '1px solid var(--border)', borderRadius: 10, padding: 14, color: '#334155', fontSize: 13, fontWeight: 500, lineHeight: 1.7 }}>
            {isPhysioPeptidesPortal
              ? 'PhysioPeptides provides a clinical recovery and performance storefront experience with quality-focused product information and secure fulfillment support.'
              : isAuroraPortal
              ? 'Aurora Labs provides a premium wellness storefront experience with transparent quality standards and discreet fulfillment.'
              : isAnatoliaPortal
              ? 'Bu sayfa tıbbi tavsiye, tanı, dozlama veya kullanım talimatı sunmaz. Her zaman lisanslı sağlık uzmanınızın veya eczanenizin yazılı talimatlarını izleyin.'
              : 'Side effects, suitability, dosing, and instructions vary by individual and must be reviewed with a licensed healthcare professional. This portal does not provide medical advice.'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!inventoryStatus.checkout_allowed} onClick={() => { onAdd(product.id); onClose(); }}>{t(isTurkish ? 'tr' : 'en', 'Add to Cart')}</button>
            {!isAuroraPortal && (
              <Link className="btn btn-outline" to={mixingPath} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2 }}>{isTurkish ? 'Karışım Merkezi' : 'Mixing Center'}</Link>
            )}
            <button className="btn btn-outline" onClick={onClose}>{t(isTurkish ? 'tr' : 'en', 'Continue browsing')}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RxPlusDistributorPortal() {
  const { distributorSlug = 'guy', productSlug } = useParams<{ distributorSlug?: string; productSlug?: string }>();
  const { pathname, search: locationSearch } = useLocation();
  const navigate = useNavigate();
  const aactivatedSearchInputRef = useRef<HTMLInputElement | null>(null);
  const aactivatedCatalogSectionRef = useRef<HTMLElement | null>(null);
  const catalogMenuRef = useRef<HTMLDivElement | null>(null);
  const skipNextCartPersistRef = useRef(false);
  const openedProductRouteRef = useRef('');

  const normalizedPathname = safeDecodePath(pathname).toLowerCase();
  const auroraRouteRepCode = AURORA_ROUTE_REP_CODES[normalizedPathname] ?? '';
  const isAuroraRepRoute = Boolean(auroraRouteRepCode);

  const resolvedSlug = normalizedPathname === '/empirehealth&wellness'
    ? 'mark'
    : normalizedPathname === '/ehwsub'
      ? 'ehwsub'
      : normalizedPathname === '/warxlabz'
        ? 'robert'
        : normalizedPathname === '/aactivated' || normalizedPathname.startsWith('/aactivated/') || normalizedPathname === '/guy'
          ? 'guy'
          : normalizedPathname === '/peakform'
            ? 'scott'
            : normalizedPathname === '/alphapride'
              ? 'alpha'
              : normalizedPathname === '/optimax-peptide-therapy'
                ? 'optimax'
                : normalizedPathname === '/ronin'
                  ? 'ronin'
                  : normalizedPathname === '/agprimelab'
                    ? 'agprime'
                    : normalizedPathname === '/vyigenix'
                      ? 'vyigenix'
                      : normalizedPathname === '/rockphorm' || normalizedPathname.startsWith('/rockphorm/')
                        ? 'rockphorm'
                        : ['/aurora', '/auroralabs'].includes(normalizedPathname) || isAuroraRepRoute
                           ? 'aurora'
                           : normalizedPathname === '/zenora'
                             ? 'zenora'
                            : normalizedPathname === '/physiopeptides'
                              ? PHYSIOPEPTIDES_STORE_SLUG
                              : ['/ginto', '/ginto-wellness-labs'].includes(normalizedPathname)
                                 ? 'ginto'
                                 : ['/beastmode', '/beastmode-performance-labs'].includes(normalizedPathname)
                                   ? 'beastmode'
                                 : ['/anatolia', '/turkiye', '/anatoliawellness', '/anatolia-wellness-labs'].includes(normalizedPathname)
                                   ? anatoliaStorefront.slug
                              : distributorSlug;

  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === resolvedSlug);
  const baseProducts = useMemo(() => getDistributorProducts(resolvedSlug), [resolvedSlug]);
  const isMarkPortal   = resolvedSlug === 'mark';
  const isEhwSubPortal  = resolvedSlug === 'ehwsub';
  const isEmpirePortal = isMarkPortal;
  const isGuyPortal    = resolvedSlug === 'guy';
  const usesAactivatedPricing = isGuyPortal || isEhwSubPortal;
  const isRobertPortal = resolvedSlug === 'robert';
  const isScottPortal  = resolvedSlug === 'scott';
  const isAlphaPortal  = resolvedSlug === 'alpha';
  const isOptimaxPortal = resolvedSlug === 'optimax';
  const isRoninPortal = resolvedSlug === 'ronin';
  const isAgPrimePortal = resolvedSlug === 'agprime';
  const isVyigenixPortal = resolvedSlug === 'vyigenix';
  const isRockPhormPortal = resolvedSlug === 'rockphorm';
  const isAuroraPortal = resolvedSlug === 'aurora';
  const isRockPhormLuxuryFamily = isRockPhormPortal || isAuroraPortal;
  const isZenoraPortal = resolvedSlug === 'zenora';
  const isPhysioPeptidesPortal = resolvedSlug === PHYSIOPEPTIDES_STORE_SLUG;
  const isGintoPortal = resolvedSlug === 'ginto';
  const isAnatoliaPortal = resolvedSlug === anatoliaStorefront.slug;
  const isBeastModePortal = resolvedSlug === 'beastmode';
  const portalConfig = getWhiteLabelPortal(resolvedSlug);
  const aactivatedRepParam = useMemo(() => {
    if (!isGuyPortal) return '';
    const value = new URLSearchParams(locationSearch).get('rep') ?? '';
    return value.trim().toUpperCase();
  }, [isGuyPortal, locationSearch]);
  const aactivatedAdminParam = useMemo(() => {
    if (!isGuyPortal) return '';
    const value = new URLSearchParams(locationSearch).get('admin') ?? '';
    return value.trim().toUpperCase();
  }, [isGuyPortal, locationSearch]);
  const aactivatedAttributionCode = aactivatedRepParam || aactivatedAdminParam;
  const aactivatedProductRouteSlug = isGuyPortal ? normalizeProductRouteSlug(productSlug) : '';
  const auroraRepParam = useMemo(() => {
    if (auroraRouteRepCode) return auroraRouteRepCode;
    if (!isAuroraPortal) return '';
    const value = new URLSearchParams(locationSearch).get('rep') ?? '';
    return normalizeAactivatedDiscountCode(value);
  }, [auroraRouteRepCode, isAuroraPortal, locationSearch]);
  const auroraAttributionCode = auroraRepParam || 'AURORA';
  const requestedCategoryParam = useMemo(() => {
    const value = new URLSearchParams(locationSearch).get('category') ?? '';
    return value.trim();
  }, [locationSearch]);

  usePageMeta(
    isEmpirePortal  ? 'Empire Health & Wellness — Peptide Therapy'
    : isEhwSubPortal ? 'Ellie'
    : isGuyPortal   ? 'AACTIVATED-RX — Optimize. Recover. Perform.'
    : isScottPortal ? 'Peak Form Peptides | Premium Research Peptides'
    : isAlphaPortal ? 'Alpha Pride Wellness | Elite Peptide Wellness'
    : isOptimaxPortal ? 'Optimax Peptide Therapy | Premium Peptide Therapy'
    : isRoninPortal ? 'Ronin | Premium Wellness Catalog'
    : isAgPrimePortal ? 'AG Prime Lab | Performance Wellness Catalog'
    : isVyigenixPortal ? 'Vyigenix Pharmaceuticals | Premium Clinical Wellness Catalog'
    : isRockPhormPortal ? 'Rock Phorm | Optimize Your Biology'
    : isAuroraPortal ? 'Aurora Labs | Refined Wellness'
    : isZenoraPortal ? 'ZENORA | Precision Wellness & Peptide Therapy'
    : isPhysioPeptidesPortal ? 'PhysioPeptides | Clinical Recovery & Performance'
    : isGintoPortal ? 'Ginto Wellness Labs | Private Wellness Access'
    : isBeastModePortal ? 'BEASTMODE Performance Labs | WE NOT THE SAME.'
    : isAnatoliaPortal ? 'Anatolia Wellness Labs | Premium Peptit ve Wellness Ürünleri'
    : (distributor ? distributor.portal_name : 'Advanced Wellness'),
    isEmpirePortal
      ? 'Pharmaceutical-grade peptide treatments for weight loss, recovery, hormone support, and longevity. Compounded to order and shipped directly to you after clinical review.'
      : isAnatoliaPortal
        ? 'Anatolia Wellness Labs, PepScriptRX altyapısıyla desteklenen Türkçe premium wellness ve peptit ürünleri platformudur.'
      : isGuyPortal
        ? 'Shop curated wellness options for weight management, performance, recovery, longevity, and cognitive support.'
        : isScottPortal
          ? 'Premium peptide research compounds and wellness solutions from Peak Form Peptides.'
          : isAlphaPortal
            ? 'Premium black-and-gold wellness catalog for Alpha Pride Wellness.'
            : isOptimaxPortal
              ? 'Premium peptide therapy solutions powered by Optimax Peptide Therapy and PepScriptRX.'
              : isRoninPortal
                ? 'Ronin premium wellness catalog with secure checkout and PepScriptRX-powered verification.'
              : isAgPrimePortal
                ? 'AG Prime Lab performance, recovery, and wellness catalog powered by PepScriptRX.'
                : isVyigenixPortal
                  ? 'Vyigenix Pharmaceuticals premium clinical wellness catalog powered under Empire Health & Wellness and PepScriptRX.'
                  : isRockPhormPortal
                    ? 'Rock Phorm premium GLP-1, recovery, performance, and longevity catalog powered by PepScriptRX.'
                    : isAuroraPortal
                       ? 'Aurora Labs premium wellness storefront with secure ordering, transparent quality standards, and discreet fulfillment.'
                       : isZenoraPortal
                         ? 'ZENORA luxury wellness and peptide therapy catalog under Empire Health & Wellness with secure PepScriptRX checkout.'
                          : isPhysioPeptidesPortal
                            ? 'PhysioPeptides premium clinical recovery, wellness, and performance catalog with secure ordering and quality-focused product information.'
                            : isGintoPortal
                              ? 'Ginto Wellness Labs private wellness access through the PepScriptRX peptide platform.'
                              : isBeastModePortal
                                ? 'BEASTMODE Performance Labs premium research storefront powered by the PepScriptRX catalog and secure checkout.'
                          : 'Advanced wellness catalog.',
  );

  const [category, setCategory] = useState<'All' | RxPlusCategory>(() => {
    return (requestedCategoryParam || 'All') as 'All' | RxPlusCategory;
  });
  const [aactivatedStorePrices, setAactivatedStorePrices] = useState<AactivatedStorePriceRow[]>([]);
  const [rockPhormProducts, setRockPhormProducts] = useState<RockPhormManagedProduct[] | null>(null);
  const [inventoryStatusRows, setInventoryStatusRows] = useState<PublicInventoryStatusRow[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('featured');
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [cart, setCart] = useState<CartMap>(() => readPortalCartState(resolvedSlug));
  const [cartOpen, setCartOpen] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showFullCatalog, setShowFullCatalog] = useState(() => isGuyPortal && Boolean(requestedCategoryParam));
  const [activePromo, setActivePromo] = useState<AactivatedPromoLink | null>(null);
  const [manualPromo, setManualPromo] = useState<AactivatedPromoLink | null>(null);
  const [aactivatedRepStore, setAactivatedRepStore] = useState<AactivatedPublicRepStore | null>(null);
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountCodeMessage, setDiscountCodeMessage] = useState('');
  const [discountCodeApplying, setDiscountCodeApplying] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [calcDose, setCalcDose] = useState(0.25);
  const [calcDoseUnit, setCalcDoseUnit] = useState<'mg' | 'mcg'>('mg');
  const [calcMg, setCalcMg] = useState(10);
  const [calcMl, setCalcMl] = useState(2);

  const products = useMemo(() => {
    const statusByProductId = new Map<string, PublicInventoryStatusRow>();
    inventoryStatusRows.forEach((row) => {
      const existing = statusByProductId.get(row.product_id);
      if (!existing || row.catalog_source === 'rx_plus_products') {
        statusByProductId.set(row.product_id, row);
      }
    });
    const withInventoryStatus = (product: DistributorCatalogProduct): DistributorCatalogProduct => ({
      ...product,
      inventoryStatus: mapInventoryStatusRow(statusByProductId.get(product.id)),
      inventoryStatusSource: statusByProductId.has(product.id) ? 'main' : 'fallback',
    });
    const onlyCustomerVisible = (product: DistributorCatalogProduct): boolean => (
      product.inventoryStatus?.inventory_status !== 'hidden'
    );

    if (isRockPhormPortal || isAuroraPortal) {
      return collapseRockPhormDuplicateProducts(
        (rockPhormProducts ?? baseProducts)
          .filter((product) => product.distributorProduct.is_enabled)
          .map(normalizeRockPhormProduct)
          .map(normalizeCatalogProduct),
      ).map(withInventoryStatus).filter(onlyCustomerVisible);
    }
    if (!usesAactivatedPricing || aactivatedStorePrices.length === 0) {
      return baseProducts.map(normalizeCatalogProduct).map(withInventoryStatus).filter(onlyCustomerVisible);
    }
    const byProductId = new Map(aactivatedStorePrices.map((row) => [row.product_id, row]));
    const repProductOrder = new Map((isGuyPortal ? aactivatedRepStore?.product_ids ?? [] : []).map((id, index) => [id, index]));
    return baseProducts
      .map((product) => {
        const override = byProductId.get(product.id);
        if (!override) return product;
        const displayPrice = override.sale_price ?? override.retail_price;
        return {
          ...product,
          distributorProduct: {
            ...product.distributorProduct,
            is_enabled: override.is_active,
            custom_price: displayPrice,
            featured: override.featured,
            updated_at: new Date().toISOString(),
          },
          displayPrice,
          scopedSortOrder: override.sort_order,
          scopedRetailPrice: override.retail_price,
          scopedSalePrice: override.sale_price,
          scopedProductNote: override.product_note,
          scopedBundleGroupKey: override.bundle_group_key,
          scopedBundleGroupName: override.bundle_group_name,
          scopedBundleDiscountPercent: override.bundle_discount_percent,
          scopedBundleDiscountAmount: override.bundle_discount_amount,
          scopedBundleNote: override.bundle_note,
        };
      })
      .filter((product) => product.distributorProduct.is_enabled)
      .map(normalizeCatalogProduct)
      .map(withInventoryStatus)
      .filter(onlyCustomerVisible)
      .sort((a, b) => {
        const aRepOrder = repProductOrder.get(a.id);
        const bRepOrder = repProductOrder.get(b.id);
        if (aRepOrder != null || bRepOrder != null) return Number(aRepOrder ?? 9999) - Number(bRepOrder ?? 9999);
        return Number((a as DistributorCatalogProduct & { scopedSortOrder?: number | null }).scopedSortOrder ?? 9999) - Number((b as DistributorCatalogProduct & { scopedSortOrder?: number | null }).scopedSortOrder ?? 9999);
      });
  }, [aactivatedRepStore?.product_ids, aactivatedStorePrices, baseProducts, inventoryStatusRows, isAuroraPortal, isGuyPortal, isRockPhormPortal, rockPhormProducts, usesAactivatedPricing]);

  useEffect(() => {
    if (!isGuyPortal || !aactivatedProductRouteSlug || products.length === 0) return;
    const routeProduct = findProductByRouteSlug(products, aactivatedProductRouteSlug);
    if (!routeProduct) return;
    if (openedProductRouteRef.current === aactivatedProductRouteSlug) return;
    openedProductRouteRef.current = aactivatedProductRouteSlug;
    setDetailProduct(routeProduct);
    setShowFullCatalog(true);
    setCategory('All');
    setSearch('');
    setCatalogOpen(false);
  }, [aactivatedProductRouteSlug, isGuyPortal, products]);

  const closeDetailProduct = useCallback(() => {
    setDetailProduct(null);
    if (isGuyPortal && aactivatedProductRouteSlug) {
      navigate(`${GUY_PORTAL_PATH}${locationSearch}`, { replace: true });
      openedProductRouteRef.current = '';
    }
  }, [aactivatedProductRouteSlug, isGuyPortal, locationSearch, navigate]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const promoSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('promo') : null;
  const appliedPromo = manualPromo ?? activePromo;
  const appliedPromoDiscount = useMemo(() => promoDiscountForCart(appliedPromo, cart, products), [appliedPromo, cart, products]);
  const supportsDiscountCode = isGuyPortal || isAlphaPortal;
  const aactivatedRepDisplayName = aactivatedRepStore?.public_display_name || aactivatedRepStore?.rep_name || aactivatedAttributionCode;
  const aactivatedRepDiscountCode = normalizeAactivatedDiscountCode(
    String(aactivatedRepStore?.discount_code || aactivatedRepStore?.promo_config?.discount_code || aactivatedAttributionCode || ''),
  );

  useEffect(() => {
    if (!isGuyPortal || !requestedCategoryParam) return;
    setCategory(requestedCategoryParam as RxPlusCategory);
    setShowFullCatalog(true);
    setCatalogOpen(false);
  }, [isGuyPortal, requestedCategoryParam]);

  useEffect(() => {
    if (!usesAactivatedPricing || !supabase) return;
    let cancelled = false;
    supabase
      .from('aactivated_store_product_prices')
      .select('product_id, retail_price, sale_price, is_active, featured, sort_order, product_note, bundle_group_key, bundle_group_name, bundle_discount_percent, bundle_discount_amount, bundle_note')
      .eq('store_slug', 'aactivated')
      .then(({ data }) => {
        if (!cancelled) setAactivatedStorePrices((data as AactivatedStorePriceRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [usesAactivatedPricing]);

  useEffect(() => {
    if (!isGuyPortal || !aactivatedAttributionCode || !supabase) {
      setAactivatedRepStore(null);
      return;
    }
    const lookupCode = normalizeAactivatedDiscountCode(aactivatedAttributionCode);
    if (!lookupCode) {
      setAactivatedRepStore(null);
      return;
    }

    let cancelled = false;
    supabase
      .from('aactivated_public_rep_stores')
      .select('id,rep_id,rep_slug,rep_name,public_display_name,store_slug,storefront_path,product_list_id,product_list_name,product_ids,pricing_mode,features,promo_config,status,discount_code,referral_path')
      .or(`rep_slug.eq.${lookupCode},store_slug.ilike.${lookupCode}`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAactivatedRepStore((data as AactivatedPublicRepStore | null) ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [aactivatedAttributionCode, isGuyPortal]);

  useEffect(() => {
    if (!isGuyPortal || promoSlug || manualPromo || !supabase || !aactivatedRepDiscountCode) return;

    let cancelled = false;
    setDiscountCodeInput(aactivatedRepDiscountCode);
    supabase
      .from('aactivated_promo_links')
      .select('promo_title,discount_code,discount_amount,discount_type,discount_percent,promo_kind,expires_at,usage_limit,uses_count,rep_slug,product_id,store_scope_code,link_slug')
      .eq('discount_code', aactivatedRepDiscountCode)
      .eq('promo_kind', 'customer_discount')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const promo = data as AactivatedPromoLink;
          setActivePromo(promo);
          setDiscountCodeMessage(`Rep store code loaded: ${promoDiscountLabel(promo)} will apply when eligible.`);
        } else {
          setDiscountCodeMessage(`Rep attribution ${aactivatedRepDiscountCode} is active. Add a customer discount code if one was provided.`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [aactivatedRepDiscountCode, isGuyPortal, manualPromo, promoSlug]);

  useEffect(() => {
    if (!supabase) return;
    const sourceProducts = isRockPhormPortal || isAuroraPortal
      ? (rockPhormProducts ?? baseProducts)
      : baseProducts;
    const productIds = Array.from(new Set(sourceProducts.map((product) => product.id).filter(Boolean)));
    if (productIds.length === 0) {
      setInventoryStatusRows([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('public_inventory_status')
      .select('catalog_source, product_id, sku, quantity_on_hand, low_stock_threshold, stock_status, allow_special_order, estimated_fulfillment_days, active, sellable, customer_visible, display_stock_status, display_stock_label, checkout_allowed, was_special_order, status_message')
      .in('product_id', productIds)
      .then(({ data }) => {
        if (!cancelled) setInventoryStatusRows((data as PublicInventoryStatusRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [baseProducts, isAuroraPortal, isRockPhormPortal, rockPhormProducts]);

  useEffect(() => {
    if (!isRockPhormPortal && !isAuroraPortal) {
      setRockPhormProducts(null);
      return;
    }
    if (!supabase) return;

    let cancelled = false;
    supabase
      .from('distributor_products')
      .select(ROCKPHORM_PRODUCT_SELECT)
      .eq('distributor.slug', 'rockphorm')
      .order('featured', { ascending: false })
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const nextProducts = ((data as unknown as RockPhormProductRow[]) ?? [])
          .map(mapRockPhormProductRow)
          .filter((product): product is RockPhormManagedProduct => Boolean(product));
        setRockPhormProducts(nextProducts);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuroraPortal, isRockPhormPortal]);

  useEffect(() => {
    if (!isGuyPortal || !promoSlug) return;
    if (!supabase) {
      setPromoError('This promo link is not active or could not be verified.');
      setActivePromo(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('aactivated_promo_links')
      .select('promo_title,discount_code,discount_amount,discount_type,discount_percent,promo_kind,expires_at,usage_limit,uses_count,rep_slug,product_id,store_scope_code,link_slug')
      .eq('link_slug', promoSlug)
      .eq('promo_kind', 'customer_discount')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPromoError('This promo link is not active or could not be verified.');
          setActivePromo(null);
          return;
        }
        const promo = data as AactivatedPromoLink;
        setActivePromo(promo);
        setDiscountCodeInput('');
        setDiscountCodeMessage(`Promo link loaded: ${promoDiscountLabel(promo)} will apply when eligible.`);
        if (promo.product_id) {
          const product = products.find((item) => item.id === promo.product_id);
          if (product) {
            setCategory(product.category);
            setSearch(product.product_name);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isGuyPortal, products, promoSlug]);

  useEffect(() => {
    skipNextCartPersistRef.current = true;
    setCart(readPortalCartState(resolvedSlug));
  }, [resolvedSlug]);

  useEffect(() => {
    if (skipNextCartPersistRef.current) {
      skipNextCartPersistRef.current = false;
      return;
    }
    writePortalCartState(resolvedSlug, cart);
  }, [cart, resolvedSlug]);

  useEffect(() => {
    if (!catalogOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCatalogOpen(false);
    };
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && catalogMenuRef.current?.contains(target)) return;
      setCatalogOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [catalogOpen]);

  useEffect(() => {
    if (!isGuyPortal) return;

    const handlePortalHomeClick = (event: MouseEvent) => {
      const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a.pub-nav-brand, a[href="/AACTIVATED"], a[href="/aactivated"], a[href="/guy"]')
        : null;
      if (!link) return;
      setSearch('');
      setCategory('All');
      setSort('featured');
      setShowFullCatalog(false);
      setCatalogOpen(false);
      const scrollHome = () => {
        const scrollRoot = document.scrollingElement ?? document.documentElement;
        scrollRoot.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      };
      scrollHome();
      window.requestAnimationFrame(scrollHome);
      window.setTimeout(scrollHome, 80);
      window.setTimeout(scrollHome, 240);
      window.setTimeout(scrollHome, 500);
    };

    document.addEventListener('click', handlePortalHomeClick, true);
    return () => document.removeEventListener('click', handlePortalHomeClick, true);
  }, [isGuyPortal]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchCat = category === 'All' || p.category === category;
      const matchQ = !q || [p.product_name, p.strength, p.category, productMetaSearchText(p), ...(p.badges ?? [])].some((v) => v.toLowerCase().includes(q));
      return matchCat && matchQ;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc') return (a.displayPrice ?? Number.MAX_SAFE_INTEGER) - (b.displayPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price-desc') return (b.displayPrice ?? 0) - (a.displayPrice ?? 0);
      if (sort === 'alpha') return a.product_name.localeCompare(b.product_name);
      if (a.distributorProduct.featured !== b.distributorProduct.featured) return a.distributorProduct.featured ? -1 : 1;
      const scopedA = (a as DistributorCatalogProduct & { scopedSortOrder?: number | null }).scopedSortOrder;
      const scopedB = (b as DistributorCatalogProduct & { scopedSortOrder?: number | null }).scopedSortOrder;
      if (isGuyPortal && scopedA !== scopedB) return Number(scopedA ?? 9999) - Number(scopedB ?? 9999);
      return a.product_name.localeCompare(b.product_name);
    });
  }, [category, isGuyPortal, products, search, sort]);

  const luxuryProductsSectionId = isAuroraPortal ? 'aurora-products' : 'rockphorm-products';
  const luxuryAudienceSections = useMemo(() => {
    if (!isRockPhormLuxuryFamily) return [];
    const brandName = isAuroraPortal ? 'Aurora' : 'Rock Phorm';
    const sectionPrefix = isAuroraPortal ? 'aurora' : 'rockphorm';
    return [
      {
        id: `${sectionPrefix}-his`,
        eyebrow: 'His',
        title: `His ${brandName}`,
        intro: isAuroraPortal
          ? 'Aurora Labs curated options for performance, recovery, body goals, and everyday optimization.'
          : 'Rock Phorm curated options for performance, recovery, body goals, and stronger daily output.',
        stacks: LUXURY_HIS_STACKS,
      },
      {
        id: `${sectionPrefix}-hers`,
        eyebrow: 'Hers',
        title: `Hers ${brandName}`,
        intro: isAuroraPortal
          ? 'Aurora Labs curated options for radiance, metabolic refinement, longevity, and polished wellness routines.'
          : 'Rock Phorm curated options for radiance, metabolic refinement, longevity, and wellness-focused routines.',
        stacks: LUXURY_HERS_STACKS,
      },
    ].map((section) => ({
      ...section,
      stacks: section.stacks.map((stack) => ({
        ...stack,
        matchedProducts: stack.products
          .map((productName) => findLuxuryProduct(products, productName))
          .filter((product): product is DistributorCatalogProduct => Boolean(product)),
      })),
    }));
  }, [isAuroraPortal, isRockPhormLuxuryFamily, products]);

  const focusLuxuryCatalogProduct = useCallback((product: DistributorCatalogProduct) => {
    setCategory('All');
    setSearch(getProductMetadata(product).commonName);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById(luxuryProductsSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }, [luxuryProductsSectionId]);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);

  const addToCart = useCallback((id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setAddedProductId(id);
    if (isRockPhormPortal) setCartOpen(true);
  }, [isRockPhormPortal]);

  const clearCart = useCallback(() => {
    setCart({});
    setAddedProductId(null);
  }, []);

  const scrollAactivatedCatalogIntoView = useCallback((focusSearch = false) => {
    if (!isGuyPortal || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const section = aactivatedCatalogSectionRef.current;
      if (section) {
        const headerOffset = window.innerWidth <= 768 ? 76 : 94;
        const targetTop = section.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
      if (focusSearch) {
        aactivatedSearchInputRef.current?.focus({ preventScroll: true });
      }
    });
  }, [isGuyPortal]);

  const runAactivatedSearch = useCallback(() => {
    setSearch((value) => value.trim());
    setShowFullCatalog(true);
    setCatalogOpen(false);
    scrollAactivatedCatalogIntoView(true);
  }, [scrollAactivatedCatalogIntoView]);

  const applyAactivatedDiscountCode = useCallback(async () => {
    const normalized = normalizeAactivatedDiscountCode(discountCodeInput);
    setDiscountCodeInput(normalized);
    setDiscountCodeMessage('');
    setManualPromo(null);

    if (!normalized) {
      setDiscountCodeMessage('Discount code removed.');
      return;
    }
    if (!supabase) {
      setDiscountCodeMessage('Discount codes are temporarily unavailable.');
      return;
    }

    setDiscountCodeApplying(true);
    const { data, error } = await supabase
      .from('aactivated_promo_links')
      .select('promo_title,discount_code,discount_amount,discount_type,discount_percent,promo_kind,expires_at,usage_limit,uses_count,rep_slug,product_id,store_scope_code,link_slug')
      .eq('discount_code', normalized)
      .eq('promo_kind', 'customer_discount')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setDiscountCodeApplying(false);

    if (error || !data) {
      setDiscountCodeMessage('Code not recognized or no longer active.');
      return;
    }

    const promo = data as AactivatedPromoLink;
    setManualPromo(promo);
    if (promo.product_id && !cart[promo.product_id]) {
      const eligibleProduct = products.find((product) => product.id === promo.product_id);
      setDiscountCodeMessage(`${promo.discount_code} is active, but add ${eligibleProduct ? `${eligibleProduct.product_name} ${eligibleProduct.strength}` : 'the eligible product'} to use it.`);
      return;
    }
    setDiscountCodeMessage(`${promo.discount_code} applied: ${promoDiscountLabel(promo)}.`);
  }, [cart, discountCodeInput, products]);

  const handleCheckout = useCallback(() => {
    const entries = cartEntries(cart, products);
    if (entries.length === 0) return;
    const blockedItem = entries.find(({ product }) => !inventoryStatusForProduct(product).checkout_allowed);
    if (blockedItem) {
      window.alert(`${blockedItem.product.product_name} is not currently sellable. Please remove it from your cart before checkout.`);
      return;
    }
    const bundleSummary = bundleDiscountSummary(cart, products);
    const checkoutPromo = appliedPromoDiscount > 0 ? appliedPromo : null;
    const checkoutDiscountAmount = appliedPromoDiscount + bundleSummary.totalDiscount;
    const checkoutDiscountCode = checkoutPromo?.discount_code
      ? bundleSummary.totalDiscount > 0
        ? `${checkoutPromo.discount_code}+BUNDLE`
        : checkoutPromo.discount_code
      : bundleSummary.totalDiscount > 0
        ? 'BUNDLE'
        : '';
    const portalRepCode = isEhwSubPortal ? 'EHWSUB' : isMarkPortal ? 'MARK65' : isGuyPortal ? (aactivatedAttributionCode || 'GUY60') : isRobertPortal ? 'ROBERT' : isScottPortal ? 'SCOTTB' : isAlphaPortal ? 'ALPHAPRIDE' : isOptimaxPortal ? 'GABE50' : isRoninPortal ? 'MGT1111' : isAgPrimePortal ? 'AGPRIME45' : isVyigenixPortal ? 'VYIGENIX' : isRockPhormPortal ? 'ROCKPHORM' : isAuroraPortal ? auroraAttributionCode : isZenoraPortal ? 'JESS8' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_SCOPE_CODE : isGintoPortal ? GINTO_SCOPE_CODE : isBeastModePortal ? BEASTMODE_SCOPE_CODE : isAnatoliaPortal ? 'MAIN' : resolvedSlug.toUpperCase();
    const portalScopeCode = checkoutPromo?.store_scope_code || (isOptimaxPortal
      ? 'OPTIMAX'
        : isGuyPortal
          ? (aactivatedAttributionCode || 'VITALITYINS')
          : isRoninPortal
            ? 'MGT1111'
            : isAgPrimePortal
              ? 'AGPRIME45'
              : isVyigenixPortal
                ? 'VYIGENIX'
                : isRockPhormPortal
                  ? 'ROCKPHORM'
                : isAuroraPortal
                    ? auroraAttributionCode
                    : isZenoraPortal
                      ? 'JESS8'
                      : isPhysioPeptidesPortal
                        ? PHYSIOPEPTIDES_SCOPE_CODE
                        : isGintoPortal
                          ? GINTO_SCOPE_CODE
                          : isBeastModePortal
                            ? BEASTMODE_SCOPE_CODE
                          : isAnatoliaPortal
                            ? 'MAIN'
        : portalRepCode);
    const sourcePortal = isOptimaxPortal
      ? 'Optimax'
      : isGuyPortal
        ? 'VITALITYINS'
        : isScottPortal
          ? 'Peak Form'
          : isAlphaPortal
            ? 'Alpha Pride Wellness'
            : isRobertPortal
              ? 'WarXlabz'
              : isRoninPortal
                ? 'Ronin'
                : isAgPrimePortal
                  ? 'AG Prime Lab'
                  : isVyigenixPortal
                    ? 'Vyigenix Pharmaceuticals'
                    : isRockPhormPortal
                      ? 'Rock Phorm'
                      : isAuroraPortal
                        ? 'Aurora Labs'
                        : isZenoraPortal
                          ? 'ZENORA Precision Wellness & Peptide Therapy'
                          : isPhysioPeptidesPortal
                            ? PHYSIOPEPTIDES_STORE_NAME
                            : isGintoPortal
                              ? GINTO_STORE_NAME
                              : isBeastModePortal
                                ? BEASTMODE_STORE_NAME
                            : isAnatoliaPortal
                              ? ANATOLIA_STORE_NAME
              : isEhwSubPortal
                ? 'Ellie'
                : isEmpirePortal
                ? 'Empire Health & Wellness'
                : resolvedSlug;
    const cartPayload = {
      rep: portalRepCode,
      scope_code: portalScopeCode,
      discount_code: checkoutDiscountCode,
      discount_amount: checkoutDiscountAmount,
      bundle_discount_amount: bundleSummary.totalDiscount,
      bundle_discounts: bundleSummary.rows,
      promo_title: checkoutPromo?.promo_title ?? '',
      promo_slug: checkoutPromo?.link_slug ?? '',
      promo_product_id: checkoutPromo?.product_id ?? '',
      distributor: resolvedSlug,
      source_portal: sourcePortal,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: isOptimaxPortal ? 'optimax-peptide-therapy' : isAlphaPortal ? 'alphapride' : isRoninPortal ? 'ronin' : isAgPrimePortal ? 'agprimelab' : isVyigenixPortal ? 'vyigenix' : isRockPhormPortal ? 'rockphorm' : isAuroraPortal ? 'aurora' : isZenoraPortal ? 'zenora' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_STORE_SLUG : isGintoPortal ? 'ginto' : isBeastModePortal ? 'beastmode' : isAnatoliaPortal ? anatoliaStorefront.slug : resolvedSlug,
      store_name: isOptimaxPortal ? 'Optimax Peptide Therapy' : isAlphaPortal ? 'Alpha Pride Wellness' : isRoninPortal ? 'Ronin' : isAgPrimePortal ? 'AG Prime Lab' : isVyigenixPortal ? 'Vyigenix Pharmaceuticals' : isRockPhormPortal ? 'Rock Phorm' : isAuroraPortal ? 'Aurora Labs' : isZenoraPortal ? 'ZENORA Precision Wellness & Peptide Therapy' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_STORE_NAME : isGintoPortal ? GINTO_STORE_NAME : isBeastModePortal ? BEASTMODE_STORE_NAME : isAnatoliaPortal ? ANATOLIA_STORE_NAME : isEhwSubPortal ? 'Ellie' : isEmpirePortal ? 'Empire Health & Wellness' : distributor?.portal_name ?? resolvedSlug,
      admin_code: isGuyPortal && aactivatedAdminParam ? aactivatedAdminParam : isOptimaxPortal ? 'GABE50' : isRoninPortal ? 'MGT1111' : isAgPrimePortal || isVyigenixPortal || isZenoraPortal ? 'MARK65' : isRockPhormPortal ? 'ROCKPHORM' : isAuroraPortal ? 'MIKEAURORA' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_SCOPE_CODE : isGintoPortal ? GINTO_SCOPE_CODE : isBeastModePortal ? BEASTMODE_SCOPE_CODE : isAnatoliaPortal ? 'MAIN' : undefined,
      admin_scope: isRockPhormPortal ? 'ROCKPHORM' : isAuroraPortal ? 'AURORA' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_SCOPE_CODE : isGintoPortal ? GINTO_SCOPE_CODE : isBeastModePortal ? BEASTMODE_SCOPE_CODE : isAnatoliaPortal ? 'MAIN' : undefined,
      owner_email: isRockPhormPortal ? 'rick@blueprintadvocate.io' : isAuroraPortal ? 'mnsgroup107@gmail.com' : undefined,
      parent_admin: isAgPrimePortal || isVyigenixPortal || isZenoraPortal ? 'MARK65' : isAuroraPortal ? (auroraRepParam ? 'MIKEAURORA' : 'ROCKPHORM') : undefined,
      parent_store_name: isAgPrimePortal || isVyigenixPortal || isZenoraPortal ? 'Empire Health & Wellness' : isAuroraPortal ? (auroraRepParam ? 'Aurora Labs' : 'Rock Phorm') : undefined,
      commission_rate: isAgPrimePortal ? 0.45 : isVyigenixPortal ? 0.5 : isRockPhormPortal ? 0.6 : isAuroraPortal ? (auroraRepParam ? 0.2 : 0.4) : isZenoraPortal ? 0.45 : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_COMMISSION_RATE : isGintoPortal ? 0.5 : isBeastModePortal ? 0.4 : isAnatoliaPortal ? anatoliaOrderMetadata.commissionRate : undefined,
      commission_type: isAgPrimePortal || isVyigenixPortal || isRockPhormPortal || isAuroraPortal || isZenoraPortal || isPhysioPeptidesPortal || isGintoPortal || isBeastModePortal ? 'net_profit_after_true_cost' : undefined,
      true_cost_rule: isAgPrimePortal || isVyigenixPortal || isZenoraPortal ? 'supplier_wholesale_cost_plus_15_percent_landing_cost' : isRockPhormPortal || isAuroraPortal || isPhysioPeptidesPortal || isGintoPortal || isBeastModePortal ? 'customer_amount_collected_minus_true_landed_product_fulfillment_shipping_payment_costs' : undefined,
      account_type: isBeastModePortal ? 'store' : (isGuyPortal && aactivatedAdminParam && !aactivatedRepParam) || isOptimaxPortal || isVyigenixPortal || isRockPhormPortal || (isAuroraPortal && !auroraRepParam) || isPhysioPeptidesPortal || isGintoPortal ? 'admin' : isAnatoliaPortal ? 'platform' : 'rep',
      parent_type: isBeastModePortal ? undefined : isAgPrimePortal || isVyigenixPortal || isZenoraPortal ? 'empire_downline' : isAuroraPortal ? (auroraRepParam ? 'aurora_downline' : 'rockphorm_downline') : isOptimaxPortal || isRoninPortal || isRockPhormPortal || isPhysioPeptidesPortal || isGintoPortal ? 'platform' : isAnatoliaPortal ? 'master_owned_localized_storefront' : undefined,
      locale: isAnatoliaPortal ? anatoliaStorefront.locale : undefined,
      commission_owner: isAnatoliaPortal ? anatoliaOrderMetadata.commissionOwner : undefined,
      partner_payout_eligible: isAnatoliaPortal ? anatoliaOrderMetadata.partnerPayoutEligible : undefined,
      items: entries.map(({ product, qty }) => {
        const metadata = getProductMetadata(product);
        const inventoryStatus = inventoryStatusForProduct(product);
        return {
          id: product.id,
          sku: product.sku,
          name: metadata.commonName,
          strength: metadata.doseLabel,
          technical_name: metadata.technicalName,
          category: product.category,
          price: product.displayPrice ?? 0,
          qty,
          inventory_status_at_purchase: inventoryStatus.inventory_status,
          inventory_status_label_at_purchase: inventoryStatus.inventory_status_label,
          was_special_order: inventoryStatus.was_special_order,
          estimated_fulfillment_days_at_purchase: inventoryStatus.estimated_fulfillment_days,
          bundle_group_key: product.scopedBundleGroupKey ?? null,
          bundle_group_name: product.scopedBundleGroupName ?? null,
        };
      }),
      total: cartSubtotal(cart, products),
      capturedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartPayload));
    const params = new URLSearchParams({
      scope:    portalScopeCode,
      source:  `${resolvedSlug}-portal`,
      rep:     portalRepCode,
    });
    if (portalConfig?.id) params.set('brand', portalConfig.id);
    navigate(`/start?${params}`);
  }, [aactivatedAdminParam, aactivatedAttributionCode, aactivatedRepParam, appliedPromo, appliedPromoDiscount, auroraAttributionCode, auroraRepParam, cart, products, distributor?.portal_name, isEhwSubPortal, isEmpirePortal, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isAuroraPortal, isZenoraPortal, isPhysioPeptidesPortal, isGintoPortal, isBeastModePortal, isAnatoliaPortal, resolvedSlug, navigate, portalConfig]);

  const count = cartCount(cart);
  const total = Math.max(0, cartTotal(cart, products) - appliedPromoDiscount);
  const addedProduct = useMemo(
    () => products.find((product) => product.id === addedProductId) ?? null,
    [addedProductId, products],
  );
  const topSellers = useMemo(() => {
    const featured = products.filter((product) => isAactivatedTopSeller(product));
    const featuredIds = new Set(featured.map((product) => product.id));
    const fallbackTopSellers = AACTIVATED_FALLBACK_TOP_SELLER_IDS
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is DistributorCatalogProduct => {
        if (!product) return false;
        return !featuredIds.has(product.id);
      });
    const fallbackIds = new Set(fallbackTopSellers.map((product) => product.id));
    const fallbackPool = featured.length >= 10
      ? featured
      : [
          ...featured,
          ...fallbackTopSellers,
          ...products.filter((product) => !featuredIds.has(product.id) && !fallbackIds.has(product.id)),
        ];
    return fallbackPool.slice(0, 10);
  }, [products]);
  const hasActiveAactivatedCatalogFilters = showFullCatalog || search.trim().length > 0 || category !== 'All' || sort !== 'featured';
  const aactivatedCatalogProducts = hasActiveAactivatedCatalogFilters ? visibleProducts : topSellers;
  const calcMgPerMl = calcMg > 0 && calcMl > 0 ? calcMg / calcMl : 0;
  const calcDoseMg = calcDoseUnit === 'mg' ? calcDose : calcDose / 1000;
  const calcDrawMl = calcMgPerMl > 0 ? calcDoseMg / calcMgPerMl : 0;
  const calcUnits = calcDrawMl * 100;
  const legalBasePath = portalConfig?.path ?? '';
  const privacyPath = legalBasePath ? `${legalBasePath}/privacy` : '/privacy';
  const termsPath = legalBasePath ? `${legalBasePath}/terms` : '/terms';
  const certificatesPath = legalBasePath ? `${legalBasePath}/certificates` : '/certificates';

  if (!distributor) {
    return (
      <PublicLayout>
        <section className="section">
          <div className="container-sm">
            <div className="empty-state card">
              <div className="empty-state-icon">+</div>
              <div className="empty-state-title">Portal not found</div>
              <div className="empty-state-desc">This distributor portal is not active or has not been configured.</div>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
      <PublicLayout
      isolatedPortal={isEhwSubPortal || isEmpirePortal || isGuyPortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal || isAgPrimePortal || isVyigenixPortal || isRockPhormPortal || isAuroraPortal || isZenoraPortal || isPhysioPeptidesPortal || isGintoPortal || isBeastModePortal || isAnatoliaPortal}
      portalHomePath={isEhwSubPortal ? EHW_SUB_PORTAL_PATH : isMarkPortal ? MARK_PORTAL_PATH : isGuyPortal ? GUY_PORTAL_PATH : isRobertPortal ? ROBERT_PORTAL_PATH : isScottPortal ? SCOTT_PORTAL_PATH : isAlphaPortal ? ALPHA_PORTAL_PATH : isOptimaxPortal ? OPTIMAX_PORTAL_PATH : isRoninPortal ? RONIN_PORTAL_PATH : isAgPrimePortal ? AG_PRIME_PORTAL_PATH : isVyigenixPortal ? VYIGENIX_PORTAL_PATH : isRockPhormPortal ? ROCKPHORM_PORTAL_PATH : isAuroraPortal ? AURORA_PORTAL_PATH : isZenoraPortal ? ZENORA_PORTAL_PATH : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_PORTAL_PATH : isGintoPortal ? GINTO_PORTAL_PATH : isBeastModePortal ? BEASTMODE_PORTAL_PATH : isAnatoliaPortal ? ANATOLIA_PORTAL_PATH : '/'}
      portalName={isEhwSubPortal ? 'Ellie' : isEmpirePortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : isRobertPortal ? 'WarXlabz' : isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : isAgPrimePortal ? 'AG Prime Lab' : isVyigenixPortal ? 'Vyigenix Pharmaceuticals' : isRockPhormPortal ? 'Rock Phorm' : isAuroraPortal ? 'Aurora Labs' : isZenoraPortal ? 'ZENORA' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_STORE_NAME : isGintoPortal ? GINTO_STORE_NAME : isBeastModePortal ? BEASTMODE_STORE_NAME : isAnatoliaPortal ? ANATOLIA_STORE_NAME : distributor.portal_name}
      portalLogoSrc={isEhwSubPortal ? portalConfig?.logoSrc : isEmpirePortal ? MARK_LOGO_SRC : isGuyPortal ? GUY_LOGO_SRC : isRobertPortal ? ROBERT_LOGO_SRC : isScottPortal ? SCOTT_LOGO_SRC : isAlphaPortal ? ALPHA_LOGO_SRC : isOptimaxPortal ? OPTIMAX_LOGO_SRC : isRoninPortal ? RONIN_LOGO_SRC : isAgPrimePortal ? AG_PRIME_LOGO_SRC : isVyigenixPortal ? VYIGENIX_LOGO_SRC : isRockPhormPortal ? ROCKPHORM_LOGO_SRC : isAuroraPortal ? AURORA_LOGO_SRC : isZenoraPortal ? ZENORA_LOGO_SRC : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_LOGO_SRC : isGintoPortal ? GINTO_LOGO_SRC : isBeastModePortal ? BEASTMODE_LOGO_SRC : isAnatoliaPortal ? ANATOLIA_LOGO_SRC : undefined}
      portalKey={portalConfig?.id}
    >
      {(isAgPrimePortal || isGuyPortal) && (
        <button
          className={`agprime-cart-corner ${isGuyPortal ? 'aactivated-cart-corner' : ''}`}
          onClick={() => setCartOpen(true)}
          aria-label={`Open cart with ${count} item${count === 1 ? '' : 's'}`}
        >
          <span className="agprime-cart-icon" aria-hidden="true">Cart</span>
          <span className="agprime-cart-text">
            <strong>{count > 0 ? `${count} item${count === 1 ? '' : 's'}` : 'My Cart'}</strong>
            <small>{count > 0 ? `$${total.toFixed(2)}` : '0 items'}</small>
          </span>
        </button>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={isBeastModePortal ? 'beastmode-hero' : isGintoPortal ? 'ginto-lux-hero' : isRockPhormLuxuryFamily ? 'rock-lux-hero' : undefined} style={{ background: isBeastModePortal ? `linear-gradient(90deg, rgba(2,2,3,.92), rgba(2,2,3,.62) 48%, rgba(2,2,3,.28)), url(${BEASTMODE_HERO_SRC}) center/cover no-repeat` : isRockPhormLuxuryFamily ? 'radial-gradient(circle at 50% -18%, rgba(94,234,212,.28), transparent 38%), radial-gradient(circle at 88% 18%, rgba(184,138,61,.18), transparent 30%), linear-gradient(135deg,#f5fffc 0%,#dff5ef 45%,#b9ded8 100%)' : isRoninPortal ? 'radial-gradient(circle at 78% 8%, rgba(185,28,28,.24), transparent 30%), linear-gradient(135deg, #030305 0%, #101116 54%, #250707 100%)' : isGintoPortal ? 'linear-gradient(115deg,#050505 0%,#0e0e0e 48%,#16120a 100%)' : isPhysioPeptidesPortal ? 'radial-gradient(circle at 78% 2%, rgba(20,184,166,.24), transparent 34%), radial-gradient(circle at 24% 14%, rgba(34,197,94,.18), transparent 34%), linear-gradient(135deg,#f8fffd 0%,#e6f7f3 48%,#dbeafe 100%)' : isAuroraPortal ? 'radial-gradient(circle at 78% 2%, rgba(45,212,191,.36), transparent 34%), radial-gradient(circle at 24% 14%, rgba(16,185,129,.24), transparent 34%), linear-gradient(135deg,#031321 0%,#06364a 46%,#061f34 100%)' : isZenoraPortal ? 'radial-gradient(circle at 74% 14%, rgba(212,175,55,.24), transparent 32%), linear-gradient(135deg,#020202 0%,#14100a 54%,#2b1f08 100%)' : isRockPhormPortal ? 'radial-gradient(circle at 76% 16%, rgba(20,184,166,.28), transparent 32%), radial-gradient(circle at 22% 18%, rgba(37,99,235,.24), transparent 34%), linear-gradient(135deg,#02040a 0%,#07111f 48%,#030711 100%)' : isVyigenixPortal ? 'radial-gradient(circle at 72% 20%, rgba(37,199,217,.28), transparent 32%), linear-gradient(135deg,#020405 0%,#111111 52%,#071721 100%)' : isAgPrimePortal ? 'radial-gradient(circle at 82% 16%, rgba(0,104,217,.18), transparent 30%), linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #e5e7eb 100%)' : isAlphaPortal ? 'linear-gradient(135deg, #050505 0%, #16130b 52%, #3a2a0a 100%)' : isRobertPortal ? 'linear-gradient(135deg, #050505 0%, #181714 48%, #3a311f 100%)' : isScottPortal ? 'linear-gradient(135deg, #0d1b3e 0%, #0f2555 50%, #1a3a7a 100%)' : isOptimaxPortal ? 'linear-gradient(135deg, #f8fffb 0%, #effbf7 46%, #e7f8ff 100%)' : isAnatoliaPortal ? 'radial-gradient(circle at 78% 12%, rgba(212,175,55,.18), transparent 30%), radial-gradient(circle at 22% 8%, rgba(0,109,119,.14), transparent 32%), linear-gradient(135deg,#fffdf7 0%,#f8faf7 48%,#e6f4f2 100%)' : 'linear-gradient(135deg, #0a1628 0%, #0d2040 60%, #0e2d4a 100%)', padding: isBeastModePortal ? '78px 0 72px' : isGintoPortal ? 'clamp(46px, 7vw, 86px) 0 0' : isRockPhormLuxuryFamily ? 'clamp(40px, 7vw, 78px) 0 36px' : '56px 0 44px', position: 'relative', overflow: 'hidden', borderBottom: isBeastModePortal ? '1px solid rgba(193,18,31,.38)' : isGintoPortal ? '1px solid rgba(200,169,106,.34)' : isRockPhormLuxuryFamily ? '1px solid rgba(184,138,61,.30)' : isRoninPortal ? '1px solid rgba(239,68,68,.24)' : isPhysioPeptidesPortal ? '1px solid rgba(20,184,166,.20)' : isAuroraPortal ? '1px solid rgba(45,212,191,.24)' : isZenoraPortal ? '1px solid rgba(212,175,55,.3)' : isRockPhormPortal ? '1px solid rgba(20,184,166,.24)' : isVyigenixPortal ? '1px solid rgba(37,199,217,.22)' : isAgPrimePortal ? '1px solid rgba(0,104,217,.18)' : isAlphaPortal ? '1px solid rgba(245,158,11,.28)' : isOptimaxPortal ? '1px solid rgba(8,127,140,.14)' : isAnatoliaPortal ? '1px solid rgba(0,109,119,.18)' : undefined }}>
        {/* Decorative glows */}
        {!isGintoPortal && !isBeastModePortal && (
          <>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,199,217,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          </>
        )}

        <div className="container">
          <div className={isRockPhormLuxuryFamily ? 'rock-lux-hero-stack' : isGuyPortal ? 'aactivated-hero-layout' : undefined} style={{ display: 'flex', justifyContent: isRockPhormLuxuryFamily ? 'center' : 'space-between', alignItems: isRockPhormLuxuryFamily ? 'center' : 'flex-start', gap: 28, flexWrap: 'wrap', position: 'relative', textAlign: isRockPhormLuxuryFamily ? 'center' : undefined }}>
            <div className={isRockPhormLuxuryFamily ? 'rock-lux-hero-copy' : isGuyPortal ? 'aactivated-hero-copy' : undefined} style={{ maxWidth: isRockPhormLuxuryFamily ? 980 : isVyigenixPortal || isRockPhormPortal || isAuroraPortal || isPhysioPeptidesPortal || isGintoPortal || isAnatoliaPortal ? 820 : 580 }}>
              {isEmpirePortal && (
                <img
                  src={MARK_LOGO_SRC}
                  alt="Empire Health & Wellness"
                  style={{
                    width: 'min(420px, 86vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 14,
                    boxShadow: '0 24px 60px rgba(0,0,0,.28)',
                  }}
                />
              )}
              {isGuyPortal && (
                <img
                  src={GUY_LOGO_SRC}
                  alt="AACTIVATED-RX"
                  style={{
                    width: 'min(360px, 82vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    filter: 'drop-shadow(0 18px 36px rgba(37,199,217,.28))',
                  }}
                />
              )}
              {isGuyPortal && aactivatedAttributionCode && (
                <div style={{
                  display: 'grid',
                  gap: 8,
                  background: 'rgba(236,254,255,.08)',
                  border: '1px solid rgba(103,232,249,.28)',
                  borderRadius: 12,
                  padding: '13px 15px',
                  margin: '0 0 18px',
                  maxWidth: 560,
                  boxShadow: '0 16px 34px rgba(2,8,23,.18)',
                }}>
                  <div style={{ color: '#67e8f9', fontSize: 11, fontWeight: 900, letterSpacing: '.09em', textTransform: 'uppercase' }}>
                    AACTIVATEDRX Rep Store
                  </div>
                  <div style={{ color: '#fff', fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>
                    {aactivatedRepDisplayName || aactivatedAttributionCode}
                  </div>
                  <div style={{ color: 'rgba(236,254,255,.78)', fontSize: 13, lineHeight: 1.55, fontWeight: 700 }}>
                    Shopping through {aactivatedRepDisplayName || 'this rep'} keeps attribution attached through checkout{aactivatedRepDiscountCode ? ` with code ${aactivatedRepDiscountCode}` : ''}.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-info">Rep: {aactivatedAttributionCode}</span>
                    {aactivatedRepStore?.product_list_name && <span className="badge badge-success">{aactivatedRepStore.product_list_name}</span>}
                    {aactivatedRepStore?.status === 'active' && <span className="badge badge-success">Store active</span>}
                  </div>
                </div>
              )}
              {isRobertPortal && (
                <img
                  src={ROBERT_LOGO_SRC}
                  alt="WarXlabz"
                  style={{
                    width: 'min(520px, 88vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 12,
                    boxShadow: '0 24px 70px rgba(250,204,21,.16)',
                  }}
                />
              )}
              {isScottPortal && (
                <img
                  src={SCOTT_LOGO_SRC}
                  alt="Peak Form Peptides"
                  style={{
                    width: 'min(420px, 84vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    filter: 'drop-shadow(0 20px 48px rgba(37,99,235,.45))',
                  }}
                />
              )}
              {isAlphaPortal && (
                <img
                  src={ALPHA_LOGO_SRC}
                  alt="Alpha Pride Wellness"
                  style={{
                    width: 'min(430px, 84vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 14,
                    boxShadow: '0 28px 72px rgba(245,158,11,.28)',
                  }}
                />
              )}
              {isOptimaxPortal && (
                <img
                  src={OPTIMAX_LOGO_SRC}
                  alt="Optimax Peptide Therapy"
                  style={{
                    width: 'min(500px, 86vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 24px',
                    filter: 'drop-shadow(0 22px 44px rgba(25,199,217,.28)) drop-shadow(0 10px 28px rgba(123,220,42,.16))',
                  }}
                />
              )}
              {isRoninPortal && (
                <img
                  src={RONIN_LOGO_SRC}
                  alt="Ronin"
                  style={{
                    width: 'min(360px, 78vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 24px',
                    filter: 'drop-shadow(0 22px 48px rgba(185,28,28,.34))',
                  }}
                />
              )}
              {isAgPrimePortal && (
                <AgPrimeBrandShowcase />
              )}
              {isVyigenixPortal && (
                <div className="vyigenix-brand-showcase" aria-label="Vyigenix Pharmaceuticals product showcase">
                  <div className="vyigenix-logo-panel">
                    <img src={VYIGENIX_LOGO_SRC} alt="Vyigenix Pharmaceuticals" />
                  </div>
                  <img className="vyigenix-hero-vial" src={VYIGENIX_PRODUCT_IMAGE_SRC} alt="Vyigenix Pharmaceuticals vial" />
                </div>
              )}
              {isRockPhormPortal && (
                <div className="rockphorm-brand-showcase" aria-label="Rock Phorm product showcase">
                  <div className="rockphorm-logo-panel">
                    <img src={ROCKPHORM_LOGO_SRC} alt="Rock Phorm" />
                  </div>
                  <img className="rockphorm-hero-vial" src={ROCKPHORM_PRODUCT_IMAGE_SRC} alt="Rock Phorm vial" />
                </div>
              )}
              {isAuroraPortal && (
                <div className="aurora-brand-showcase" aria-label="Aurora Labs brand">
                  <img src={AURORA_STANDARD_FLYER_SRC} alt="Aurora Labs science precision transformation flyer" />
                </div>
              )}
              {isPhysioPeptidesPortal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', margin: '0 0 24px' }} aria-label="PhysioPeptides brand">
                  <div style={{ background: 'rgba(255,255,255,.86)', border: '1px solid rgba(20,184,166,.22)', borderRadius: 14, padding: '14px 18px', boxShadow: '0 18px 44px rgba(15,118,110,.14)' }}>
                    <img src={PHYSIOPEPTIDES_LOGO_SRC} alt="PhysioPeptides" style={{ width: 'min(360px, 72vw)', maxHeight: 190, objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
              )}
              {isGintoPortal && (
                <div className="ginto-lux-brand" aria-label="Ginto Wellness Labs brand">
                  <div className="ginto-lux-logo-panel">
                    <img src={GINTO_LOGO_SRC} alt="Ginto Wellness Labs" />
                  </div>
                </div>
              )}
              {isBeastModePortal && (
                <div className="beastmode-hero-logo" aria-label="BEASTMODE Performance Labs brand">
                  <img src={BEASTMODE_LOGO_SRC} alt="BEASTMODE Performance Labs" />
                </div>
              )}
              {isAnatoliaPortal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', margin: '0 0 24px' }} aria-label="Anatolia Wellness Labs brand">
                  <div style={{ background: '#fff', border: '1px solid rgba(212,175,55,.34)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 18px 44px rgba(0,109,119,.14)' }}>
                    <img src={ANATOLIA_LOGO_SRC} alt="Anatolia Wellness Labs" style={{ width: 'min(420px, 78vw)', maxHeight: 210, objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
              )}
              {isZenoraPortal && (
                <div className="rockphorm-brand-showcase" aria-label="ZENORA product showcase">
                  <div className="rockphorm-logo-panel" style={{ background: '#050403', borderColor: 'rgba(212,175,55,.28)' }}>
                    <img src={ZENORA_LOGO_SRC} alt="ZENORA Precision Wellness & Peptide Therapy" />
                  </div>
                </div>
              )}
              {/* Brand line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: isBeastModePortal ? 'linear-gradient(135deg,#050505,#C1121F)' : isRoninPortal ? 'linear-gradient(135deg,#f8fafc,#991b1b)' : isAnatoliaPortal ? 'linear-gradient(135deg,#006D77,#D4AF37)' : isAlphaPortal || isZenoraPortal ? 'linear-gradient(135deg,#111827,#D4AF37)' : isScottPortal ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : isOptimaxPortal ? 'linear-gradient(135deg,#7BDC2A,#25C7D9)' : 'linear-gradient(135deg,#25C7D9,#0e9ab0)', color: isOptimaxPortal ? '#061425' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isBeastModePortal ? 12 : 18, fontWeight: 900 }}>{isBeastModePortal ? 'BM' : isRoninPortal ? 'R' : isAnatoliaPortal ? 'A' : isZenoraPortal ? 'Z' : isAlphaPortal ? 'A' : isScottPortal ? 'P' : isOptimaxPortal ? 'O' : 'RX'}</div>
                <span style={{ color: isRoninPortal ? 'rgba(226,232,240,.72)' : isAlphaPortal || isZenoraPortal ? 'rgba(250,204,21,.74)' : isOptimaxPortal || isPhysioPeptidesPortal || isAnatoliaPortal ? 'rgba(6,20,37,.68)' : 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {isEmpirePortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : isRockPhormPortal ? 'Rock Phorm' : isAuroraPortal ? 'Aurora Labs' : isZenoraPortal ? 'ZENORA' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_STORE_NAME : isGintoPortal ? GINTO_STORE_NAME : isBeastModePortal ? BEASTMODE_STORE_NAME : isAnatoliaPortal ? ANATOLIA_STORE_NAME : distributor.portal_name}
                </span>
              </div>

              <h1 style={{ color: isBeastModePortal ? '#f4f4f5' : isGintoPortal ? '#fffaf0' : isRockPhormLuxuryFamily ? '#7b5a20' : isOptimaxPortal || isAgPrimePortal || isPhysioPeptidesPortal || isAnatoliaPortal ? '#061425' : '#fff', fontFamily: isBeastModePortal ? "'Arial Black', Impact, system-ui, sans-serif" : isGintoPortal || isRockPhormLuxuryFamily ? "Georgia, 'Times New Roman', serif" : undefined, fontSize: isBeastModePortal ? 56 : isGintoPortal ? 'clamp(42px, 7vw, 82px)' : isRockPhormLuxuryFamily ? 'clamp(44px, 8vw, 96px)' : 'clamp(26px, 4vw, 40px)', fontWeight: isGintoPortal || isRockPhormLuxuryFamily ? 500 : 900, margin: '0 0 14px', lineHeight: isGintoPortal || isRockPhormLuxuryFamily ? .96 : 1.1, letterSpacing: isBeastModePortal ? '.03em' : isRockPhormLuxuryFamily ? '.08em' : 0, textTransform: isBeastModePortal || isRockPhormLuxuryFamily ? 'uppercase' : undefined, textShadow: isBeastModePortal ? '0 10px 40px rgba(0,0,0,.72)' : undefined }}>
                {isBeastModePortal ? 'UNLEASH THE NEXT VERSION OF YOURSELF.' : isGintoPortal ? 'Elevate Wellness. Defined by Excellence.' : isRockPhormLuxuryFamily ? (isAuroraPortal ? 'Aurora Labs' : 'Rock Phorm') : isEmpirePortal ? 'Advanced Peptide Therapy' : isGuyPortal ? 'Optimize. Recover. Perform.' : isRobertPortal ? 'Train Hard. Recover Tactical.' : isScottPortal ? 'Perform. Recover. Peak.' : isAlphaPortal ? 'Strength. Recovery. Pride.' : isOptimaxPortal ? 'Optimize. Recover. Perform.' : isRoninPortal ? 'Discipline. Recovery. Precision.' : isAgPrimePortal ? 'Recover Better. Perform Stronger.' : isVyigenixPortal ? 'Precision Wellness. Premium Access.' : isRockPhormPortal ? 'Optimize Your Biology' : isAuroraPortal ? 'Refined Wellness. Elevated Standards.' : isZenoraPortal ? 'Precision Wellness. Longevity Refined.' : isPhysioPeptidesPortal ? 'Clinical Recovery. Performance Wellness.' : isAnatoliaPortal ? ANATOLIA_STORE_NAME : 'Advanced Wellness Products'}
              </h1>
              {isRockPhormLuxuryFamily && (
                <p className="rock-lux-tagline">
                  {isAuroraPortal ? 'Refined Wellness - Luxury Peptide Access' : 'Luxury Performance - Peptide Wellness'}
                </p>
              )}
              <p style={{ color: isBeastModePortal ? 'rgba(244,244,245,.82)' : isGintoPortal ? 'rgba(255,250,240,.76)' : isRockPhormLuxuryFamily ? '#725f63' : isOptimaxPortal || isAgPrimePortal || isPhysioPeptidesPortal || isAnatoliaPortal ? 'rgba(6,20,37,.72)' : isAuroraPortal ? 'rgba(236,254,255,.82)' : isVyigenixPortal ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.65)', fontSize: isBeastModePortal ? 18 : isGintoPortal ? 18 : isRockPhormLuxuryFamily ? 17 : 15, margin: '0 0 24px', lineHeight: 1.75, maxWidth: isBeastModePortal ? 560 : isGintoPortal ? 620 : isRockPhormLuxuryFamily ? 720 : undefined, marginLeft: isRockPhormLuxuryFamily ? 'auto' : undefined, marginRight: isRockPhormLuxuryFamily ? 'auto' : undefined, whiteSpace: isBeastModePortal ? 'pre-line' : undefined }}>
                {isEmpirePortal
                  ? 'Pharmaceutical-grade peptides for weight loss, recovery, hormone support, and longevity. Select your products, set your quantity, and continue directly to secure checkout.'
                  : isGuyPortal
                    ? 'A private partner portal for targeted wellness support, top-seller product paths, education, and secure account-code checkout.'
                    : isRobertPortal
                      ? 'WarXlabz custom pricing for performance, recovery, and wellness support. Orders stay attributed under Empire Health & Wellness and continue to secure checkout.'
                      : isScottPortal
                        ? 'Premium peptides for athletes, high performers, and wellness-focused individuals. Select your products and continue directly to secure checkout.'
                        : isAlphaPortal
                          ? 'A black-and-gold wellness storefront built for elite performance, recovery, and strength-focused optimization.'
                          : isOptimaxPortal
                            ? 'Premium peptide therapy solutions powered by Optimax Peptide Therapy and PepScriptRX.'
                            : isRoninPortal
                              ? 'A premium minimalist catalog built for disciplined performance, recovery, and focused wellness support.'
                              : isAgPrimePortal
                                ? 'A clean performance and recovery storefront with electric-blue Prime Lab pricing, Empire parent attribution, and secure PepScriptRX checkout.'
                                 : isVyigenixPortal
                                   ? 'A premium clinical wellness catalog with Vyigenix retail pricing, Empire Health & Wellness hierarchy attribution, and secure PepScriptRX checkout.'
                                    : isRockPhormPortal
                                      ? 'Premium GLP-1, recovery, performance, and longevity peptides designed to support transformation from the inside out.'
                                      : isAuroraPortal
                                        ? 'Aurora Labs brings a clean, premium wellness experience with transparent quality standards, secure ordering, and discreet fulfillment.'
                                       : isZenoraPortal
                                         ? 'A luxury black-and-gold wellness catalog for concierge peptide therapy, anti-aging support, and longevity optimization. Orders stay attributed to Jessica Hinojosa under Empire Health & Wellness.'
                                        : isPhysioPeptidesPortal
                                          ? 'A premium clinical storefront for recovery, wellness, and performance support with full catalog access, secure checkout, and PhysioPeptides attribution preserved through fulfillment.'
                                        : isGintoPortal
                                          ? 'Premium peptides. Exceptional quality. Delivered with precision through a discreet concierge wellness experience.'
                                        : isBeastModePortal
                                          ? 'Premium research compounds.\nBuilt for relentless performance.\n\nWE NOT THE SAME.'
                                        : isAnatoliaPortal
                                          ? 'PepScriptRX altyapısıyla desteklenen premium peptit ve wellness ürünleri. Katalog, ödeme ve kalite belgeleri tek platformda.'
                                        : 'Curated advanced wellness products for performance, recovery, and longevity.'}
              </p>

              {isAnatoliaPortal && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                  <a className="btn btn-primary" href="#anatolia-products" style={{ background: '#006D77', borderColor: '#006D77', color: '#fff', fontWeight: 900, boxShadow: '0 16px 34px rgba(0,109,119,.18)' }}>
                    Ürünleri Görüntüle
                  </a>
                  <Link className="btn btn-outline" to={`${ANATOLIA_PORTAL_PATH}/certificates`} style={{ color: '#0B1F33', borderColor: 'rgba(212,175,55,.50)', background: 'rgba(255,255,255,.78)', fontWeight: 900 }}>
                    Sertifikaları İncele
                  </Link>
                  <Link className="btn btn-outline" to={`${ANATOLIA_PORTAL_PATH}/library`} style={{ color: '#0B1F33', borderColor: 'rgba(0,109,119,.34)', background: '#fff', fontWeight: 900, boxShadow: '0 12px 26px rgba(11,31,51,.08)' }}>
                    Ürün Kütüphanesi
                  </Link>
                  <Link className="btn btn-outline" to={`${ANATOLIA_PORTAL_PATH}/mixing`} style={{ color: '#006D77', borderColor: 'rgba(0,109,119,.34)', background: 'rgba(255,255,255,.78)', fontWeight: 900 }}>
                    Karışım Merkezine Git
                  </Link>
                </div>
              )}

              {isOptimaxPortal && (
                <a className="btn btn-primary" href="#optimax-products" style={{ marginBottom: 18, background: '#7BDC2A', borderColor: '#7BDC2A', color: '#061425', fontWeight: 900, boxShadow: '0 14px 28px rgba(123,220,42,.24)' }}>
                  Start Your Wellness Request
                </a>
              )}

              {isGintoPortal && (
                <div className="ginto-lux-actions">
                  <a className="ginto-lux-primary" href="#ginto-products">
                    Explore Collection
                  </a>
                  <a className="ginto-lux-secondary" href="#ginto-collections">
                    Luxury Collections
                  </a>
                </div>
              )}

              {isBeastModePortal && (
                <div className="beastmode-hero-actions">
                  <a className="beastmode-primary" href="#beastmode-products">
                    Shop Performance
                  </a>
                  <a className="beastmode-secondary" href="#beastmode-bundles">
                    Explore Bundles
                  </a>
                </div>
              )}

              {isRockPhormLuxuryFamily && (
                <>
                  <nav className="rock-lux-gender-switch" aria-label={`${isAuroraPortal ? 'Aurora Labs' : 'Rock Phorm'} his and hers collections`}>
                    <a className="rock-lux-gender-btn" href={isAuroraPortal ? '#aurora-his' : '#rockphorm-his'}>
                      <span>His</span>
                      <strong>{isAuroraPortal ? 'Aurora' : 'Rock Phorm'}</strong>
                    </a>
                    <a className="rock-lux-gender-btn" href={isAuroraPortal ? '#aurora-hers' : '#rockphorm-hers'}>
                      <span>Hers</span>
                      <strong>{isAuroraPortal ? 'Aurora' : 'Rock Phorm'}</strong>
                    </a>
                  </nav>
                  <div className="rock-lux-actions-row">
                    <a className="rock-lux-btn rock-lux-btn-primary" href={isAuroraPortal ? '#aurora-products' : '#rockphorm-products'}>
                      {isAuroraPortal ? 'Shop Aurora' : 'Shop Rock Phorm'}
                    </a>
                    <a className="rock-lux-btn rock-lux-btn-secondary" href={isAuroraPortal ? '#aurora-quality' : '#rockphorm-products'}>
                      {isAuroraPortal ? 'View Quality Standards' : 'Explore Catalog'}
                    </a>
                    <Link className="rock-lux-btn rock-lux-btn-secondary" to={`${isAuroraPortal ? AURORA_PORTAL_PATH : ROCKPHORM_PORTAL_PATH}/mixing`}>
                      Mixing Center
                    </Link>
                  </div>
                </>
              )}

              {isPhysioPeptidesPortal && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                  <a className="btn btn-primary" href="#physiopeptides-products" style={{ background: '#0f766e', borderColor: '#0f766e', color: '#fff', fontWeight: 900, boxShadow: '0 16px 34px rgba(15,118,110,.20)' }}>
                    Shop PhysioPeptides
                  </a>
                  <a className="btn btn-outline" href={certificatesPath} style={{ color: '#075985', borderColor: 'rgba(14,116,144,.35)', background: 'rgba(255,255,255,.52)' }}>
                    View Certificates
                  </a>
                </div>
              )}

              {isGuyPortal && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                  <a className="btn btn-primary" href="#aactivated-top-sellers">
                    Shop Top Sellers
                  </a>
                  <Link className="btn btn-outline" to={`${GUY_PORTAL_PATH}/library`} style={{ color: '#25C7D9', borderColor: 'rgba(37,199,217,.42)' }}>
                    Product Library
                  </Link>
                  <Link className="btn btn-outline" to={`${GUY_PORTAL_PATH}/rep-intake`} style={{ color: '#25C7D9', borderColor: 'rgba(37,199,217,.42)' }}>
                    Rep Approval
                  </Link>
                </div>
              )}

              {/* Trust badges */}
              {(isEmpirePortal || isGuyPortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal || isAgPrimePortal || isVyigenixPortal || isRockPhormPortal) && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { icon: '✓', label: isGuyPortal ? 'Curated Wellness Options' : isScottPortal ? 'Premium Grade' : isAlphaPortal ? 'Elite Wellness Catalog' : isOptimaxPortal ? 'Premium Therapy Options' : isRoninPortal ? 'Disciplined Catalog' : 'Pharmaceutical Grade' },
                    { icon: '✓', label: isGuyPortal ? 'Secure Checkout' : 'Immediate Checkout' },
                    { icon: '✓', label: 'Discreet Shipping' },
                    { icon: '✓', label: isGuyPortal ? 'AACTIVATED-RX Member Pricing' : isScottPortal ? 'Peak Form Member Pricing' : isAlphaPortal ? 'Alpha Pride Pricing' : isOptimaxPortal ? 'Optimax Retail Pricing' : isRoninPortal ? 'Ronin Pricing' : 'Compounded to Order' },
                  ].map(({ icon, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isRoninPortal ? 'rgba(127,29,29,.24)' : isAlphaPortal ? 'rgba(245,158,11,.14)' : isScottPortal ? 'rgba(37,99,235,.18)' : isOptimaxPortal ? 'rgba(255,255,255,.72)' : 'rgba(37,199,217,.12)', color: isRoninPortal ? '#fecaca' : isAlphaPortal ? '#FACC15' : isScottPortal ? '#93C5FD' : isOptimaxPortal ? '#075b6b' : '#25C7D9', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1px solid ${isRoninPortal ? 'rgba(248,113,113,.28)' : isAlphaPortal ? 'rgba(245,158,11,.32)' : isScottPortal ? 'rgba(37,99,235,.35)' : isOptimaxPortal ? 'rgba(8,127,140,.2)' : 'rgba(37,199,217,.22)'}` }}>
                      <span style={{ fontSize: 11 }}>{icon}</span>{label}
                    </span>
                  ))}
                </div>
              )}
              {(isEmpirePortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal || isAgPrimePortal || isVyigenixPortal || isRockPhormPortal) && (
                <div style={{ marginTop: 20, maxWidth: 760 }}>
                  <ProductPurityGuaranteeBadge compact variant={isGuyPortal ? 'aactivated' : 'pepscriptrx'} />
                </div>
              )}
            </div>

            <div className="aactivated-hero-side" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', marginLeft: 'auto' }}>
              {isGuyPortal && <AACTIVATEDRXVerificationBadge placement="hero" />}
              {isGuyPortal && (
                <img
                  className="aactivated-hero-support-card"
                  src={GUY_WEIGHT_MANAGEMENT_SUPPORT_SRC}
                  alt="AACTIVATEDRX Weight Management Support"
                />
              )}
              {isGintoPortal && (
                <div className="ginto-lux-stage" aria-label="Ginto Wellness Labs LV Collection storefront preview">
                  <img
                    className="ginto-lux-storefront-image"
                    src={GINTO_LV_STOREFRONT_SRC}
                    alt="Ginto Wellness Labs LV Collection luxury peptides storefront"
                  />
                </div>
              )}

              {/* Cart chip */}
              {!isAgPrimePortal && !isGuyPortal && (
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  background: count > 0 ? (isRockPhormPortal ? '#67e8f9' : isOptimaxPortal || isAnatoliaPortal ? '#061425' : 'rgba(37,199,217,1)') : (isOptimaxPortal || isAnatoliaPortal ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.08)'),
                  border: count > 0 ? `2px solid ${isRockPhormPortal ? 'rgba(103,232,249,.68)' : isOptimaxPortal ? 'rgba(123,220,42,.45)' : isAnatoliaPortal ? 'rgba(0,109,119,.30)' : 'rgba(37,199,217,.4)'}` : `1.5px solid ${isOptimaxPortal ? 'rgba(8,127,140,.18)' : isAnatoliaPortal ? 'rgba(0,109,119,.20)' : 'rgba(255,255,255,.15)'}`,
                  borderRadius: 16, padding: '16px 22px', cursor: 'pointer', color: isRockPhormPortal && count > 0 ? '#031321' : (isOptimaxPortal || isAnatoliaPortal) && count === 0 ? '#061425' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                  marginTop: 0,
                  minWidth: 150, transition: 'all .2s', boxShadow: count > 0 ? (isRockPhormPortal ? '0 12px 28px rgba(103,232,249,.22)' : isOptimaxPortal || isAnatoliaPortal ? '0 14px 30px rgba(6,20,37,.18)' : '0 8px 24px rgba(37,199,217,.3)') : (isOptimaxPortal || isAnatoliaPortal ? '0 12px 28px rgba(8,127,140,.1)' : 'none'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🛒</span>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{count > 0 ? (isAnatoliaPortal ? `${count} ürün` : `${count} item${count === 1 ? '' : 's'}`) : (isAnatoliaPortal ? 'Sepetim' : 'My Cart')}</span>
                </div>
                {count > 0
                  ? <div style={{ fontSize: 20, fontWeight: 900 }}>${total.toFixed(2)}</div>
                  : <div style={{ fontSize: 12, color: isOptimaxPortal || isAnatoliaPortal ? 'rgba(6,20,37,.58)' : 'rgba(255,255,255,.5)', fontWeight: 600 }}>{isAnatoliaPortal ? '0 ürün' : '0 items'}</div>
                }
              </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      {isBeastModePortal && (
        <section className="beastmode-showcase" aria-label="BEASTMODE featured sections">
          <div className="container">
            <div className="beastmode-section-heading">
              <span>Featured Bundle</span>
              <h2>Wolverine Stack</h2>
              <p>A premium recovery and performance stack built for focused routines.</p>
            </div>
            <article id="beastmode-bundles" className="beastmode-bundle-feature">
              <div>
                <span className="beastmode-kicker">Performance Stacks</span>
                <h3>Wolverine Stack</h3>
                <p>A focused performance bundle featuring recovery, rebuilding, and cellular-support favorites.</p>
                <a className="beastmode-primary" href="#beastmode-products">Shop The Stack</a>
              </div>
              <img src={BEASTMODE_WOLVERINE_SRC} alt="BEASTMODE Wolverine Stack promotional artwork" loading="lazy" />
            </article>
            <div id="beastmode-performance" className="beastmode-category-grid">
              {BEASTMODE_CATEGORIES.map((item) => (
                <button key={item.title} type="button" className="beastmode-category-card" onClick={() => setCategory(item.category as RxPlusCategory)}>
                  <span>{item.title}</span>
                  <p>{item.copy}</p>
                </button>
              ))}
            </div>
            <div id="beastmode-weight-loss" className="beastmode-split-section">
              <div>
                <span className="beastmode-kicker">Weight Management</span>
                <h3>Body Composition</h3>
                <p>Explore metabolic support options for focused body-composition goals.</p>
              </div>
              <button type="button" className="beastmode-secondary" onClick={() => setCategory('GLP / Weight Management' as RxPlusCategory)}>View Weight Management</button>
            </div>
            <div id="beastmode-recovery" className="beastmode-split-section">
              <div>
                <span className="beastmode-kicker">Recovery</span>
                <h3>Rebuild. Recover. Regenerate.</h3>
                <p>Support hard training days with repair and resilience-focused options.</p>
              </div>
              <button type="button" className="beastmode-secondary" onClick={() => setCategory('Recovery / Repair' as RxPlusCategory)}>View Recovery</button>
            </div>
            <div id="beastmode-library" className="beastmode-split-section">
              <div>
                <span className="beastmode-kicker">Research Library</span>
                <h3>Know What You Are Looking At</h3>
                <p>Review product education, quality documents, and research references before checkout.</p>
              </div>
              <Link className="beastmode-secondary" to={`${BEASTMODE_PORTAL_PATH}/library`}>Open Library</Link>
            </div>
            <div id="beastmode-why" className="beastmode-why-grid">
              {[
                ['Premium Catalog', 'Performance, recovery, body composition, longevity, wellness, and bundle paths in one focused storefront.'],
                ['Secure Checkout', 'Encrypted checkout with clear pricing and order review.'],
                ['Research Library', 'Product education and quality references for informed shopping.'],
                ['Powered by PepScriptRX', 'Reliable ordering, support, and fulfillment coordination behind the scenes.'],
              ].map(([title, copy]) => (
                <div key={title}>
                  <span>{title}</span>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isGintoPortal && (
        <section className="ginto-lux-showcase" id="ginto-collections">
          <div className="container">
            <div className="ginto-lux-trust-ribbon">
              {GINTO_TRUST_POINTS.map((point) => (
                <div key={point.label}>
                  <span>{point.mark}</span>
                  <strong>{point.label}</strong>
                </div>
              ))}
            </div>
            <div className="ginto-lux-collections">
              <aside className="ginto-lux-collection-menu">
                <div>Shop Peptides</div>
                {GINTO_COLLECTIONS.map((collection) => (
                  <button key={collection.title} type="button" onClick={() => setCategory(collection.category as RxPlusCategory)}>
                    {collection.title}
                  </button>
                ))}
                <button type="button" onClick={() => setCategory('All')}>All Products</button>
              </aside>
              <div className="ginto-lux-collection-grid">
                {GINTO_COLLECTIONS.map((collection) => (
                  <article key={collection.title} className="ginto-lux-collection-card">
                    <div>
                      <span>Luxury Collection</span>
                      <h2>{collection.title}</h2>
                    </div>
                    <img src={GINTO_PRODUCT_IMAGE_SRC} alt={`${collection.title} collection vial`} loading="lazy" />
                    <ul>
                      {collection.products.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <a href="#ginto-products" onClick={() => setCategory(collection.category as RxPlusCategory)}>Shop Now</a>
                  </article>
                ))}
              </div>
            </div>
            <div className="ginto-lux-standard">
              <div className="ginto-lux-standard-mark">G</div>
              <div>
                <span>The GINTO Standard</span>
                <p>Premium wellness access with lab-focused quality cues, secure checkout, discreet shipping, and a concierge-level shopping experience.</p>
              </div>
              <Link to={`${GINTO_PORTAL_PATH}/library`}>Product Library</Link>
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (appliedPromo || promoError) && (
        <section style={{ background: '#06101f', borderBottom: '1px solid rgba(250,204,21,.28)', padding: '14px 0' }}>
          <div className="container">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap',
              border: appliedPromo ? '1px solid rgba(250,204,21,.36)' : '1px solid rgba(248,113,113,.34)',
              background: appliedPromo ? 'linear-gradient(135deg, rgba(20,16,8,.96), rgba(9,17,32,.96))' : 'rgba(127,29,29,.16)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div>
                <div style={{ color: appliedPromo ? '#FACC15' : '#FCA5A5', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {appliedPromo ? 'Discount Code Active' : 'Promo Link Notice'}
                </div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>
                  {appliedPromo ? appliedPromo.promo_title : promoError}
                </div>
                {appliedPromo && (
                  <div style={{ color: 'rgba(255,255,255,.66)', fontSize: 12, marginTop: 2 }}>
                    Code {appliedPromo.discount_code} saves {promoDiscountLabel(appliedPromo)} at checkout.
                  </div>
                )}
              </div>
              {appliedPromo?.product_id && (
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => {
                    const product = products.find((item) => item.id === appliedPromo.product_id);
                    if (product) addToCart(product.id);
                  }}
                  style={{ background: '#FACC15', borderColor: '#FACC15', color: '#050505', fontWeight: 900 }}
                >
                  Add Promo Product
                </button>
              )}
              {!appliedPromo && promoError && (
                <button
                  type="button"
                  aria-label="Dismiss promo notice"
                  onClick={() => setPromoError('')}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    border: '1px solid rgba(252,165,165,.42)',
                    background: 'rgba(255,255,255,.08)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 20,
                    fontWeight: 900,
                    lineHeight: 1,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {(isEmpirePortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal || isAgPrimePortal || isVyigenixPortal || isZenoraPortal) && (
        <div style={{ background: isRoninPortal ? '#07080b' : isZenoraPortal ? '#070604' : isVyigenixPortal ? '#050708' : isAgPrimePortal ? '#ffffff' : isAlphaPortal ? '#0b0b0a' : isRobertPortal ? '#0b0b0a' : isScottPortal ? '#f0f5ff' : isOptimaxPortal ? '#f4fbf8' : '#fff', borderBottom: isRoninPortal ? '1px solid rgba(248,113,113,.18)' : isZenoraPortal ? '1px solid rgba(212,175,55,.24)' : isVyigenixPortal ? '1px solid rgba(37,199,217,.18)' : isAgPrimePortal ? '1px solid rgba(0,104,217,.16)' : isAlphaPortal ? '1px solid rgba(245,158,11,.25)' : isRobertPortal ? '1px solid rgba(250,204,21,.22)' : isScottPortal ? '1px solid rgba(37,99,235,.18)' : isOptimaxPortal ? '1px solid rgba(123,220,42,.22)' : '1px solid var(--border)', padding: '14px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: '🔬', text: isGuyPortal ? 'Curated wellness menu' : 'Sterile compounding lab' },
                { icon: '🚚', text: 'Ships nationwide' },
                { icon: '✓', text: 'Immediate checkout path' },
                { icon: '🔒', text: 'HIPAA-compliant ordering' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isRoninPortal ? '#e2e8f0' : isZenoraPortal ? '#fef3c7' : isVyigenixPortal ? '#d8faff' : isAlphaPortal ? '#FACC15' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isEmpirePortal && (
        <section style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: '#f8fbfc' }}>
                <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome from Mark Ayala
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  This Empire Health &amp; Wellness portal was created so you can browse our wellness catalog and continue directly to secure checkout — with member pricing automatically applied.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,199,217,.35)', borderRadius: 12, padding: 20, background: '#ecfeff' }}>
                <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Questions?
                </div>
                <div style={{ color: 'var(--navy)', fontWeight: 800, marginBottom: 8 }}>Mark's wellness team can help.</div>
                <a className="btn btn-primary btn-sm" href="mailto:service@pepscriptrx.com?subject=Empire Health %26 Wellness portal question">Contact the team</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section style={{ background: '#f8fbfc', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '22px 0 8px' }}>
          <div className="container">
            <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid rgba(8,145,178,.18)', padding: '16px 20px', display: 'flex', gap: 12, flexDirection: 'column', boxShadow: '0 14px 34px rgba(15,23,42,.06)' }}>
              <div className="aactivated-search-row">
                <input
                  ref={aactivatedSearchInputRef}
                  type="search"
                  className="form-input"
                  placeholder="Search products by name, strength, or category"
                  value={search}
                  onChange={(e) => {
                    const nextSearch = e.target.value;
                    setSearch(nextSearch);
                    setShowFullCatalog(Boolean(nextSearch.trim()));
                    if (!nextSearch.trim() && window.innerWidth <= 768) {
                      e.currentTarget.blur();
                      const scrollHome = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                      window.requestAnimationFrame(scrollHome);
                      window.setTimeout(scrollHome, 80);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runAactivatedSearch();
                  }}
                  style={{ borderRadius: 10 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runAactivatedSearch}
                  style={{ borderRadius: 10, justifyContent: 'center', minWidth: 112 }}
                >
                  Search
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#075985', fontWeight: 800 }}>
                  {aactivatedAttributionCode
                    ? `${aactivatedRepDisplayName || aactivatedAttributionCode} attribution stays attached through checkout.`
                    : 'AACTIVATED-RX member pricing is applied automatically at checkout.'}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 800 }}>
                  Sort
                  <select className="form-select" value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setShowFullCatalog(true); scrollAactivatedCatalogIntoView(); }} style={{ width: 180, borderRadius: 10 }}>
                    <option value="featured">Featured</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="alpha">Alphabetical</option>
                  </select>
                </label>
              </div>
              <div className="aactivated-category-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${category === 'All' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setCategory('All'); setShowFullCatalog(true); scrollAactivatedCatalogIntoView(); }}
                  style={{ borderRadius: 20 }}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setCategory(cat); setShowFullCatalog(true); scrollAactivatedCatalogIntoView(); }}
                    style={{ borderRadius: 20 }}
                  >
                    {categoryIcon(cat, isAgPrimePortal)} {categoryLabel(cat, isAgPrimePortal)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section ref={aactivatedCatalogSectionRef} id="aactivated-top-sellers" style={{ background: '#f8fbfc', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '30px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {hasActiveAactivatedCatalogFilters ? 'Shop full catalog' : 'Shop top sellers'}
                </div>
                <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>
                  {hasActiveAactivatedCatalogFilters ? 'All available products' : 'Most requested products'}
                </h2>
              </div>
              <div ref={catalogMenuRef} className="aactivated-catalog-menu-wrap" style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCatalogOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={catalogOpen}
                  style={{
                    background: catalogOpen ? '#ecfeff' : '#ffffff',
                    border: '1px solid rgba(8,145,178,.22)',
                    borderRadius: 12,
                    color: '#0891b2',
                    cursor: 'pointer',
                    fontWeight: 900,
                    padding: '10px 14px',
                    boxShadow: catalogOpen ? '0 12px 30px rgba(8,145,178,.12)' : '0 8px 20px rgba(15,23,42,.04)',
                  }}
                >
                  Catalog Options <span style={{ fontSize: 12 }}>{catalogOpen ? '^' : 'v'}</span>
                </button>
                {catalogOpen && (
                  <div
                    className="aactivated-catalog-menu"
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      zIndex: 12,
                      width: 'min(280px, calc(100vw - 32px))',
                      background: '#ffffff',
                      border: '1px solid rgba(8,145,178,.18)',
                      borderRadius: 14,
                      padding: 8,
                      boxShadow: '0 24px 60px rgba(15,23,42,.18)',
                    }}
                  >
                    <a
                      href="#aactivated-top-sellers"
                      role="menuitem"
                      onClick={(event) => {
                        event.preventDefault();
                        setSearch('');
                        setCategory('All');
                        setSort('featured');
                        setShowFullCatalog(false);
                        setCatalogOpen(false);
                        scrollAactivatedCatalogIntoView();
                      }}
                      style={{ display: 'block', padding: '12px 14px', borderRadius: 10, color: '#075985', fontWeight: 900, textDecoration: 'none' }}
                    >
                      Shop Top Sellers
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSearch('');
                        setCategory('All');
                        setShowFullCatalog(true);
                        setCatalogOpen(false);
                        scrollAactivatedCatalogIntoView();
                      }}
                      style={{ display: 'block', width: '100%', padding: '12px 14px', border: 0, borderRadius: 10, background: 'transparent', color: '#075985', fontWeight: 900, textAlign: 'left', cursor: 'pointer' }}
                    >
                      Browse Full Catalog
                    </button>
                    <Link
                      to={`${GUY_PORTAL_PATH}/library`}
                      role="menuitem"
                      onClick={() => setCatalogOpen(false)}
                      style={{ display: 'block', padding: '12px 14px', borderRadius: 10, color: '#075985', fontWeight: 900, textDecoration: 'none' }}
                    >
                      Open Product Library
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 22 }}>
              {aactivatedCatalogProducts.length === 0 ? (
                <div role="status" style={{ background: '#fff', border: '1px solid rgba(8,145,178,.14)', borderRadius: 12, padding: 22, color: '#475569', fontWeight: 800 }}>
                  <div>No products found. Try a different search or category filter.</div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setCategory('All'); setSort('featured'); setShowFullCatalog(false); scrollAactivatedCatalogIntoView(); }} style={{ marginTop: 12 }}>
                    Clear Search and Filters
                  </button>
                </div>
              ) : aactivatedCatalogProducts.map((product) => (
                <AactivatedShowcaseCard
                  key={product.id}
                  product={product}
                  qty={cart[product.id] ?? 0}
                  onQtyChange={setQty}
                  onAdd={addToCart}
                  onLearnMore={setDetailProduct}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section id="aactivated-calculator" style={{ background: '#f4f8fb', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '22px 0' }}>
          <div className="container">
            <details className="aactivated-resource-dropdown">
              <summary>
                <span>
                  <small>AACTIVATEDRX resources</small>
                  <strong>Education, library paths, and mixing calculator</strong>
                </span>
                <b aria-hidden="true">v</b>
              </summary>
              <div className="aactivated-resource-dropdown-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(300px,1.1fr)', gap: 18 }} className="portal-welcome-grid">
                  <div>
                    <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Compound Library</div>
                    <h2 style={{ margin: '0 0 10px', color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>Education by goal</h2>
                    <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px', fontWeight: 650 }}>
                      Start with the goal, then use the AACTIVATED library to compare commonly requested peptide pairings before checkout. Pairing paths are educational only and final use should be discussed with a licensed provider.
                    </p>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {AACTIVATED_EDUCATION.map((item) => (
                        <div key={item.title} style={{ background: '#fff', border: '1px solid rgba(8,145,178,.14)', borderRadius: 12, padding: 16, boxShadow: '0 8px 22px rgba(15,23,42,.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ color: 'var(--navy)', fontWeight: 950, fontSize: 16 }}>{item.title}</div>
                            <Link to={`${GUY_PORTAL_PATH}/library`} style={{ color: '#0891b2', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>Open library</Link>
                          </div>
                          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, marginTop: 6, fontWeight: 600 }}>{item.body}</div>
                          <div style={{ color: '#075985', fontSize: 11, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 12 }}>
                            Pairing path
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                            {item.pairings.map((pairing) => (
                              <span key={pairing} style={{ background: '#ecfeff', border: '1px solid rgba(8,145,178,.18)', borderRadius: 999, color: '#155e75', fontSize: 11, fontWeight: 850, padding: '5px 9px' }}>
                                {pairing}
                              </span>
                            ))}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
                            {item.library}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid rgba(37,99,235,.14)', borderRadius: 12, padding: 14, marginTop: 14, color: '#334155', fontSize: 12, lineHeight: 1.65, fontWeight: 650 }}>
                      Pairing ideas are not protocols, prescriptions, dosing guidance, or medical advice. Availability, suitability, and final product selection remain subject to standard verification and state availability.
                    </div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18, boxShadow: '0 12px 28px rgba(15,23,42,.06)' }}>
                    <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Mixing calculator</div>
                    <h3 style={{ margin: '0 0 14px', color: 'var(--navy)', fontSize: 22 }}>Mixing strength and draw volume</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Vial mg<input className="form-input" type="number" min="1" value={calcMg} onChange={(e) => setCalcMg(Number(e.target.value))} /></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Water mL<input className="form-input" type="number" min="0.1" step="0.1" value={calcMl} onChange={(e) => setCalcMl(Number(e.target.value))} /></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Dose unit<select className="form-input" value={calcDoseUnit} onChange={(e) => setCalcDoseUnit(e.target.value as 'mg' | 'mcg')}><option value="mg">mg</option><option value="mcg">mcg</option></select></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Desired dose ({calcDoseUnit})<input className="form-input" type="number" min="0" step={calcDoseUnit === 'mg' ? '0.01' : '1'} value={calcDose} onChange={(e) => setCalcDose(Number(e.target.value))} /></label>
                    </div>
                    <div style={{ background: '#ecfeff', border: '1px solid rgba(8,145,178,.18)', borderRadius: 10, padding: 14, marginTop: 14 }}>
                      <div style={{ color: '#155e75', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Mixed concentration</div>
                      <div style={{ color: 'var(--navy)', fontSize: 30, fontWeight: 900 }}>{Number.isFinite(calcMgPerMl) ? calcMgPerMl.toFixed(2) : '0.00'} mg/mL</div>
                      <div style={{ color: '#155e75', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', marginTop: 12 }}>Estimated draw</div>
                      <div style={{ color: 'var(--navy)', fontSize: 24, fontWeight: 900 }}>{Number.isFinite(calcDrawMl) ? calcDrawMl.toFixed(2) : '0.00'} mL / {Number.isFinite(calcUnits) ? calcUnits.toFixed(1) : '0.0'} units</div>
                      <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5 }}>Calculator is educational only. Follow licensed-provider and pharmacy instructions.</div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section style={{ background: '#06101f', borderBottom: '1px solid rgba(37,199,217,.18)', padding: '24px 0 28px' }}>
          <div className="container">
            <div style={{ border: '1px solid rgba(103,232,249,.22)', borderRadius: 14, background: 'linear-gradient(135deg, rgba(8,31,51,.96), rgba(6,16,31,.98))', padding: '20px 22px', boxShadow: '0 18px 42px rgba(2,8,23,.22)' }}>
              <div style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Important Notice
              </div>
              <div style={{ display: 'grid', gap: 9, color: '#e2f7fb', fontSize: 13, lineHeight: 1.65, fontWeight: 650 }}>
                <p style={{ margin: 0 }}>All products are intended for use under the supervision of a licensed healthcare provider.</p>
                <p style={{ margin: 0 }}>AACTIVATEDRX does not provide medical advice, diagnosis, or treatment.</p>
                <p style={{ margin: 0 }}>Product availability, pricing, and fulfillment are subject to verification and applicable regulations.</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                <Link to={`${GUY_PORTAL_PATH}/privacy`} style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>Privacy</Link>
                <Link to={`${GUY_PORTAL_PATH}/terms`} style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>Terms</Link>
                <Link to={`${GUY_PORTAL_PATH}/certificates`} style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>Certificates</Link>
              </div>
              <div style={{ color: 'rgba(226,247,251,.66)', fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 18 }}>
                AACTIVATEDRX Private Partner Ecosystem
              </div>
            </div>
          </div>
        </section>
      )}

      {isScottPortal && (
        <section style={{ background: '#f0f5ff', borderBottom: '1px solid rgba(37,99,235,.18)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(37,99,235,.22)', borderRadius: 12, padding: 20, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to Peak Form Peptides
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  This portal gives you direct access to our curated peptide catalog — built for performance, recovery, and peak wellness. Select your products and continue directly to secure checkout.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,99,235,.3)', borderRadius: 12, padding: 20, background: 'rgba(37,99,235,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 118 }}>
                <div style={{ color: 'var(--navy)', fontSize: 22, fontWeight: 900, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Peak Form Peptides
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isAlphaPortal && (
        <section style={{ background: '#11100d', borderBottom: '1px solid rgba(245,158,11,.22)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(245,158,11,.24)', borderRadius: 12, padding: 20, background: '#fffaf0' }}>
                <div style={{ fontSize: 12, color: '#a16207', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to Alpha Pride Wellness
                </div>
                <p style={{ margin: 0, color: '#171717', fontWeight: 750, lineHeight: 1.7 }}>
                  A premium black-and-gold catalog built for strength, recovery, performance, and elite wellness. Select your products and continue directly to secure checkout.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(245,158,11,.32)', borderRadius: 12, padding: 20, background: 'linear-gradient(135deg,#050505,#2b210f)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 118 }}>
                <div style={{ color: '#FACC15', fontSize: 22, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Alpha Pride Wellness
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isOptimaxPortal && (
        <section style={{ background: '#f4fbf8', borderBottom: '1px solid rgba(123,220,42,.22)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(25,199,217,.24)', borderRadius: 12, padding: 20, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#087f8c', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Optimax Peptide Therapy
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  Premium peptide therapy solutions built for athletic optimization, recovery, longevity, and modern wellness.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(123,220,42,.32)', borderRadius: 12, padding: 20, background: 'rgba(123,220,42,.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <img
                  src={OPTIMAX_LOGO_SRC}
                  alt="Optimax Peptide Therapy"
                  style={{ width: 'min(230px, 100%)', height: 'auto', margin: '0 0 14px', filter: 'drop-shadow(0 8px 18px rgba(8,127,140,.14))' }}
                />
                <div style={{ fontSize: 12, color: '#3b7f08', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Compliance Note
                </div>
                <div style={{ color: 'var(--navy)', fontWeight: 800, lineHeight: 1.6 }}>
                  Products and availability may vary. Orders continue to secure checkout and remain subject to standard verification.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isAgPrimePortal && (
        <section style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,104,217,.16)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(0,104,217,.18)', borderRadius: 12, padding: 20, background: '#f8fafc' }}>
                <div style={{ fontSize: 12, color: '#0068d9', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to AG Prime Lab
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  A premium performance, recovery, and wellness catalog with AG Prime Lab pricing applied automatically through secure checkout.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(0,104,217,.24)', borderRadius: 12, padding: 20, background: 'linear-gradient(135deg,#f8fafc,#eff6ff)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ color: '#0068d9', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Powered by PepScriptRX
                </div>
                <div style={{ color: 'var(--navy)', fontWeight: 800, lineHeight: 1.6 }}>
                  Orders remain subject to standard verification, state availability, and fulfillment review.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isVyigenixPortal && (
        <section style={{ background: '#050708', borderBottom: '1px solid rgba(37,199,217,.18)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(37,199,217,.24)', borderRadius: 12, padding: 20, background: 'linear-gradient(135deg,rgba(255,255,255,.06),rgba(37,199,217,.08))' }}>
                <div style={{ fontSize: 12, color: '#67e8f9', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to Vyigenix Pharmaceuticals
                </div>
                <p style={{ margin: 0, color: '#f8fafc', fontWeight: 700, lineHeight: 1.7 }}>
                  A premium clinical catalog with retail pricing applied automatically through secure checkout. Scope VYIGENIX stays attached under Empire Health &amp; Wellness.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,199,217,.28)', borderRadius: 12, padding: 20, background: '#0d1114', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Powered by PepScriptRX
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, lineHeight: 1.6 }}>
                  Orders remain subject to standard verification, state availability, and fulfillment review.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isZenoraPortal && (
        <section style={{ background: '#070604', borderBottom: '1px solid rgba(212,175,55,.24)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(212,175,55,.28)', borderRadius: 12, padding: 20, background: 'linear-gradient(135deg,rgba(255,255,255,.05),rgba(212,175,55,.1))' }}>
                <div style={{ fontSize: 12, color: '#FACC15', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to ZENORA
                </div>
                <p style={{ margin: 0, color: '#f8fafc', fontWeight: 700, lineHeight: 1.7 }}>
                  Precision wellness and peptide therapy pricing is applied automatically. Jessica Hinojosa's JESS8 attribution stays connected through checkout under Empire Health & Wellness.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(212,175,55,.32)', borderRadius: 12, padding: 20, background: '#11100c', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ color: '#FACC15', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Powered by PepScriptRX
                </div>
                <div style={{ color: '#fef3c7', fontWeight: 800, lineHeight: 1.6 }}>
                  Orders remain subject to standard verification, state availability, and fulfillment review.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isAuroraPortal && (
        <section style={{ background: 'linear-gradient(180deg,#f8fffd,#ecfeff)', borderBottom: '1px solid rgba(20,184,166,.2)', padding: '24px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 18 }}>
              {[
                ['COA Documentation', 'Quality documentation and batch transparency are emphasized.'],
                ['Transparent Standards', 'Aurora keeps quality, ordering, and fulfillment expectations clear.'],
                ['Secure Checkout', 'A simple private checkout experience keeps ordering clear and protected.'],
                ['Discreet Packaging', 'Fulfillment is privacy-forward from confirmation through delivery.'],
                ['Fast Fulfillment', 'Orders are reviewed promptly for availability and applicable requirements.'],
              ].map(([title, text]) => (
                <div key={title} style={{ border: '1px solid rgba(20,184,166,.22)', borderRadius: 16, background: 'rgba(255,255,255,.82)', padding: 16, boxShadow: '0 16px 34px rgba(15,118,110,.08)' }}>
                  <div style={{ color: '#075b6b', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
                  <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, fontWeight: 700 }}>{text}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(260px,.85fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(20,184,166,.22)', borderRadius: 18, background: '#ffffff', padding: 22 }}>
                <div style={{ color: '#0f766e', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Shop by Goal</div>
                <p style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.7, margin: '0 0 14px' }}>
                  Explore Aurora's wellness categories, from weight management and recovery to performance, longevity, and essentials.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from(new Set(categories.slice(0, 8).map(auroraCategoryLabel))).map((label) => {
                    const sourceCategory = categories.find((cat) => auroraCategoryLabel(cat) === label) ?? 'All';
                    return (
                    <button key={label} type="button" className="btn btn-sm btn-outline" onClick={() => setCategory(sourceCategory)} style={{ borderColor: 'rgba(20,184,166,.34)', color: '#0f766e', borderRadius: 999 }}>
                      {label}
                    </button>
                    );
                  })}
                </div>
              </div>
              <div id="aurora-quality" style={{ border: '1px solid rgba(20,184,166,.26)', borderRadius: 18, background: 'linear-gradient(135deg,#ecfeff,#ffffff)', padding: 22 }}>
                <div style={{ color: '#075b6b', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Quality Standards</div>
                <p style={{ color: '#334155', fontWeight: 700, lineHeight: 1.7, margin: 0 }}>
                  Aurora emphasizes COA access, batch documentation, transparent standards, discreet fulfillment, and a clean ordering experience.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(14,165,233,.18)', borderRadius: 18, background: 'rgba(240,253,250,.76)', padding: 22 }}>
                <div style={{ color: '#0369a1', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Recurring Orders</div>
                <p style={{ color: '#334155', fontWeight: 700, lineHeight: 1.7, margin: 0 }}>
                  Returning customers can sign in to view past orders, saved details, and request repeat catalog orders more easily.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(20,184,166,.24)', borderRadius: 18, background: '#ffffff', padding: 22 }}>
                <div style={{ color: '#0f766e', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Order Support</div>
                <p style={{ color: '#334155', fontWeight: 700, lineHeight: 1.7, margin: '0 0 14px' }}>
                  Need help with an order or repeat purchase? Sign in to your customer account to view order details and support options.
                </p>
                <Link className="btn btn-primary btn-sm" to="/login?portal=patient&brand=aurora&returnTo=%2Faurora" style={{ background: '#0f766e', borderColor: '#0f766e' }}>
                  Customer Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!isGuyPortal && (
      <section id={isAlphaPortal ? 'alphapride-products' : isOptimaxPortal ? 'optimax-products' : isRoninPortal ? 'ronin-products' : isAgPrimePortal ? 'agprime-products' : isVyigenixPortal ? 'vyigenix-products' : isRockPhormPortal ? 'rockphorm-products' : isAuroraPortal ? 'aurora-products' : isZenoraPortal ? 'zenora-products' : isPhysioPeptidesPortal ? 'physiopeptides-products' : isGintoPortal ? 'ginto-products' : isBeastModePortal ? 'beastmode-products' : isAnatoliaPortal ? 'anatolia-products' : undefined} className={isGintoPortal ? 'ginto-lux-products-section' : isBeastModePortal ? 'beastmode-products-section' : isRockPhormLuxuryFamily ? 'rock-lux-products-section' : undefined} style={{ background: isGintoPortal ? '#050505' : isBeastModePortal ? '#050505' : isRockPhormLuxuryFamily ? 'linear-gradient(180deg,#fffaf4,#f0fbf8)' : isRoninPortal ? 'linear-gradient(180deg,#090a0e,#111217)' : isAuroraPortal ? 'linear-gradient(180deg,#f8fffd,#eefcff)' : isZenoraPortal ? 'linear-gradient(180deg,#070604,#14100a)' : isVyigenixPortal ? 'linear-gradient(180deg,#050708,#101418)' : isAlphaPortal ? '#0b0b0a' : isAgPrimePortal ? '#f1f5f9' : isAnatoliaPortal ? '#f4f8f7' : isPhysioPeptidesPortal ? '#f6fffb' : '#f4f6f9', padding: isGintoPortal ? 'clamp(38px, 6vw, 70px) 0' : isBeastModePortal ? '44px 0 72px' : isRockPhormLuxuryFamily ? 'clamp(42px, 7vw, 74px) 0' : isRockPhormPortal || isAuroraPortal || isPhysioPeptidesPortal || isAnatoliaPortal ? '28px 0 34px' : '32px 0 64px' }}>
        <div className="container">
          {isOptimaxPortal && (
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: '0 0 6px', color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>
                Available Peptide Options
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 700 }}>
                Retail pricing shown. Checkout stays connected to Optimax Peptide Therapy.
              </p>
            </div>
          )}

          {isRockPhormLuxuryFamily && (
            <div className="rock-lux-audience-sections">
              {luxuryAudienceSections.map((section) => (
                <section key={section.id} id={section.id} className="rock-lux-audience-card">
                  <div className="rock-lux-audience-heading">
                    <span>{section.eyebrow}</span>
                    <h2>{section.title}</h2>
                    <p>{section.intro}</p>
                  </div>
                  <div className="rock-lux-stack-grid">
                    {section.stacks.map((stack) => (
                      <article key={`${section.id}-${stack.title}`} className="rock-lux-stack-card">
                        <div className="rock-lux-stack-kicker">{stack.title}</div>
                        <p>{stack.copy}</p>
                        <div className="rock-lux-stack-products">
                          {stack.matchedProducts.map((product) => {
                            const metadata = getProductMetadata(product);
                            return (
                              <button
                                key={`${section.id}-${stack.title}-${product.id}`}
                                type="button"
                                className="rock-lux-stack-product"
                                onClick={() => focusLuxuryCatalogProduct(product)}
                              >
                                <span>{metadata.commonName}</span>
                                <strong>{formatRetailPrice(product.displayPrice)}</strong>
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Search + category filters */}
          <div style={{ background: isGintoPortal ? 'linear-gradient(145deg,rgba(19,18,16,.96),rgba(5,5,5,.96))' : isBeastModePortal ? 'linear-gradient(145deg,rgba(24,24,27,.96),rgba(5,5,5,.98))' : isRockPhormLuxuryFamily ? 'rgba(255,255,255,.86)' : isGuyPortal ? 'rgba(255,255,255,.96)' : isRoninPortal ? '#15171c' : isZenoraPortal ? '#16110a' : isVyigenixPortal ? '#11161a' : isAlphaPortal ? '#fffaf0' : '#fff', borderRadius: isRockPhormLuxuryFamily || isBeastModePortal ? 8 : 14, border: isGintoPortal ? '1px solid rgba(200,169,106,.28)' : isBeastModePortal ? '1px solid rgba(193,18,31,.34)' : isRockPhormLuxuryFamily ? '1px solid rgba(184,138,61,.22)' : isGuyPortal ? '1px solid rgba(103,232,249,.28)' : isRoninPortal ? '1px solid rgba(248,113,113,.18)' : isZenoraPortal ? '1px solid rgba(212,175,55,.28)' : isVyigenixPortal ? '1px solid rgba(37,199,217,.22)' : isAlphaPortal ? '1px solid rgba(245,158,11,.28)' : isAgPrimePortal ? '1px solid rgba(0,104,217,.18)' : isPhysioPeptidesPortal ? '1px solid rgba(20,184,166,.22)' : isAnatoliaPortal ? '1px solid rgba(0,109,119,.22)' : '1px solid var(--border)', padding: isRockPhormLuxuryFamily ? '18px 20px' : '16px 20px', marginBottom: isRockPhormLuxuryFamily ? 32 : 20, display: 'flex', gap: 12, flexDirection: 'column', boxShadow: isGintoPortal ? '0 24px 70px rgba(0,0,0,.34)' : isBeastModePortal ? '0 24px 70px rgba(0,0,0,.44), 0 0 26px rgba(193,18,31,.10)' : isRockPhormLuxuryFamily ? '0 18px 42px rgba(84,54,43,.08)' : isGuyPortal ? '0 18px 42px rgba(2,8,23,.22)' : isRoninPortal ? '0 18px 42px rgba(0,0,0,.24)' : isZenoraPortal ? '0 18px 42px rgba(0,0,0,.32)' : isVyigenixPortal ? '0 18px 42px rgba(0,0,0,.28)' : isAlphaPortal ? '0 18px 42px rgba(0,0,0,.28)' : isPhysioPeptidesPortal ? '0 12px 30px rgba(15,118,110,.10)' : isAnatoliaPortal ? '0 16px 36px rgba(11,31,51,.10)' : '0 1px 6px rgba(0,0,0,.05)' }}>
            <input
              type="search"
              className="form-input"
              placeholder={isAnatoliaPortal ? 'Peptit adı, güç veya kategori ile ara...' : isBeastModePortal ? 'Search by product, strength, or category...' : 'Search by peptide name, strength, or category...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ borderRadius: 10, background: isBeastModePortal ? '#0b0b0c' : isGintoPortal ? '#0b0b0b' : undefined, borderColor: isBeastModePortal ? 'rgba(193,18,31,.38)' : isGintoPortal ? 'rgba(200,169,106,.34)' : undefined, color: isBeastModePortal ? '#f4f4f5' : isGintoPortal ? '#fffaf0' : undefined }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {!isRobertPortal && (
                <div style={{ fontSize: 12, color: isGuyPortal ? '#075985' : isZenoraPortal ? '#fef3c7' : isVyigenixPortal ? '#baeef5' : isAnatoliaPortal ? '#0B1F33' : 'var(--text-muted)', fontWeight: 700 }}>
                  {isEmpirePortal ? 'Member pricing stays attached through checkout.' : isGuyPortal ? 'AACTIVATED-RX member pricing is applied automatically at checkout.' : isScottPortal ? 'Peak Form member pricing is applied automatically at checkout.' : isAlphaPortal ? 'Alpha Pride pricing is applied automatically at checkout.' : isOptimaxPortal ? 'Optimax retail pricing is applied automatically at checkout.' : isRoninPortal ? 'Ronin pricing is applied automatically at checkout.' : isAgPrimePortal ? 'AG Prime Lab pricing and Angel attribution stay attached through checkout.' : isVyigenixPortal ? 'Vyigenix retail pricing and VYIGENIX attribution stay attached through checkout.' : isAuroraPortal ? 'Aurora Labs preferred pricing is applied automatically at checkout.' : isZenoraPortal ? 'ZENORA pricing and JESS8 attribution stay attached under Empire Health & Wellness.' : isPhysioPeptidesPortal ? 'PhysioPeptides pricing is applied automatically at checkout.' : isBeastModePortal ? 'Select products, choose quantity, and continue to secure checkout.' : isAnatoliaPortal ? 'Anatolia kataloğu, fiyatlandırması ve ödemesi ana PepScriptRX platformuna bağlıdır.' : 'Partner catalog pricing stays attached through checkout.'}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isGintoPortal ? '#f3e2bd' : isAnatoliaPortal ? '#0B1F33' : 'var(--text-muted)', fontWeight: 700 }}>
                {isAnatoliaPortal ? 'Sırala' : 'Sort'}
                <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={{ width: 180, borderRadius: 10 }}>
                  <option value="featured">{isRockPhormLuxuryFamily ? 'Curated' : t(isAnatoliaPortal ? 'tr' : 'en', 'Featured')}</option>
                  <option value="price-asc">{t(isAnatoliaPortal ? 'tr' : 'en', 'Price: low to high')}</option>
                  <option value="price-desc">{t(isAnatoliaPortal ? 'tr' : 'en', 'Price: high to low')}</option>
                  <option value="alpha">{t(isAnatoliaPortal ? 'tr' : 'en', 'Alphabetical')}</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${category === 'All' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCategory('All')}
                style={portalCategoryButtonStyle(category === 'All', isRoninPortal, isVyigenixPortal, isZenoraPortal, isRockPhormLuxuryFamily, isGintoPortal, isBeastModePortal)}
              >
                {t(isAnatoliaPortal ? 'tr' : 'en', 'All')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCategory(cat)}
                    style={portalCategoryButtonStyle(category === cat, isRoninPortal, isVyigenixPortal, isZenoraPortal, isRockPhormLuxuryFamily, isGintoPortal, isBeastModePortal)}
                >
                  {categoryIcon(cat, isAgPrimePortal)} {isBeastModePortal ? beastModeCategoryLabel(cat) : isAuroraPortal ? auroraCategoryLabel(cat) : categoryLabel(cat, isAgPrimePortal, isAnatoliaPortal)}
                </button>
              ))}
            </div>
          </div>

          {isRockPhormPortal && (
            <AddedToCartInlineNotice
              product={addedProduct}
              onContinue={() => setAddedProductId(null)}
              onViewCart={() => {
                setAddedProductId(null);
                setCartOpen(true);
              }}
            />
          )}

          {/* Main layout: product grid + cart sidebar */}
          <div className="portal-products-layout" style={{ display: 'grid', gridTemplateColumns: count > 0 && !isAgPrimePortal ? 'minmax(0,1fr) 340px' : '1fr', gap: 20, alignItems: 'start' }}>

            {/* Product grid */}
            <div>
              {visibleProducts.length === 0 ? (
                <div role="status" style={{ background: '#fff', borderRadius: 14, padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 16 }}>{isAnatoliaPortal ? 'Ürün bulunamadı' : 'No products found'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>{isAnatoliaPortal ? 'Farklı bir arama veya kategori filtresi deneyin.' : 'Try a different search or category filter.'}</div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setCategory('All'); }} style={{ marginTop: 14 }}>
                    {isAnatoliaPortal ? 'Arama ve filtreleri temizle' : 'Clear Search and Filters'}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: isBeastModePortal ? '#a1a1aa' : isGintoPortal ? '#d8c693' : isGuyPortal ? 'rgba(255,255,255,.68)' : isRoninPortal ? 'rgba(226,232,240,.68)' : isZenoraPortal ? 'rgba(254,243,199,.76)' : isVyigenixPortal ? 'rgba(226,232,240,.72)' : isAlphaPortal ? 'rgba(250,204,21,.72)' : isAnatoliaPortal ? '#0B1F33' : 'var(--text-muted)', fontWeight: 700, marginBottom: 14 }}>
                    {isAnatoliaPortal ? `${visibleProducts.length} ürün gösteriliyor` : isBeastModePortal ? `Showing ${visibleProducts.length} product${visibleProducts.length !== 1 ? 's' : ''}` : `Showing ${visibleProducts.length} treatment${visibleProducts.length !== 1 ? 's' : ''}`}{category !== 'All' ? ` - ${isBeastModePortal ? beastModeCategoryLabel(category) : isAuroraPortal ? auroraCategoryLabel(category) : categoryLabel(category, isAgPrimePortal, isAnatoliaPortal)}` : ''}
                  </div>
                  <div className={isGintoPortal ? 'ginto-lux-product-grid' : isBeastModePortal ? 'beastmode-product-grid' : isRockPhormLuxuryFamily ? 'rock-lux-product-grid' : undefined} style={{ display: 'grid', gridTemplateColumns: isGintoPortal || isBeastModePortal ? 'repeat(auto-fit, minmax(270px, 1fr))' : isRockPhormLuxuryFamily ? 'repeat(auto-fit, minmax(280px, 1fr))' : isGuyPortal ? 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isGintoPortal ? 22 : isBeastModePortal ? 20 : isRockPhormLuxuryFamily ? 20 : isGuyPortal ? 28 : 14 }}>
                    {visibleProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        qty={cart[product.id] ?? 0}
                        onQtyChange={setQty}
                        onAdd={addToCart}
                        onViewCart={isRockPhormPortal ? () => setCartOpen(true) : undefined}
                        onLearnMore={setDetailProduct}
                        showDiscount={isEmpirePortal || isGuyPortal || isAlphaPortal || isRoninPortal || isAgPrimePortal || isVyigenixPortal || isRockPhormPortal || isAuroraPortal || isZenoraPortal || isPhysioPeptidesPortal || isBeastModePortal || isAnatoliaPortal}
                        isMarkPortal={isEmpirePortal}
                        isGuyPortal={isGuyPortal}
                        isRobertPortal={isRobertPortal}
                        isScottPortal={isScottPortal}
                        isAlphaPortal={isAlphaPortal}
                        isOptimaxPortal={isOptimaxPortal}
                        isRoninPortal={isRoninPortal}
                        isAgPrimePortal={isAgPrimePortal}
                        isVyigenixPortal={isVyigenixPortal}
                        isRockPhormPortal={isRockPhormPortal}
                        isAuroraPortal={isAuroraPortal}
                        isZenoraPortal={isZenoraPortal}
                        isPhysioPeptidesPortal={isPhysioPeptidesPortal}
                        isGintoPortal={isGintoPortal}
                        isAnatoliaPortal={isAnatoliaPortal}
                        isBeastModePortal={isBeastModePortal}
                        portalPath={portalConfig?.path}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sticky cart sidebar — desktop, only shown when cart has items */}
            {count > 0 && !isAgPrimePortal && (
              <div className="portal-cart-sidebar" style={{ position: 'sticky', top: 24 }}>
                <div style={{ background: '#fff', borderRadius: 16, border: '2px solid var(--teal)', boxShadow: '0 8px 32px rgba(37,199,217,.12)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--navy)', padding: '18px 20px' }}>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{isAnatoliaPortal ? 'Siparişiniz' : 'Your Order'}</div>
                    <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>{isAnatoliaPortal ? `${count} ürün` : `${count} item${count !== 1 ? 's' : ''}`}</div>
                  </div>
                  <div style={{ padding: '10px 16px', maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cartEntries(cart, products).map(({ product, qty }) => {
                      const metadata = getProductMetadata(product);
                      return (
                      <div key={product.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13, lineHeight: 1.3 }}>{product.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{product.strength}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{isAnatoliaPortal ? 'Teknik ad' : 'Technical'}: {metadata.technicalName}</div>
                          <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700, marginTop: 3 }}>{formatRetailPrice(product.displayPrice ? product.displayPrice * qty : null)}</div>
                        </div>
                        <Stepper value={qty} label={product.product_name} onChange={(v) => setQty(product.id, v)} />
                      </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--card-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{isAnatoliaPortal ? 'Ara toplam' : 'Subtotal'}</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>${cartSubtotal(cart, products).toFixed(2)}</span>
                    </div>
                    {bundleDiscountSummary(cart, products).rows.map((row) => (
                      <div key={row.groupKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#0f766e', fontWeight: 800, marginBottom: 4 }}>
                         <span>{row.groupName} {isAnatoliaPortal ? 'paket indirimi' : 'bundle savings'}</span>
                        <span>-${row.discount.toFixed(2)}</span>
                      </div>
                    ))}
                    {supportsDiscountCode && (
                      <div style={{ display: 'grid', gap: 8, margin: '12px 0', padding: 10, border: '1px solid rgba(8,145,178,.18)', borderRadius: 10, background: '#fff' }}>
                        <div style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 900 }}>{isAnatoliaPortal ? 'İndirim kodu' : 'Discount code'}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="form-input"
                            value={discountCodeInput}
                            onChange={(event) => setDiscountCodeInput(normalizeAactivatedDiscountCode(event.target.value))}
                            placeholder={isAnatoliaPortal ? 'Kodu girin' : 'Enter code'}
                            autoCapitalize="characters"
                            style={{ minWidth: 0 }}
                          />
                          <button className="btn btn-outline btn-sm" type="button" onClick={applyAactivatedDiscountCode} disabled={discountCodeApplying}>
                            {discountCodeApplying ? (isAnatoliaPortal ? 'Kontrol ediliyor...' : 'Checking...') : (isAnatoliaPortal ? 'Uygula' : 'Apply')}
                          </button>
                        </div>
                        {discountCodeMessage && (
                          <div style={{ fontSize: 12, color: appliedPromoDiscount > 0 ? '#047857' : appliedPromo?.product_id && !cart[appliedPromo.product_id] ? '#a16207' : 'var(--text-muted)', fontWeight: 800 }}>
                            {discountCodeMessage}
                          </div>
                        )}
                      </div>
                    )}
                    {supportsDiscountCode && appliedPromoDiscount > 0 && appliedPromo && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#0f766e', fontWeight: 900, marginBottom: 6 }}>
                        <span>{isAnatoliaPortal ? 'Kod' : 'Code'} {appliedPromo.discount_code}</span>
                        <span>-${appliedPromoDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>{isAnatoliaPortal ? 'Toplam' : 'Total'}</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${total.toFixed(2)}</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '13px 0', borderRadius: 10 }}
                      onClick={handleCheckout}
                    >
                      {isAnatoliaPortal ? 'Ödemeye Devam Et' : 'Continue to Secure Checkout'} →
                    </button>
                    <button
                      type="button"
                      onClick={clearCart}
                      style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '7px 0' }}
                    >
                      {isAnatoliaPortal ? 'Sepeti Temizle' : 'Clear Cart'}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                      {isAnatoliaPortal ? 'Güvenli ödeme kullanılabilir. Teslimat süresi doğrulama sonrası onaylanır.' : 'Secure checkout available. Fulfillment timing is confirmed after verification.'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating cart bar — mobile, shown when cart has items */}
          {isGintoPortal && (
            <section style={{ marginTop: 38, border: '1px solid rgba(29,78,216,.16)', borderRadius: 14, background: 'linear-gradient(135deg,#ffffff,#eff6ff)', padding: 22, boxShadow: '0 14px 34px rgba(29,78,216,.08)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(280px,1.1fr)', gap: 18, alignItems: 'start' }} className="portal-welcome-grid">
                <div>
                  <div style={{ color: '#b45309', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Mixing calculator</div>
                  <h2 style={{ margin: '0 0 10px', color: '#061425', fontSize: 26, fontWeight: 900 }}>Mixing support</h2>
                  <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px', fontWeight: 650 }}>
                    Use the calculator as an educational double-check only. Always follow the instructions from the dispensing pharmacy or licensed provider.
                  </p>
                  <Link className="btn btn-outline" to={`${GINTO_PORTAL_PATH}/mixing`} style={{ color: '#1d4ed8', borderColor: 'rgba(29,78,216,.28)', background: '#fff', fontWeight: 900 }}>
                    Open Full Mixing Center
                  </Link>
                </div>
                <div style={{ background: '#fff', border: '1px solid rgba(29,78,216,.14)', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Vial mg<input className="form-input" type="number" min="1" value={calcMg} onChange={(e) => setCalcMg(Number(e.target.value))} /></label>
                    <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Water mL<input className="form-input" type="number" min="0.1" step="0.1" value={calcMl} onChange={(e) => setCalcMl(Number(e.target.value))} /></label>
                    <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Dose unit<select className="form-input" value={calcDoseUnit} onChange={(e) => setCalcDoseUnit(e.target.value as 'mg' | 'mcg')}><option value="mg">mg</option><option value="mcg">mcg</option></select></label>
                    <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Desired dose ({calcDoseUnit})<input className="form-input" type="number" min="0" step={calcDoseUnit === 'mg' ? '0.01' : '1'} value={calcDose} onChange={(e) => setCalcDose(Number(e.target.value))} /></label>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid rgba(245,158,11,.24)', borderRadius: 10, padding: 14, marginTop: 14 }}>
                    <div style={{ color: '#92400e', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Mixed concentration</div>
                    <div style={{ color: '#061425', fontSize: 28, fontWeight: 900 }}>{Number.isFinite(calcMgPerMl) ? calcMgPerMl.toFixed(2) : '0.00'} mg/mL</div>
                    <div style={{ color: '#92400e', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', marginTop: 12 }}>Estimated draw</div>
                    <div style={{ color: '#0f2f6f', fontSize: 23, fontWeight: 900 }}>{Number.isFinite(calcDrawMl) ? calcDrawMl.toFixed(2) : '0.00'} mL / {Number.isFinite(calcUnits) ? calcUnits.toFixed(1) : '0.0'} units</div>
                    <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>Educational calculator only. Follow licensed-provider and pharmacy instructions.</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {count > 0 && !isAgPrimePortal && !isRockPhormPortal && (
            <div style={{
              position: 'fixed',
              bottom: isRockPhormPortal ? 'max(14px, env(safe-area-inset-bottom))' : 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: isRockPhormPortal ? 1102 : 100,
              display: 'none',
              width: isRockPhormPortal ? 'min(360px, calc(100vw - 24px))' : undefined,
            }} className="cart-float-bar">
              {isRockPhormPortal && (
                <div style={{ background: '#020617', color: '#fff', border: '1px solid rgba(20,184,166,.5)', borderRadius: 16, padding: 12, boxShadow: '0 14px 38px rgba(2,6,23,.36)', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', fontSize: 13, fontWeight: 900 }}>
                    <span>{count} item{count !== 1 ? 's' : ''} in cart</span>
                    <span style={{ color: '#67e8f9' }}>${total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button type="button" onClick={() => setAddedProductId(null)} style={{ border: '1px solid rgba(148,163,184,.52)', borderRadius: 10, background: 'rgba(15,23,42,.9)', color: '#f8fafc', fontSize: 13, fontWeight: 900, padding: '11px 8px' }}>
                      Continue Shopping
                    </button>
                    <button type="button" onClick={() => { setAddedProductId(null); setCartOpen(true); }} style={{ border: 'none', borderRadius: 10, background: '#14b8c6', color: '#031321', fontSize: 13, fontWeight: 900, padding: '11px 8px' }}>
                      View Cart
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 14,
                  padding: '14px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(0,0,0,.25)', display: isRockPhormPortal ? 'none' : 'flex', alignItems: 'center', gap: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🛒 {isAnatoliaPortal ? `${count} ürün` : `${count} item${count !== 1 ? 's' : ''}`}</span>
                <span style={{ borderLeft: '1px solid rgba(255,255,255,.25)', paddingLeft: 14, color: isAnatoliaPortal ? '#D4AF37' : '#25C7D9', fontSize: 17 }}>${total.toFixed(2)}</span>
                <span style={{ color: isAnatoliaPortal ? '#D4AF37' : '#25C7D9' }}>{isAnatoliaPortal ? 'Ödeme' : 'Checkout'} →</span>
              </button>
            </div>
          )}

          <div style={{ marginTop: isRockPhormLuxuryFamily ? 32 : isRockPhormPortal ? 24 : 48, padding: '20px 24px', background: isRockPhormLuxuryFamily ? 'rgba(255,255,255,.84)' : '#fff', borderRadius: isRockPhormLuxuryFamily ? 8 : 12, border: isRockPhormLuxuryFamily ? '1px solid rgba(184,138,61,.22)' : isAnatoliaPortal ? '1px solid rgba(0,109,119,.22)' : '1px solid var(--border)', fontSize: 12, color: isAnatoliaPortal ? '#334155' : 'var(--text-muted)', lineHeight: 1.8, boxShadow: isRockPhormLuxuryFamily ? '0 16px 34px rgba(84,54,43,.08)' : isAnatoliaPortal ? '0 14px 34px rgba(11,31,51,.08)' : undefined }}>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 6 }}>{isAnatoliaPortal ? 'Önemli Uyarı' : 'Important Notice'}</strong>
            {isAnatoliaPortal ? (
              <>
                Tüm ürünler lisanslı bir sağlık uzmanının gözetiminde kullanılmaya yönelik bileşik peptitlerdir.
                Anatolia Wellness Labs ve PepScriptRX tıbbi tavsiye, tanı veya tedavi sunmaz.
                Ürün bulunurluğu, fiyatlandırma ve gönderim standart doğrulama süreçlerine ve geçerli eyalet düzenlemelerine tabidir.
                Siparişler gönderimden önce uygunluk veya eyalet bulunurluğu kontrolü gerektirebilir. Tüm ürünler her eyalette mevcut olmayabilir.
              </>
            ) : (
              <>
                All products are compounded peptides intended for use under the supervision of a licensed healthcare provider.
                {isGuyPortal
                  ? 'AACTIVATEDRX does not provide medical advice, diagnosis, or treatment.'
                  : `${isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : isAgPrimePortal ? 'AG Prime Lab' : isVyigenixPortal ? 'Vyigenix Pharmaceuticals' : isRockPhormPortal ? 'Rock Phorm' : isAuroraPortal ? 'Aurora Labs' : isZenoraPortal ? 'ZENORA' : isPhysioPeptidesPortal ? PHYSIOPEPTIDES_STORE_NAME : isGintoPortal ? GINTO_STORE_NAME : isBeastModePortal ? BEASTMODE_STORE_NAME : 'Empire Health & Wellness'} and PepScriptRX do not provide medical advice, diagnosis, or treatment.`}
                Product availability, pricing, and fulfillment are subject to standard verification and applicable state regulations.
                Orders may require eligibility or state-availability checks before shipment. Not all products are available in every state.
              </>
            )}
            <div style={{ color: isRoninPortal ? '#fecaca' : isZenoraPortal ? '#a16207' : isAlphaPortal ? '#a16207' : isRobertPortal ? '#92400e' : isAnatoliaPortal ? '#006D77' : 'var(--text-muted)', fontWeight: 800, marginTop: 8 }}>
              {portalPoweredByLabel(isEmpirePortal, isGuyPortal, isRobertPortal, isOptimaxPortal, isAlphaPortal, isRoninPortal, isAgPrimePortal, isVyigenixPortal, isRockPhormPortal, isZenoraPortal, isAuroraPortal, isPhysioPeptidesPortal, isGintoPortal, isAnatoliaPortal, isBeastModePortal)}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
              <a href={privacyPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>{isAnatoliaPortal ? 'Gizlilik Politikası' : 'Privacy Policy'}</a>
              <a href={termsPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>{isAnatoliaPortal ? 'Kullanım Şartları' : 'Terms & Conditions'}</a>
              <a href={certificatesPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>{isAnatoliaPortal ? 'Kalite Belgeleri' : 'Quality Documents'}</a>
            </div>
          </div>
        </div>
      </section>
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={closeDetailProduct}
        onAdd={addToCart}
        isMarkPortal={isEmpirePortal}
        isGuyPortal={isGuyPortal}
        isRobertPortal={isRobertPortal}
        isScottPortal={isScottPortal}
        isAlphaPortal={isAlphaPortal}
        isOptimaxPortal={isOptimaxPortal}
        isRoninPortal={isRoninPortal}
        isAgPrimePortal={isAgPrimePortal}
        isVyigenixPortal={isVyigenixPortal}
        isRockPhormPortal={isRockPhormPortal}
        isAuroraPortal={isAuroraPortal}
        isZenoraPortal={isZenoraPortal}
        isPhysioPeptidesPortal={isPhysioPeptidesPortal}
        isGintoPortal={isGintoPortal}
        isAnatoliaPortal={isAnatoliaPortal}
        isBeastModePortal={isBeastModePortal}
        portalPath={portalConfig?.path}
      />

      {/* Cart drawer (mobile) */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        showDiscountCode={supportsDiscountCode}
        cart={cart}
        products={products}
        discountCodeInput={discountCodeInput}
        discountCodeMessage={discountCodeMessage}
        discountCodeApplying={discountCodeApplying}
        appliedPromo={appliedPromo}
        promoDiscountAmount={appliedPromoDiscount}
        onQtyChange={setQty}
        onClear={clearCart}
        onDiscountCodeInputChange={(value) => setDiscountCodeInput(normalizeAactivatedDiscountCode(value))}
        onApplyDiscountCode={applyAactivatedDiscountCode}
        onCheckout={() => { setCartOpen(false); handleCheckout(); }}
        isAnatoliaPortal={isAnatoliaPortal}
      />

      {!isRockPhormPortal && (
        <AddedToCartModal
          product={addedProduct}
          onContinue={() => setAddedProductId(null)}
          onViewCart={() => {
            setAddedProductId(null);
            setCartOpen(true);
          }}
          onCheckout={() => {
            setAddedProductId(null);
            handleCheckout();
          }}
          isAnatoliaPortal={isAnatoliaPortal}
        />
      )}

      <style>{`
        .agprime-cart-corner {
          position: fixed;
          top: 88px;
          right: 18px;
          z-index: 950;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 52px;
          padding: 10px 14px 10px 10px;
          border: 1px solid rgba(0,104,217,.22);
          border-radius: 8px;
          background: rgba(255,255,255,.94);
          color: #061425;
          box-shadow: 0 18px 44px rgba(15,23,42,.18);
          cursor: pointer;
          backdrop-filter: blur(16px);
        }
        .agprime-cart-corner:hover {
          border-color: rgba(0,104,217,.42);
          transform: translateY(-1px);
          box-shadow: 0 22px 52px rgba(15,23,42,.22);
        }
        .aactivated-cart-corner {
          top: 82px;
          border-color: rgba(37,199,217,.42);
          background: rgba(6,16,31,.96);
          color: #f8fafc;
          box-shadow: 0 18px 44px rgba(6,16,31,.26), 0 0 0 1px rgba(37,199,217,.16);
        }
        .aactivated-cart-corner:hover {
          border-color: rgba(37,199,217,.7);
          box-shadow: 0 22px 54px rgba(6,16,31,.34), 0 0 0 1px rgba(37,199,217,.28);
        }
        .agprime-cart-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: linear-gradient(135deg,#0068d9,#0b8bff);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .agprime-cart-text {
          display: grid;
          gap: 2px;
          text-align: left;
          line-height: 1.1;
        }
        .agprime-cart-text strong {
          color: #061425;
          font-size: 14px;
          font-weight: 900;
        }
        .agprime-cart-text small {
          color: #0068d9;
          font-size: 12px;
          font-weight: 800;
        }
        .aactivated-cart-corner .agprime-cart-icon {
          background: linear-gradient(135deg,#25C7D9,#0891b2);
          color: #03121d;
        }
        .aactivated-cart-corner .agprime-cart-text strong {
          color: #f8fafc;
        }
        .aactivated-cart-corner .agprime-cart-text small {
          color: #67e8f9;
        }
        .aactivated-search-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .aactivated-category-filters .btn-outline {
          background: #ffffff;
          border-color: rgba(7, 89, 133, .36);
          color: #075985;
          box-shadow: 0 4px 12px rgba(15, 23, 42, .05);
        }
        .aactivated-category-filters .btn-outline:hover,
        .aactivated-category-filters .btn-outline:focus-visible {
          background: #ecfeff;
          border-color: #0891b2;
          color: #0c4a6e;
        }
        .aactivated-category-filters .btn-primary {
          background: #075985;
          border-color: #075985;
          color: #ffffff;
        }
        .aactivated-search-row .form-input:focus,
        .aactivated-search-row .btn:focus-visible,
        .aactivated-category-filters .btn:focus-visible,
        .aactivated-catalog-menu [role="menuitem"]:focus-visible,
        .portal-qty-stepper-btn:focus-visible {
          outline: 3px solid rgba(37, 199, 217, .45);
          outline-offset: 2px;
        }
        .portal-qty-stepper-btn-minus {
          background: #f8fafc;
          color: #0f172a;
        }
        .portal-qty-stepper-btn-minus:hover {
          background: #e2e8f0;
        }
        .portal-qty-stepper-btn-plus {
          background: #047c89;
          color: #ffffff;
        }
        .portal-qty-stepper-btn-plus:hover {
          background: #075985;
        }
        .portal-qty-stepper-btn:disabled {
          cursor: not-allowed;
          opacity: .62;
        }
        .aactivated-product-card {
          position: relative;
          overflow: hidden;
          min-height: 410px;
          border-radius: 20px;
          background: linear-gradient(145deg, #ffffff 0%, #f8fdff 46%, #e8f8fb 100%);
          border: 2px solid rgba(103,232,249,.75);
          box-shadow: 0 18px 46px rgba(2,8,23,.32);
          display: flex;
          flex-direction: column;
          isolation: isolate;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .aactivated-product-card:hover {
          transform: translateY(-2px);
          border-color: #25C7D9;
          box-shadow: 0 24px 54px rgba(2,8,23,.34);
        }
        .aactivated-product-card.in-cart {
          border-width: 3px;
          border-color: #25C7D9;
          box-shadow: 0 20px 48px rgba(37,199,217,.28);
        }
        .aactivated-product-card-frame {
          position: absolute;
          inset: 8px;
          border-radius: 16px;
          border: 1px solid rgba(8,145,178,.24);
          pointer-events: none;
          z-index: 2;
        }
        .aactivated-product-card-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 82% 22%, rgba(103,232,249,.32), transparent 32%), radial-gradient(circle at 70% 68%, rgba(125,211,252,.18), transparent 34%);
          z-index: 0;
          pointer-events: none;
        }
        .aactivated-card-content {
          position: relative;
          z-index: 3;
          padding: 20px 20px 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .aactivated-card-header {
          min-height: 64px;
          display: grid;
          grid-template-columns: minmax(130px, 1fr) minmax(116px, 144px);
          align-items: start;
          gap: 14px;
        }
        .aactivated-card-logo {
          width: min(148px, 100%);
          height: 44px;
          object-fit: contain;
          object-position: left center;
          filter: drop-shadow(0 5px 12px rgba(8,145,178,.12));
        }
        .aactivated-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(120px, 34%);
          gap: clamp(12px, 2vw, 22px);
          align-items: center;
          flex: 1;
        }
        .aactivated-card-copy {
          min-width: 0;
          display: grid;
          align-content: start;
        }
        .aactivated-top-seller-badge {
          display: inline-flex;
          width: fit-content;
          font-size: 10px;
          color: #064e3b;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          background: #d1fae5;
          border: 1px solid rgba(16,185,129,.22);
          border-radius: 999px;
          padding: 5px 8px;
          white-space: nowrap;
          margin-bottom: 10px;
        }
        .aactivated-card-category {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          min-width: 0;
        }
        .aactivated-card-category span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid rgba(8,145,178,.36);
          color: #0891b2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          flex-shrink: 0;
        }
        .aactivated-card-category strong {
          min-width: 0;
          color: #0f3654;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .aactivated-card-title {
          margin: 0 0 10px;
          color: #07172d;
          font-size: clamp(25px, 3vw, 34px);
          line-height: 1.02;
          font-weight: 950;
        }
        .aactivated-card-strength {
          color: #0891b2;
          font-size: 22px;
          line-height: 1.05;
          font-weight: 900;
          margin: -6px 0 12px;
        }
        .aactivated-card-rule {
          width: min(88%, 300px);
          height: 2px;
          background: linear-gradient(90deg,#0891b2,#67e8f9,transparent);
          margin-bottom: 10px;
        }
        .aactivated-card-price {
          color: #061425;
          font-size: clamp(36px, 4vw, 48px);
          line-height: .95;
          font-weight: 950;
          letter-spacing: 0;
        }
        .aactivated-card-note {
          width: fit-content;
          max-width: 100%;
          margin-top: 8px;
          padding: 7px 9px;
          border-radius: 8px;
          border: 1px solid rgba(8,145,178,.22);
          background: rgba(236,254,255,.86);
          color: #075985;
          font-size: 11px;
          font-weight: 850;
          line-height: 1.3;
        }
        .aactivated-card-meta {
          display: grid;
          gap: 6px;
          margin-top: 10px;
          color: #0f3654;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.35;
        }
        .aactivated-card-meta div:first-child {
          color: #075985;
          font-weight: 900;
        }
        .aactivated-card-actions {
          position: relative;
          z-index: 4;
          padding: 0 20px 20px;
        }
        .aactivated-card-actions-mobile {
          display: none;
          padding: 0;
          margin-top: 14px;
        }
        .aactivated-card-actions-desktop {
          display: block;
        }
        .aactivated-card-image-shell {
          align-self: stretch;
          min-height: 210px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: radial-gradient(circle at 50% 52%, rgba(255,255,255,.68), rgba(103,232,249,.12) 60%, transparent 72%);
          overflow: hidden;
        }
        .aactivated-card-image {
          width: min(100%, 190px);
          height: min(250px, 100%);
          object-fit: contain;
          filter: drop-shadow(0 24px 28px rgba(2,8,23,.22));
        }
        .agprime-brand-showcase {
          position: relative;
          display: block;
          width: min(640px, 92vw);
          min-height: 0;
          margin: 0 0 26px;
        }
        .agprime-brand-card {
          position: relative;
          z-index: 2;
          width: 100%;
          padding: clamp(22px, 4vw, 36px);
          border: 1px solid rgba(0,104,217,.18);
          border-radius: 8px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.99), rgba(248,250,252,.97)),
            radial-gradient(circle at 86% 14%, rgba(0,104,217,.14), transparent 36%);
          box-shadow: 0 30px 80px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95);
          backdrop-filter: blur(18px);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .agprime-brand-card::before {
          content: "";
          position: absolute;
          inset: 10px;
          border: 1px solid rgba(0,104,217,.08);
          border-radius: 6px;
          pointer-events: none;
        }
        .agprime-logo-shell {
          position: relative;
          display: grid;
          place-items: center;
          min-height: clamp(180px, 24vw, 260px);
          padding: clamp(16px, 3vw, 28px);
          border-radius: 6px;
          background:
            radial-gradient(circle at 50% 42%, #ffffff 0%, #ffffff 44%, #f8fafc 72%, #e2e8f0 100%),
            linear-gradient(145deg, #ffffff, #eef2f7);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.95), 0 18px 38px rgba(15,23,42,.08);
          overflow: hidden;
        }
        .agprime-logo-shell::after {
          content: "";
          position: absolute;
          left: 10%;
          right: 10%;
          bottom: 9%;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(6,20,37,.72), rgba(0,104,217,.88), transparent);
        }
        .agprime-brand-logo {
          position: relative;
          z-index: 1;
          display: block;
          width: min(460px, 92%);
          height: auto;
          filter: contrast(1.04) saturate(1.04) drop-shadow(0 16px 24px rgba(15,23,42,.10));
        }
        .agprime-brand-rule {
          height: 4px;
          width: min(360px, 70%);
          margin: 18px 0 16px;
          border-radius: 999px;
          background: linear-gradient(90deg,#061425,#0068d9);
        }
        .agprime-brand-copy {
          display: grid;
          gap: 5px;
        }
        .agprime-brand-copy span {
          color: #0068d9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .agprime-brand-copy strong {
          color: #061425;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
        }
        .agprime-brand-copy small {
          color: #475569;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.45;
        }
        .vyigenix-brand-showcase {
          position: relative;
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(150px, 210px);
          align-items: center;
          gap: clamp(18px, 4vw, 34px);
          width: min(780px, 92vw);
          min-height: 260px;
          margin: 0 0 28px;
          padding: 16px 0 4px;
        }
        .vyigenix-logo-panel {
          position: relative;
          z-index: 2;
          width: min(520px, 100%);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }
        .vyigenix-logo-panel img {
          display: block;
          width: 100%;
          height: auto;
          mix-blend-mode: screen;
          filter: drop-shadow(0 18px 42px rgba(0,0,0,.44)) drop-shadow(0 0 24px rgba(37,199,217,.2));
        }
        .vyigenix-hero-vial {
          position: relative;
          z-index: 1;
          justify-self: center;
          height: clamp(210px, 22vw, 280px);
          max-width: 100%;
          object-fit: contain;
          filter: drop-shadow(0 30px 46px rgba(0,0,0,.44)) drop-shadow(0 0 34px rgba(37,199,217,.2));
          pointer-events: none;
        }
        .rockphorm-brand-showcase {
          position: relative;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(150px, 220px);
          align-items: center;
          gap: clamp(18px, 4vw, 34px);
          width: min(820px, 92vw);
          min-height: 280px;
          margin: 0 0 28px;
          padding: 16px 0 4px;
        }
        .rockphorm-brand-showcase::before {
          content: "";
          position: absolute;
          inset: 10% 2% 4% 24%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(20,184,166,.2), transparent 62%);
          filter: blur(6px);
          pointer-events: none;
        }
        .rockphorm-logo-panel {
          position: relative;
          z-index: 2;
          width: min(560px, 100%);
          padding: clamp(14px, 2vw, 22px);
          border: 1px solid rgba(125,249,255,.18);
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(37,99,235,.1) 45%, rgba(0,0,0,.16));
          box-shadow: 0 24px 70px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.12);
          backdrop-filter: blur(12px);
        }
        .rockphorm-logo-panel img {
          display: block;
          width: 100%;
          height: auto;
          mix-blend-mode: screen;
          filter: drop-shadow(0 18px 42px rgba(0,0,0,.46)) drop-shadow(0 0 22px rgba(20,184,166,.2));
        }
        .rockphorm-hero-vial {
          position: relative;
          z-index: 1;
          justify-self: center;
          height: clamp(220px, 24vw, 310px);
          max-width: 100%;
          object-fit: contain;
          border-radius: 16px;
          filter: drop-shadow(0 34px 52px rgba(0,0,0,.5)) drop-shadow(0 0 36px rgba(20,184,166,.22));
          pointer-events: none;
        }
        .aurora-brand-showcase {
          position: relative;
          z-index: 2;
          width: min(700px, 92vw);
          margin: 0 0 26px;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(94,234,212,.26);
          box-shadow: 0 28px 78px rgba(0,0,0,.42), 0 0 44px rgba(45,212,191,.16);
          background: rgba(3,19,33,.42);
        }
        .aurora-brand-showcase img {
          display: block;
          width: 100%;
          height: auto;
        }
        .rock-lux-hero-stack {
          width: min(1160px, 100%);
          margin: 0 auto;
        }
        .rock-lux-hero-copy {
          display: grid;
          gap: 14px;
          justify-items: center;
        }
        .rock-lux-hero .container,
        .rock-lux-products-section .container {
          position: relative;
          z-index: 1;
        }
        .rock-lux-products-section {
          position: relative;
          overflow: hidden;
        }
        .rock-lux-hero::before,
        .rock-lux-products-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(circle at 18px 18px, rgba(47,127,122,.20) 0 2px, transparent 2.6px),
            radial-gradient(circle at 34px 34px, rgba(184,138,61,.18) 0 2px, transparent 2.6px),
            repeating-linear-gradient(45deg, transparent 0 24px, rgba(184,138,61,.10) 24px 25px, transparent 25px 48px),
            repeating-linear-gradient(-45deg, transparent 0 24px, rgba(47,127,122,.08) 24px 25px, transparent 25px 48px);
          background-size: 52px 52px, 52px 52px, 96px 96px, 96px 96px;
          opacity: .42;
          mix-blend-mode: multiply;
          z-index: 0;
        }
        .rock-lux-hero::after,
        .rock-lux-products-section::after {
          content: "A R A R A R A R A R A R";
          position: absolute;
          inset: auto -12px 18px -12px;
          pointer-events: none;
          color: rgba(123,90,32,.14);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(18px, 3vw, 36px);
          letter-spacing: .48em;
          line-height: 1;
          white-space: nowrap;
          text-align: center;
          text-transform: uppercase;
          z-index: 0;
        }
        .rock-lux-hero .rockphorm-brand-showcase {
          justify-content: center;
          grid-template-columns: minmax(260px, 560px) minmax(130px, 210px);
          margin: 0 auto 18px;
          min-height: 230px;
          width: min(780px, 92vw);
        }
        .rock-lux-hero .rockphorm-logo-panel,
        .rock-lux-hero .aurora-brand-showcase {
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(184,138,61,.28);
          border-radius: 18px;
          box-shadow: 0 28px 70px rgba(84,54,43,.14);
          backdrop-filter: blur(12px);
        }
        .rock-lux-hero .rockphorm-logo-panel img {
          mix-blend-mode: multiply;
          filter: drop-shadow(0 18px 38px rgba(47,127,122,.14));
        }
        .rock-lux-hero .rockphorm-hero-vial {
          filter: drop-shadow(0 34px 52px rgba(47,37,39,.22)) drop-shadow(0 0 36px rgba(47,127,122,.16));
        }
        .rock-lux-hero .aurora-brand-showcase {
          width: min(820px, 92vw);
          margin: 0 auto 18px;
          overflow: hidden;
          background: #0d2c23;
        }
        .rock-lux-hero .aurora-brand-showcase img {
          max-height: min(78vh, 860px);
          object-fit: contain;
          background: #0d2c23;
        }
        .rock-lux-tagline {
          margin: -4px 0 0;
          color: #2f2527;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(17px, 3vw, 28px);
          letter-spacing: .08em;
          line-height: 1.25;
          text-transform: uppercase;
        }
        .rock-lux-actions-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin: 0 0 22px;
        }
        .rock-lux-gender-switch {
          width: min(520px, 100%);
          margin: 0 auto 16px;
          padding: 5px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          border: 1px solid rgba(184,138,61,.36);
          border-radius: 10px;
          background: rgba(255,255,255,.44);
          box-shadow: 0 16px 36px rgba(84,54,43,.10);
          backdrop-filter: blur(8px);
        }
        .rock-lux-gender-btn {
          min-height: 62px;
          border-radius: 7px;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          color: #2f2527;
          text-decoration: none;
          border: 1px solid transparent;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
        }
        .rock-lux-gender-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(184,138,61,.36);
          background: rgba(255,255,255,.70);
        }
        .rock-lux-gender-btn span {
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: #8a6a2f;
        }
        .rock-lux-gender-btn strong {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 17px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .rock-lux-gender-btn.active {
          background: linear-gradient(135deg,#2f7f7a,#185b59);
          color: #fff;
          border-color: rgba(255,255,255,.45);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 12px 26px rgba(47,127,122,.24);
        }
        .rock-lux-gender-btn.active span {
          color: #f4d797;
        }
        .rock-lux-audience-sections {
          display: grid;
          gap: 20px;
          margin: 0 0 28px;
        }
        .rock-lux-audience-card {
          scroll-margin-top: 18px;
          border: 1px solid rgba(184,138,61,.28);
          border-radius: 10px;
          padding: clamp(18px, 3vw, 28px);
          background:
            linear-gradient(135deg, rgba(255,255,255,.94), rgba(247,255,252,.86)),
            repeating-linear-gradient(135deg, rgba(47,127,122,.05) 0, rgba(47,127,122,.05) 1px, transparent 1px, transparent 18px);
          box-shadow: 0 20px 48px rgba(84,54,43,.10);
        }
        .rock-lux-audience-heading {
          max-width: 780px;
          margin: 0 auto 18px;
          text-align: center;
        }
        .rock-lux-audience-heading span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 5px 12px;
          border: 1px solid rgba(184,138,61,.38);
          border-radius: 999px;
          color: #7b5a20;
          background: rgba(255,255,255,.72);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .rock-lux-audience-heading h2 {
          margin: 12px 0 8px;
          color: #2f2527;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(26px, 4vw, 44px);
          font-weight: 700;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .rock-lux-audience-heading p {
          margin: 0;
          color: #725f63;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.7;
        }
        .rock-lux-stack-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .rock-lux-stack-card {
          border: 1px solid rgba(184,138,61,.24);
          border-radius: 8px;
          padding: 16px;
          background: rgba(255,255,255,.80);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
        }
        .rock-lux-stack-kicker {
          color: #2f7f7a;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .rock-lux-stack-card p {
          min-height: 68px;
          margin: 8px 0 14px;
          color: #4a3f41;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.55;
        }
        .rock-lux-stack-products {
          display: grid;
          gap: 8px;
        }
        .rock-lux-stack-product {
          width: 100%;
          min-height: 42px;
          border: 1px solid rgba(47,127,122,.26);
          border-radius: 7px;
          padding: 8px 10px;
          background: linear-gradient(135deg,#ffffff,#f0fdfa);
          color: #183b3a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          text-align: left;
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .rock-lux-stack-product:hover {
          transform: translateY(-1px);
          border-color: rgba(47,127,122,.58);
          box-shadow: 0 10px 22px rgba(47,127,122,.12);
        }
        .rock-lux-stack-product span {
          font-size: 13px;
          font-weight: 900;
        }
        .rock-lux-stack-product strong {
          color: #8a6a2f;
          font-size: 13px;
          font-weight: 950;
          white-space: nowrap;
        }
        .rock-lux-btn,
        .rock-lux-add,
        .rock-lux-view-cart,
        .rock-lux-learn {
          min-height: 44px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border: 1px solid transparent;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .rock-lux-btn:hover,
        .rock-lux-add:hover,
        .rock-lux-view-cart:hover,
        .rock-lux-learn:hover {
          transform: translateY(-1px);
        }
        .rock-lux-btn-primary,
        .rock-lux-add,
        .rock-lux-view-cart {
          background: #2f7f7a;
          color: #fff;
          box-shadow: 0 14px 30px rgba(47,127,122,.20);
        }
        .rock-lux-btn-secondary,
        .rock-lux-learn {
          background: rgba(255,255,255,.78);
          color: #2f2527;
          border-color: rgba(184,138,61,.34);
          box-shadow: 0 12px 26px rgba(84,54,43,.08);
        }
        .rock-lux-products-section .container {
          width: min(1160px, calc(100% - 32px));
        }
        .rock-lux-product-card {
          overflow: hidden;
          display: grid;
          grid-template-rows: 240px 1fr;
          background: #fff;
          border: 1px solid rgba(184,138,61,.22);
          border-radius: 8px;
          box-shadow: 0 18px 42px rgba(84,54,43,.10);
          min-height: 680px;
          position: relative;
        }
        .rock-lux-product-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(circle at 12px 12px, rgba(47,127,122,.13) 0 1.5px, transparent 2px),
            radial-gradient(circle at 24px 24px, rgba(184,138,61,.12) 0 1.5px, transparent 2px),
            repeating-linear-gradient(45deg, transparent 0 18px, rgba(184,138,61,.055) 18px 19px, transparent 19px 36px);
          background-size: 38px 38px, 38px 38px, 72px 72px;
          opacity: .7;
          z-index: 0;
        }
        .rock-lux-product-visual,
        .rock-lux-product-copy {
          position: relative;
          z-index: 1;
        }
        .rock-lux-product-card.is-in-cart {
          border-color: rgba(47,127,122,.48);
          box-shadow: 0 20px 48px rgba(47,127,122,.14);
        }
        .rock-lux-product-visual {
          position: relative;
          min-height: 240px;
          border-bottom: 1px solid rgba(184,138,61,.18);
          background:
            radial-gradient(circle at 50% 42%, rgba(255,250,244,.90), rgba(196,166,111,.26) 38%, rgba(13,44,35,.94) 76%),
            linear-gradient(145deg,#071a16,#0d2c23 58%,#143d32);
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .rock-lux-product-visual::before,
        .rock-lux-product-visual::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .rock-lux-product-visual::before {
          background-image:
            radial-gradient(circle at 11px 11px, rgba(196,166,111,.36) 0 1.6px, transparent 2.2px),
            radial-gradient(circle at 30px 30px, rgba(124,45,49,.28) 0 1.3px, transparent 2px),
            repeating-linear-gradient(45deg, transparent 0 17px, rgba(196,166,111,.28) 17px 18px, transparent 18px 35px),
            repeating-linear-gradient(-45deg, transparent 0 17px, rgba(47,127,122,.22) 17px 18px, transparent 18px 35px);
          background-size: 44px 44px, 44px 44px, 70px 70px, 70px 70px;
          opacity: .38;
          mix-blend-mode: screen;
        }
        .rock-lux-product-visual::after {
          background:
            linear-gradient(120deg, rgba(255,255,255,.20), transparent 34%, rgba(196,166,111,.12) 56%, transparent 78%),
            linear-gradient(90deg, transparent 0 45%, rgba(13,44,35,.18) 45% 48%, rgba(124,45,49,.20) 48% 52%, rgba(13,44,35,.18) 52% 55%, transparent 55%),
            radial-gradient(circle at 50% 42%, transparent 0 52%, rgba(4,19,15,.28) 86%);
          opacity: .48;
        }
        .rock-lux-product-visual > div {
          width: 100%;
          height: 100%;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          margin: 0 !important;
          position: relative;
          z-index: 1;
        }
        .luxury-catalog-thumb {
          isolation: isolate;
        }
        .luxury-catalog-thumb-pattern,
        .luxury-catalog-thumb-ribbon {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .luxury-catalog-thumb-pattern {
          z-index: 0;
          background-image:
            radial-gradient(circle at 10px 10px, rgba(196,166,111,.34) 0 1.6px, transparent 2px),
            repeating-linear-gradient(45deg, transparent 0 15px, rgba(196,166,111,.24) 15px 16px, transparent 16px 31px),
            repeating-linear-gradient(-45deg, transparent 0 15px, rgba(47,127,122,.20) 15px 16px, transparent 16px 31px);
          background-size: 38px 38px, 62px 62px, 62px 62px;
          opacity: .30;
          mix-blend-mode: screen;
        }
        .luxury-catalog-thumb-ribbon {
          z-index: 0;
          background:
            linear-gradient(90deg, transparent 0 43%, rgba(13,44,35,.30) 43% 47%, rgba(124,45,49,.34) 47% 53%, rgba(13,44,35,.30) 53% 57%, transparent 57%),
            radial-gradient(circle at 50% 38%, rgba(255,250,244,.42), transparent 50%);
          opacity: .42;
        }
        .rock-lux-cart-pill {
          position: absolute;
          top: 12px;
          right: 12px;
          border-radius: 999px;
          background: #2f7f7a;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          z-index: 3;
        }
        .rock-lux-product-copy {
          padding: 18px;
          display: grid;
          gap: 10px;
          align-content: start;
        }
        .rock-lux-product-category {
          color: #2f7f7a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .rock-lux-product-copy h3 {
          margin: 0;
          color: #2f2527;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 500;
        }
        .rock-lux-strength {
          margin: -6px 0 0;
          color: #b88a3d;
          font-weight: 900;
        }
        .rock-lux-product-note,
        .rock-lux-detail span {
          margin: 0;
          color: #725f63;
          font-size: 14px;
          line-height: 1.6;
        }
        .rock-lux-detail {
          display: grid;
          gap: 3px;
        }
        .rock-lux-detail strong {
          color: #2f2527;
          font-size: 12px;
        }
        .rock-lux-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .rock-lux-badges span,
        .rock-lux-price-note {
          border: 1px solid rgba(47,127,122,.18);
          border-radius: 999px;
          background: #eef9f6;
          color: #2f7f7a;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 900;
        }
        .rock-lux-price-note {
          border-radius: 8px;
          line-height: 1.35;
        }
        .rock-lux-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 4px;
        }
        .rock-lux-card-footer strong {
          color: #2f2527;
          font-size: 24px;
        }
        .rock-lux-card-footer a {
          color: #2f7f7a;
          font-size: 13px;
          font-weight: 900;
        }
        .rock-lux-add,
        .rock-lux-learn {
          width: 100%;
        }
        .rock-lux-add:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }
        .rock-lux-actions {
          display: grid;
          gap: 8px;
        }
        .beastmode-hero {
          min-height: 78vh;
          isolation: isolate;
        }
        .beastmode-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(135deg, rgba(255,255,255,.08), transparent 26%, rgba(193,18,31,.16) 58%, transparent 84%),
            repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 1px, transparent 1px 13px);
          mix-blend-mode: screen;
          opacity: .55;
        }
        .beastmode-hero::after {
          content: "";
          position: absolute;
          inset: -20% -10%;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(115deg, transparent 0 16%, rgba(255,255,255,.075) 28%, transparent 42% 100%),
            linear-gradient(80deg, transparent 0 30%, rgba(193,18,31,.11) 44%, transparent 62% 100%);
          filter: blur(18px);
          opacity: .48;
          animation: beastmode-smoke 12s ease-in-out infinite alternate;
        }
        @keyframes beastmode-smoke {
          from { transform: translate3d(-1.5%, .5%, 0); }
          to { transform: translate3d(1.5%, -1%, 0); }
        }
        .beastmode-hero .container,
        .beastmode-hero .container > div {
          position: relative;
          z-index: 1;
        }
        .beastmode-hero-logo {
          width: min(360px, 84vw);
          padding: 10px;
          margin: 0 0 24px;
          border: 1px solid rgba(193,18,31,.45);
          border-radius: 8px;
          background: rgba(0,0,0,.72);
          box-shadow: 0 28px 70px rgba(0,0,0,.52), 0 0 36px rgba(193,18,31,.18);
        }
        .beastmode-hero-logo img {
          width: 100%;
          height: auto;
          display: block;
        }
        .beastmode-hero-actions,
        .beastmode-product-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .beastmode-primary,
        .beastmode-secondary,
        .beastmode-add,
        .beastmode-details {
          min-height: 46px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: .05em;
          text-transform: uppercase;
          text-decoration: none;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .beastmode-primary,
        .beastmode-add {
          background: linear-gradient(135deg,#C1121F,#7f1119);
          color: #fff;
          box-shadow: 0 16px 34px rgba(193,18,31,.26);
        }
        .beastmode-secondary,
        .beastmode-details {
          background: rgba(17,17,19,.82);
          color: #f4f4f5;
          border-color: rgba(193,18,31,.44);
        }
        .beastmode-primary:hover,
        .beastmode-secondary:hover,
        .beastmode-add:hover,
        .beastmode-details:hover,
        .beastmode-category-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 42px rgba(193,18,31,.20);
        }
        .beastmode-showcase,
        .beastmode-products-section {
          position: relative;
          color: #f4f4f5;
          background:
            repeating-linear-gradient(135deg, rgba(255,255,255,.032) 0 1px, transparent 1px 16px),
            linear-gradient(180deg,#050505,#101113 48%,#050505);
        }
        .beastmode-showcase {
          padding: 58px 0 42px;
          border-top: 1px solid rgba(193,18,31,.32);
          border-bottom: 1px solid rgba(193,18,31,.22);
        }
        .beastmode-section-heading {
          max-width: 740px;
          margin: 0 0 24px;
        }
        .beastmode-section-heading span,
        .beastmode-kicker,
        .beastmode-product-kicker,
        .beastmode-product-badge {
          color: #C1121F;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .beastmode-section-heading h2,
        .beastmode-bundle-feature h3,
        .beastmode-split-section h3 {
          margin: 8px 0 8px;
          color: #f4f4f5;
          font-family: 'Arial Black', Impact, system-ui, sans-serif;
          letter-spacing: .03em;
          text-transform: uppercase;
        }
        .beastmode-section-heading h2 {
          font-size: 38px;
        }
        .beastmode-section-heading p,
        .beastmode-bundle-feature p,
        .beastmode-split-section p,
        .beastmode-category-card p,
        .beastmode-why-grid p,
        .beastmode-product-copy {
          color: #a1a1aa;
          line-height: 1.65;
        }
        .beastmode-bundle-feature {
          display: grid;
          grid-template-columns: minmax(0,.8fr) minmax(280px,1.2fr);
          gap: 22px;
          align-items: center;
          padding: 22px;
          border: 1px solid rgba(193,18,31,.34);
          border-radius: 8px;
          background: linear-gradient(135deg,rgba(24,24,27,.92),rgba(5,5,5,.96));
          box-shadow: 0 24px 70px rgba(0,0,0,.42);
        }
        .beastmode-bundle-feature img {
          width: 100%;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 22px 54px rgba(0,0,0,.48);
        }
        .beastmode-category-grid,
        .beastmode-why-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }
        .beastmode-category-card,
        .beastmode-why-grid div,
        .beastmode-split-section {
          border: 1px solid rgba(193,18,31,.24);
          border-radius: 8px;
          background: rgba(17,17,19,.84);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        .beastmode-category-card {
          min-height: 144px;
          padding: 17px;
          text-align: left;
          cursor: pointer;
        }
        .beastmode-category-card span,
        .beastmode-why-grid span {
          color: #f4f4f5;
          font-size: 17px;
          font-weight: 950;
          text-transform: uppercase;
        }
        .beastmode-split-section {
          margin-top: 16px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .beastmode-why-grid div {
          padding: 16px;
        }
        .beastmode-product-card {
          min-height: 580px;
          overflow: hidden;
          display: grid;
          grid-template-rows: 220px 1fr;
          border: 1px solid rgba(193,18,31,.28);
          border-radius: 8px;
          background: linear-gradient(180deg,#141416,#070708);
          box-shadow: 0 18px 46px rgba(0,0,0,.36);
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .beastmode-product-card:hover,
        .beastmode-product-card.is-in-cart {
          border-color: rgba(193,18,31,.72);
          box-shadow: 0 20px 54px rgba(0,0,0,.44), 0 0 34px rgba(193,18,31,.18);
        }
        .beastmode-product-media {
          position: relative;
          min-height: 220px;
          overflow: hidden;
          background: #050505;
        }
        .beastmode-product-media > div {
          width: 100%;
          height: 100%;
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          background: transparent !important;
        }
        .beastmode-product-badge,
        .beastmode-cart-pill {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 3;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(5,5,5,.84);
          border: 1px solid rgba(193,18,31,.46);
        }
        .beastmode-cart-pill {
          left: auto;
          right: 12px;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }
        .beastmode-product-body {
          padding: 18px;
          display: grid;
          gap: 10px;
        }
        .beastmode-product-body h3 {
          margin: 0;
          color: #f4f4f5;
          font-size: 23px;
          line-height: 1.1;
          font-weight: 950;
          text-transform: uppercase;
        }
        .beastmode-product-strength {
          margin: -4px 0 0;
          color: #d4d4d8;
          font-weight: 900;
        }
        .beastmode-product-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .beastmode-product-trust span,
        .beastmode-price-note {
          padding: 6px 8px;
          border: 1px solid rgba(193,18,31,.24);
          border-radius: 999px;
          color: #d4d4d8;
          background: rgba(193,18,31,.08);
          font-size: 11px;
          font-weight: 900;
        }
        .beastmode-price-note {
          border-radius: 8px;
          margin: 0;
        }
        .beastmode-product-footer {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .beastmode-product-footer strong {
          color: #fff;
          font-size: 26px;
        }
        .beastmode-product-footer span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .beastmode-add,
        .beastmode-details {
          flex: 1 1 140px;
          width: 100%;
        }
        .beastmode-add:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }
        @media (max-width: 768px) {
          .cart-float-bar { display: block !important; }
          .portal-products-layout { grid-template-columns: 1fr !important; }
          .portal-cart-sidebar { display: none !important; }
          .portal-welcome-grid { grid-template-columns: 1fr !important; }
          .agprime-cart-corner { top: 72px; right: 12px; min-height: 46px; padding: 8px 10px 8px 8px; }
          .aactivated-cart-corner {
            top: auto;
            right: 14px;
            bottom: 14px;
            width: 54px;
            height: 54px;
            min-height: 54px;
            padding: 6px;
            border-radius: 50%;
          }
          .aactivated-cart-corner .agprime-cart-icon { width: 40px; height: 40px; border-radius: 50%; }
          .aactivated-cart-corner .agprime-cart-text { display: none; }
          .agprime-cart-icon { width: 34px; height: 34px; font-size: 10px; }
          .agprime-cart-text strong { font-size: 13px; }
          .aactivated-search-row { grid-template-columns: 1fr; }
          .aactivated-search-row .btn { min-height: 44px; }
          .aactivated-category-filters { gap: 6px !important; }
          .aactivated-category-filters .btn {
            min-height: 38px;
            padding: 7px 10px;
            line-height: 1.15;
          }
          .aactivated-product-card { min-height: 0; }
          .aactivated-card-content { padding: 16px 16px 0; gap: 12px; }
          .aactivated-card-header { grid-template-columns: 1fr; min-height: 0; gap: 8px; }
          .aactivated-card-main { grid-template-columns: 1fr; align-items: start; gap: 12px; }
          .aactivated-card-actions-desktop { display: none; }
          .aactivated-card-actions-mobile { display: block; }
          .aactivated-card-image-shell { min-height: 136px; }
          .aactivated-card-image { height: 152px; width: min(156px, 72%); }
          .aactivated-card-title { font-size: 24px; line-height: 1.08; }
          .aactivated-card-strength { font-size: 18px; margin: -4px 0 8px; }
          .aactivated-card-note { margin-top: 7px; }
          .aactivated-card-meta { margin-top: 8px; gap: 5px; }
          .aactivated-catalog-menu-wrap { position: static !important; width: 100%; }
          .aactivated-catalog-menu {
            position: fixed !important;
            top: 92px !important;
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            max-height: calc(100vh - 124px);
            overflow-y: auto;
            z-index: 1200 !important;
          }
          .agprime-brand-showcase { width: 100%; min-height: 0; }
          .agprime-brand-card { width: min(380px, 88vw); min-height: auto; padding: 20px; justify-self: start; }
          .agprime-logo-shell { min-height: 190px; padding: 18px; }
          .agprime-brand-rule { width: 78%; }
          .vyigenix-brand-showcase { grid-template-columns: 1fr; width: 100%; min-height: 0; gap: 8px; padding-top: 8px; }
          .vyigenix-logo-panel { width: min(390px, 86vw); }
          .vyigenix-hero-vial { height: 210px; opacity: .94; justify-self: center; margin-top: -6px; }
          .rockphorm-brand-showcase { grid-template-columns: 1fr; width: 100%; min-height: 0; gap: 10px; padding-top: 8px; }
          .rockphorm-logo-panel { width: min(400px, 88vw); padding: 12px; }
          .rockphorm-hero-vial { height: 230px; justify-self: center; margin-top: -8px; }
          .aurora-brand-showcase { width: min(420px, 88vw); margin-bottom: 20px; }
          .rock-lux-actions-row { width: 100%; }
          .rock-lux-gender-switch { width: 100%; }
          .rock-lux-gender-btn strong { font-size: 14px; }
          .rock-lux-stack-grid { grid-template-columns: 1fr; }
          .rock-lux-stack-card p { min-height: 0; }
          .rock-lux-btn { flex: 1 1 180px; }
          .rock-lux-product-card { min-height: 0; }
          .beastmode-hero { min-height: 70vh; background-position: center top !important; }
          .beastmode-hero h1 { font-size: 38px !important; }
          .beastmode-hero-logo { width: min(300px, 86vw); }
          .beastmode-bundle-feature,
          .beastmode-category-grid,
          .beastmode-why-grid { grid-template-columns: 1fr; }
          .beastmode-split-section { align-items: stretch; flex-direction: column; }
          .beastmode-product-card { min-height: 0; }
        }
        @media (min-width: 769px) {
          [style*="gridTemplateColumns"] { transition: grid-template-columns .3s ease; }
        }
      `}</style>
    </PublicLayout>
  );
}
