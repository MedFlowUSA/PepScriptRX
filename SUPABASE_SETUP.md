# PepScriptRX Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260519000000_pepscriptrx_mvp.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Add these Vercel/local environment variables:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Confirm the private Storage bucket exists:

```text
submission-documents
```

5. Create staff accounts in Supabase Auth, then add matching rows in `profiles` with `auth_user_id` set to the auth user id and role set to `admin`, `rep`, `physician`, or `fulfillment`.
6. Add rep records with unique `rep_slug` values such as `cynthia`, `ish`, and `jane`.

The public intake form can insert patient profiles, submissions, waitlist records, audit logs, and private storage files. Staff dashboards are scaffolded in the UI; production data reads and update actions should use the RLS-backed tables from the migration.

## Auth Redirects

In Supabase, go to **Authentication > URL Configuration** and set:

```text
Site URL:
https://pepscriptrx.vercel.app

Additional Redirect URLs:
https://pepscriptrx.vercel.app/**
https://pepscriptrx.vercel.app/auth/callback
http://localhost:5173/**
```

The app passes `emailRedirectTo` during patient signup, so production confirmation emails should use:

```text
https://pepscriptrx.vercel.app/auth/callback
```

For local development, `http://localhost:5173/auth/callback` is still supported when running Vite locally.

## Branded Confirmation Email

In Supabase, go to **Authentication > Email Templates > Confirm signup**.

Subject:

```text
Confirm your PepScriptRX account
```

Body:

```html
<div style="margin:0;padding:0;background:#07111F;font-family:Arial,Helvetica,sans-serif;color:#102033;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07111F;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#F8FAFC;border-radius:18px;overflow:hidden;border:1px solid #D9E4EE;">
          <tr>
            <td style="padding:30px 30px 10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#102033;">PepScript<span style="color:#25C7D9;">RX</span></div>
              <div style="margin-top:8px;color:#64748B;font-size:14px;">Already prescribed? Refill for less.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 30px 8px;">
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#102033;">Welcome to PepScriptRX.</h1>
              <p style="margin:0;color:#475569;font-size:16px;line-height:1.6;">
                Please confirm your email address to finish creating your account.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 30px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1296A5;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 24px;border-radius:10px;">
                Confirm My Account
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 28px;">
              <p style="margin:0;color:#64748B;font-size:13px;line-height:1.6;">
                If the button does not work, copy and paste this link into your browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color:#1296A5;word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#EEF3F8;padding:18px 30px;text-align:center;color:#64748B;font-size:12px;line-height:1.5;">
              If you did not request this account, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

Supabase requires the `{{ .ConfirmationURL }}` variable. Do not replace it with a hardcoded link.

## Custom SMTP

To remove the default Supabase sender and “powered by Supabase” feel, configure **Authentication > SMTP Settings**.

Recommended providers:

- Resend
- Postmark

Recommended sender identities:

```text
PepScriptRX <noreply@pepscriptrx.com>
PepScriptRX <support@pepscriptrx.com>
```

Before switching SMTP, verify the sending domain in your email provider and add the required SPF, DKIM, and DMARC DNS records. Then send a test confirmation email from Supabase and confirm the link opens:

```text
https://pepscriptrx.vercel.app/auth/callback
```
