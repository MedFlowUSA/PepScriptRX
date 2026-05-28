# PepScriptRX — Supabase Setup Instructions for Codex

Complete these tasks in order. Everything here connects the PepScriptRX React frontend to its Supabase backend.

---

## Prerequisites

You need:
- Supabase CLI installed: `npm install -g supabase`
- The project's Supabase credentials (found in Supabase dashboard → Project Settings → API)
- A logged-in Supabase CLI session: `supabase login`

Link the project (replace `<PROJECT_REF>` with the actual project ref from the Supabase dashboard URL):
```bash
supabase link --project-ref <PROJECT_REF>
```

---

## Step 1 — Apply All Database Migrations

Push all migrations in `supabase/migrations/` to the live database:

```bash
supabase db push
```

This applies every `.sql` file in `supabase/migrations/` in timestamp order. Key tables and changes it creates:

- `profiles` — user profiles with roles (patient, admin, rep, physician, fulfillment)
- `patient_submissions` — refill requests including `tracking_number`, `tracking_carrier`, `status`, `quoted_price`, `payment_url`, etc.
- `patient_goals` — patient weight/height goals including `height_inches`
- `patient_weight_log` — weekly weight entries
- `patient_activity_log` — daily step counts and active minutes (Google Fit + manual)
- `patient_side_effects` — symptom severity log
- `submission_messages` — in-app patient↔care team message thread
- `reps` — sales representative profiles and referral codes
- `referral_attributions` — tracks which rep referred each visitor/submission
- `products` — compound product catalog
- `inventory` — stock tracking per product
- `fulfillment_orders` — shipping orders linked to submissions
- `crypto_transactions` — crypto payment records
- Supabase Realtime enabled on `patient_submissions` and `submission_messages`

If `supabase db push` fails on a specific migration, you can run the SQL manually in the Supabase SQL editor (dashboard → SQL Editor → New query). All migrations use `IF NOT EXISTS` and are safe to re-run.

---

## Step 2 — Deploy Edge Functions

Four edge functions live in `supabase/functions/`. Deploy all of them:

```bash
supabase functions deploy notify-sms --no-verify-jwt
supabase functions deploy notify-new-submission --no-verify-jwt
supabase functions deploy notify-payment-sent --no-verify-jwt
supabase functions deploy process-payout
supabase functions deploy send-injection-reminders --no-verify-jwt
```

Note: `process-payout` does **not** use `--no-verify-jwt` — it requires a valid user JWT (called from the Admin portal).

### What each function does

**`notify-sms`**
- Called from the Admin portal when a submission status changes
- Sends a Twilio SMS to the patient's phone number
- Accepts: `{ phone, name, status, quoted_price? }`
- Requires: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

**`notify-new-submission`**
- Triggered by Supabase Database Webhook on `patient_submissions` INSERT
- Sends an email to the admin (info@4lifequote.com) with submission details and a link to review
- Requires: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`, `SITE_URL`

**`notify-payment-sent`**
- Called when admin marks a submission as `payment_sent`
- Sends the patient an email with their payment link and order summary
- Requires: `RESEND_API_KEY`, `NOTIFY_FROM`, `SITE_URL`

**`process-payout`**
- Called only from an explicit Admin portal payout action
- Sends approved internal payouts via PayPal Payouts API after customer payment has already been captured into the official PepScriptRX PayPal Business account
- Idempotent: skips if payout already sent for this submission
- Logs all payouts to the `payouts` table (viewable in Admin -> Commission Payouts -> Manual PayPal Payouts tab)
- Accepts: `{ submission_id: string }`
- Requires: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `ADMIN_PAYPAL_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**`send-injection-reminders`**
- Sends a weekly Twilio SMS to all patients with `paid` or `fulfilled` orders reminding them to take their medication and log progress
- One message per unique phone number (deduplicates across multiple submissions)
- Intended to be triggered by pg_cron — see Step 10 below for setup
- Requires: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`

---

## Step 3 — Set Edge Function Secrets

Set all secrets for the deployed edge functions:

```bash
# Twilio (for SMS notifications)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_twilio_auth_token
supabase secrets set TWILIO_FROM_NUMBER=+1XXXXXXXXXX

# Resend (for email notifications)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set NOTIFY_EMAIL=info@4lifequote.com
supabase secrets set NOTIFY_FROM="PepScriptRX <notifications@pepscriptrx.com>"
supabase secrets set SITE_URL=https://pepscriptrx.com

# PayPal (official checkout capture and manual payout distribution)
supabase secrets set PAYPAL_CLIENT_ID=your_paypal_client_id
supabase secrets set PAYPAL_CLIENT_SECRET=your_paypal_client_secret
supabase secrets set PAYPAL_ENV=live
supabase secrets set ADMIN_PAYPAL_EMAIL=your_admin_paypal_email@example.com
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase Edge Functions runtime
# No need to set them manually — they are always available as Deno.env.get(...)
```

Replace placeholder values with real credentials before running.

To get your PayPal credentials:
1. Log in to [developer.paypal.com](https://developer.paypal.com)
2. My Apps & Credentials → Create App (REST API)
3. Copy the Live Client ID and Secret for the official PepScriptRX PayPal Business app
4. Ensure the app has **Payouts** permission enabled (Request in app settings if missing)

To verify secrets were set:
```bash
supabase secrets list
```

---

## Step 4 — Set Up Database Webhook for New Submission Emails

In the Supabase dashboard:
1. Go to **Database → Webhooks → Create a new hook**
2. Configure:
   - **Name:** `on_new_submission_email`
   - **Table:** `patient_submissions`
   - **Events:** `INSERT`
   - **Type:** Supabase Edge Function
   - **Function:** `notify-new-submission`
3. Save

This webhook fires `notify-new-submission` every time a new refill request is submitted, alerting the admin by email immediately.

---

## Step 5 — Configure Supabase Auth

In the Supabase dashboard → **Authentication → URL Configuration**:

1. **Site URL:** `https://pepscriptrx.com`
2. **Redirect URLs** — add all of:
   ```
   https://pepscriptrx.com/auth/callback
   https://pepscriptrx.com/reset-password
   http://localhost:5173/auth/callback
   http://localhost:5173/reset-password
   ```

In **Authentication → Email Templates**, update the:
- **Confirm signup** template — use branded PepScriptRX HTML
- **Reset password** template — update the redirect URL to `{{ .SiteURL }}/reset-password`

---

## Step 6 — Set Frontend Environment Variables

Create or update `.env` in the project root with:

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_FIT_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

For the hosting platform (Netlify / Vercel), add the same three variables in the environment variable settings of the deployment dashboard.

The `VITE_GOOGLE_FIT_CLIENT_ID` is only needed if Google Fit integration on the Patient Progress page is being used. To set it up:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Fitness API**
3. Create an OAuth 2.0 Client ID (Web Application)
4. Add authorized redirect URI: `https://pepscriptrx.com/patient/progress`
5. Copy the Client ID into the env var above

---

## Step 7 — Verify RLS (Row Level Security)

All tables have RLS enabled. Verify with this query in the SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

All rows should show `rowsecurity = true`. If any critical table shows `false`, run:
```sql
alter table public.<tablename> enable row level security;
```

---

## Step 8 — Seed Initial Admin User

After a user signs up through the app, promote them to admin in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'info@4lifequote.com';
```

Run this once. All other roles (patient, rep, physician, fulfillment) are set either via the signup flow or via admin assignment in the Admin → Reps panel.

---

## Step 9 — Schedule Weekly Injection Reminders (pg_cron)

Enable pg_cron in Supabase (if not already enabled):
1. Go to **Database → Extensions**
2. Enable **pg_cron**
3. Enable **pg_net** (needed for HTTP calls from cron)

Then run this in the SQL Editor to schedule the weekly SMS reminder every Monday at 10:00 AM UTC:

```sql
select cron.schedule(
  'weekly-injection-reminders',
  '0 10 * * 1',
  $$
    select net.http_post(
      url    := (select value from vault.secrets where name = 'supabase_url') || '/functions/v1/send-injection-reminders',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body   := '{}'::jsonb
    )
  $$
);
```

If vault.secrets is not available, replace the URL directly:

```sql
select cron.schedule(
  'weekly-injection-reminders',
  '0 10 * * 1',
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-injection-reminders',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    )
  $$
);
```

To view scheduled jobs: `select * from cron.job;`
To unschedule: `select cron.unschedule('weekly-injection-reminders');`

---

## Step 10 — Verify Everything Works

Run through this checklist after setup:

- [ ] Submit a test refill request at `/start` — check that admin receives an email
- [ ] Log into `/login?portal=admin` with the admin account
- [ ] Open the test submission — change status, click SMS patient, verify Twilio SMS arrives
- [ ] Mark submission as `payment_sent` — verify patient receives payment email
- [ ] Pay through `/pay/:id` — verify server-side PayPal capture marks the order paid and commission remains pending
- [ ] Send any rep/admin payout only from the manual Admin payout workflow
- [ ] Manually call `send-injection-reminders` via curl or Supabase dashboard and verify SMS arrives
- [ ] Confirm pg_cron job is scheduled: `select * from cron.job;`
- [ ] Log into `/patient/referral` — verify referral link displays and copy works
- [ ] Log into `/login?portal=patient` — verify dashboard shows orders, messaging works
- [ ] Open `/library` — verify the Compound Library loads with search and filters
- [ ] Test dark mode toggle in any portal sidebar footer
- [ ] Test mobile hamburger nav on a phone or DevTools mobile viewport

---

## Quick Reference — Supabase CLI Commands

```bash
# See all pending migrations
supabase migration list

# Push pending migrations
supabase db push

# Pull current remote schema to local
supabase db pull

# Deploy a single function
supabase functions deploy <function-name>

# View function logs
supabase functions logs notify-sms

# List secrets
supabase secrets list

# Open Supabase studio locally
supabase start
supabase studio
```

---

## File Map

```
supabase/
  migrations/
    001_initial_schema.sql                  — core tables
    20260520190000_patient_tracking_and_messages.sql  — messages, activity log, side effects
    20260520210000_tracking_carrier_height.sql         — tracking_carrier, height_inches, realtime publications
    ... (all other migrations apply chronologically)
  functions/
    notify-sms/index.ts                     — Twilio SMS sender
    notify-new-submission/index.ts          — Admin new submission email
    notify-payment-sent/index.ts            — Patient payment link email
    process-payout/index.ts                 — Manual PayPal Payouts distribution after admin approval
    send-injection-reminders/index.ts       — Weekly Twilio SMS to active patients (pg_cron triggered)

src/
  data/compoundLibrary.ts                   — All 32 compound entries (educational library)
  hooks/useTheme.ts                         — Dark mode toggle with localStorage
  hooks/useRealtime.ts                      — Supabase Realtime subscription hook
  components/MessageThread.tsx              — In-app messaging component
  components/layout/DashLayout.tsx          — Shared portal layout with dark mode toggle
  components/layout/PublicLayout.tsx        — Public nav + footer (Compound Library link added)
  pages/public/Library.tsx                  — /library compound education page
  pages/patient/PatientDashboard.tsx        — Orders, messages, tracking, refill request
  pages/patient/PatientProfile.tsx          — Health overview, BMI, goals quick links
  pages/patient/PatientProgress.tsx         — Weight/waist charts, Google Fit, activity log
  pages/patient/PatientSideEffects.tsx      — Symptom tracker with severity
  pages/admin/AdminAnalytics.tsx            — Revenue charts, funnel, medication breakdown
  pages/admin/AdminSubmissions.tsx          — Live realtime submissions list
  pages/admin/AdminSubmissionDetail.tsx     — Status, SMS, shipping, messaging per submission
  pages/admin/AdminPayouts.tsx             — Commission ledger + Manual PayPal Payouts tabs
  pages/admin/AdminPaymentAudit.tsx        — Official PayPal capture and legacy routing audit
  pages/rep/RepDashboard.tsx               — Rep stats, referral link, commission ledger, PayPal payout history
  pages/patient/PatientReferral.tsx        — /patient/referral — patient's personal refer-a-friend link + count
```
