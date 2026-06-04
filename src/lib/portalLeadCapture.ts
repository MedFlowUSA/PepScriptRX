import type { WhiteLabelPortal } from '../config/whiteLabelPortals';

export const PORTAL_LEAD_DISCOUNT_CODE = 'PORTAL10';
export const PORTAL_LEAD_DISCOUNT_PERCENT = 0.10;

const STORAGE_KEY = 'pepscriptrx_portal_age_lead';
const SESSION_CONFIRMATION_KEY = 'pepscriptrx_portal_age_confirmed';
const DISCOUNT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export type PortalLeadCapture = {
  portalId: string;
  portalName: string;
  portalPath: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ageConfirmed: boolean;
  discountCode: string;
  discountPercent: number;
  discountTriggered: boolean;
  capturedAt: string;
};

export function getPortalLeadStorageKey(portalId: string): string {
  return `${STORAGE_KEY}:${portalId}`;
}

function getPortalAgeSessionKey(portalId: string): string {
  return `${SESSION_CONFIRMATION_KEY}:${portalId}`;
}

export function buildPortalLeadCapture(
  portal: WhiteLabelPortal,
  values: { firstName: string; lastName: string; email: string; phone: string },
): PortalLeadCapture {
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim().toLowerCase();
  const phone = values.phone.trim();
  const discountTriggered = Boolean(firstName && lastName && email);

  return {
    portalId: portal.id,
    portalName: portal.brandName,
    portalPath: portal.path,
    firstName,
    lastName,
    email,
    phone,
    ageConfirmed: true,
    discountCode: PORTAL_LEAD_DISCOUNT_CODE,
    discountPercent: PORTAL_LEAD_DISCOUNT_PERCENT,
    discountTriggered,
    capturedAt: new Date().toISOString(),
  };
}

export function storePortalLeadCapture(capture: PortalLeadCapture) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getPortalLeadStorageKey(capture.portalId), JSON.stringify(capture));
  window.sessionStorage.setItem(getPortalAgeSessionKey(capture.portalId), 'true');
}

export function storePortalAgeSessionConfirmation(portalId?: string | null) {
  if (typeof window === 'undefined' || !portalId) return;
  window.sessionStorage.setItem(getPortalAgeSessionKey(portalId), 'true');
}

export function hasPortalAgeSessionConfirmation(portalId?: string | null): boolean {
  if (typeof window === 'undefined' || !portalId) return false;
  return window.sessionStorage.getItem(getPortalAgeSessionKey(portalId)) === 'true';
}

export function restorePortalLeadCapture(portalId?: string | null): PortalLeadCapture | null {
  if (typeof window === 'undefined' || !portalId) return null;
  try {
    const raw = window.localStorage.getItem(getPortalLeadStorageKey(portalId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalLeadCapture;
    if (!parsed.ageConfirmed) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasPortalAgeConfirmation(portalId?: string | null): boolean {
  return hasPortalAgeSessionConfirmation(portalId) || Boolean(restorePortalLeadCapture(portalId)?.ageConfirmed);
}

export function getActivePortalLeadDiscount(portalId?: string | null): PortalLeadCapture | null {
  const capture = restorePortalLeadCapture(portalId);
  if (!capture?.discountTriggered || !capture.email) return null;
  const capturedMs = Date.parse(capture.capturedAt);
  if (!Number.isFinite(capturedMs) || Date.now() - capturedMs > DISCOUNT_WINDOW_MS) return null;
  return capture;
}
