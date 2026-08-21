export const ispartaStorefront = {
  id: 'isparta',
  slug: 'isparta',
  aliases: ['ispartawellness', 'isparta-wellness-labs'],
  brandName: 'Isparta Wellness Labs',
  adminLabel: 'Isparta Wellness Labs - Turkish Storefront',
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
    primary: '#073F42',
    secondary: '#C8A04B',
    background: '#F7F2E8',
    navy: '#062B30',
    accent: '#C8A04B',
  },
  assets: {
    logo: '/brands/isparta/isparta-logo.png',
    productPlaceholder: '/brands/isparta/isparta-vial.png',
    hero: '/brands/isparta/isparta-hero.png',
  },
} as const;

export const ispartaOrderMetadata = {
  storefront: 'isparta',
  brandName: 'Isparta Wellness Labs',
  locale: 'tr',
  commissionOwner: 'main',
  commissionRate: 1.0,
  partnerPayoutEligible: false,
} as const;
