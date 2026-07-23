import type { PatientSubmission, SubmissionStatus } from '../../types';

export const JOURNEY_STEPS = ['Request received', 'Review', 'Payment', 'Processing', 'Shipped', 'Complete'] as const;

export type PatientJourney = {
  currentStep: number;
  headline: string;
  explanation: string;
  expectation: string;
  actionLabel: string | null;
  actionPath: string | null;
  needsCustomerAction: boolean;
  terminalTone: 'active' | 'success' | 'warning' | 'error';
};

const REVIEW_COPY: Partial<Record<SubmissionStatus, Pick<PatientJourney, 'headline' | 'explanation' | 'expectation'>>> = {
  under_review: {
    headline: 'Your request is being reviewed',
    explanation: 'The care team is checking the information submitted with this request.',
    expectation: 'Watch this page and your email for the next update.',
  },
  physician_review: {
    headline: 'Clinical review is in progress',
    explanation: 'A licensed clinician is reviewing the request where required. Approval is not guaranteed.',
    expectation: 'No action is needed unless the care team asks for more information.',
  },
  fulfillment_review: {
    headline: 'Availability is being confirmed',
    explanation: 'The fulfillment team is confirming eligibility, availability, and order details.',
    expectation: 'Payment instructions will appear only after the request is ready.',
  },
  eligible: {
    headline: 'Review is complete',
    explanation: 'The request has reached the payment-preparation stage.',
    expectation: 'A secure payment option will appear when checkout is opened.',
  },
};

export function getPatientJourney(order: PatientSubmission): PatientJourney {
  if (order.status === 'missing_info') {
    return {
      currentStep: 1,
      headline: 'Information is needed from you',
      explanation: 'The care team cannot continue until the requested information is provided.',
      expectation: 'Open messages and respond before the review can resume.',
      actionLabel: 'Open messages',
      actionPath: `#messages-${order.id}`,
      needsCustomerAction: true,
      terminalTone: 'warning',
    };
  }

  if (order.status === 'not_eligible') {
    return {
      currentStep: 1,
      headline: 'This request cannot continue',
      explanation: 'The request was not eligible to proceed. This does not provide a medical determination.',
      expectation: 'Review your messages or contact support if you need an explanation of the administrative decision.',
      actionLabel: null,
      actionPath: null,
      needsCustomerAction: false,
      terminalTone: 'error',
    };
  }

  if (order.status === 'cancelled_refunded') {
    return {
      currentStep: 2,
      headline: 'Order closed',
      explanation: 'This order was cancelled or refunded and will not continue through fulfillment.',
      expectation: 'Review payment records or messages if you have questions.',
      actionLabel: 'View payments',
      actionPath: '/patient/payments',
      needsCustomerAction: false,
      terminalTone: 'warning',
    };
  }

  if (order.status === 'fulfilled') {
    return {
      currentStep: 5,
      headline: 'Order complete',
      explanation: 'The fulfillment workflow for this order is complete.',
      expectation: 'Tracking history and refill options remain available in your portal.',
      actionLabel: 'View shipping',
      actionPath: '/patient/shipping',
      needsCustomerAction: false,
      terminalTone: 'success',
    };
  }

  if (order.status === 'shipped' || order.tracking_number) {
    return {
      currentStep: 4,
      headline: order.tracking_number ? 'Your shipment is on the way' : 'Your order has shipped',
      explanation: order.tracking_number
        ? `Tracking is available through ${order.tracking_carrier ?? 'the carrier'}.`
        : 'Carrier tracking will appear when it becomes available.',
      expectation: 'Use the carrier page for the latest delivery estimate and exceptions.',
      actionLabel: 'Open shipping center',
      actionPath: '/patient/shipping',
      needsCustomerAction: false,
      terminalTone: 'active',
    };
  }

  if (order.status === 'paid' || order.payment_status === 'paid') {
    return {
      currentStep: 3,
      headline: 'Payment confirmed',
      explanation: 'The order is being prepared for fulfillment.',
      expectation: 'Shipping information will appear here after a carrier label is created.',
      actionLabel: null,
      actionPath: null,
      needsCustomerAction: false,
      terminalTone: 'active',
    };
  }

  if (order.status === 'payment_sent') {
    return {
      currentStep: 2,
      headline: 'Secure payment is ready',
      explanation: 'Review the order total and complete payment through the displayed checkout option.',
      expectation: 'Fulfillment begins only after payment is confirmed.',
      actionLabel: 'Review and pay',
      actionPath: `/pay/${order.id}`,
      needsCustomerAction: true,
      terminalTone: 'warning',
    };
  }

  const reviewCopy = REVIEW_COPY[order.status];
  if (reviewCopy) {
    return {
      currentStep: 1,
      ...reviewCopy,
      actionLabel: null,
      actionPath: null,
      needsCustomerAction: false,
      terminalTone: 'active',
    };
  }

  return {
    currentStep: 0,
    headline: 'Request received',
    explanation: 'Your request is in the queue and has not yet completed review.',
    expectation: 'Most requests receive an initial update within 1–2 business days.',
    actionLabel: null,
    actionPath: null,
    needsCustomerAction: false,
    terminalTone: 'active',
  };
}
