export const REFERRAL_DISPLAY_BASE_URL = 'https://vsol.vercel.app';

export const DEFAULT_REFERRAL_DISCOUNT_AMOUNT = 10;
export const REFERRAL_STORAGE_KEY = 'pepscriptrx_referral';

export type StoredReferral = {
  repSlug: string;
  discountCode: string;
  discountAmount: number;
  capturedAt: string;
};

export function buildReferralLink(repSlug: string, baseUrl = REFERRAL_DISPLAY_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/r/${encodeURIComponent(repSlug)}`;
}
