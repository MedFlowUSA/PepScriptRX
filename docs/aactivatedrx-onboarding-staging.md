# AACTIVATEDRX Rep Onboarding — Staging Delivery

Status: implemented on `codex/aactivatedrx-onboarding-staging`; production disabled. No migration, Edge Function, secret, or frontend build has been deployed.

## Architecture

The AACTIVATED-only public application writes non-sensitive application data to the existing intake queue. Approval calls a server-authorized function that creates an inactive, brand-scoped rep and auth profile, generates a secure recovery/activation handoff, and creates the onboarding record. The rep portal loads the server-owned state and submits agreement, W-9, and payout data through an authenticated Edge Function. A centralized database evaluator is the only path to readiness; an authorized admin performs final activation.

```text
application_pending
  -> application_more_info_required -> application_pending
  -> application_declined
  -> approved_activation_pending
  -> approved_onboarding_incomplete
       -> agreement_complete
       -> w9_pending_review
       -> starter_kit_pending
       -> payout_pending
  -> ready_for_activation
  -> active

Any approved/incomplete state -> suspended
Declined and suspended states cannot become active through the evaluator.
```

## Routes

- `/aactivated/apply` and existing AACTIVATED application aliases
- `/rep/onboarding`
- `/admin/rep-onboarding`

## Migration and data model

Migration: `20260806120000_aactivated_rep_onboarding_staging.sql`.

New tables:

- `aactivated_onboarding_settings`
- `aactivated_onboarding_profiles`
- `aactivated_agreements`
- `aactivated_agreement_signatures`
- `aactivated_w9_submissions`
- `aactivated_starter_kit_definitions`
- `aactivated_starter_kit_orders`
- `aactivated_payout_profiles`
- `aactivated_onboarding_audit`
- `aactivated_onboarding_notifications`
- `aactivated_onboarding_overrides`

The migration only adds application columns. The legacy `paypal_account` column is retained and documented as deprecated for AACTIVATEDRX; historical data is untouched.

## Permission matrix

| Capability | Applicant | Assigned rep | AACTIVATED admin | Master/platform admin | Other brand |
|---|---:|---:|---:|---:|---:|
| Submit application | Yes | — | — | — | AACTIVATED route only |
| View onboarding | No | Own row | Brand rows | All AACTIVATED rows | No |
| Sign agreement | No | Own published version | View | View | No |
| Submit W-9 | No | Own authenticated session | Status only | Tax-authorized access | No |
| Read encrypted TIN | No | No | No | Service/tax workflow only | No |
| Submit payout | No | Own authenticated session | Masked status | Masked status | No |
| Approve/override/activate | No | No | Brand-scoped | Yes | No |

## Agreement versioning

Agreement content is a single controlled record. Only `approved` records with `published_at` may be signed. Each signature stores the agreement ID/version, exact rendered content, SHA-256 hash, consents, signature, audit ID, request metadata, and private PDF path. A unique record is created per agreement version; prior signatures are never updated. The seeded development record is an unpublished legal-review placeholder.

## W-9 security

The secure submission function authenticates the rep, validates ownership and required fields, places the certification immediately before the signature UI, encrypts the full TIN with AES-256-GCM using `AACTIVATED_ONBOARDING_ENCRYPTION_KEY`, and stores only the last four separately. Full TINs are excluded from URLs, logs, email, admin UI, and exports. Completed representations are stored in the non-public `aactivated-onboarding-private` bucket. Client insert/update/delete grants are revoked; only the server function writes submissions. Corrections create a new revision and supersede the prior record.

## Starter kit

The onboarding schema enforces exactly one `reta` or `tirzepatide` product path and models paid, failed, cancelled, refunded, and abandoned outcomes. Completion must be set only after payment, ownership, definition, price, eligibility, inventory, and purchase-limit validation. The UI is intentionally disabled in this branch until the corrected package migrations and payment callbacks from the isolated starter-kit worktree are merged and validated in staging; it cannot falsely complete the step.

## Payouts

PayPal was removed from the AACTIVATED application and notification email. The approved rep provides and confirms a PayPal email only in onboarding. It is encrypted server-side, masked for ordinary display, and previous destinations are retained as superseded history. No unsupported payout method is shown.

## Notifications

Application intake notification no longer reads or renders PayPal. Approval creates a secure activation-notification event and generates a one-time recovery handoff without returning the link or any password to the browser. A staging notification worker must deliver the branded templates before release. Sensitive documents and values must never be attached or embedded.

## Staging prerequisites

1. Apply the migration to a new non-production Supabase project.
2. Set a random base64-encoded 32-byte `AACTIVATED_ONBOARDING_ENCRYPTION_KEY` only in Edge Function secrets.
3. Deploy `approve-aactivated-onboarding` and `submit-aactivated-onboarding` to staging.
4. Merge/validate the corrected starter-kit package definitions and payment finalizer; leave kit definitions inactive until validated.
5. Publish legal-approved agreement content in staging only.
6. Configure branded notification delivery for queued events.
7. Exercise every role/brand boundary and payment failure/refund path with synthetic data.
8. Capture desktop/mobile and admin screenshots from staging after seeded auth users exist.

## Test evidence

- `npm run build`: passed.
- `npm test`: 77 passed, 0 failed.
- Targeted ESLint on all new/modified onboarding UI, domain, route, and test files: passed.
- Full repository ESLint initially failed because untracked nested worktrees created multiple TypeScript roots; the config now fixes the root and ignores `.tmp-*`/`.codex-*` worktrees.
- No remote database/security integration test was run because this task explicitly prohibits production data/secrets and no isolated staging project was supplied.
- Screenshots are pending staging migration, synthetic users, and corrected-kit merge; no production or fabricated screenshots were produced.

## Confirmations

- PayPal is not collected by the AACTIVATED application and is absent from its notification email.
- There is no welcome-video item, placeholder, route, or checklist step.
- The kit model rejects mixed RETA/Tirzepatide paths.
- Existing ordinary checkout, existing reps, historical payouts, and other-brand intake routes were not migrated or deleted.
- Production remains disabled in both frontend configuration and the database settings seed.

## Rollback

Before any staging rollback, export synthetic audit evidence if needed. Remove the AACTIVATED routes/functions, then reverse the migration by dropping the new policies, functions, bucket policies/bucket (only after verifying it contains no required documents), and the eleven `aactivated_*` onboarding tables in dependency order. Drop only the newly added intake columns if staging policy allows. Do not drop or clear `rep_store_intake_submissions.paypal_account`, `reps`, existing payouts, commissions, orders, or auth users. Since production has not been enabled or migrated, production rollback is not applicable.
