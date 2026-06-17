import type { PatientSubmission, Profile, Rep, RepStoreIntakeSubmission, Role } from '../types';

export const AACTIVATED_PARENT_STORE_SLUG = 'aactivated';
export const AACTIVATED_PARENT_STORE_NAME = 'AACTIVATEDRX';
export const AACTIVATED_SOURCE_PORTAL = 'AACTIVATEDRX';
export const AACTIVATED_PARTNER_ADMIN_NAME = 'Guy Griffithe';
export const AACTIVATED_PARTNER_ADMIN_EMAIL = 'guy@aactivated.com';
export const AACTIVATED_PARTNER_ADMIN_EMAILS = ['guy@aactivated.com', 'bossiquitinc@gmail.com'];
export const AACTIVATED_ADMIN_REP_CODE = 'GUY60';
export const AACTIVATED_SCOPE_CODES = ['VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX'];

const PLATFORM_ADMIN_ROLES: Role[] = ['admin', 'owner', 'platform_admin', 'super_admin'];

export function isPlatformAdminRole(role?: string | null): boolean {
  return PLATFORM_ADMIN_ROLES.includes(String(role ?? '').toLowerCase() as Role);
}

export function isAactivatedPartnerAdmin(profile?: Profile | null): boolean {
  if (profile?.role !== 'rx_plus_admin') return false;
  const email = String(profile.email ?? '').trim().toLowerCase();
  const ownerEmail = String(profile.owner_email ?? '').trim().toLowerCase();
  const scopeTokens = [
    profile.admin_scope,
    profile.store_slug,
  ].map(normalizeScopeToken);

  return (
    AACTIVATED_PARTNER_ADMIN_EMAILS.includes(email)
    || AACTIVATED_PARTNER_ADMIN_EMAILS.includes(ownerEmail)
    || scopeTokens.some((token) => (
      AACTIVATED_SCOPE_CODES.includes(token)
      || token === AACTIVATED_PARENT_STORE_SLUG.toUpperCase()
      || token.includes('AACTIVATED')
    ))
  );
}

export function canSeeAactivatedPartnerScope(profile?: Profile | null): boolean {
  return isPlatformAdminRole(profile?.role) || isAactivatedPartnerAdmin(profile);
}

export function normalizeScopeToken(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isAactivatedIntake(row: RepStoreIntakeSubmission): boolean {
  if (row.source_portal_id === 'aactivated' || row.review_queue === 'aactivated') return true;
  if (normalizeScopeToken(row.parent_store_slug) === AACTIVATED_PARENT_STORE_SLUG.toUpperCase()) return true;
  if (AACTIVATED_PARTNER_ADMIN_EMAILS.map((email) => email.toUpperCase()).includes(normalizeScopeToken(row.partner_admin_email))) return true;
  if (normalizeScopeToken(row.approval_owner_email) === AACTIVATED_PARTNER_ADMIN_EMAIL.toUpperCase()) return true;
  if (normalizeScopeToken(row.review_admin_code) === AACTIVATED_ADMIN_REP_CODE) return true;

  const haystack = [
    row.source_portal,
    row.source_url,
    row.source_route,
    row.review_admin_name,
    row.internal_notes,
    row.parent_rep_or_admin_name,
    row.parent_store_name,
    row.store_type,
    row.store_brand_name,
  ].filter(Boolean).join(' ').toUpperCase();

  return haystack.includes('AACTIVATED');
}

export function intakeApprovalStatus(row: RepStoreIntakeSubmission): string {
  if (row.approval_status) return row.approval_status;
  if (row.status === 'ready_to_build' || row.status === 'launched') return 'approved';
  if (row.status === 'more_info_requested') return 'more_info_requested';
  if (row.status === 'rejected') return 'rejected';
  return 'pending';
}

export function isAactivatedOrder(row: Partial<PatientSubmission>): boolean {
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
  ].map(normalizeScopeToken);

  return tokens.some((token) => (
    AACTIVATED_SCOPE_CODES.includes(token)
    || token.includes('AACTIVATED')
    || token === AACTIVATED_PARENT_STORE_SLUG.toUpperCase()
  ));
}

export function isAactivatedRep(row: Partial<Rep>, guyProfileId?: string | null, guyRepId?: string | null): boolean {
  const tokens = [
    row.rep_slug,
    row.custom_store_slug,
    row.brand_name,
    row.rep_channel,
    row.rep_tier,
    row.payout_email,
  ].map(normalizeScopeToken);

  return (
    tokens.some((token) => (
      AACTIVATED_SCOPE_CODES.includes(token)
      || token.includes('AACTIVATED')
      || AACTIVATED_PARTNER_ADMIN_EMAILS.map((email) => email.toUpperCase()).includes(token)
    ))
    || (Boolean(guyProfileId) && row.managed_by_profile_id === guyProfileId)
    || (Boolean(guyRepId) && row.parent_rep_id === guyRepId)
  );
}
