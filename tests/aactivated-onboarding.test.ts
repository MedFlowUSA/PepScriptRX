import assert from 'node:assert/strict';
import test from 'node:test';
import { ONBOARDING_STEPS, canActivate, completionPercent, maskTin, validateKitSelection, type OnboardingSnapshot } from '../src/lib/aactivatedOnboarding.ts';

const complete: OnboardingSnapshot = { state: 'ready_for_activation', account: 'complete', agreement: 'complete', w9: 'accepted', starter_kit: 'complete', payout: 'complete' };

test('onboarding checklist has no welcome video', () => {
  assert.equal(ONBOARDING_STEPS.some((step) => /video/i.test(step.label)), false);
});

test('all server-required steps gate activation', () => {
  assert.equal(canActivate(complete), true);
  assert.equal(canActivate({ ...complete, payout: 'not_started' }), false);
  assert.equal(canActivate({ ...complete, state: 'application_declined' }), false);
});

test('pending W-9 is accepted only when policy permits it', () => {
  const pending = { ...complete, w9: 'submitted' as const };
  assert.equal(canActivate(pending), false);
  assert.equal(canActivate(pending, true), true);
});

test('starter kit cannot combine RETA and Tirzepatide', () => {
  assert.equal(validateKitSelection([{ product_path: 'reta' }]), true);
  assert.equal(validateKitSelection([{ product_path: 'tirzepatide' }]), true);
  assert.equal(validateKitSelection([{ product_path: 'reta' }, { product_path: 'tirzepatide' }]), false);
});

test('progress is deterministic and TIN output is masked', () => {
  assert.equal(completionPercent({ ...complete, payout: 'not_started' }), 80);
  assert.equal(maskTin('123-45-6789'), '***-**-6789');
  assert.equal(maskTin(''), '***-**-****');
});
