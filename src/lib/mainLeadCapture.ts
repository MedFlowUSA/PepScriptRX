export type LeadCaptureSource = 'MAIN' | 'EHWSub';

const MAIN_DISCOUNT_CODE = 'PEP10';
const EHW_SUB_SCOPE_CODE = 'EHWSUB';
const EHW_DISCOUNT_CODE = 'PEP10';

export function getLeadCaptureDiscountCode(source: LeadCaptureSource): string {
  return source === 'EHWSub' ? EHW_DISCOUNT_CODE : MAIN_DISCOUNT_CODE;
}

export function getEhwSubScopeCode(): string {
  return EHW_SUB_SCOPE_CODE;
}

export function buildStorefrontStartHref(source: LeadCaptureSource, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    discount: getLeadCaptureDiscountCode(source),
    source: source === 'EHWSub' ? 'ehwsub' : 'main',
    ...extra,
  });

  if (source === 'EHWSub') {
    params.set('rep', EHW_SUB_SCOPE_CODE);
    params.set('scope', EHW_SUB_SCOPE_CODE);
  }

  return `/start?${params.toString()}`;
}
