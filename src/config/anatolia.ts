export const anatoliaStorefront = {
  id: 'anatolia',
  slug: 'anatolia',
  aliases: ['turkiye', 'anatoliawellness', 'anatolia-wellness-labs'],
  brandName: 'Anatolia Wellness Labs',
  adminLabel: 'Anatolia Wellness Labs - Turkish Storefront',
  locale: 'tr',
  storeType: 'master_localized',
  commission: {
    owner: 'main',
    rate: 1.0,
    partnerPayoutEligible: false,
    repOverridesEnabled: false,
    downlineEnabled: false,
  },
  catalogSource: 'main',
  pricingSource: 'main',
  inventorySource: 'main',
  certificatesSource: 'main',
  checkoutSource: 'main',
  theme: {
    primary: '#006D77',
    secondary: '#D4AF37',
    background: '#FFFFFF',
    navy: '#0B1F33',
    accent: '#F4A261',
  },
  assets: {
    logo: '/brands/anatolia/anatolia-logo.png',
    productPlaceholder: '/brands/anatolia/anatolia-vial.png',
  },
} as const;

export const anatoliaOrderMetadata = {
  storefront: 'anatolia',
  brandName: 'Anatolia Wellness Labs',
  locale: 'tr',
  commissionOwner: 'main',
  commissionRate: 1.0,
  partnerPayoutEligible: false,
} as const;
