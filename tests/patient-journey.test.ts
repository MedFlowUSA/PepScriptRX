import assert from 'node:assert/strict';
import test from 'node:test';
import { getPatientJourney } from '../src/pages/patient/patientJourney.ts';
import type { PatientSubmission, SubmissionStatus } from '../src/types/index.ts';

function order(status: SubmissionStatus, overrides: Partial<PatientSubmission> = {}) {
  return { id: 'order-1', status, payment_status: 'unpaid', tracking_number: null, tracking_carrier: null, ...overrides } as PatientSubmission;
}

test('new requests begin at request received without customer action', () => {
  const journey = getPatientJourney(order('new_submission'));
  assert.equal(journey.currentStep, 0);
  assert.equal(journey.needsCustomerAction, false);
});

test('missing information clearly requires customer action', () => {
  const journey = getPatientJourney(order('missing_info'));
  assert.equal(journey.needsCustomerAction, true);
  assert.equal(journey.actionLabel, 'Open messages');
});

test('payment-ready orders link directly to secure payment', () => {
  const journey = getPatientJourney(order('payment_sent'));
  assert.equal(journey.currentStep, 2);
  assert.equal(journey.actionPath, '/pay/order-1');
});

test('paid, shipped, and fulfilled orders advance through distinct stages', () => {
  assert.equal(getPatientJourney(order('paid')).currentStep, 3);
  assert.equal(getPatientJourney(order('shipped')).currentStep, 4);
  assert.equal(getPatientJourney(order('fulfilled')).currentStep, 5);
});

test('tracking advances an order to shipping even before status synchronization', () => {
  const journey = getPatientJourney(order('paid', { tracking_number: 'TRACK123', tracking_carrier: 'UPS' }));
  assert.equal(journey.currentStep, 4);
  assert.match(journey.explanation, /UPS/);
});
