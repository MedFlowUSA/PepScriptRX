const CHECKOUT_SCOPE_KEY = 'pepscriptrx_checkout_scope';
const SCOPE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

export type CheckoutScopeSource = 'url' | 'session' | 'manual_checkout' | 'admin_link' | 'default';

export type CheckoutScopeState = {
  code: string;
  source: CheckoutScopeSource;
};

export function normalizeCheckoutScopeCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isValidCheckoutScopeFormat(value: string | null | undefined): boolean {
  const normalized = normalizeCheckoutScopeCode(value);
  return Boolean(normalized && SCOPE_RE.test(normalized));
}

export function storeCheckoutScope(scope: CheckoutScopeState | null) {
  if (typeof window === 'undefined') return;
  if (!scope || !isValidCheckoutScopeFormat(scope.code)) {
    window.sessionStorage.removeItem(CHECKOUT_SCOPE_KEY);
    return;
  }
  window.sessionStorage.setItem(CHECKOUT_SCOPE_KEY, JSON.stringify({
    code: normalizeCheckoutScopeCode(scope.code),
    source: scope.source,
  }));
}

export function restoreCheckoutScope(): CheckoutScopeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutScopeState;
    const code = normalizeCheckoutScopeCode(parsed.code);
    if (!isValidCheckoutScopeFormat(code)) return null;
    return { code, source: parsed.source || 'session' };
  } catch {
    return null;
  }
}

export function resolveCheckoutScope(
  searchParams: URLSearchParams,
  options: { restoreStored?: boolean } = {},
): CheckoutScopeState | null {
  const restoreStored = options.restoreStored ?? true;
  const explicitScope = normalizeCheckoutScopeCode(searchParams.get('scope'));
  if (isValidCheckoutScopeFormat(explicitScope)) {
    const source = searchParams.get('source') === 'admin_link' ? 'admin_link' : 'url';
    const scope = { code: explicitScope, source } as CheckoutScopeState;
    storeCheckoutScope(scope);
    return scope;
  }

  if (restoreStored) {
    const stored = restoreCheckoutScope();
    if (stored) return { ...stored, source: 'session' };
  } else {
    storeCheckoutScope(null);
  }

  const legacyCode = normalizeCheckoutScopeCode(
    searchParams.get('rep') || searchParams.get('admin') || searchParams.get('store'),
  );
  if (isValidCheckoutScopeFormat(legacyCode)) {
    const scope = { code: legacyCode, source: 'url' } as CheckoutScopeState;
    storeCheckoutScope(scope);
    return scope;
  }

  return null;
}
