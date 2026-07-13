import { getWhiteLabelPortal, type WhiteLabelPortal } from '../config/whiteLabelPortals';

export const ACTIVE_STORE_CONTEXT_KEY = 'activeStoreContext';

export type ActiveStoreContext = {
  storeSlug: string;
  displayName: string;
  portalId: string;
  homePath: string;
  pricingScope: string;
  repCode: string;
  adminCode?: string;
  catalogScope: string;
  logoSrc: string;
};

const MAIN_PATHS = new Set(['', '/', '/start', '/checkout']);

export function contextFromPortal(portal: WhiteLabelPortal): ActiveStoreContext {
  return {
    storeSlug: normalizeStoreSlug(portal.path),
    displayName: portal.brandName,
    portalId: portal.id,
    homePath: portal.path,
    pricingScope: portal.repSlug,
    repCode: portal.repSlug,
    adminCode: portal.backOfficePortal === 'admin' ? portal.repSlug : undefined,
    catalogScope: portal.distributorSlug,
    logoSrc: portal.logoSrc,
  };
}

export function resolveStoreContextFromLocation(location: Pick<Location, 'pathname' | 'search'>): ActiveStoreContext | null {
  const pathname = normalizePath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const portal = getWhiteLabelPortal(
    searchParams.get('brand') ||
    searchParams.get('store') ||
    searchParams.get('portal') ||
    searchParams.get('scope') ||
    searchParams.get('rep') ||
    firstPathSegment(location.pathname),
  );

  if (portal) return contextFromPortal(portal);
  if (pathname.startsWith('/pay/')) return null;
  if (!MAIN_PATHS.has(pathname)) return restoreActiveStoreContext();
  return null;
}

export function storeActiveStoreContext(context: ActiveStoreContext | null) {
  if (typeof window === 'undefined') return;
  if (!context) {
    window.sessionStorage.removeItem(ACTIVE_STORE_CONTEXT_KEY);
    return;
  }
  window.sessionStorage.setItem(ACTIVE_STORE_CONTEXT_KEY, JSON.stringify(context));
}

export function restoreActiveStoreContext(): ActiveStoreContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_STORE_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveStoreContext;
    return parsed?.portalId && parsed?.homePath ? parsed : null;
  } catch {
    return null;
  }
}

export function buildScopedPath(path: string, context?: ActiveStoreContext | null): string {
  if (!context) return path;
  if (!path || path === '/') return context.homePath;
  if (/^https?:\/\//i.test(path) || path.startsWith('#')) return path;

  const [pathname, suffix = ''] = splitPathSuffix(path);
  const scopedRoutes = new Set([
    '/library',
    '/product-library',
    '/mixing',
    '/privacy',
    '/terms',
    '/certificates',
    '/product-confidence',
    '/quality',
    '/verification',
    '/rep-intake',
    '/start-rep',
    '/approval',
    '/apply',
  ]);

  if (pathname.startsWith('/mixing/')) return `${context.homePath}${pathname}${suffix}`;
  if (scopedRoutes.has(pathname)) return `${context.homePath}${pathname}${suffix}`;

  return path;
}

export function buildScopedCheckoutPath(context?: ActiveStoreContext | null): string {
  if (!context) return '/start';
  const params = new URLSearchParams({
    scope: context.pricingScope,
    source: `${context.storeSlug}-portal`,
    rep: context.repCode,
    brand: context.portalId,
  });
  return `/start?${params.toString()}`;
}

export function normalizeStoreSlug(value: string): string {
  return String(value)
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function firstPathSegment(pathname: string): string {
  return normalizePath(pathname).split('/').filter(Boolean)[0] ?? '';
}

function normalizePath(pathname: string): string {
  const path = pathname || '/';
  return path === '/' ? '/' : path.replace(/\/+$/, '').toLowerCase();
}

function splitPathSuffix(path: string): [string, string] {
  const match = path.match(/^([^?#]*)(.*)$/);
  return [match?.[1] || path, match?.[2] || ''];
}
