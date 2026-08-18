export const AACTIVATED_BRAND_ID = 'aactivated' as const;
export const AACTIVATED_ONBOARDING_PRODUCTION_ENABLED = false as const;

export type OnboardingStep = 'account' | 'agreement' | 'w9' | 'starter_kit' | 'payout';
export type OnboardingState =
  | 'application_pending'
  | 'application_more_info_required'
  | 'application_declined'
  | 'approved_activation_pending'
  | 'approved_onboarding_incomplete'
  | 'agreement_complete'
  | 'w9_pending_review'
  | 'starter_kit_pending'
  | 'payout_pending'
  | 'ready_for_activation'
  | 'active'
  | 'suspended';

export type StepStatus = 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'accepted' | 'correction_required' | 'complete';

export type OnboardingSnapshot = Record<OnboardingStep, StepStatus> & {
  state: OnboardingState;
};

export const ONBOARDING_STEPS: ReadonlyArray<{ id: OnboardingStep; label: string }> = [
  { id: 'agreement', label: 'Review and Sign Rep Agreement' },
  { id: 'w9', label: 'Complete Form W-9' },
  { id: 'starter_kit', label: 'Select and Purchase Starter Kit' },
  { id: 'payout', label: 'Add Payout Information' },
  { id: 'account', label: 'Complete Account Setup' },
];

export const STARTER_KIT_TIERS = ['starter_experience', 'momentum_business_builder', 'ultimate_business_builder'] as const;
export const STARTER_KIT_PRODUCT_PATHS = ['reta', 'tirzepatide'] as const;

export function isStepComplete(status: StepStatus, allowSubmittedW9 = false) {
  return status === 'complete' || status === 'accepted' || (allowSubmittedW9 && (status === 'submitted' || status === 'under_review'));
}

export function completionPercent(snapshot: OnboardingSnapshot, allowSubmittedW9 = false) {
  // This percentage represents work completed by the representative. A secure
  // submission is complete from the rep's perspective even while final admin
  // review is pending; activation eligibility remains governed by canActivate.
  const complete = ONBOARDING_STEPS.filter(({ id }) => isStepComplete(snapshot[id], id === 'w9' && allowSubmittedW9)
    || snapshot[id] === 'submitted' || snapshot[id] === 'under_review').length;
  return Math.round((complete / ONBOARDING_STEPS.length) * 100);
}

export function canActivate(snapshot: OnboardingSnapshot, allowSubmittedW9 = false) {
  return snapshot.state !== 'application_declined'
    && snapshot.state !== 'suspended'
    && isStepComplete(snapshot.account)
    && isStepComplete(snapshot.agreement)
    && isStepComplete(snapshot.w9, allowSubmittedW9)
    && isStepComplete(snapshot.starter_kit)
    && isStepComplete(snapshot.payout);
}

export function validateKitSelection(products: Array<{ product_path: string }>) {
  const paths = new Set(products.map((product) => product.product_path.toLowerCase()));
  return paths.size === 1 && (paths.has('reta') || paths.has('tirzepatide'));
}

export function maskTin(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : '***-**-****';
}

export function maskPayoutDestination(value: string) {
  const [name, domain] = value.trim().split('@');
  if (!domain) return `***${value.slice(-4)}`;
  return `${name.slice(0, 1)}***@${domain}`;
}
