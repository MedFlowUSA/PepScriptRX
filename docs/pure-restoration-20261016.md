# Pure storefront restoration — October 16, 2026

The October 12 CLI deployment `dpl_DcwVyCqVtwvwCAPTkwikSWpH44zo` used
`.deploy-admin-login-fix` (reported base commit `8cad213`, dirty source).
It contained the older Pure storefront and omitted the aqua collection release.
The production database still had all 37 Pure assignments and three published
collections, with the approved prices, PURE25 and 65% owner commission intact.

Release branch: `fix/pure-current-20261016`.

`9831325` records the existing deployed frontend source, excluding credentials.
The restoration reapplies `dfedc3b` on that baseline, preserving the deployed
login fix, JSK, Isparta, KLOW, referral agreements and other storefronts.
Shared routing/checkout changes are limited to Pure collections. Existing Pure
migration sources are retained for reproducible isolated verification; no
production database migration or account/password change is required.

Validation: production build, 81 regression tests, targeted component lint,
isolated collection/discount/submission checks, and isolated existing finalizer
commission checks. Live read-only checks confirm 37 prices/commission rates and
all three bundle/PURE25 totals. Browser verification covers His/Hers at desktop,
390px and 320px widths, cart persistence and checkout discount selection.

Deploy from this committed release source. Do not redeploy the older
`.deploy-admin-login-fix` directory. Main contains the approved Pure release but
does not contain every subsequent CLI-only platform change; replacing production
with main without reconciling those changes would remove unrelated features.
