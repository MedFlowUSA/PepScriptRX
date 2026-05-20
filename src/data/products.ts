export type ProductStatus = 'active' | 'manual_review' | 'physician_review' | 'hidden' | 'inactive';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  status: ProductStatus;
  display_note?: string;
  sort_order: number;
}

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'tirzepatide-30',
    name: 'Tirzepatide 30mg Vial',
    price: 199,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    sort_order: 1,
  },
  {
    id: 'tirzepatide-60',
    name: 'Tirzepatide 60mg Vial',
    price: 249,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    sort_order: 2,
  },
  {
    id: 'semaglutide-10',
    name: 'Semaglutide 10mg Vial',
    price: 99,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    sort_order: 3,
  },
  {
    id: 'bac-water',
    name: 'BAC Water + 8-Pack Syringe Kit',
    price: 12,
    category: 'Supplies',
    status: 'active',
    sort_order: 4,
  },
  {
    id: 'pen-kit',
    name: 'Reusable Pen Kit',
    price: 19,
    category: 'Supplies',
    status: 'active',
    display_note: 'Includes reusable pen body, cartridge, and pen needles. Multiple colors available.',
    sort_order: 5,
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide Vial',
    price: 279,
    category: 'GLP-1 / Weight Management',
    status: 'active',
    display_note: 'Available for savings-check submissions.',
    sort_order: 6,
  },
  {
    id: 'igf1',
    name: 'IGF-1 / Insulin Growth Factor One',
    price: 199,
    category: 'Physician Review',
    status: 'physician_review',
    display_note: 'Physician review required.',
    sort_order: 7,
  },
];

export const PRODUCT_IMAGES: Record<string, string> = {
  'tirzepatide-30': '/marketing/pepscript-promo-5.png',
  'tirzepatide-60': '/marketing/pepscript-promo-4.png',
  'semaglutide-10': '/marketing/pepscript-promo-3.png',
  'bac-water':      '/marketing/pepscript-promo-2.png',
  'retatrutide':    '/marketing/pepscript-promo-1.png',
  'pen-kit':        '/marketing/pepscript-promo-6.png',
};

export const AI_RECEPTIONIST_SCRIPT =
  'PepScriptRX offers cash-pay refill support for eligible patients. Current listed options include Tirzepatide 30mg for $199, Tirzepatide 60mg for $249, Semaglutide 10mg for $99, Retatrutide for $279, BAC water with an 8-pack syringe kit for $12, and IGF-1 listed at $199. Eligibility, availability, and fulfillment are subject to review.';

export const PRICING_DISCLAIMER =
  'Pricing, eligibility, and availability may vary by state, prescription verification, fulfillment partner, and review status. PepScriptRX is not a pharmacy or medical provider and does not guarantee approval, availability, or savings.';

// Products eligible for the public start/intake form
export const INTAKE_PRODUCTS = DEFAULT_PRODUCTS.filter(
  (p) => p.status === 'active' || p.status === 'manual_review' || p.status === 'physician_review',
);

export const STATUS_LABELS: Record<ProductStatus, string> = {
  active:           'Active',
  manual_review:    'Manual Review',
  physician_review: 'Physician Review',
  hidden:           'Hidden',
  inactive:         'Inactive',
};

export const STATUS_COLORS: Record<ProductStatus, string> = {
  active:           'badge-success',
  manual_review:    'badge-warning',
  physician_review: 'badge-purple',
  hidden:           'badge-default',
  inactive:         'badge-error',
};
