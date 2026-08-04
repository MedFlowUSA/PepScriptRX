# PepScriptRX MPS Production Launch Decision Packet

Status: **OPEN — production MPS checkout must remain disabled**

Prepared: 2026-08-04

Scope: PepScriptRX `MAIN` storefront, MPS Gateway v2.5.6, card-not-present WooCommerce checkout

This packet collects the written business, acquirer, tax, and legal decisions required before a controlled production payment. It is not legal or tax advice. Do not place merchant credentials, bank information, card data, API keys, or processor secrets in this document.

## Current technical behavior

- The application sends a server-signed WooCommerce checkout contract.
- WooCommerce creates individual products and one fee item named `Processing Fee`.
- The approved technical maximum is 300 basis points (3%) of the signed pre-fee amount, rounded to integer cents.
- The fee is currently non-taxable and applies to the MPS payment path before the card brand or card product is known.
- A `$15.00` pre-fee order therefore produces a `$0.45` fee and a `$15.45` total.
- Stripe checkout initiation is retired. PayPal does not receive this added fee.
- Tax is currently required to be exactly zero; there is no approved server-side tax authority in this flow.
- Inventory and promotion mutation remain manual.
- Payment finalization is transactional and idempotent, but processor refunds, voids, and disputes require an approved operating process.

## Remaining fee eligibility issue requiring written resolution

Visa's published U.S. merchant guidance says a surcharge must be limited to credit cards, cannot apply to debit or prepaid cards, and cannot exceed the applicable merchant discount rate or 3%, whichever is lower. Mastercard says surcharges are not permitted on debit or prepaid cards and publishes a 4% maximum, also limited by the merchant's cost of acceptance.

The fee has been reduced to a 3% maximum. Because it is still applied before the card product is known, the checkout cannot currently distinguish an eligible credit card from debit or prepaid. Visa also limits a surcharge to the merchant discount rate or 3%, whichever is lower, and Mastercard limits it to the applicable cost of acceptance or its published cap. Production payment testing therefore remains blocked until the acquirer confirms the permitted rate and card-eligibility enforcement.

Authoritative references reviewed:

- [Visa U.S. Merchant Surcharge Q&A](https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf)
- [Mastercard merchant surcharge rules](https://www.mastercard.com/us/en/business/support/merchant-surcharge-rules.html)

## Processor/acquirer questionnaire

Send this section to the merchant acquirer or MPS/PayRio account representative and request written answers.

### Merchant and program confirmation

- Confirm the merchant legal entity and merchant ID privately.
- Confirm the merchant category code and approved products/services.
- Confirm that e-commerce/card-not-present transactions through MPS Gateway v2.5.6 are approved.
- Confirm the exact supported card brands and card products.
- Confirm whether the processor supports identifying credit, debit, and prepaid products before the final amount is authorized.

### Proposed fee

The proposed checkout adds a fee labeled `Processing Fee` equal to no more than 3% of the merchandise, discount, shipping, and tax-adjusted pre-fee amount. It is shown as a separate WooCommerce order line and is added before the card product is known.

Provide written answers to all of the following:

1. Is this fee permitted by the merchant agreement and the processor/acquirer program?
2. Is it classified as a card surcharge, convenience fee, service fee, or another program-specific charge?
3. What is the maximum permitted percentage or amount for each supported card brand?
4. May it be assessed on debit or prepaid cards? If not, how must those products be detected before authorization?
5. Must it be limited to the merchant's actual cost of acceptance?
6. Must Visa, Mastercard, the acquirer, or another party receive advance notice or registration?
7. Which transaction data field must carry the surcharge or fee amount?
8. What exact checkout, point-of-entry, point-of-sale, and receipt disclosures are required?
9. May the fee differ between MPS and PayPal when both methods are available?
10. Is the fee refundable on a full refund? How must it be allocated on a partial refund?
11. Is the fee taxable in the merchant's jurisdictions, and must it be included in the taxable basis?

Required result: a signed or otherwise attributable written response from the acquirer. A verbal approval is insufficient for the launch record.

### Descriptor and customer recognition

Request written confirmation of:

- The exact authorization descriptor
- The exact clearing/settlement descriptor
- Whether a dynamic descriptor is used
- The customer-support telephone number or URL appearing with the descriptor
- Maximum length and allowed characters
- Whether the production MID is already configured with that descriptor

Owner approval:

- Approved descriptor: `____________________________`
- Approved support text: `____________________________`
- Acquirer confirmation reference/date: `____________________________`

### Refund, void, and dispute capabilities

Request written answers to:

1. Does the production processor expose a confirmed API or portal operation for full refunds?
2. Does it support partial refunds and multiple partial refunds?
3. Does it support voiding an authorization before capture or settlement?
4. What stable transaction identifiers are required for each operation?
5. How is success distinguished from accepted-for-processing, pending, or failed?
6. Which webhook or report provides final refund, void, dispute, and chargeback status?
7. What is the settlement and reconciliation timetable?
8. What is the escalation process for an uncertain result?

The installed MPS V2D plugin currently emails a refund request and can return success to WooCommerce before processor confirmation. That path must not be treated as proof that money was returned.

## Tax sign-off

The tax owner or qualified adviser must complete this section for the controlled order and for broad launch.

- Merchant legal location(s): `____________________________`
- Fulfillment origin(s): `____________________________`
- Customer destination used for controlled test: recorded privately
- Product/SKU and tax category: `____________________________`
- Seller nexus determination: `____________________________`
- Merchandise tax result and authority: `____________________________`
- Shipping tax result and authority: `____________________________`
- Processing-fee tax result and authority: `____________________________`
- Approved server-side tax source for broad launch: `____________________________`
- Signer, role, and date: `____________________________`

The controlled payment may use zero tax only if this sign-off establishes that the exact product, seller, and destination combination is legitimately zero-tax. The application must not estimate or silently assume zero tax.

## Owner policy decisions

Record one explicit decision for every row.

| Topic | Required owner decision | Decision/reference |
|---|---|---|
| Fee model | Technical maximum reduced from 6% to 3%; final rate must also remain within the acquirer-approved cost limit | 3% maximum approved by owner; acquirer confirmation pending |
| Eligible cards | Exact credit products allowed; debit/prepaid treatment | Pending |
| Fee refund | Full, proportional, non-refundable, or other approved rule | Pending |
| Partial refunds | Allocation among merchandise, shipping, tax, and fee | Pending |
| Voids | When a void is allowed instead of refund | Pending |
| Commission/wallet | Adjustment rule after refund/dispute/chargeback | Pending |
| Inventory | Restock or manual handling after reversal | Manual pending policy |
| Promotions | Restore redemption or leave consumed | Manual pending policy |
| Disputes | Owner, response SLA, evidence, and accounting treatment | Pending |
| Descriptor | Final acquirer-approved statement descriptor | Pending |
| Customer disclosure | Approved checkout, receipt, and refund wording | Pending |
| Pilot access | Approved single-user or one-time production access control | Pending |

## Launch gates

All items below must be checked before authorizing a production payment:

- [ ] Written acquirer approval for the final fee model
- [ ] Card-product eligibility can be enforced before authorization
- [ ] Required network/acquirer notification completed
- [ ] Exact disclosures approved and implemented
- [ ] Exact controlled order has authoritative tax sign-off
- [ ] Final descriptor confirmed
- [ ] Refund/void recovery route confirmed
- [ ] Dispute monitoring owner assigned
- [ ] Commission/wallet reversal policy recorded
- [ ] Branch `payment-remediation-20260804` reviewed and merged through the normal workflow
- [ ] A single-user or one-time pilot access mechanism is approved; `MAIN` scope alone is not a single-customer restriction
- [ ] Controlled-payment runbook approved

Until every applicable item is complete, keep WordPress `Enabled`, `WOOCOMMERCE_BRIDGE_ENABLED`, and `VITE_WOOCOMMERCE_BRIDGE_VISIBLE` false.
