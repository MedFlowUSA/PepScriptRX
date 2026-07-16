import type { Profile } from '../types';

export type PartnerAccessLevel = 'platform_admin' | 'partner_admin_full' | 'partner_admin_limited' | 'rep' | 'customer';

export type PartnerModule =
  | 'dashboard'
  | 'storefront'
  | 'products'
  | 'pricing'
  | 'discounts'
  | 'reps'
  | 'teams'
  | 'orders'
  | 'customers'
  | 'analytics'
  | 'reports'
  | 'inventory'
  | 'payouts'
  | 'marketing';

export type PartnerTenantConfig = {
  brandId: string;
  storeSlug: string;
  scopeCode: string;
  brandName: string;
  accessLevel: PartnerAccessLevel;
  storefrontPath: string;
  modules: PartnerModule[];
};

const PLATFORM_ADMIN_ROLES = new Set(['admin', 'owner', 'platform_admin', 'master_admin', 'super_admin']);
const PARTNER_ADMIN_ROLES = new Set(['rx_plus_admin', 'partner_admin_full', 'partner_admin_limited']);

const FULL_MODULES: PartnerModule[] = [
  'dashboard',
  'storefront',
  'products',
  'pricing',
  'discounts',
  'reps',
  'teams',
  'orders',
  'customers',
  'analytics',
  'reports',
  'inventory',
  'payouts',
  'marketing',
];

const LIMITED_MODULES: PartnerModule[] = [
  'dashboard',
  'storefront',
  'products',
  'reps',
  'orders',
  'customers',
  'analytics',
  'reports',
  'payouts',
  'marketing',
];

const KNOWN_TENANTS: PartnerTenantConfig[] = [
  {
    brandId: 'aactivated',
    storeSlug: 'aactivated',
    scopeCode: 'AACTIVATEDRX',
    brandName: 'AACTIVATED RX',
    accessLevel: 'partner_admin_full',
    storefrontPath: '/aactivated',
    modules: FULL_MODULES,
  },
  {
    brandId: 'aurora',
    storeSlug: 'aurora',
    scopeCode: 'AURORA',
    brandName: 'Aurora Labs',
    accessLevel: 'partner_admin_limited',
    storefrontPath: '/aurora',
    modules: LIMITED_MODULES,
  },
  {
    brandId: 'glow',
    storeSlug: 'glow',
    scopeCode: 'GLOW',
    brandName: 'GLOW Sheer Radiance',
    accessLevel: 'partner_admin_limited',
    storefrontPath: '/glow',
    modules: LIMITED_MODULES,
  },
  {
    brandId: 'beastmode',
    storeSlug: 'beastmode',
    scopeCode: 'BEASTMODE',
    brandName: 'BEASTMODE Performance Labs',
    accessLevel: 'partner_admin_limited',
    storefrontPath: '/beastmode',
    modules: ['dashboard', 'orders', 'customers', 'marketing'],
  },
  {
    brandId: 'rockphorm',
    storeSlug: 'rockphorm',
    scopeCode: 'ROCKPHORM',
    brandName: 'Rock Phorm',
    accessLevel: 'partner_admin_full',
    storefrontPath: '/rockphorm',
    modules: FULL_MODULES,
  },
  {
    brandId: 'optimax',
    storeSlug: 'optimax',
    scopeCode: 'OPTIMAX',
    brandName: 'Optimax Peptide Therapy',
    accessLevel: 'partner_admin_limited',
    storefrontPath: '/optimax-peptide-therapy',
    modules: ['dashboard', 'orders', 'customers'],
  },
  {
    brandId: 'vitality',
    storeSlug: 'vitality',
    scopeCode: 'VITALITY',
    brandName: 'Vitality Institute Labs',
    accessLevel: 'partner_admin_limited',
    storefrontPath: '/vitality',
    modules: ['dashboard', 'storefront', 'products', 'orders', 'customers', 'analytics', 'reports', 'marketing'],
  },
  {
    brandId: 'sandman',
    storeSlug: 'sandman',
    scopeCode: 'SANDMAN',
    brandName: 'Sandman Wellness Labs',
    accessLevel: 'partner_admin_full',
    storefrontPath: '/sandman',
    modules: ['dashboard', 'storefront', 'products', 'pricing', 'discounts', 'reps', 'orders', 'customers', 'analytics', 'reports', 'inventory', 'marketing'],
  },
  {
    brandId: 'blackline',
    storeSlug: 'blackline',
    scopeCode: 'BLACKLINE',
    brandName: 'Blackline Peptides',
    accessLevel: 'partner_admin_full',
    storefrontPath: '/blackline',
    modules: ['dashboard', 'storefront', 'products', 'pricing', 'discounts', 'reps', 'orders', 'customers', 'analytics', 'reports', 'inventory', 'marketing'],
  },
];

export function normalizeTenantToken(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeTenantScope(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isPlatformAdmin(profile?: Profile | null): boolean {
  const role = normalizeTenantToken(profile?.role);
  if (role === 'master_admin' || role === 'super_admin') return true;
  if (!PLATFORM_ADMIN_ROLES.has(role)) return false;
  return !profile?.store_slug && !profile?.brand_id && !profile?.admin_scope;
}

export function isPartnerAdmin(profile?: Profile | null): boolean {
  const role = normalizeTenantToken(profile?.role);
  return PARTNER_ADMIN_ROLES.has(role) || Boolean(getPartnerTenant(profile));
}

export function partnerAccessLevel(profile?: Profile | null): PartnerAccessLevel | null {
  if (isPlatformAdmin(profile)) return 'platform_admin';
  const role = normalizeTenantToken(profile?.role);
  if (role === 'partner_admin_full') return 'partner_admin_full';
  if (role === 'partner_admin_limited') return 'partner_admin_limited';
  if (role === 'rx_plus_admin') return 'partner_admin_full';
  if (role === 'rep') return 'rep';
  if (role === 'patient' || role === 'customer' || role === 'client') return 'customer';
  return getPartnerTenant(profile)?.accessLevel ?? null;
}

export function getPartnerTenant(profile?: Profile | null): PartnerTenantConfig | null {
  if (!profile) return null;
  const brandId = normalizeTenantToken(profile.brand_id);
  const storeSlug = normalizeTenantToken(profile.store_slug);
  const adminScope = normalizeTenantScope(profile.admin_scope);
  const email = normalizeTenantToken(profile.email);
  const ownerEmail = normalizeTenantToken(profile.owner_email);

  const known = KNOWN_TENANTS.find((tenant) => (
    tenant.brandId === brandId
    || tenant.storeSlug === storeSlug
    || tenant.scopeCode === adminScope
    || (tenant.brandId === 'aactivated' && (['guy@aactivated.com', 'bossiquitinc@gmail.com'].includes(email) || ['guy@aactivated.com', 'bossiquitinc@gmail.com'].includes(ownerEmail)))
    || (tenant.brandId === 'aurora' && (['mnsgroup107@gmail.com', 'msngroup107@gmail.com', 'mike@auroralabsrx.com'].includes(email) || ['mnsgroup107@gmail.com', 'msngroup107@gmail.com', 'mike@auroralabsrx.com'].includes(ownerEmail)))
  ));
  if (!known) return null;

  const accessLevel = partnerAccessLevelFromProfile(profile) ?? known.accessLevel;
  return {
    ...known,
    accessLevel,
    modules: accessLevel === 'partner_admin_limited' ? known.modules.filter((module) => LIMITED_MODULES.includes(module)) : known.modules,
  };
}

export function partnerCan(profile: Profile | null | undefined, module: PartnerModule): boolean {
  if (isPlatformAdmin(profile)) return true;
  const tenant = getPartnerTenant(profile);
  return Boolean(tenant?.modules.includes(module));
}

function partnerAccessLevelFromProfile(profile: Profile): PartnerTenantConfig['accessLevel'] | null {
  const role = normalizeTenantToken(profile.role);
  if (role === 'partner_admin_full') return 'partner_admin_full';
  if (role === 'partner_admin_limited') return 'partner_admin_limited';
  const profileLevel = normalizeTenantToken(profile.partner_access_level);
  if (profileLevel === 'full') return 'partner_admin_full';
  if (profileLevel === 'limited') return 'partner_admin_limited';
  return null;
}
