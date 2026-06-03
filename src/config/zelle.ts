type ImportMetaEnvMap = Record<string, string | undefined>;

const env = import.meta.env as unknown as ImportMetaEnvMap;

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

function envNumber(defaultValue: number, ...keys: string[]) {
  const raw = envValue(...keys);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export const zelleConfig = {
  enabled: envValue('NEXT_PUBLIC_ZELLE_ENABLED', 'VITE_ZELLE_ENABLED').toLowerCase() === 'true',
  discountBps: envNumber(1000, 'NEXT_PUBLIC_ZELLE_DISCOUNT_BPS', 'VITE_ZELLE_DISCOUNT_BPS'),
  displayName: envValue('NEXT_PUBLIC_ZELLE_DISPLAY_NAME', 'VITE_ZELLE_DISPLAY_NAME') || 'Vitality Institute',
  recipientKind: envValue('NEXT_PUBLIC_ZELLE_RECIPIENT_KIND', 'VITE_ZELLE_RECIPIENT_KIND') || 'email',
  recipientValue: envValue('NEXT_PUBLIC_ZELLE_RECIPIENT_VALUE', 'VITE_ZELLE_RECIPIENT_VALUE') || '',
  lowRiskMaxCents: envNumber(50000, 'NEXT_PUBLIC_ZELLE_LOW_RISK_MAX_CENTS', 'VITE_ZELLE_LOW_RISK_MAX_CENTS'),
};

export function centsFromDollars(value: number) {
  return Math.max(0, Math.round(value * 100));
}

export function dollarsFromCents(value: number | null | undefined) {
  return Number(((value ?? 0) / 100).toFixed(2));
}
