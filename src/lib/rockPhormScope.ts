import type { PatientSubmission, Profile, Rep } from '../types';

export const ROCKPHORM_ADMIN_EMAIL = 'rick@blueprintadvocate.io';
export const ROCKPHORM_SCOPE_CODE = 'ROCKPHORM';
export const ROCKPHORM_STORE_SLUG = 'rockphorm';
export const ROCKPHORM_STORE_NAME = 'Rock Phorm';
export const ROCKPHORM_COMMISSION_RATE = 0.60;
export const ROCKPHORM_LOGO_SRC = '/marketing/rockphorm-logo.png';
export const ROCKPHORM_VIAL_SRC = '/marketing/rockphorm-vial.png';
export const AURORA_ADMIN_EMAIL = 'mnsgroup107@gmail.com';
export const AURORA_SCOPE_CODE = 'AURORA';
export const AURORA_ADMIN_CODE = 'MIKEAURORA';
export const AURORA_STORE_SLUG = 'aurora';
export const AURORA_STORE_NAME = 'Aurora Labs';
export const AURORA_COMMISSION_RATE = 0.40;
export const AURORA_LOGO_SRC = '/marketing/aurora-logo.png';
export const AURORA_VIAL_SRC = '/marketing/aurora-vial.png';
export const PHYSIOPEPTIDES_SCOPE_CODE = 'PHYSIOPEPTIDES';
export const PHYSIOPEPTIDES_STORE_SLUG = 'physiopeptides';
export const PHYSIOPEPTIDES_STORE_NAME = 'PhysioPeptides';
export const PHYSIOPEPTIDES_COMMISSION_RATE = 0.99;
export const PHYSIOPEPTIDES_LOGO_SRC = '/marketing/physiopeptides-logo.png';
export const PHYSIOPEPTIDES_VIAL_SRC = '/marketing/physiopeptides-vial.png';
export const GLOW_ADMIN_EMAIL = 'vanessacosio@ymail.com';
export const GLOW_SCOPE_CODE = 'GLOW';
export const GLOW_STORE_SLUG = 'glow';
export const GLOW_STORE_NAME = 'GLOW Sheer Radiance';
export const GLOW_COMMISSION_RATE = 0.80;
export const GLOW_LOGO_SRC = '/brands/glow/glow-peptide-complex.png';
export const GLOW_VIAL_SRC = '/brands/glow/glow-peptide-complex.png';
export const OPTIMAX_ADMIN_EMAIL = 'gmart36@gmail.com';
export const OPTIMAX_SCOPE_CODE = 'OPTIMAX';
export const OPTIMAX_ADMIN_CODE = 'GABE50';
export const OPTIMAX_STORE_SLUG = 'optimax';
export const OPTIMAX_STOREFRONT_SLUG = 'optimax-peptide-therapy';
export const OPTIMAX_STORE_NAME = 'Optimax Peptide Therapy';
export const OPTIMAX_COMMISSION_RATE = 0.55;
export const OPTIMAX_LOGO_SRC = '/marketing/optimax-logo-clean.png';
export const OPTIMAX_VIAL_SRC = '/marketing/optimax-vial.png';

export const ROCKPHORM_ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin', icon: '01' },
  { label: 'Orders', path: '/admin/submissions', icon: '02' },
  { label: 'Customers', path: '/admin/leads', icon: '03' },
  { label: 'Products', path: '/admin/products', icon: '04' },
  { label: 'Pricing', path: '/admin/pricing', icon: '05' },
  { label: 'Commission', path: '/admin/commission-center', icon: '06' },
  { label: 'Store Settings', path: '/admin/store-settings', icon: '07' },
  { label: 'Reps', path: '/admin/reps', icon: '08' },
];

type ScopedProfile = Profile & {
  admin_scope?: string | null;
  store_slug?: string | null;
  owner_email?: string | null;
};

export function normalizeRockToken(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isRockPhormAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  const role = String(scopedProfile?.role ?? '').toLowerCase();
  return Boolean(
    (role === 'admin' || role === 'rx_plus_admin')
    && (
      scopedProfile?.email?.toLowerCase() === ROCKPHORM_ADMIN_EMAIL
      || scopedProfile?.email?.toLowerCase() === AURORA_ADMIN_EMAIL
      || scopedProfile?.email?.toLowerCase() === GLOW_ADMIN_EMAIL
      || scopedProfile?.email?.toLowerCase() === OPTIMAX_ADMIN_EMAIL
      || normalizeRockToken(scopedProfile?.admin_scope) === ROCKPHORM_SCOPE_CODE
      || normalizeRockToken(scopedProfile?.admin_scope) === AURORA_SCOPE_CODE
      || normalizeRockToken(scopedProfile?.admin_scope) === PHYSIOPEPTIDES_SCOPE_CODE
      || normalizeRockToken(scopedProfile?.admin_scope) === GLOW_SCOPE_CODE
      || normalizeRockToken(scopedProfile?.admin_scope) === OPTIMAX_SCOPE_CODE
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === ROCKPHORM_STORE_SLUG
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === AURORA_STORE_SLUG
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === PHYSIOPEPTIDES_STORE_SLUG
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === GLOW_STORE_SLUG
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === OPTIMAX_STORE_SLUG
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === OPTIMAX_STOREFRONT_SLUG
    ),
  );
}

export function isAuroraLabsAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  return Boolean(
    scopedProfile?.role === 'admin'
    && (
      scopedProfile.email?.toLowerCase() === AURORA_ADMIN_EMAIL
      || normalizeRockToken(scopedProfile.admin_scope) === AURORA_SCOPE_CODE
      || String(scopedProfile.store_slug ?? '').trim().toLowerCase() === AURORA_STORE_SLUG
    ),
  );
}

export function isPhysioPeptidesAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  return Boolean(
    scopedProfile?.role === 'admin'
    && (
      normalizeRockToken(scopedProfile.admin_scope) === PHYSIOPEPTIDES_SCOPE_CODE
      || String(scopedProfile.store_slug ?? '').trim().toLowerCase() === PHYSIOPEPTIDES_STORE_SLUG
    ),
  );
}

export function isGlowAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  const role = String(scopedProfile?.role ?? '').toLowerCase();
  return Boolean(
    (role === 'admin' || role === 'rx_plus_admin')
    && (
      scopedProfile?.email?.toLowerCase() === GLOW_ADMIN_EMAIL
      || normalizeRockToken(scopedProfile?.admin_scope) === GLOW_SCOPE_CODE
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === GLOW_STORE_SLUG
    ),
  );
}

export function isOptimaxAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  const role = String(scopedProfile?.role ?? '').toLowerCase();
  const storeSlug = String(scopedProfile?.store_slug ?? '').trim().toLowerCase();
  return Boolean(
    (role === 'admin' || role === 'rx_plus_admin')
    && (
      scopedProfile?.email?.toLowerCase() === OPTIMAX_ADMIN_EMAIL
      || normalizeRockToken(scopedProfile?.admin_scope) === OPTIMAX_SCOPE_CODE
      || storeSlug === OPTIMAX_STORE_SLUG
      || storeSlug === OPTIMAX_STOREFRONT_SLUG
    ),
  );
}

export function isAuroraLabsOrder(row: Partial<PatientSubmission>): boolean {
  const tokens = [
    row.checkout_scope_code,
    row.source_portal,
    row.source_route,
    row.source_store,
    row.source_admin,
    row.source_rep,
    row.admin_code,
    row.store_slug,
    row.store_name,
    row.referral_code,
    row.discount_code,
    (row.rep as Rep | undefined)?.rep_slug,
    (row.rep as Rep | undefined)?.brand_name,
    (row.rep as Rep | undefined)?.custom_store_slug,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === AURORA_SCOPE_CODE
      || token === AURORA_ADMIN_CODE
      || token === AURORA_STORE_SLUG.toUpperCase()
      || token.includes('AURORA LABS')
      || token.includes('AURORA');
  });
}

export function isAuroraLabsRep(row: Partial<Rep>): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
    row.referral_path,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === AURORA_SCOPE_CODE
      || token === AURORA_ADMIN_CODE
      || token === AURORA_ADMIN_EMAIL.toUpperCase()
      || token === AURORA_STORE_SLUG.toUpperCase()
      || token.includes('AURORA LABS')
      || token.includes('AURORA');
  });
}

export function isRockPhormOrder(row: Partial<PatientSubmission>): boolean {
  const tokens = [
    row.checkout_scope_code,
    row.source_portal,
    row.source_route,
    row.source_store,
    row.source_admin,
    row.source_rep,
    row.admin_code,
    row.store_slug,
    row.store_name,
    row.referral_code,
    row.discount_code,
    (row.rep as Rep | undefined)?.rep_slug,
    (row.rep as Rep | undefined)?.brand_name,
    (row.rep as Rep | undefined)?.custom_store_slug,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === ROCKPHORM_SCOPE_CODE
      || token === AURORA_SCOPE_CODE
      || token === AURORA_ADMIN_CODE
      || token === ROCKPHORM_STORE_SLUG.toUpperCase()
      || token === AURORA_STORE_SLUG.toUpperCase()
      || token.includes('ROCK PHORM')
      || token.includes('AURORA LABS')
      || token.includes('AURORA');
  });
}

export function isRockPhormRep(row: Partial<Rep>): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
    row.referral_path,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === ROCKPHORM_SCOPE_CODE
      || token === AURORA_SCOPE_CODE
      || token === AURORA_ADMIN_CODE
      || token === AURORA_ADMIN_EMAIL.toUpperCase()
      || token === ROCKPHORM_ADMIN_EMAIL.toUpperCase()
      || token === ROCKPHORM_STORE_SLUG.toUpperCase()
      || token === AURORA_STORE_SLUG.toUpperCase()
      || token.includes('ROCKPHORM')
      || token.includes('ROCK PHORM')
      || token.includes('AURORA LABS')
      || token.includes('AURORA');
  });
}

export function isPhysioPeptidesOrder(row: Partial<PatientSubmission>): boolean {
  const tokens = [
    row.checkout_scope_code,
    row.source_portal,
    row.source_route,
    row.source_store,
    row.source_admin,
    row.source_rep,
    row.admin_code,
    row.store_slug,
    row.store_name,
    row.referral_code,
    row.discount_code,
    (row.rep as Rep | undefined)?.rep_slug,
    (row.rep as Rep | undefined)?.brand_name,
    (row.rep as Rep | undefined)?.custom_store_slug,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === PHYSIOPEPTIDES_SCOPE_CODE
      || token === PHYSIOPEPTIDES_STORE_SLUG.toUpperCase()
      || token.includes('PHYSIOPEPTIDES')
      || token.includes('PHYSIO PEPTIDES');
  });
}

export function isPhysioPeptidesRep(row: Partial<Rep>): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
    row.referral_path,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === PHYSIOPEPTIDES_SCOPE_CODE
      || token === PHYSIOPEPTIDES_STORE_SLUG.toUpperCase()
      || token.includes('PHYSIOPEPTIDES')
      || token.includes('PHYSIO PEPTIDES');
  });
}

export function isOptimaxOrder(row: Partial<PatientSubmission>): boolean {
  const tokens = [
    row.checkout_scope_code,
    row.source_portal,
    row.source_route,
    row.source_store,
    row.source_admin,
    row.source_rep,
    row.admin_code,
    row.store_slug,
    row.store_name,
    row.referral_code,
    row.discount_code,
    (row.rep as Rep | undefined)?.rep_slug,
    (row.rep as Rep | undefined)?.brand_name,
    (row.rep as Rep | undefined)?.custom_store_slug,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === OPTIMAX_SCOPE_CODE
      || token === OPTIMAX_ADMIN_CODE
      || token === OPTIMAX_STORE_SLUG.toUpperCase()
      || token === OPTIMAX_STOREFRONT_SLUG.toUpperCase()
      || token.includes('OPTIMAX PEPTIDE THERAPY')
      || token.includes('OPTIMAX');
  });
}

export function isOptimaxRep(row: Partial<Rep>): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
    row.referral_path,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === OPTIMAX_SCOPE_CODE
      || token === OPTIMAX_ADMIN_CODE
      || token === OPTIMAX_ADMIN_EMAIL.toUpperCase()
      || token === OPTIMAX_STORE_SLUG.toUpperCase()
      || token === OPTIMAX_STOREFRONT_SLUG.toUpperCase()
      || token.includes('OPTIMAX PEPTIDE THERAPY')
      || token.includes('OPTIMAX');
  });
}

export function isGlowOrder(row: Partial<PatientSubmission>): boolean {
  const tokens = [
    row.checkout_scope_code,
    row.source_portal,
    row.source_route,
    row.source_store,
    row.source_admin,
    row.source_rep,
    row.admin_code,
    row.store_slug,
    row.store_name,
    row.referral_code,
    row.discount_code,
    (row.rep as Rep | undefined)?.rep_slug,
    (row.rep as Rep | undefined)?.brand_name,
    (row.rep as Rep | undefined)?.custom_store_slug,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === GLOW_SCOPE_CODE
      || token === GLOW_STORE_SLUG.toUpperCase()
      || token === 'GLOW&SAVE25'
      || token.includes('GLOW SHEER RADIANCE')
      || token.includes('GLOW');
  });
}

export function isGlowRep(row: Partial<Rep>): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
    row.referral_path,
  ];

  return tokens.some((value) => {
    const token = normalizeRockToken(value);
    return token === GLOW_SCOPE_CODE
      || token === GLOW_ADMIN_EMAIL.toUpperCase()
      || token === GLOW_STORE_SLUG.toUpperCase()
      || token.includes('GLOW SHEER RADIANCE')
      || token.includes('GLOW');
  });
}
