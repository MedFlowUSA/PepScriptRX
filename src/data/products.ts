export type ProductStatus = 'active' | 'active_addon' | 'manual_review' | 'physician_review' | 'hidden' | 'inactive';
export type ProductType = 'glp1' | 'manual_review' | 'physician_review' | 'supply' | 'accessory';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  status: ProductStatus;
  product_type: ProductType;
  requires_prescription_upload: boolean;
  requires_receipt_upload: boolean;
  requires_dob: boolean;
  requires_physician_review: boolean;
  display_note?: string;
  customer_visible?: boolean;
  active?: boolean;
  sellable?: boolean;
  admin_manageable?: boolean;
  allow_special_order?: boolean;
  estimated_fulfillment_days?: number;
  inventory_source?: string | null;
  parent_product_id?: string | null;
  sort_order: number;
}

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'tirzepatide-30',
    name: 'Tirzepatide 30mg Vial',
    price: 199,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    product_type: 'glp1',
    requires_prescription_upload: false,
    requires_receipt_upload: true,
    requires_dob: true,
    requires_physician_review: false,
    sort_order: 1,
  },
  {
    id: 'tirzepatide-60',
    name: 'Tirzepatide 60mg Vial',
    price: 249,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    product_type: 'glp1',
    requires_prescription_upload: false,
    requires_receipt_upload: true,
    requires_dob: true,
    requires_physician_review: false,
    sort_order: 2,
  },
  {
    id: 'semaglutide-10',
    name: 'Semaglutide 10mg Vial',
    price: 99,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    product_type: 'glp1',
    requires_prescription_upload: false,
    requires_receipt_upload: true,
    requires_dob: true,
    requires_physician_review: false,
    sort_order: 3,
  },
  {
    id: 'bac-water',
    name: 'BAC Water + 8-Pack Syringe Kit',
    price: 12,
    category: 'Supply',
    status: 'active',
    product_type: 'supply',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: false,
    requires_physician_review: false,
    sort_order: 4,
  },
  {
    id: 'pen-kit',
    name: 'Reusable Pen Kit',
    price: 19,
    category: 'Accessory',
    status: 'active_addon',
    product_type: 'accessory',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: false,
    requires_physician_review: false,
    display_note: 'Includes reusable pen body, cartridge, and pen needles. Multiple colors available.',
    sort_order: 5,
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide 15mg Vial',
    price: 279,
    category: 'GLP-1 / Weight Management',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for savings-check submissions.',
    sort_order: 6,
  },
  {
    id: 'igf1',
    name: 'IGF-1 / Insulin Growth Factor One',
    price: 199,
    category: 'Physician Review',
    status: 'physician_review',
    product_type: 'physician_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: true,
    display_note: 'Physician review required.',
    sort_order: 7,
  },
  {
    id: 'bpc-157-10mg',
    name: 'BPC-157 10mg Vial',
    price: 99,
    category: 'Recovery / Repair',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for checkout and standard verification review.',
    sort_order: 8,
  },
  {
    id: 'tb-500-10mg',
    name: 'TB-500 10mg Vial',
    price: 149,
    category: 'Recovery / Repair',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for checkout and standard verification review.',
    sort_order: 9,
  },
  {
    id: 'wolverine-stack',
    name: 'Wolverine Stack / BB20 - BPC-157 + TB-500',
    price: 149,
    category: 'Recovery / Repair',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'BPC-157 10mg + TB-500 10mg blend. Eligible for BEASTMODE promo while active.',
    sort_order: 10,
  },
  {
    id: 'cjc-ipamorelin-10mg',
    name: 'CJC-1295 / Ipamorelin 10mg Vial',
    price: 169,
    category: 'Growth / Performance',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for checkout and standard verification review.',
    sort_order: 11,
  },
  {
    id: 'nad-plus',
    name: 'NAD+ Vial',
    price: 149,
    category: 'Longevity / Wellness',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for checkout and standard verification review.',
    sort_order: 12,
  },
  {
    id: 'ghk-cu-100mg',
    name: 'GHK-Cu 100mg Vial',
    price: 129,
    category: 'Recovery / Repair',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: true,
    requires_physician_review: false,
    display_note: 'Available for checkout and standard verification review.',
    sort_order: 13,
  },
];

export const PRODUCT_IMAGES: Record<string, string> = {
  'tirzepatide-30': '/products/t30.png',
  'tirzepatide-60': '/products/t60.png',
  'semaglutide-10': '/products/sem10.png',
  'bac-water':      '/products/bac-water-kit.png',
  'pen-kit':        '/products/pen-kit.png',
  'retatrutide':    '/products/reta.png',
  'igf1':           '/products/reta.png',
  'bpc-157-10mg':   '/products/reta.png',
  'tb-500-10mg':    '/products/reta.png',
  'wolverine-stack': '/products/reta.png',
  'cjc-ipamorelin-10mg': '/products/reta.png',
  'nad-plus':       '/products/reta.png',
  'ghk-cu-100mg':   '/products/reta.png',
};

export const AI_RECEPTIONIST_SCRIPT =
  'PepScriptRX offers cash-pay refill support for eligible patients. Current listed options include Tirzepatide 30mg for $199, Tirzepatide 60mg for $249, Semaglutide 10mg for $99, Retatrutide 15mg for $279, BPC-157 10mg for $99, TB-500 10mg for $149, Wolverine Stack / BB20 for $149, CJC-1295 / Ipamorelin 10mg for $169, NAD+ for $149, GHK-Cu 100mg for $129, BAC water with an 8-pack syringe kit for $12, and IGF-1 listed at $199. Eligibility, availability, and fulfillment are subject to review.';

export const PRICING_DISCLAIMER =
  'Pricing, eligibility, and availability may vary by state, prescription verification, fulfillment partner, and review status. PepScriptRX is not a pharmacy or medical provider and does not guarantee approval, availability, or savings.';

// Products eligible for the public start/intake form
export const INTAKE_PRODUCTS = DEFAULT_PRODUCTS.filter(
  (p) => p.status === 'active' || p.status === 'active_addon' || p.status === 'manual_review' || p.status === 'physician_review',
);

export const STATUS_LABELS: Record<ProductStatus, string> = {
  active:           'Active',
  active_addon:     'Active Add-on',
  manual_review:    'Manual Review',
  physician_review: 'Physician Review',
  hidden:           'Hidden',
  inactive:         'Inactive',
};

export const STATUS_COLORS: Record<ProductStatus, string> = {
  active:           'badge-success',
  active_addon:     'badge-success',
  manual_review:    'badge-warning',
  physician_review: 'badge-purple',
  hidden:           'badge-default',
  inactive:         'badge-error',
};
