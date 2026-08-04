# PepScriptRX MPS Refund, Void, and Dispute SOP

Status: **DRAFT — owner and acquirer approval required**
Scope: MPS/WooCommerce orders finalized into PepScriptRX

This procedure preserves the existing manual-reconciliation policy. It does not authorize a refund, void, retry, commission adjustment, wallet adjustment, inventory change, or promotion change.

## Safety rules

- Never infer processor success from a WooCommerce status alone.
- Never use the MPS V2D `process_refund` return value as proof that funds moved; the inspected implementation can return success after sending an operational email.
- Never retry an uncertain processor operation until the processor transaction record has been reconciled.
- Never create a replacement payment to repair a refund or void.
- Never delete payment, callback, reconciliation, or audit records.
- Never copy card data, processor credentials, or full customer data into tickets or logs.
- Do not change commission, wallet, inventory, or promotion records until an approved rule explicitly requires it.

WooCommerce distinguishes automatic gateway refunds from manual refunds. A manual WooCommerce refund records the refund in WooCommerce but does not return customer funds. See [WooCommerce refund documentation](https://woocommerce.com/document/woocommerce-refunds/).

## Required roles

- Requester: records the customer request and reason.
- Payment operator: accesses the authorized processor portal or API.
- Verifier: independently verifies the processor result and amount.
- Finance/commission owner: approves any accounting or commission adjustment.
- Support owner: communicates the final result to the customer.

For the controlled pilot, payment operator and verifier should be different people where practicable.

## Case record

Create one restricted case record containing only:

- PepScriptRX order ID
- WooCommerce order ID
- Processor transaction reference
- Original captured amount and currency
- Requested reversal amount
- Merchandise, shipping/tax, and processing-fee breakdown
- Request type: refund, partial refund, void, dispute, or chargeback
- Reason and authorization reference
- Processor result and timestamp
- WooCommerce refund/event ID
- Reconciliation-event ID
- Final verification and customer-notification timestamps

Do not include PAN, CVV, full authorization headers, API keys, or screenshots containing sensitive customer data.

## Full refund

1. Confirm the order is paid and identify the single authoritative processor transaction.
2. Obtain refund authorization under the approved refund policy.
3. Confirm whether the approved policy refunds merchandise, shipping, tax, and the processing fee.
4. Execute the refund through the acquirer-approved processor route.
5. If the response is pending or uncertain, stop. Mark the case `processor_verification_required`; do not retry.
6. Independently verify that the processor reports the exact refunded amount and stable refund reference.
7. Only after processor confirmation, record the matching WooCommerce manual refund and exact component breakdown.
8. Verify that the signed callback created one idempotent reconciliation event.
9. Confirm the original order remains historically paid and is not finalized a second time.
10. Apply commission, wallet, inventory, or promotion changes only under an approved policy.

## Partial refund

Follow the full-refund procedure, with these additional requirements:

- Record the exact merchandise, shipping/tax, and processing-fee amounts separately.
- Ensure the component sum equals the processor-confirmed partial refund.
- Ensure cumulative partial refunds cannot exceed the original captured amount or any individual component.
- Use the stable processor refund ID and WooCommerce refund ID as idempotency references.
- Do not mark the full order refunded unless cumulative confirmed refunds equal the approved full-refund amount.

## Void

1. Verify from the processor that the transaction is authorized but not captured or settled.
2. Obtain explicit authorization to void.
3. Submit one void through the approved processor route.
4. If the result is uncertain, stop and reconcile; do not submit another void or refund.
5. Verify the final processor state and stable reference.
6. Record the corresponding WooCommerce/PepScriptRX reconciliation event.

If the transaction is captured or settled, use the approved refund workflow instead of relabeling it as a void.

## Dispute or chargeback

1. Record the processor case/reference, reason code, disputed amount, response deadline, and current stage.
2. Link it to the authoritative payment without changing the original paid audit history.
3. Verify one `disputed`/`chargeback` reconciliation event exists.
4. Assign the evidence package and response deadline to the dispute owner.
5. Record the final processor outcome when available.
6. Apply commission, wallet, or accounting adjustments only after the relevant owner approves the established rule.

The inspected MPS V2D plugin has no automated dispute/chargeback hook. Processor portal/report monitoring is therefore mandatory until an approved automated feed exists.

## Uncertain results

An operation is uncertain when the request timed out, the browser failed after submission, the processor returned a pending status, or WordPress and the processor disagree.

Required response:

1. Do not retry.
2. Preserve all records.
3. Query the processor using the original stable transaction or operation reference.
4. Compare processor, WooCommerce, callback, and PepScriptRX reconciliation records.
5. Escalate if the final funds state cannot be established.
6. Resume only after a verifier documents the final state.

## Completion criteria

A reversal case is complete only when:

- The processor's final funds state and amount are verified.
- WooCommerce reflects the same component breakdown.
- Exactly one reconciliation event exists per stable processor/Woo event.
- No duplicate finalization, commission, wallet, audit, or notification effects exist.
- Required customer communication is sent without sensitive data.
- Any manual accounting adjustment has a named approver and audit reference.
