import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPatientNotifications } from '../src/pages/patient/orderNotificationModel.ts';
import type { PatientSubmission, SubmissionStatus } from '../src/types/index.ts';

function order(status: SubmissionStatus, overrides: Partial<PatientSubmission> = {}) {
  return { id: 'order-1', medication: 'Listed product', status, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-20T00:00:00Z', payment_status: 'unpaid', fulfillment_status: null, tracking_number: null, tracking_carrier: null, ...overrides } as PatientSubmission;
}

test('every order produces an intake notification with an order deep link', () => {
  const items = buildPatientNotifications([order('new_submission')]);
  assert.equal(items[0].kind, 'intake_received');
  assert.equal(items[0].href, '/patient#order-order-1');
});

test('action states produce important missing-info and payment notifications', () => {
  assert.equal(buildPatientNotifications([order('missing_info')]).some((item) => item.kind === 'information_missing' && item.priority === 'important'), true);
  assert.equal(buildPatientNotifications([order('payment_sent')]).find((item) => item.kind === 'payment_requested')?.href, '/pay/order-1');
});

test('shipping, exceptions, delivery, and refill windows are represented', () => {
  const now = new Date('2026-07-23T00:00:00Z');
  assert.equal(buildPatientNotifications([order('shipped', { tracking_number: 'TRACK', tracking_carrier: 'UPS' })], now).some((item) => item.kind === 'shipped'), true);
  assert.equal(buildPatientNotifications([order('paid', { fulfillment_status: 'delivery_exception' })], now).some((item) => item.kind === 'delivery_exception'), true);
  const fulfilled = buildPatientNotifications([order('fulfilled', { updated_at: '2026-06-01T00:00:00Z' })], now);
  assert.equal(fulfilled.some((item) => item.kind === 'delivered'), true);
  assert.equal(fulfilled.some((item) => item.kind === 'refill_approaching'), true);
});
