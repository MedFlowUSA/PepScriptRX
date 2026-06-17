export type Role =
  | 'patient'
  | 'customer'
  | 'client'
  | 'rep'
  | 'representative'
  | 'affiliate'
  | 'physician'
  | 'fulfillment'
  | 'admin'
  | 'rx_plus_admin'
  | 'distributor'
  | 'owner'
  | 'platform_admin'
  | 'master_admin'
  | 'super_admin';

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

export type CustomerManualReviewStatus =
  | 'leave_unlinked'
  | 'test_record'
  | 'staff_internal'
  | 'customer_confirmed_attach_later'
  | 'cancelled_refunded_preserve'
  | 'payment_mismatch_review'
  | 'needs_customer_confirmation';

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

export const CUSTOMER_MANUAL_REVIEW_STATUS_LABELS: Record<CustomerManualReviewStatus, string> = {
  leave_unlinked:                   'Leave unlinked',
  test_record:                      'Test / QA record',
  staff_internal:                   'Staff / internal',
  customer_confirmed_attach_later:  'Customer confirmed - attach later',
  cancelled_refunded_preserve:      'Cancelled/refunded - preserve',
  payment_mismatch_review:          'Payment mismatch review',
  needs_customer_confirmation:      'Needs customer confirmation',
};

export const ALL_CUSTOMER_MANUAL_REVIEW_STATUSES: CustomerManualReviewStatus[] = [
  'leave_unlinked',
  'test_record',
  'staff_internal',
  'customer_confirmed_attach_later',
  'cancelled_refunded_preserve',
  'payment_mismatch_review',
  'needs_customer_confirmation',
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
  admin_scope?: string | null;
  store_slug?: string | null;
  owner_email?: string | null;
  sms_opted_out: boolean;
  created_at: string;
}

export interface Rep {
  id: string;
  profile_id: string | null;
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
  override_percent?: number | null;
  platform_percent?: number | null;
  custom_store_slug?: string | null;
  brand_name?: string | null;
  paypal_link?: string | null;
  brand_theme?: Record<string, unknown> | null;
  custom_price_list?: unknown[] | null;
  account_type?: string | null;
  parent_type?: string | null;
  active: boolean;
  created_at: string;
  profile?: Profile;
  parent_rep?: Rep | null;
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
  product_id?: string | null;
  product_name?: string | null;
  submission_type?: string | null;
  inquiry_notes?: string | null;
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
  admin_code?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  account_type?: string | null;
  parent_type?: string | null;
  checkout_scope_code?: string | null;
  checkout_scope_id?: string | null;
  attribution_source?: string | null;
  source_portal?: string | null;
  source_route?: string | null;
  source_store?: string | null;
  source_admin?: string | null;
  source_rep?: string | null;
  locale?: string | null;
  commission_owner?: string | null;
  commission_rate?: number | null;
  partner_payout_eligible?: boolean | null;
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
  cost_of_goods: number | null;
  // Payment
  paypal_link: string | null;
  payment_provider: 'paypal' | 'crypto' | 'zelle' | 'manual' | 'other' | null;
  payment_status: 'unpaid' | 'payment_pending' | 'paid' | 'payment_exception' | 'failed' | 'refunded' | 'reversed' | 'cancelled';
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  amount_due_cents?: number | null;
  payment_expires_at?: string | null;
  payment_reference?: string | null;
  payment_release_policy?: 'paid_hold' | 'manual_release' | 'released' | null;
  payout_status: 'pending' | 'payable' | 'paid' | 'failed' | 'reversed';
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  paypal_capture_status: string | null;
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
  fulfillment_status: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  tracking_url: string | null;
  manual_review_status?: CustomerManualReviewStatus | null;
  manual_review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  recommended_action?: string | null;
  manual_review_risk_level?: 'low' | 'medium' | 'high' | 'manual' | null;
  manual_review_source?: string | null;
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
  commission_role?: 'rep_commission_owner' | 'override_owner' | 'platform_margin_owner' | null;
  owner_label?: string | null;
  status: CommissionStatus;
  payout_date: string | null;
  created_at: string;
  rep?: Rep;
  submission?: PatientSubmission;
}

export type RepStoreIntakeStatus =
  | 'new'
  | 'reviewing'
  | 'more_info_requested'
  | 'logo_needed'
  | 'pricing_review'
  | 'ready_to_build'
  | 'launched'
  | 'rejected';

export interface RepStoreIntakeProduct {
  id?: string;
  category?: string;
  product_name: string;
  suggested_retail_price?: number | null;
  requested_retail_price?: number | null;
  notes?: string | null;
}

export interface RepStoreIntakeSubmission {
  id: string;
  created_at: string;
  updated_at: string;
  status: RepStoreIntakeStatus;
  full_name: string;
  phone: string | null;
  email: string;
  paypal_account: string | null;
  desired_rep_code: string | null;
  parent_rep_or_admin_name: string | null;
  store_type: string;
  store_brand_name: string;
  logo_needed: string | null;
  preferred_color_1: string | null;
  preferred_color_2: string | null;
  preferred_color_3: string | null;
  brand_style_notes: string | null;
  selected_products: RepStoreIntakeProduct[] | null;
  custom_products: RepStoreIntakeProduct[] | null;
  source_portal_id: string | null;
  source_portal: string | null;
  source_url: string | null;
  source_route: string | null;
  parent_store_slug: string | null;
  parent_store_name: string | null;
  partner_admin_id: string | null;
  partner_admin_email: string | null;
  approval_owner_id: string | null;
  approval_owner_email: string | null;
  approval_status: string | null;
  approval_notes: string | null;
  review_queue: string | null;
  review_admin_code: string | null;
  review_admin_name: string | null;
  internal_notes: string | null;
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
