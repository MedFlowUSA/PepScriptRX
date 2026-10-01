# Pure Peptide Labs

Implemented in the existing PepScriptRX app at `/purepeptidelabs`. Production release target: `https://pepscriptrx.vercel.app/purepeptidelabs`. The two scoped database migrations were applied to production on September 28, 2026 after explicit deployment authorization. The initial release created no authentication identity. On October 1, Lily was provisioned with the explicitly supplied email and temporary password; no payment or payout was created. The release is isolated from the original workspace's unrelated uncommitted changes and based on production main commit `8dd9d70`.

The design uses the three supplied PNGs unchanged: logo, blank-label product vial, and basket hero. The headline and primary action stay on the left; the full basket fits below the copy on mobile. Warm ivory, blush, cocoa, champagne borders, and a subtle CSS paper texture are scoped to this store. The platform menu, age confirmation, accounts, policies, support, cart format, order submission, payment processing, and review flow are reused. The user subsequently approved matching GLOW's products and prices; GLOW branding, marketing claims, promotions, and commission settings are not copied.

## Ownership and commission

The storefront now offers His and Hers style buttons. Hers preserves the original ivory/blush basket presentation; His uses navy, steel blue, stronger typography, and the supplied branded vial as a hero. Share `/purepeptidelabs?view=his` or `?view=hers`. The explicit URL takes precedence over the locally remembered choice. Both views share the same product query, prices, cart, scope, and checkout; switching does not categorize medical suitability or alter inventory. Theme rules are scoped in `PurePeptideLabsEditions.css`.

The closest reference was `LongevityWellnessStorefront.tsx` and migration `20260821233000_longevity_wellness_cynthia_direct_store.sql`.

The new migration prepares existing `distributors`, `partner_brands`, `reps`, `checkout_scopes`, and marketing-asset records:

- Owner: Lily Graham; rep code `LILY60`; brand/store `purepeptidelabs`; scope `PUREPEPTIDELABS`.
- `direct_store_owner` / `direct_store_commission`, with no parent rep, parent brand, manager, parent account, or override.
- Rep and checkout-scope rates: `0.6500`; platform share: `0.3500`; override: `0`.
- Owner email: `lilypurepeptides@gmail.com`; profile linked with role `partner_admin_limited`. Payout email remains NULL until confirmed.
- Limited tenant access excludes global administration, pricing, inventory, and other stores.

The existing paid-order finalizer calculates `round(greatest(0, product_subtotal - discounts - cost_of_goods) * commission_rate, 2)`. Shipping is excluded from this margin. No commission formula or payout execution was changed. The later concurrency and Stripe-token wrappers delegate to this same finalizer.

Isolated PostgreSQL tests execute the **actual commission block extracted from the existing finalizer**, using the new seeded rates. $200 subtotal − $20 discount − $50 cost gives $130 margin: Lily $84.50, platform $45.50, no override. $25 shipping or $0 shipping produces the same split. Negative margin, cent rounding, and internal-order exclusion also pass. An unrelated owner record remains unchanged across two migration applications.

## Lily's admin login

- Login: `/login?portal=admin&brand=purepeptidelabs` with `lilypurepeptides@gmail.com`.
- The user-supplied temporary password was set via the existing Supabase Auth Admin API, outside committed files. Lily should change it after signing in using `/reset-password?brand=purepeptidelabs`.
- Migration `20261001223000_pure_lily_admin_65_percent.sql` links her profile and one limited brand assignment, configures 65% owner / 35% platform / 0 override across the existing commission records, and enables the existing `orders_customers` RLS capability for her brand.
- `LILY60` remains the stable attribution code; the stored rate is now 65%. Historical ledger entries and payouts are not recalculated.
- Server-side checks verify successful password login, no platform-admin status, Pure-only orders/reps/ledger visibility, and denial of other-brand scope helpers. The legacy signup trigger initially supplied an unscoped admin default; this was removed from the just-created, unused identity before onboarding completed.
- Admin dashboard, orders, customers, analytics, reports, and store settings reuse the existing tenant portal. Pricing and global administration stay unavailable.
- Payout destination still needs confirmation through the existing payout setup; the login email is not assumed to be a payout address.
- `tools/provision-pure-owner.mjs` reads credentials from the authenticated CLI and temporary-password environment only. `tools/onboard-pure-peptide-labs.sql` now delegates to the current 65% admin migration.
## Approved catalog

October 1 pricing update: user requested Radiance's tirzepatide prices. The live Radiance full catalog lists 10mg $140, 15mg $175, and 30mg $275. Migration `20261001210000_pure_tirzepatide_radiance_prices.sql` changes only these three Pure assignments, in both checkout price fields. Other Pure products, master prices, other stores, publication flags, and Lily's 60% margin commission are unchanged. Radiance has no 20mg or 60mg listing; those Pure listings remain at their previous prices pending the user's selection decision. This supersedes the GLOW price snapshot for the three matching tirzepatide strengths only.

On September 28, 2026 the user explicitly approved the same products and pricing as `https://pepscriptrx.vercel.app/glow`. Migration `20260928192000_pure_peptide_labs_glow_catalog.sql` publishes all 37 current GLOW SKUs at their displayed retail prices, including the normalized 100 IU HGH kit at $285. The reference is the catalog actually rendered by GLOW (`getDistributorProducts('glow')`), verified against the live page, rather than its older database assignments. This is a dated price snapshot; future GLOW changes do not silently reprice Pure.

All 37 SKUs map uniquely to existing active `rx_plus_products` records; no product records or descriptions are created or modified. Their legacy `partner_slug='guy'` identifies catalog provenance and does not place Lily under that owner. Only these approved shared SKUs are admitted through Pure's frontend and checkout guard, and each still requires an enabled Pure assignment with its own explicit price. Both price fields are set consistently and assignment commissions are now 0.6500. No other store assignments, master prices, stock, ownership, or payouts are changed. Inactive, wholesale-only, invite-only, unassigned, or unpriced records remain excluded. Inventory availability is read from `public_inventory_status`; missing availability cannot be added to the bag.

Identity onboarding is complete. The 20mg and 60mg tirzepatide selection remains awaiting a decision. Run `node tools/verify-pure-glow-catalog.mjs` to compare the approved snapshot with the GLOW source catalog. The SQL harness also executes the existing checkout price query for all 37 records and verifies GLOW assignments remain unchanged.

Search and categories derive from published records. Details use the existing product description. The matching blank-label vial remains the product image; individual images can be substituted by approved product ID in `PURE_PRODUCT_IMAGES` in `src/lib/purePeptideLabsCatalog.ts` without changing products or prices. No product names or strengths were added to the hero image.

The second migration narrowly extends the existing submission-pricing function's distributor mapping and adds a Pure-only assignment guard. It rejects unpublished products before the platform fallback and leaves all other store branches intact. It checks expected function markers and fails for review if the upstream function changes. Payment processor eligibility remains governed by the existing platform configuration; this change does not grant processor approval to products.

## Verification and rollout

- Production TypeScript/Vite build passed (existing large-chunk warning remains).
- All **159** tests on the isolated production release branch passed, as did full-repository ESLint. The original workspace also passed its 93 tests before release integration.
- SQL migrations applied twice in isolated PGlite PostgreSQL fixtures. Owner configuration, actual commission branches, catalog guard, and preservation of an unrelated owner passed. This is not a production-schema migration or live-payment test.
- Headless browser checks passed at 1440×1000, 390×844, and 320×760: age gate without discounts; unpublished state; mock product search, categories and details; quantity/cart handoff and restoration; scoped account/signup and policy routes; empty-cart protection; no horizontal overflow or broken images. Browser API responses were intercepted; no live customer/order writes occurred. Fixture products appear only in test screenshots, never in the catalog or migration.
- Evidence: `artifacts/purepeptidelabs/sql-verification.json`, `browser-verification.json`, `unit-tests.log`, and desktop/mobile PNG screenshots.

The production database rollout applied only the two new migrations through an isolated Supabase CLI working directory matching the existing remote history; the dry run confirmed no other pending migrations would execute. The live finalizer's commission formula was checked by the migration before Lily's rate was configured. Frontend deployment uses the existing Vercel project and production environment guard from main. The original workspace's substantial pre-existing changes remain untouched.

This workspace's `.env.local` has empty Supabase variables that override `.env`. Verification supplied the existing `.env` public Supabase variables to the build process; neither environment file was modified. Ensure the deployment environment supplies valid values. The local preview serves that verified build.

Re-run `npm test` and the targeted ESLint command as usual. The SQL harness uses `@electric-sql/pglite@0.5.8` installed only under `artifacts/purepeptidelabs/verification` (no app dependency changes), then `node tools/verify-pure-peptide-labs-sql.mjs`. With the production-build preview on port 5188, run `node tools/pure-peptide-labs-qa.mjs` for mocked browser verification.

## Files added or changed for this task

| Files | Purpose |
| --- | --- |
| `src/pages/public/PurePeptideLabsStorefront.tsx`, `PurePeptideLabsStorefront.css` | New branded page, responsive layout, catalog states and shared-cart handoff |
| `src/lib/purePeptideLabsCatalog.ts` | Explicit assignment filtering, image overrides and existing cart contract |
| `public/brands/purepeptidelabs/logo.png`, `vial.png`, `hero.png` | Unchanged supplied assets |
| `src/App.tsx` | Import and canonical storefront route |
| `src/config/whiteLabelPortals.ts` | Portal, owner code, account branding and no-discount age gate |
| `src/lib/partnerTenant.ts`, `src/lib/storeAttribution.ts` | Tenant scope and store attribution registration |
| `src/components/layout/PublicLayout.tsx` | Scoped styling hook and readable Pure wordmark beside supplied logo |
| `src/components/PortalAgeLeadGate.tsx`, `src/lib/portalLeadCapture.ts` | Optional discount offer can be disabled; existing portals retain defaults |
| `src/components/FreeBacWaterBanner.tsx`, `src/pages/public/Start.tsx` | Pure-only promotion suppression and empty-checkout catalog protection |
| `supabase/migrations/20260928190000_pure_peptide_labs_direct_store.sql` | Direct owner/store/scope configuration, no login and no listings |
| `supabase/migrations/20260928191000_pure_peptide_labs_checkout_catalog.sql` | Existing checkout pricing integration and strict publication guard |
| `supabase/migrations/20260928192000_pure_peptide_labs_glow_catalog.sql` | User-approved 37-product GLOW catalog and price snapshot, Pure-only assignments |
| `tools/verify-pure-glow-catalog.mjs` | Exact SKU, strength, and price comparison against GLOW's rendered source catalog |
| `.gitignore`, `.vercelignore` | Exclude local verification artifacts from commits and deployment uploads |
| `tools/onboard-pure-peptide-labs.sql` | Transactional identity link after real email is supplied |
| `tests/pure-peptide-labs.test.ts` | Catalog, cart, ownership, tenant and age-gate regressions |
| `tools/verify-pure-peptide-labs-sql.mjs`, `tools/pure-peptide-labs-qa.mjs` | Isolated SQL and responsive browser verification |
| `docs/pure-peptide-labs-handoff.md` | This handoff, pending decisions, deployment and onboarding steps |

PURE25 customer promotion: 25% off the product subtotal in both His and Hers, excluding shipping. Uses the existing `aactivated_promo_links` record and server calculator. No expiry, minimum spend, or usage cap; cannot be combined with another code. Restricted to Pure customer orders on the server and checkout UI. Retail prices and Lily's 65% of post-discount margin remain unchanged. Migration: `20261002001000_pure25_customer_discount.sql`; isolated checks: `node tools/verify-pure25.mjs`.

Other pre-existing changes visible in `git diff` are not part of this task.
