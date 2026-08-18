type DbClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type FinalizePaidOrderInput = {
  provider: 'stripe' | 'paypal' | 'woocommerce';
  providerEventId: string;
  providerOrderReference?: string | null;
  providerTransactionReference: string;
  orderId: string;
  amountCents: number;
  currency: string;
  paidAt?: string | null;
  eventPayload?: Record<string, unknown>;
};

export type FinalizePaidOrderResult = {
  result:
    | 'finalized'
    | 'already_finalized'
    | 'amount_mismatch'
    | 'currency_mismatch'
    | 'invalid_order_state'
    | 'conflicting_provider_reference'
    | 'reconciliation_required'
    | 'invalid_provider_event';
  order_id?: string;
  expected_amount_cents?: number;
};

export async function finalizeVerifiedPaidOrder(
  db: DbClient,
  input: FinalizePaidOrderInput,
): Promise<FinalizePaidOrderResult> {
  const { data, error } = await db.rpc('finalize_verified_paid_order', {
    p_provider: input.provider,
    p_provider_event_id: input.providerEventId,
    p_provider_order_reference: input.providerOrderReference ?? null,
    p_provider_transaction_reference: input.providerTransactionReference,
    p_order_id: input.orderId,
    p_amount_cents: input.amountCents,
    p_currency: input.currency.toUpperCase(),
    p_paid_at: input.paidAt ?? new Date().toISOString(),
    p_event_payload: input.eventPayload ?? {},
  });
  if (error) throw new Error(`Paid-order finalizer failed: ${error.message ?? 'database error'}`);
  const result = data as FinalizePaidOrderResult;
  if (!result?.result) throw new Error('Paid-order finalizer returned an invalid result');
  return result;
}

export async function recordManualReconciliation(
  db: DbClient,
  input: {
    provider: string;
    providerEventId: string;
    providerTransactionReference?: string | null;
    orderId: string;
    eventType: string;
    originalAmountCents?: number | null;
    eventAmountCents?: number | null;
    currency?: string | null;
    occurredAt?: string | null;
    privateDetails?: Record<string, unknown>;
  },
): Promise<FinalizePaidOrderResult> {
  const { data, error } = await db.rpc('record_payment_reconciliation_event', {
    p_provider: input.provider,
    p_provider_event_id: input.providerEventId,
    p_provider_transaction_reference: input.providerTransactionReference ?? null,
    p_order_id: input.orderId,
    p_event_type: input.eventType,
    p_original_amount_cents: input.originalAmountCents ?? null,
    p_event_amount_cents: input.eventAmountCents ?? null,
    p_currency: input.currency ?? null,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_private_details: input.privateDetails ?? {},
  });
  if (error) throw new Error(`Reconciliation recorder failed: ${error.message ?? 'database error'}`);
  return data as FinalizePaidOrderResult;
}
