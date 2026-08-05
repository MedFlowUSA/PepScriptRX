export type StarterKitAudience = 'public' | 'other_rep' | 'aactivated_rep' | 'aactivated_admin' | 'platform_admin';

export type StarterKitPackage = {
  packageId: string;
  tier: 'starter_experience' | 'momentum_business_builder' | 'ultimate_business_builder';
  name: string;
  label: string;
  retailValue: number;
  promoPrice: number;
  savings: number;
  variationRequired: boolean;
  purchaseLimit: number;
  components: StarterKitComponent[];
  variations?: StarterKitVariation[];
};

export type StarterKitVariation = {
  variationId: 'reta' | 'tirz';
  name: string;
  retailValue: number;
  promoPrice: number;
  savings: number;
  components: StarterKitComponent[];
};

export type StarterKitComponent = {
  sku: string;
  name: string;
  quantity: number;
};

export type StarterKitInventoryRow = StarterKitComponent & {
  currentQty: number;
  active?: boolean;
};

export type StarterKitCheckoutPolicyInput = {
  audience: StarterKitAudience;
  packageId: string;
  variationId?: string | null;
  priorPurchases?: string[];
  inventory?: StarterKitInventoryRow[];
  couponCode?: string | null;
  commissionEnabled?: boolean;
  adminOverride?: boolean;
};

export type StarterKitCheckoutPolicyResult = {
  allowed: boolean;
  reason?: string;
};

export const AACTIVATED_STARTER_KIT_PATH = '/aactivated/rep/starter-kits';

export const AACTIVATED_STARTER_KITS: StarterKitPackage[] = [
  {
    packageId: 'starter-experience-kit',
    tier: 'starter_experience',
    name: 'Starter Experience Kit',
    label: 'Choose your starter stack',
    retailValue: 447,
    promoPrice: 249,
    savings: 198,
    variationRequired: true,
    purchaseLimit: 1,
    components: [],
    variations: [
      {
        variationId: 'reta',
        name: 'RETA Starter',
        retailValue: 447,
        promoPrice: 249,
        savings: 198,
        components: [
          { sku: 'RXP-GLP-RETA-20', name: 'RETA 20 mg', quantity: 1 },
          { sku: 'RXP-LONG-NAD-1000', name: 'NAD+ 1000 mg', quantity: 1 },
          { sku: 'RXP-MAIN-GLOW70', name: 'Glow', quantity: 1 },
          { sku: 'WA10', name: 'BAC Water 10 mL', quantity: 2 },
        ],
      },
      {
        variationId: 'tirz',
        name: 'Tirzepatide Starter',
        retailValue: 567,
        promoPrice: 349,
        savings: 218,
        components: [
          { sku: 'TR30', name: 'Tirzepatide 30 mg', quantity: 1 },
          { sku: 'RXP-LONG-NAD-1000', name: 'NAD+ 1000 mg', quantity: 1 },
          { sku: 'RXP-MAIN-WOLVERINE-20', name: 'Wolverine Stack 10 mg', quantity: 1 },
          { sku: 'WA10', name: 'BAC Water 10 mL', quantity: 2 },
        ],
      },
    ],
  },
  {
    packageId: 'momentum-business-builder-kit',
    tier: 'momentum_business_builder',
    name: 'Momentum Business Builder Kit',
    label: 'Most popular',
    retailValue: 850,
    promoPrice: 499,
    savings: 351,
    variationRequired: false,
    purchaseLimit: 1,
    components: [
      { sku: 'RXP-GLP-RETA-20', name: 'RETA 20 mg', quantity: 1 },
      { sku: 'TR30', name: 'Tirzepatide 30 mg', quantity: 1 },
      { sku: 'RXP-LONG-NAD-1000', name: 'NAD+ 1000 mg', quantity: 1 },
      { sku: 'RXP-MAIN-GLOW70', name: 'Glow', quantity: 1 },
      { sku: 'RXP-MAIN-WOLVERINE-20', name: 'Wolverine Stack 10 mg', quantity: 1 },
      { sku: 'WA10', name: 'BAC Water 10 mL', quantity: 2 },
    ],
  },
  {
    packageId: 'ultimate-business-builder-kit',
    tier: 'ultimate_business_builder',
    name: 'Ultimate Business Builder Kit',
    label: 'Fully stacked',
    retailValue: 1099,
    promoPrice: 699,
    savings: 400,
    variationRequired: false,
    purchaseLimit: 1,
    components: [
      { sku: 'RXP-GLP-RETA-20', name: 'RETA 20 mg', quantity: 1 },
      { sku: 'TR30', name: 'Tirzepatide 30 mg', quantity: 1 },
      { sku: 'RXP-MAIN-WOLVERINE-20', name: 'Wolverine Stack 20 mg', quantity: 1 },
      { sku: 'RXP-REC-BPC157-10', name: 'BPC-157 10 mg', quantity: 1 },
      { sku: 'RXP-LONG-NAD-1000', name: 'NAD+ 1000 mg', quantity: 1 },
      { sku: 'RXP-MAIN-GLOW70', name: 'Glow', quantity: 1 },
      { sku: 'WA10', name: 'BAC Water 10 mL', quantity: 3 },
    ],
  },
];

export function findStarterKit(packageId: string): StarterKitPackage | null {
  return AACTIVATED_STARTER_KITS.find((kit) => kit.packageId === packageId) ?? null;
}

export function starterKitComponents(packageId: string, variationId?: string | null): StarterKitComponent[] {
  const kit = findStarterKit(packageId);
  if (!kit) return [];
  if (!kit.variationRequired) return kit.components;
  return kit.variations?.find((variation) => variation.variationId === variationId)?.components ?? [];
}

export function validateStarterKitSelection(packageId: string, variationId?: string | null): StarterKitCheckoutPolicyResult {
  const kit = findStarterKit(packageId);
  if (!kit) return { allowed: false, reason: 'unknown_package' };
  if (kit.variationRequired && !variationId) return { allowed: false, reason: 'variation_required' };
  if (!kit.variationRequired && variationId) return { allowed: false, reason: 'variation_not_allowed' };
  if (kit.variationRequired && !kit.variations?.some((variation) => variation.variationId === variationId)) {
    return { allowed: false, reason: 'unknown_variation' };
  }
  return { allowed: true };
}

export function starterKitInventoryAvailable(packageId: string, variationId: string | null | undefined, inventory: StarterKitInventoryRow[] = []): StarterKitCheckoutPolicyResult {
  const required = starterKitComponents(packageId, variationId);
  if (required.length === 0) return { allowed: false, reason: 'missing_components' };
  for (const component of required) {
    const row = inventory.find((item) => item.sku.toUpperCase() === component.sku.toUpperCase());
    if (!row || row.active === false || row.currentQty < component.quantity) {
      return { allowed: false, reason: `inventory_unavailable:${component.sku}` };
    }
  }
  return { allowed: true };
}

export function evaluateStarterKitCheckout(input: StarterKitCheckoutPolicyInput): StarterKitCheckoutPolicyResult {
  if (!['aactivated_rep', 'aactivated_admin', 'platform_admin'].includes(input.audience)) {
    return { allowed: false, reason: 'private_aactivated_only' };
  }
  if (input.couponCode?.trim()) return { allowed: false, reason: 'discount_codes_not_allowed' };
  if (input.commissionEnabled) return { allowed: false, reason: 'commission_stacking_not_allowed' };

  const selection = validateStarterKitSelection(input.packageId, input.variationId);
  if (!selection.allowed) return selection;

  const alreadyPurchased = input.priorPurchases?.includes(input.packageId) ?? false;
  const admin = input.audience === 'aactivated_admin' || input.audience === 'platform_admin';
  if (alreadyPurchased && !admin && !input.adminOverride) return { allowed: false, reason: 'purchase_limit_reached' };

  const inventory = starterKitInventoryAvailable(input.packageId, input.variationId, input.inventory);
  if (!inventory.allowed) return inventory;
  return { allowed: true };
}
