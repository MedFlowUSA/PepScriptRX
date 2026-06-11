# Credentialed Admin / Rep / Customer QA Checklist

Last updated: 2026-06-10

Do not hardcode or commit credentials. Use temporary QA accounts supplied through the normal secure channel, and rotate or deactivate them after testing.

## Credentials Needed

| Role | Required credential details |
| --- | --- |
| Platform admin | Email, temporary password, expected admin scope, and confirmation that the account can view platform-level orders, products, inventory, payment audit, promos, and partner tools. |
| Partner/store admin | Email, temporary password, store scope code, owner email, expected commission model, and expected storefront(s), such as AACTIVATED, Rock Phorm, Aurora, AG Prime, Vyigenix, or Zenora. |
| Rep account | Email or rep login, temporary password if applicable, rep code/slug, parent admin, expected commission rate, and expected referral links/promo links. |
| Customer account | Email, temporary password or passwordless test flow, test order history state, and any expected subscription/refill status. |
| Test payment path | Non-production payment method or a documented dry-run path. Do not use live customer payment credentials. |

## Platform Admin Checks

| Flow | Expected result | Pass / fail criteria |
| --- | --- | --- |
| Login and session persistence | Admin can log in, refresh, and stay in the correct admin shell. | Pass if protected admin routes load after refresh and logout clears access. |
| Product/catalog admin | Products, aliases, categories, strengths, and inventory status render without blank names or broken labels. | Pass if metadata matches catalog expectations and edits do not affect pricing unless intentionally saved. |
| Inventory status | Stock labels, special-order flags, hidden products, and checkout eligibility match configured inventory rows. | Pass if hidden products stay hidden and special-order notices appear consistently. |
| Orders/submissions | Admin can view recent orders with source portal, store scope, items, technical names, quantities, and attribution. | Pass if records are scoped correctly and no cross-store leakage appears. |
| Payment audit | Admin can view payment audit rows without exposing unrelated data. | Pass if totals and product/order labels are readable and scoped. |
| Promo tools | Admin can create, edit, disable, and validate promo links in the expected scope. | Pass if wrong-product promo rejection and eligible-product application both behave as expected. |

## Partner Admin Checks

| Flow | Expected result | Pass / fail criteria |
| --- | --- | --- |
| Scoped dashboard | Partner admin only sees assigned store(s), orders, reps, promos, and pricing tools. | Pass if unrelated stores and platform-only data are not visible. |
| Storefront checkout attribution | Orders submitted from the partner storefront preserve store slug, store name, owner/admin code, parent admin, and commission model. | Pass if order payload fields match the expected store scope. |
| Product/pricing display | Partner storefront catalog names, strengths, categories, and prices match configured product rows. | Pass if no unintended price changes or duplicate Wolverine/BB20 rows appear. |
| Promo/discount controls | Partner-specific discount code or promo link applies only within its allowed scope. | Pass if wrong store or wrong product is rejected with clear messaging. |

## Rep Checks

| Flow | Expected result | Pass / fail criteria |
| --- | --- | --- |
| Rep login or rep link access | Rep can access assigned dashboard/link tools only. | Pass if parent admin and rep code are correct and admin-only tools are hidden. |
| Referral link preservation | Opening storefront with rep params preserves attribution through cart and checkout payload. | Pass if submitted order includes the expected rep slug/code and parent store. |
| Promo link behavior | Rep promo links load, display the correct discount message, and apply only to eligible products. | Pass if eligible product discounts calculate correctly and wrong-product discounts are rejected. |
| Commission visibility | Rep-facing totals match documented commission rules without exposing admin-only cost data. | Pass if rep sees expected earned/eligible values and no true-cost fields unless intentionally allowed. |

## Customer Checks

| Flow | Expected result | Pass / fail criteria |
| --- | --- | --- |
| Login/account access | Customer can log in or use the configured passwordless path and only sees their own data. | Pass if customer cannot access admin/rep routes or other customers' orders. |
| Catalog browse/search | Customer can search, filter, sort, and add products on desktop and mobile. | Pass if mobile search returns the user to readable results without header overlap or scroll lock. |
| Cart and checkout | Cart quantities, discounts, special-order notices, and totals remain readable and accurate through checkout. | Pass if item names, technical names, strengths, and prices match the storefront catalog. |
| Order history/refill | Customer can view expected order/refill history and submit allowed refill or support actions. | Pass if records are customer-scoped and actions create the expected submission/order state. |
| Logout/security | Logout clears the session and protected routes redirect to login/start. | Pass if browser refresh after logout does not restore protected access. |

## Evidence To Capture

- Date/time, environment, browser, and viewport used.
- Test account role and store scope, without recording passwords.
- Screenshot or exported evidence for any failure.
- Order/submission IDs for successful dry-run checkout tests.
- Pass/fail notes for each row above, including any residual business confirmation needed.
