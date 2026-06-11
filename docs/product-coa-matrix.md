# PepScriptRX Product-to-COA Matrix

Last updated: 2026-06-10

Scope: public certificate coverage compared with the active storefront/catalog naming families called out by the P1/P2 audit. Certificate availability was checked against the hardcoded public COA entries in `src/pages/public/Certificates.tsx` and current catalog naming/alias usage.

## Coverage Summary

| Product family | Catalog aliases reviewed | COA status | Notes / mismatch to resolve |
| --- | --- | --- | --- |
| Tirzepatide | Trizep, Tirz, Tirzepatide 10/15/20/30/60mg | Covered | Public COA entry exists for Tirzepatide. Batch is compound-level and does not distinguish every catalog dose. |
| Semaglutide | Sema, Semaglutide 10mg | Pending | Public COA row exists, but all batch fields are marked pending and no PDF is attached. |
| NAD+ | NAD, NAD+, NAD Plus, 100/500/1000 IU, 500/1000mg | Covered with dose-unit confirmation needed | Public COA entry exists for NAD+. Certificate does not distinguish IU vs mg catalog variants. |
| GHK-Cu | GHK-Cu, GHKCU, CU100 | Covered | Public COA entry exists for GHK-Cu. Confirm whether this covers all GHK-Cu dose/package variants. |
| CJC-1295 | CJC-1295 Without DAC | Covered as standalone CJC-1295 only | Public COA entry is for CJC-1295 Without DAC. It is not a full match for CJC-1295 / Ipamorelin blend products. |
| MOTS-C | MOTS-c, MOTS-C, MOTSC, MS10 | Covered | Public COA entry exists. Normalize display capitalization to MOTS-C where possible. |
| TB-500 | TB-500, TB500 | Covered | Public COA entry exists. |
| Wolverine Stack / BB20 | Wolverine, BB20, BPC/TB, BPC-157 + TB-500 | Partial | TB-500 coverage exists. BPC-157 coverage is missing, so the combo is not fully covered. |
| Glow Stack / GLOW70 | Glow, Glow 70, GLOW70, historical GloM | Partial | TB-500 and GHK-Cu coverage exists. BPC-157 coverage is missing. Historical GloM naming should remain archived only. |
| Klow Peptide Blend | Klow, Klow Stack | Partial | TB-500 and GHK-Cu coverage exists. KPV and BPC-157 coverage are missing. |
| BPC-157 | BPC-157, BPC157 | Missing | No public COA row was found. Required for BPC-only products and combo products containing BPC-157. |
| Retatrutide | Reta, Retatrutide 5/10/15/20/30/50mg, Reta Oral 500mcg | Missing | No public COA row was found. Oral 500mcg coverage should be confirmed separately if sourced differently. |
| CagriSema | CagriSema, CS10, Cagrilintide / Semaglutide blend | Missing | No public COA row was found. Catalog dose says 2.4mg + 2.4mg / 4.8mg total, while supplier notes reference CS10 10mg total; business confirmation needed before changing labels. |
| Cagrilintide | Cagri, Cagrilintide 5mg | Missing | No public COA row was found. |
| CJC-1295 / Ipamorelin | CJC/IP, CJCIPA, CP10 | Partial | CJC-1295 Without DAC COA exists; Ipamorelin coverage is missing. Need blend-specific or both-component documentation. |
| Ipamorelin | IPA, IPA5, IPA10, Ipamorelin 5/10mg | Missing | No public COA row was found. |
| Tesamorelin | Tesa, Tesamorelin 2/5/10mg, TSM10 | Missing | No public COA row was found. |
| HGH / Somatropin | HGH, Somatropin, H10, H24, 100/240 IU kits | Missing | No public COA row was found. |
| Glutathione | Gluta, Glutathione 1500mg | Missing | No public COA row was found. |
| AOD-9604 | AOD9604, AOD-9604 5/10mg | Missing | No public COA row was found. |
| IGF-1 / IGF-1 LR3 | IGF, IGF-1, IGF-1 LR3 1mg | Missing | No public COA row was found. |

## Safe Improvements Made

- Normalized product alias handling in the shared metadata helper for checkout, admin, rep, and storefront views.
- Added explicit aliases for BB20/Wolverine as BPC-157 + TB-500.
- Added explicit aliases for Reta/Retatrutide, Trizep/Tirzepatide, Sema/Semaglutide, CagriSema, GLOW70, Klow, CJC/Ipamorelin, Ipamorelin, HGH/Somatropin, MOTS-C, NAD+, AOD-9604, IGF, BPC-157, TB-500, GHK-Cu, and Glutathione.
- Did not attach or remap certificate files where a matching document was not clear.

## Business Confirmations Needed

- Confirm whether one compound-level COA is acceptable for all dose variants, especially NAD+ IU vs mg, GHK-Cu, Tirzepatide, and future Retatrutide variants.
- Confirm whether CagriSema should display 4.8mg total or CS10 / 10mg total in all customer-facing catalog surfaces.
- Provide BPC-157 COA coverage before treating Wolverine, Glow, or Klow combo products as fully covered.
- Provide blend-specific or component-level documentation for CJC-1295 / Ipamorelin.
