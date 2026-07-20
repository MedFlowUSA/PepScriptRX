import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExplicitReferralParameter, isCapturedContextFresh, REFERRAL_MAX_AGE_MS, shouldPresentReferralBranding } from '../src/lib/referralPolicy.ts';

const now = Date.parse('2026-07-20T12:00:00.000Z');

test('clean direct main-store and library visits remain generic', () => {
  assert.equal(shouldPresentReferralBranding('/', '', false), false);
  assert.equal(shouldPresentReferralBranding('/library', '', false), false);
});

test('explicit referred main-store session may present referral branding', () => {
  assert.equal(shouldPresentReferralBranding('/', '?rep=EHWSUB', false), true);
});

test('discount and referral parameters remain separate', () => {
  assert.equal(hasExplicitReferralParameter('?discount=SAVE20'), false);
  assert.equal(shouldPresentReferralBranding('/', '?discount=SAVE20', false), false);
});

test('partner storefront remains branded without referral query parameters', () => {
  assert.equal(shouldPresentReferralBranding('/aactivated', '', true), true);
});

test('fresh context remains valid and expired or future context is rejected', () => {
  assert.equal(isCapturedContextFresh(new Date(now - REFERRAL_MAX_AGE_MS + 1).toISOString(), now), true);
  assert.equal(isCapturedContextFresh(new Date(now - REFERRAL_MAX_AGE_MS - 1).toISOString(), now), false);
  assert.equal(isCapturedContextFresh(new Date(now + 1).toISOString(), now), false);
  assert.equal(isCapturedContextFresh('invalid', now), false);
});
