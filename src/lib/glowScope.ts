import type { PatientSubmission, Profile, Rep } from '../types';

export const GLOW_ADMIN_EMAIL = 'vanessacosio@ymail.com';
export const GLOW_SCOPE_CODE = 'GLOW';
export const GLOW_STORE_SLUG = 'glow';
export const GLOW_STORE_NAME = 'GLOW Sheer Radiance';
export const GLOW_COMMISSION_RATE = 0.80;
export const GLOW_LOGO_SRC = '/brands/glow/glow-peptide-complex.png';
export const GLOW_VIAL_SRC = '/brands/glow/glow-peptide-complex.png';

type ScopedProfile = Profile & {
  admin_scope?: string | null;
  store_slug?: string | null;
  owner_email?: string | null;
};

function normalizeGlowToken(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isGlowAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  const role = String(scopedProfile?.role ?? '').toLowerCase();
  return Boolean(
    (role === 'admin' || role === 'rx_plus_admin')
    && (
      scopedProfile?.email?.toLowerCase() === GLOW_ADMIN_EMAIL
      || normalizeGlowToken(scopedProfile?.admin_scope) === GLOW_SCOPE_CODE
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === GLOW_STORE_SLUG
    ),
  );
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
    const token = normalizeGlowToken(value);
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
    const token = normalizeGlowToken(value);
    return token === GLOW_SCOPE_CODE
      || token === GLOW_ADMIN_EMAIL.toUpperCase()
      || token === GLOW_STORE_SLUG.toUpperCase()
      || token.includes('GLOW SHEER RADIANCE')
      || token.includes('GLOW');
  });
}
