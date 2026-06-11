# PepScriptRX P1/P2 Cleanup Report

Last updated: 2026-06-10

## A. Summary of Fixes Completed

- Normalized shared catalog metadata aliases used by storefront, checkout payloads, admin views, rep views, and search.
- Documented product-to-COA coverage and gaps without guessing missing certificate links.
- Improved AACTIVATED catalog/search mobile behavior and same-route logo/home scroll reset.
- Improved catalog/cart readability with stronger quantity controls, higher-contrast category/menu controls, and tighter mobile card spacing.
- Added a credentialed QA checklist for admin, partner admin, rep, and customer flows.
- Preserved partner routes, pricing logic, commission logic, legal language, referral attribution, payment logic, and store ownership/scope configuration.

## B. Files Changed

- `src/lib/productMetadata.ts`
- `src/pages/public/RxPlusDistributorPortal.tsx`
- `src/components/layout/PublicLayout.tsx`
- `src/index.css`
- `src/lib/inventoryStatus.ts`
- `tools/deep-platform-audit.mjs`
- `docs/product-coa-matrix.md`
- `docs/credentialed-qa-checklist.md`
- `docs/pepscriptrx-p1-p2-cleanup-report.md`

## C. Product Metadata / Alias Corrections Made

- Added SKU-aware metadata matching and search text so aliases work across checkout/admin/rep/storefront surfaces.
- Added or expanded aliases for Retatrutide/Reta, Retatrutide Oral 500mcg, Tirzepatide/Trizep/Tirz, Semaglutide/Sema, CagriSema, Cagrilintide, AOD-9604, BPC-157, TB-500, Wolverine Stack/BB20, Glow/GLOW70/GloM historical lookup, Klow, GHK-Cu/GHKCU/CU100, Glutathione, NAD+, MOTS-C, CJC-1295 / Ipamorelin, Ipamorelin/IPA, Tesamorelin, HGH/Somatropin, IGF, and IGF-1 LR3.
- Wolverine Stack / BB20 is consistently treated as a BPC-157 + TB-500 blend.
- No pricing corrections were made.

## D. COA / Certificate Matrix Findings

The full matrix is in `docs/product-coa-matrix.md`.

- Covered: Tirzepatide, NAD+, GHK-Cu, CJC-1295 Without DAC, MOTS-C, TB-500.
- Pending: Semaglutide has a public row but pending batch fields/PDF.
- Partial: Wolverine Stack/BB20, Glow/GLOW70, Klow, and CJC-1295 / Ipamorelin need missing component or blend-specific coverage.
- Missing: BPC-157, Retatrutide, CagriSema, Cagrilintide, Ipamorelin, Tesamorelin, HGH/Somatropin, Glutathione, AOD-9604, IGF-1 / IGF-1 LR3.
- Business confirmation needed: CagriSema 4.8mg catalog labeling vs CS10 10mg supplier reference; dose-variant certificate policy for NAD+/GHK-Cu/Tirzepatide.

## E. UI / Contrast Improvements Made

- Strengthened AACTIVATED category filter contrast and focus states.
- Converted quantity stepper buttons to explicit high-contrast minus/plus states with focus styling.
- Changed shared mobile menu trigger from translucent light background to opaque dark styling, clearing low-contrast warnings.
- Preserved brand colors and storefront visual style.

## F. AACTIVATED Mobile Search Fix Status

- Search now scrolls to the catalog section with a header offset when the Search button, sort, or category filters are used.
- Clearing the search exits full-catalog mode, blurs the mobile input, and returns to top/top-sellers behavior.
- AACTIVATED logo/home clicks reset catalog filters and force a top scroll on same-route navigation.
- Confirmed locally at 390px mobile width: `Search TB-500 mobile` passed in filtered `tools/live-qa.mjs`.

## G. Cart / Catalog Layout Improvements Made

- AACTIVATED product cards use slightly tighter spacing, shorter mobile media, smaller mobile headings, and denser note/meta spacing.
- Cart item rows are slightly tighter and no longer repeat the dose as a separate third metadata line.
- Checkout CTAs and necessary product/support/compliance information remain visible.

## H. Credentialed QA Checklist Created

Checklist is in `docs/credentialed-qa-checklist.md`.

It identifies needed credentials for platform admin, partner/store admin, rep, customer, and test payment paths, plus role-specific expected results and pass/fail criteria.

## I. Tests Run and Results

- `npm run build` - pass. Vite chunk-size warning remains non-blocking.
- `npm run lint` - pass.
- `npm run qa:smoke` - pass with Edge DevTools. Initial Chrome attempt timed out on DevTools navigation.
- `npm run qa:data` - pass.
- `npm run qa:inventory-status` - pass, with expected warning that Supabase env vars were not set for live inventory read.
- `node tools/beastmode-promo-qa.mjs` - pass.
- `node tools/deep-platform-audit.mjs` - pass against production.
- Filtered local AACTIVATED live QA against built preview - pass exit code; mobile search, cart, logo routes, and checkout scope passed. Generic overlap heuristic remains a warning, but low-contrast findings were empty and AACTIVATED badge collisions were empty.

## J. Remaining Open Questions

- Confirm final CagriSema customer-facing strength label: 4.8mg total vs CS10 / 10mg total.
- Provide missing COAs or confirm acceptable component-level coverage for BPC-157, Retatrutide, CagriSema, Cagrilintide, Ipamorelin, Tesamorelin, HGH/Somatropin, Glutathione, AOD-9604, and IGF variants.
- Confirm whether one COA document may cover all dose/package variants for compounds with multiple catalog strengths.
- Provide test credentials to complete credentialed admin, partner admin, rep, and customer QA.
