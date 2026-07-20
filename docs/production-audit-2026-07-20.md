# Production audit — 2026-07-20

## Release summary

This pass prioritized attribution correctness, clinical safety, quality-claim integrity, checkout usability, private uploads, SEO/security defaults, dependency health, and release verification. It does not constitute legal, medical, or regulatory approval.

## P0 findings and remediation

- **Referral leakage into generic routes:** persisted partner context could rebrand `/` and other main-store pages. Generic routes now remain generic unless the URL contains an explicit referral parameter; referral and discount parameters are separate; stored attribution expires after 30 days. Regression tests cover direct, referred, partner, expired, future, and discount-only visits.
- **Unsafe mixing guidance:** the prior calculator exposed inferred/default values and preparation-oriented copy. It is now an acknowledgment-gated, arithmetic-only label-math tool with blank inputs, validation boundaries, mg/mcg conversion, and a hard refusal to determine treatment, dose, frequency, preparation, or administration. PEPRXbot uses the same boundary.
- **Unsupported quality claims:** fabricated-looking purity, batch, laboratory, and testimonial content was removed. Quality records default to `documentation_pending`; only a current record with an actual document URL can be presented as verified.
- **Sensitive uploads:** the client validates actual PDF/JPEG/PNG/HEIC signatures, rejects renamed executables, enforces 10 MB, and generates non-sensitive randomized object names. The prepared database migration keeps the bucket private and limits bucket MIME/size, object paths, and metadata rows. No malware scanner is claimed.
- **Checkout accessibility:** checkout now has explicit labels/autocomplete, invalid-state handling, focused error summary, clearer contrast, and a visible progress indicator.

## P1 changes

- Direct `/` visits no longer auto-redirect from stale partner context.
- Private/transaction routes emit `noindex`; canonical and social URLs are absolute and query-free.
- Added `robots.txt`, a public-only sitemap, CSP, HSTS, anti-framing, MIME-sniffing, referrer, and permissions headers.
- Removed unverified patient testimonials and unsupported savings/quality copy.
- Updated compatible dependencies and patched transitive packages. PayPal, TypeScript, and Node-type major upgrades were intentionally deferred.

## Verification evidence

- `npm test`: 17 passed, 0 failed.
- `npx eslint src tests tools --max-warnings 100`: passed.
- `npm run build`: passed with Vite 8.1.5.
- `npm audit --audit-level=low`: 0 vulnerabilities.
- `supabase db lint --linked --level warning`: no schema errors.
- Production build warning remains: public bundle is about 744 kB minified (170 kB gzip), admin bundle about 576 kB, and five product PNGs are 1.57–1.71 MB each.

## Open P1/P2 decisions

- Add a trusted server-side malware scanner or upload gateway before describing intake uploads as malware-scanned.
- Optimize product images and split the public/admin bundles.
- Replace remaining catalog marketing language with owner/legal/clinical-approved copy after a source-of-truth review.
- Obtain written owner/legal approval for refund windows, testing thresholds, testimonials, savings comparisons, privacy/terms, and jurisdiction-specific clinical language before publishing those claims.
- Complete independent WCAG keyboard/screen-reader testing and a formal privacy/security review.

## Database deployment note

`20260720120000_harden_sensitive_submission_uploads.sql` is prepared but intentionally not auto-applied: the linked migration history contains an unrelated pending local migration (`20260715170000`) and a remote-only migration (`20260718103000`). Applying all pending files would exceed this release's safe scope. Reconcile migration history, test upload INSERT/RETURNING behavior in staging, then apply the hardening migration. Rollback guidance is in `docs/sensitive-upload-rollback.md`.

## Rollback

- Front end: redeploy the previous Vercel deployment or revert the release commit.
- Database: follow `docs/sensitive-upload-rollback.md`; do not make the bucket public.
