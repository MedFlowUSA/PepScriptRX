# Environment isolation

## Vercel production

- Project: `pepscriptrx` (`prj_ReiH3X8RHsv53zvOm49yCAq6O40Y`)
- Git repository: `MedFlowUSA/PepScriptRX`
- Production branch: `main`
- `APP_ENV=production` and `VITE_APP_ENV=production`
- `APP_PROJECT=pepscriptrx` and `VITE_APP_PROJECT=pepscriptrx`
- Client and server Supabase URLs must both reference `ubfruugzofftwlomkqcl`
- Preview deployments remain physically in `pepscriptrx` but use `APP_ENV=staging` and staging Supabase.
- Production deploys should originate only from GitHub `main`; retire mixed CLI deploys in a separately authorized phase.

## Proposed Vercel staging

- Project: `pepscriptrx-staging`
- Project ID: `prj_G1mqmEdPLlKm83TFweRGsOBDARRw`
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

Physical Vercel project identity (`APP_PROJECT` and `VERCEL_PROJECT_ID`), deployment role (`VERCEL_ENV`), application/data identity (`APP_ENV`), and Supabase target are validated independently. `VERCEL_ENV=production` is valid for the staging project's primary deployment, while a canonical-project Preview remains physically `pepscriptrx` and uses staging application/data identity. The application displays its staging identity from `VITE_APP_ENV`.
