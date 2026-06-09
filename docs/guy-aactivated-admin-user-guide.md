# AACTIVATEDRX Admin Portal User Guide

Prepared for: Guy Griffithe  
Portal: PepScriptRX / AACTIVATEDRX Admin  
Production URL: https://pepscriptrx.vercel.app

Important: Do not store the admin password in this guide. Use a secure password manager.

## 1. Log In

1. Go to https://pepscriptrx.vercel.app/login?portal=admin.
2. Enter the AACTIVATED admin email.
3. Enter the admin password from the secure handoff.
4. Click **Sign In**.
5. Confirm the left sidebar says **Rx_plus_admin Portal** or shows the AACTIVATED admin tools.
6. If the page lands somewhere unexpected, click **Dashboard** in the left sidebar.

Verified: the Guy admin login successfully reaches `/admin` on `https://pepscriptrx.vercel.app`.

## 2. Admin Portal Layout

The left sidebar is the main control center. The most important AACTIVATEDRX sections are:

- **Dashboard**: quick overview.
- **Orders**: customer submissions/orders.
- **Rep Requests**: approve or reject new rep applications.
- **Reps**: edit active rep account details.
- **Rep Store Manager**: manage rep storefronts, product lists, hierarchy/uplines, and portal login access.
- **Commission Center**: set rep commission rules within allowed limits.
- **Product Lists**: create product groups for rep stores.
- **Pricing Manager**: control AACTIVATED product pricing, visibility, top sellers, and bundle grouping.
- **Products**: scoped product/catalog view.
- **Customer Activity**: customer/order behavior summary.
- **Product Performance**: product sales performance.
- **Promo Links**: promo and campaign tracking.
- **Leads**: lead records.
- **Payouts**: payout visibility.
- **Store Settings**: storefront branding/support content.
- **Feature Requests**: submit platform requests.

If broader platform tools appear, only change AACTIVATEDRX-related records unless a platform admin specifically approves otherwise.

## 3. Rep Requests

Use **Rep Requests** when someone applies to become an AACTIVATED rep.

1. Click **Rep Requests**.
2. Review the request details:
   - Name
   - Email
   - Desired rep code
   - Parent/upline info
   - Notes
3. Choose one action:
   - **Approve**: moves the rep forward.
   - **Reject**: declines the request.
   - **Request More Information**: sends the request back for clarification.
4. After approval, use the setup workflow to create or activate the rep account/store.

Best practice: do not approve incomplete requests until email, payout info, and rep code are clear.

## 4. Reps

Use **Reps** to edit active rep account basics.

1. Click **Reps**.
2. Find the rep row.
3. Click **Edit**.
4. Update normal fields as needed:
   - Display name
   - Commission percent
   - Discount code
   - Discount amount
   - Payout email
   - Handle / username
5. Click **Save Changes**.

Important:

- Admin-tier records such as BOSSIQUIT have locked admin access fields.
- Do not downgrade an admin-tier account to a standard rep.
- Use **Deactivate** only when a rep should no longer be active.

## 5. Rep Store Manager

Use **Rep Store Manager** to control rep storefronts and hierarchy.

1. Click **Rep Store Manager**.
2. Find the rep.
3. Review or edit:
   - Display name
   - Store slug
   - Store status: Draft, Active, Disabled
   - Product list assignment
   - Pricing mode
   - Feature toggles
   - Upline / hierarchy assignment
4. To place a rep under another rep:
   - Use the **Hierarchy** dropdown.
   - Select the correct upline.
   - Click **Save Store**.
5. To move a rep back under the main AACTIVATED portal:
   - Select **AACTIVATEDRX Main Portal / GUY60**.
   - Click **Save Store**.

The system prevents assigning a rep under themselves or creating a loop.

## 6. Grant Rep Portal Login

Use this only after a rep is approved and should access their portal.

1. Go to **Rep Store Manager**.
2. Find the rep.
3. If the rep does not already have portal access, click **Grant Login + Temp PW**.
4. Copy the temporary password from the success message.
5. Send the rep:
   - Rep portal URL: https://pepscriptrx.vercel.app/rep
   - Their login email
   - Temporary password
6. Tell the rep to change the password after first login.

Do not send passwords through public comments or shared screenshots.

## 7. Commission Center

Use **Commission Center** to manage AACTIVATED rep commission settings.

1. Click **Commission Center**.
2. Find the rep.
3. Set commission percent.
4. Choose commission type if needed.
5. Add notes if there is an approval reason or special case.
6. Click **Save**.

Guardrails:

- Normal AACTIVATED partner commission settings are scoped to AACTIVATEDRX.
- High commission changes may require platform approval.
- Commission should be calculated after customer discounts are applied.
- Internal rep/sample codes should not generate customer commission.

## 8. Product Lists

Use **Product Lists** when a rep store should show a curated set of products.

1. Click **Product Lists**.
2. Enter a list name.
3. Choose a template:
   - Full Catalog
   - GLP Starter
   - Performance
   - Recovery
   - Longevity
   - Custom
4. Select or deselect products.
5. Add notes if helpful.
6. Click **Create Product List**.
7. Go to **Rep Store Manager** to assign the list to a rep.

Use product lists for rep/storefront organization, not for changing global product data.

## 9. Pricing Manager

Use **Pricing Manager** for AACTIVATED storefront pricing and visibility.

1. Click **Pricing Manager**.
2. Review the AACTIVATED product table.
3. For each product, manage:
   - Retail price
   - Sale price
   - Active/visible status
   - Featured / Top Seller status
   - Sort order
   - Bundle group fields
4. Click **Save** for the product row or save all changes if available.

Important:

- Pricing changes apply to AACTIVATEDRX only.
- Historical orders keep the price captured at purchase time.
- Do not change pricing for other partner stores from this portal.
- Bundle discounts should be used carefully and checked in cart/checkout after changes.

## 10. Top Sellers

Top Sellers are controlled through AACTIVATED product settings.

1. Go to **Pricing Manager**.
2. Mark products as featured/top sellers where available.
3. Set the storefront order/rank.
4. Save changes.
5. Open https://pepscriptrx.vercel.app/AACTIVATED to confirm the storefront order.

Recommended: keep the top seller section focused on the top 10 AACTIVATED products.

## 11. Promo Links and Discount Codes

Use **Promo Links** and the promo/discount tools to track rep campaigns.

Code families:

- `SAVE-*`: default customer discount code.
- Rep tier codes such as `ADONIS15`, `ADONIS20`, `ADONIS25`, `ADONIS30`: customer promo tiers.
- `REP-*`: internal rep/sample codes only.

Rules:

- Customer promo codes should be used only in customer checkout.
- `REP-*` codes are internal/sample codes and should not be used for customer checkout.
- Discounts above approved preset tiers require platform approval.
- Do not mix customer discounts with internal rep sample discounts.

## 12. Orders

Use **Orders** to review customer order flow.

1. Click **Orders**.
2. Search or filter by customer, rep, product, or status.
3. Review:
   - Product ordered
   - Customer contact info
   - Payment status
   - Discount code used
   - Rep attribution
   - Order status
4. Do not mark payment complete unless payment has been verified.

## 13. Customer Activity and Product Performance

Use these pages for sales review.

Customer Activity helps answer:

- Who is ordering?
- Who may need follow-up?
- Are there repeat customers?
- Are there abandoned or unpaid orders?

Product Performance helps answer:

- Which products are selling?
- Which products need better visibility?
- Which products are underperforming?

## 14. Store Settings

Use **Store Settings** for AACTIVATED storefront content.

1. Click **Store Settings**.
2. Review branding/support fields.
3. Update support contact, descriptions, hero/promotional content, or social links.
4. Save.
5. Check the public AACTIVATED storefront after saving.

## 15. Feature Requests

Use **Feature Requests** when something needs platform support.

1. Click **Feature Requests**.
2. Enter a clear request title.
3. Choose priority.
4. Choose category.
5. Describe exactly what is needed.
6. Click **Submit Request**.

Good examples:

- “Need new product added to AACTIVATED pricing manager.”
- “Need custom discount above 30% approved.”
- “Need rep hierarchy adjusted for a team lead.”

## 16. Daily Workflow Checklist

1. Check **Rep Requests** for new applicants.
2. Check **Orders** for new customer orders or payment issues.
3. Check **Leads** and **Customer Activity** for follow-up opportunities.
4. Review **Reps** and **Rep Store Manager** for account/store changes.
5. Review **Pricing Manager** before running promotions.
6. Use **Feature Requests** for anything requiring platform help.

## 17. Safety Rules

- Do not share admin passwords in screenshots, texts, or public notes.
- Do not delete reps unless platform admin approves.
- Prefer deactivating a rep/store over deleting.
- Do not change platform-wide settings from the AACTIVATED admin account.
- Do not use customer promo codes for internal rep sample orders.
- Do not use internal `REP-*` sample codes for customer orders.
- After any pricing or product visibility change, check the public AACTIVATED storefront.

## 18. Public Links Guy May Need

- Admin login: https://pepscriptrx.vercel.app/login?portal=admin
- AACTIVATED storefront: https://pepscriptrx.vercel.app/AACTIVATED
- Rep portal login: https://pepscriptrx.vercel.app/rep
- Rep intake form: https://pepscriptrx.vercel.app/AACTIVATED/rep-intake

## 19. Troubleshooting

If login fails:

1. Confirm the email is typed correctly.
2. Confirm the password from the secure handoff.
3. Try an incognito/private window.
4. Clear browser cache for `pepscriptrx.vercel.app`.
5. Ask platform admin to reset the password.

If a save fails:

1. Read the red error message.
2. Confirm you are editing an AACTIVATEDRX record.
3. Do not change locked admin-tier fields.
4. Try saving only one small change.
5. Submit a Feature Request or contact platform admin if the same error repeats.

If a rep cannot log in:

1. Confirm the rep exists under **Reps**.
2. Confirm the rep store is active under **Rep Store Manager**.
3. Confirm **Grant Login + Temp PW** has been run.
4. Send the rep the `/rep` login link and temporary password privately.

## 20. What Was Verified

- Guy admin login reaches `/admin`.
- The admin portal shows Guy as the signed-in admin.
- The AACTIVATED Rep Store Manager route loads and displays AACTIVATEDRX scoped tooling.
- No production records were changed during this guide verification.
