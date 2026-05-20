export const REFERRAL_DISPLAY_BASE_URL = 'https://pepscriptrx.vercel.app';

export const DEFAULT_REFERRAL_DISCOUNT_AMOUNT = 10;
export const REFERRAL_STORAGE_KEY = 'pepscriptrx_referral';
export const LEGACY_REFERRAL_STORAGE_KEY = 'rep_referral';
export const REFERRAL_COOKIE_NAME = 'pepscriptrx_referral';
export const REFERRAL_VISITOR_KEY = 'pepscriptrx_referral_visitor';

export type StoredReferral = {
  repSlug: string;
  discountCode: string;
  discountAmount: number;
  capturedAt: string;
  repName?: string;
  portalPath?: string;
  source?: string;
};

export type RepPortal = {
  path: string;
  repSlug: string;
  discountCode: string;
  repName: string;
  manifest: string;
};

export const REP_PORTALS: RepPortal[] = [
  {
    path: '/rick',
    repSlug: 'RICK50',
    discountCode: 'RICK50',
    repName: 'Rick Diaz',
    manifest: '/manifests/rick.webmanifest',
  },
  {
    path: '/mark',
    repSlug: 'MARK65',
    discountCode: 'MARK65',
    repName: 'Mark Ayala',
    manifest: '/manifests/mark.webmanifest',
  },
  {
    path: '/dennis',
    repSlug: 'DEAN50',
    discountCode: 'DEAN50',
    repName: 'Dennis Hernandez',
    manifest: '/manifests/dennis.webmanifest',
  },
  {
    path: '/gabriel',
    repSlug: 'GABE50',
    discountCode: 'GABE50',
    repName: 'Gabriel Martinez',
    manifest: '/manifests/gabriel.webmanifest',
  },
  {
    path: '/jerry',
    repSlug: 'JERRY45',
    discountCode: 'JERRY45',
    repName: 'Jerry Diaz',
    manifest: '/manifests/jerry.webmanifest',
  },
];

export function buildReferralLink(repSlug: string, baseUrl = REFERRAL_DISPLAY_BASE_URL): string {
  const portal = getPortalByCode(repSlug);
  const path = portal?.path ?? `/r/${encodeURIComponent(repSlug)}`;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function getPortalByPath(pathname: string): RepPortal | null {
  const normalized = normalizePath(pathname);
  return REP_PORTALS.find((portal) => portal.path === normalized) ?? null;
}

export function getPortalByCode(code: string): RepPortal | null {
  const normalized = normalizeCode(code);
  return REP_PORTALS.find((portal) => (
    portal.repSlug === normalized || portal.discountCode === normalized || portal.path.slice(1).toUpperCase() === normalized
  )) ?? null;
}

export function captureReferral(input: string | RepPortal, source = 'unknown'): StoredReferral {
  const portal = typeof input === 'string' ? getPortalByCode(input) : input;
  const repSlug = portal?.repSlug ?? normalizeCode(String(input));
  const discountCode = portal?.discountCode ?? repSlug;
  const referral: StoredReferral = {
    repSlug,
    discountCode,
    discountAmount: DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
    capturedAt: new Date().toISOString(),
    repName: portal?.repName,
    portalPath: portal?.path,
    source,
  };

  persistReferral(referral);
  return referral;
}

export function persistReferral(referral: StoredReferral): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeReferral(referral);
  const serialized = JSON.stringify(normalized);
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, serialized);
  window.localStorage.setItem(LEGACY_REFERRAL_STORAGE_KEY, normalized.repSlug);
  window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, serialized);
  window.sessionStorage.setItem(LEGACY_REFERRAL_STORAGE_KEY, normalized.repSlug);
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(serialized)}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

export function restoreReferral(): StoredReferral | null {
  if (typeof window === 'undefined') return null;
  const candidates = [
    readStoredReferral(window.localStorage.getItem(REFERRAL_STORAGE_KEY)),
    readStoredReferral(window.sessionStorage.getItem(REFERRAL_STORAGE_KEY)),
    readStoredReferral(readCookie(REFERRAL_COOKIE_NAME)),
    readLegacyReferral(window.localStorage.getItem(LEGACY_REFERRAL_STORAGE_KEY)),
    readLegacyReferral(window.sessionStorage.getItem(LEGACY_REFERRAL_STORAGE_KEY)),
  ];
  const referral = candidates.find(Boolean) ?? null;
  if (referral) persistReferral(referral);
  return referral;
}

export function applyReferralFromUrl(search: string, pathname = ''): StoredReferral | null {
  const params = new URLSearchParams(search);
  const portal = getPortalByPath(pathname);
  const rep = params.get('rep') || params.get('ref') || params.get('referral') || params.get('discount');
  if (portal) return captureReferral(portal, 'portal_route');
  if (rep) return captureReferral(rep, 'url_param');
  return restoreReferral();
}

export function updateManifestForReferral(referral: StoredReferral | null): void {
  if (typeof document === 'undefined') return;
  const portal = referral?.portalPath ? getPortalByPath(referral.portalPath) : referral ? getPortalByCode(referral.repSlug) : null;
  const manifestHref = portal?.manifest ?? '/manifest.webmanifest';
  const title = portal ? `PepScriptRX - ${portal.repName}` : 'PepScriptRX';
  let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifest) {
    manifest = document.createElement('link');
    manifest.rel = 'manifest';
    document.head.appendChild(manifest);
  }
  manifest.href = manifestHref;
  document.title = title;
}

export function getReferralStartPath(referral: StoredReferral): string {
  const params = new URLSearchParams({
    rep: referral.repSlug,
    discount: referral.discountCode,
  });
  return `/start?${params.toString()}`;
}

export function getReferralVisitorId(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(REFERRAL_VISITOR_KEY);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(REFERRAL_VISITOR_KEY, generated);
  return generated;
}

function normalizeReferral(referral: StoredReferral): StoredReferral {
  const portal = getPortalByCode(referral.repSlug) ?? (referral.portalPath ? getPortalByPath(referral.portalPath) : null);
  return {
    ...referral,
    repSlug: portal?.repSlug ?? normalizeCode(referral.repSlug),
    discountCode: portal?.discountCode ?? normalizeCode(referral.discountCode || referral.repSlug),
    discountAmount: Number(referral.discountAmount || DEFAULT_REFERRAL_DISCOUNT_AMOUNT),
    capturedAt: referral.capturedAt || new Date().toISOString(),
    repName: portal?.repName ?? referral.repName,
    portalPath: portal?.path ?? referral.portalPath,
  };
}

function readStoredReferral(raw: string | null): StoredReferral | null {
  if (!raw) return null;
  try {
    const decoded = raw.startsWith('%7B') ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded) as StoredReferral;
    if (!parsed.repSlug) return null;
    return normalizeReferral(parsed);
  } catch {
    return null;
  }
}

function readLegacyReferral(raw: string | null): StoredReferral | null {
  if (!raw) return null;
  const code = normalizeCode(raw);
  if (!code) return null;
  const portal = getPortalByCode(code);
  return {
    repSlug: portal?.repSlug ?? code,
    discountCode: portal?.discountCode ?? code,
    discountAmount: DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
    capturedAt: new Date().toISOString(),
    repName: portal?.repName,
    portalPath: portal?.path,
    source: 'legacy_storage',
  };
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function normalizeCode(value: string): string {
  return value.trim().replace(/^\/+/, '').toUpperCase();
}

function normalizePath(value: string): string {
  const path = value.split('?')[0].replace(/\/+$/, '');
  return path || '/';
}
