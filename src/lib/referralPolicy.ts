export const REFERRAL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const GENERIC_MAIN_PATHS = new Set(['/', '/library', '/certificates', '/mixing', '/peptide-calculator']);

export function isCapturedContextFresh(capturedAt: string, now = Date.now()): boolean {
  const capturedTime = Date.parse(capturedAt);
  return Number.isFinite(capturedTime) && capturedTime <= now && now - capturedTime <= REFERRAL_MAX_AGE_MS;
}

export function hasExplicitReferralParameter(search: string): boolean {
  const params = new URLSearchParams(search);
  return ['rep', 'ref', 'referral'].some((key) => Boolean(params.get(key)?.trim()));
}

export function shouldPresentReferralBranding(pathname: string, search: string, isolatedPortal: boolean): boolean {
  if (isolatedPortal) return true;
  if (hasExplicitReferralParameter(search)) return true;
  return !GENERIC_MAIN_PATHS.has(normalizePath(pathname));
}

function normalizePath(pathname: string): string {
  const normalized = pathname.trim().toLowerCase().replace(/\/+$/, '');
  return normalized || '/';
}

