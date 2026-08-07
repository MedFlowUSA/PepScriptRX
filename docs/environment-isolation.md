# Environment isolation

## Vercel production

- Project: `pepscriptrx` (`prj_ReiH3X8RHsv53zvOm49yCAq6O40Y`)
- Git repository: `MedFlowUSA/PepScriptRX`
- Production branch: `main`
- `APP_ENV=production` and `VITE_APP_ENV=production`
- `APP_PROJECT=pepscriptrx` and `VITE_APP_PROJECT=pepscriptrx`
- Client and server Supabase URLs must both reference `ubfruugzofftwlomkqcl`
- Production deploys should originate only from GitHub `main`; retire mixed CLI deploys in a separately authorized phase.

## Proposed Vercel staging

- Project: `pepscriptrx-staging`
- Git repository: `MedFlowUSA/PepScriptRX`
- Intentional branch: `staging`
- No production or customer-facing domain and no automatic production promotion
- `APP_ENV=staging` and `VITE_APP_ENV=staging`
- `APP_PROJECT=pepscriptrx-staging` and `VITE_APP_PROJECT=pepscriptrx-staging`
- Client and server Supabase URLs must both reference `yjexrleubnjuitiyjvoy`
- Use only the staging anonymous key and staging-only server credentials
- `VITE_WOOCOMMERCE_BRIDGE_VISIBLE=false`
- `WOOCOMMERCE_BRIDGE_ENABLED=false`
- `STRIPE_PAYMENTS_ENABLED=false`
- Do not configure production PayPal, Stripe, WooCommerce, MPS, Zelle, email, or service-role credentials

`VERCEL_ENV=production` is valid for the staging project's primary deployment because Vercel's deployment tier is separate from the application identity. The application displays its staging identity from `VITE_APP_ENV`. The verifier rejects ambiguous, mixed, wrong-project, wrong-domain, or production-backed preview builds before compilation.
