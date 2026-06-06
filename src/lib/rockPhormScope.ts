import type { PatientSubmission, Profile, Rep } from '../types';

export const ROCKPHORM_ADMIN_EMAIL = 'rick@blueprintadvocate.io';
export const ROCKPHORM_SCOPE_CODE = 'ROCKPHORM';
export const ROCKPHORM_STORE_SLUG = 'rockphorm';
export const ROCKPHORM_STORE_NAME = 'Rock Phorm';
export const ROCKPHORM_COMMISSION_RATE = 0.60;
export const ROCKPHORM_LOGO_SRC = '/marketing/rockphorm-logo.png';
export const ROCKPHORM_VIAL_SRC = '/marketing/rockphorm-vial.png';

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
  return Boolean(
    scopedProfile?.role === 'admin'
    && (
      scopedProfile.email?.toLowerCase() === ROCKPHORM_ADMIN_EMAIL
      || normalizeRockToken(scopedProfile.admin_scope) === ROCKPHORM_SCOPE_CODE
      || String(scopedProfile.store_slug ?? '').trim().toLowerCase() === ROCKPHORM_STORE_SLUG
    ),
  );
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
    return token === ROCKPHORM_SCOPE_CODE || token === ROCKPHORM_STORE_SLUG.toUpperCase() || token.includes('ROCK PHORM');
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
      || token === ROCKPHORM_ADMIN_EMAIL.toUpperCase()
      || token === ROCKPHORM_STORE_SLUG.toUpperCase()
      || token.includes('ROCKPHORM')
      || token.includes('ROCK PHORM');
  });
}
