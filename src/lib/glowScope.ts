import type { PatientSubmission, Profile, Rep } from '../types';

export const GLOW_ADMIN_EMAIL = 'vanessacosio@ymail.com';
export const GLOW_SCOPE_CODE = 'GLOW';
export const GLOW_STORE_SLUG = 'glow';
export const GLOW_STORE_NAME = 'GLOW Sheer Radiance';
export const GLOW_COMMISSION_RATE = 0.80;
export const GLOW_LOGO_SRC = '/brands/glow/glow-peptide-complex.png';
export const GLOW_VIAL_SRC = '/brands/glow/glow-peptide-complex.png';
export const GLOW_APPROVED_REP_CODES = ['GLOW', 'DEAN50', 'GINTO'] as const;
export const GLOW_DISCOUNT_CODE = 'GLOW&SAVE25';
export const GLOW_REP_QUERY_OR = [
  'rep_slug.eq.GLOW',
  'rep_slug.eq.DEAN50',
  'rep_slug.eq.GINTO',
  'custom_store_slug.eq.glow',
  'rep_channel.eq.glow_partner_admin',
  'rep_channel.eq.glow_downline_rep',
  'rep_tier.eq.glow_admin_distributor',
  'rep_tier.eq.glow_downline_rep',
].join(',');
export const GLOW_ORDER_QUERY_OR = [
  'checkout_scope_code.eq.GLOW',
  'store_slug.eq.glow',
  'source_store.eq.GLOW',
  'source_admin.eq.GLOW',
  'source_rep.eq.GLOW',
  'admin_code.eq.GLOW',
  'referral_code.eq.GLOW',
  'referral_code.eq.DEAN50',
  'referral_code.eq.GINTO',
  'discount_code.eq.GLOW&SAVE25',
].join(',');
export const GLOW_ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin', icon: '01' },
  { label: 'Orders', path: '/admin/submissions', icon: '02' },
  { label: 'Customers', path: '/admin/leads', icon: '03' },
  { label: 'Products', path: '/admin/products', icon: '04' },
  { label: 'Analytics', path: '/admin/analytics', icon: '05' },
  { label: 'Payouts', path: '/admin/payouts', icon: '06' },
  { label: 'Reps', path: '/admin/reps', icon: '07' },
  { label: 'Store Settings', path: '/admin/store-settings', icon: '08' },
];

type ScopedProfile = Profile & {
  admin_scope?: string | null;
  store_slug?: string | null;
  owner_email?: string | null;
};

function normalizeGlowToken(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeGlowSlug(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function isApprovedGlowRepCode(value?: string | null): boolean {
  const token = normalizeGlowToken(value);
  return GLOW_APPROVED_REP_CODES.some((code) => code === token);
}

export function isGlowAdmin(profile?: Profile | null): boolean {
  const scopedProfile = profile as ScopedProfile | null | undefined;
  const role = String(scopedProfile?.role ?? '').toLowerCase();
  return Boolean(
    (role === 'admin' || role === 'rx_plus_admin' || role === 'partner_admin_full' || role === 'partner_admin_limited')
    && (
      scopedProfile?.email?.toLowerCase() === GLOW_ADMIN_EMAIL
      || normalizeGlowToken(scopedProfile?.admin_scope) === GLOW_SCOPE_CODE
      || String(scopedProfile?.store_slug ?? '').trim().toLowerCase() === GLOW_STORE_SLUG
    ),
  );
}

export function isGlowOrder(row: Partial<PatientSubmission>): boolean {
  const rep = row.rep as Rep | undefined;
  return normalizeGlowToken(row.checkout_scope_code) === GLOW_SCOPE_CODE
    || normalizeGlowSlug(row.store_slug) === GLOW_STORE_SLUG
    || normalizeGlowToken(row.source_store) === GLOW_SCOPE_CODE
    || normalizeGlowToken(row.source_admin) === GLOW_SCOPE_CODE
    || normalizeGlowToken(row.source_rep) === GLOW_SCOPE_CODE
    || normalizeGlowToken(row.admin_code) === GLOW_SCOPE_CODE
    || normalizeGlowToken(row.store_name) === GLOW_STORE_NAME.toUpperCase()
    || normalizeGlowToken(row.discount_code) === GLOW_DISCOUNT_CODE
    || isApprovedGlowRepCode(row.referral_code)
    || isApprovedGlowRepCode(rep?.rep_slug)
    || normalizeGlowSlug(rep?.custom_store_slug) === GLOW_STORE_SLUG;
}

export function isGlowRep(row: Partial<Rep>): boolean {
  return isApprovedGlowRepCode(row.rep_slug)
    || normalizeGlowSlug(row.custom_store_slug) === GLOW_STORE_SLUG
    || normalizeGlowToken(row.rep_channel) === 'GLOW_PARTNER_ADMIN'
    || normalizeGlowToken(row.rep_channel) === 'GLOW_DOWNLINE_REP'
    || normalizeGlowToken(row.rep_tier) === 'GLOW_ADMIN_DISTRIBUTOR'
    || normalizeGlowToken(row.rep_tier) === 'GLOW_DOWNLINE_REP';
}
