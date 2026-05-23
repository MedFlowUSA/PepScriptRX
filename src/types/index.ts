export type Role = 'patient' | 'rep' | 'physician' | 'fulfillment' | 'admin' | 'rx_plus_admin';

export type SubmissionStatus =
  | 'new_submission'
  | 'missing_info'
  | 'under_review'
  | 'physician_review'
  | 'fulfillment_review'
  | 'eligible'
  | 'payment_sent'
  | 'paid'
  | 'shipped'
  | 'fulfilled'
  | 'not_eligible'
  | 'cancelled_refunded';

export type CommissionStatus = 'pending' | 'payable' | 'paid' | 'reversed';

export type CryptoAsset = 'BTC' | 'ETH' | 'USDT' | 'XRP';

export type CryptoPaymentStatus =
  | 'unpaid'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'underpaid'
  | 'overpaid'
  | 'wrong_network'
  | 'refunded';

export const CRYPTO_PAYMENT_STATUS_LABELS: Record<CryptoPaymentStatus, string> = {
  unpaid:                 'Unpaid',
  awaiting_confirmation:  'Awaiting Confirmation',
  confirmed:              'Confirmed',
  underpaid:              'Underpaid',
  overpaid:               'Overpaid',
  wrong_network:          'Wrong Network',
  refunded:               'Refunded',
};

export const ALL_CRYPTO_STATUSES: CryptoPaymentStatus[] = [
  'unpaid','awaiting_confirmation','confirmed','underpaid','overpaid','wrong_network','refunded',
];

export type PhysicianReviewStatus =
  | 'approved_for_refill_review'
  | 'needs_more_information'
  | 'not_appropriate'
  | 'refer_to_fulfillment_partner'
  | 'clinical_review_complete';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  sms_opted_out: boolean;
  created_at: string;
}

export interface Rep {
  id: string;
  profile_id: string;
  rep_name: string | null;
  handle: string | null;
  rep_identifier: string | null;
  commission_type: string | null;
  rep_tier: string | null;
  rep_slug: string;
  commission_rate: number;
  payout_email: string;
  payout_method: string | null;
  attribution_window_days: number | null;
  discount_code: string | null;
  discount_amount: number | null;
  referral_path: string | null;
  attribution_locked: boolean | null;
  rep_channel?: string | null;
  parent_rep_id?: string | null;
  managed_by_profile_id?: string | null;
  active: boolean;
  created_at: string;
  profile?: Profile;
}

export type ShippingSpeed = 'standard' | 'expedited' | 'overnight';

export const SHIPPING_OPTIONS: { value: ShippingSpeed; label: string; days: string; cost: number }[] = [
  { value: 'standard',  label: 'Standard Shipping',   days: '5–7 business days', cost: 0  },
  { value: 'expedited', label: 'Expedited Shipping',   days: '2–3 business days', cost: 25 },
  { value: 'overnight', label: 'Overnight Shipping',   days: 'Next business day',  cost: 50 },
];

export interface PatientSubmission {
  id: string;
  patient_profile_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  rep_id: string | null;
  physician_id: string | null;
  medication: string;
  current_dose: string;
  current_price: number | null;
  state: string;
  date_of_birth: string;
  current_pharmacy: string;
  status: SubmissionStatus;
  quoted_price: number | null;
  estimated_savings: number | null;
  admin_notes: string | null;
  referral_code: string | null;
  discount_code: string | null;
  discount_amount: number | null;
  order_number: string | null;
  order_items: unknown[] | null;
  order_total: number | null;
  confirmation_email_sent_at: string | null;
  shipping_email_sent_at: string | null;
  // Shipping
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_speed: ShippingSpeed | null;
  shipping_cost: number | null;
  // Payment
  paypal_link: string | null;
  // Crypto payment
  crypto_asset: CryptoAsset | null;
  crypto_address: string | null;
  crypto_destination_tag: string | null;
  crypto_expected_amount_usd: number | null;
  crypto_expected_amount_asset: number | null;
  crypto_tx_hash: string | null;
  crypto_payment_status: CryptoPaymentStatus | null;
  crypto_notes: string | null;
  paid_at: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  tracking_url: string | null;
  created_at: string;
  updated_at: string;
  rep?: Rep;
  physician?: Profile;
  documents?: SubmissionDocument[];
}

export interface SubmissionDocument {
  id: string;
  submission_id: string;
  document_type: 'prescription' | 'receipt' | 'medication_photo' | 'id_optional';
  file_path: string;
  uploaded_at: string;
}

export interface PhysicianReview {
  id: string;
  submission_id: string;
  physician_id: string;
  review_status: PhysicianReviewStatus;
  review_notes: string;
  reviewed_at: string;
  physician?: Profile;
}

export interface FulfillmentOrder {
  id: string;
  submission_id: string;
  fulfillment_partner: string;
  fulfillment_status: string;
  tracking_number: string | null;
  tracking_carrier: string | null;
  cost_basis: number | null;
  retail_price: number | null;
  margin: number | null;
  created_at: string;
  submission?: PatientSubmission;
}

export interface CommissionLedger {
  id: string;
  submission_id: string;
  rep_id: string;
  gross_sale: number;
  margin: number;
  commission_rate: number;
  commission_amount: number;
  status: CommissionStatus;
  payout_date: string | null;
  created_at: string;
  rep?: Rep;
  submission?: PatientSubmission;
}

export interface RetaWaitlist {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  state: string;
  interest_notes: string;
  rep_id: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  new_submission: 'New Submission',
  missing_info: 'Missing Info',
  under_review: 'Under Review',
  physician_review: 'Physician Review',
  fulfillment_review: 'Fulfillment Review',
  eligible: 'Eligible',
  payment_sent: 'Payment Sent',
  paid: 'Paid',
  shipped: 'Shipped',
  fulfilled: 'Fulfilled',
  not_eligible: 'Not Eligible',
  cancelled_refunded: 'Cancelled / Refunded',
};

export const STATUS_COLORS: Record<SubmissionStatus, string> = {
  new_submission: 'badge-info',
  missing_info: 'badge-warning',
  under_review: 'badge-info',
  physician_review: 'badge-purple',
  fulfillment_review: 'badge-purple',
  eligible: 'badge-teal',
  payment_sent: 'badge-teal',
  paid: 'badge-success',
  shipped: 'badge-success',
  fulfilled: 'badge-success',
  not_eligible: 'badge-error',
  cancelled_refunded: 'badge-default',
};

export const ALL_STATUSES: SubmissionStatus[] = [
  'new_submission',
  'missing_info',
  'under_review',
  'physician_review',
  'fulfillment_review',
  'eligible',
  'payment_sent',
  'paid',
  'shipped',
  'fulfilled',
  'not_eligible',
  'cancelled_refunded',
];

export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];
