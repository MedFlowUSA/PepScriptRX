# PepScriptRX Master Inventory Sync - 2026-07-11

Source report: `PepScriptRX_Master_Inventory_2026-07-11.pdf`

The app does not currently expose a location-level inventory table for LA and Redlands. The migrations total location counts into the central `inventory_items.current_qty` field and keep the original location split here for review. No product pricing, descriptions, commissions, or storefront configuration records were changed.

## Synced Existing Inventory SKUs

| Existing SKU | Report product | Strength | LA | Redlands | Total |
| --- | --- | --- | ---: | ---: | ---: |
| RT15 | Retatrutide | 15 mg | 26 | 0 | 26 |
| TR30 | Tirzepatide | 30 mg | 2 | 0 | 2 |
| SM10 | Semaglutide | 10 mg | 0 | 20 | 20 |
| WA10 | BAC Water | 10 mL | 37 | 92 | 129 |
| RXP-MAIN-WOLVERINE-20 | Wolverine Stack / BB20 | 20 mg blend | 29 | 9 | 38 |
| RXP-MAIN-GLOW70 | Glow | 70 mg | 8 | 14 | 22 |
| RXP-MAIN-CJCIPA-10 | CJC-1295 No DAC / Ipamorelin | 5 mg + 5 mg, 10 mg total | 10 | 0 | 10 |
| RXP-MAIN-GLUTA-1500 | Glutathione | 1500 mg | 0 | 6 | 6 |
| RXP-MAIN-HGH-100IU-KIT | HGH Kit | 100 IU | 0 | 2 | 2 |
| RXP-MAIN-TESA-10 | Tesamorelin | 10 mg | 0 | 5 | 5 |

## Added Master Inventory SKUs

| Added SKU | Report product | Strength | LA | Redlands | Total |
| --- | --- | --- | ---: | ---: | ---: |
| RXP-REC-BPC157-10 | BPC-157 | 10 mg | 0 | 10 | 10 |
| RXP-LONG-NAD-500 | NAD+ | 500 mg | 0 | 30 | 30 |
| RXP-LONG-NAD-1000 | NAD+ | 1000 mg | 0 | 1 | 1 |
| RXP-GLP-RETA-20 | Retatrutide | 20 mg | 0 | 34 | 34 |
| RXP-GLP-RETA-30 | Retatrutide | 30 mg | 0 | 6 | 6 |
| RXP-GLP-CAGRI-10 | Cagrilintide | 10 mg | 0 | 10 | 10 |
| RXP-MAIN-TB500-15 | TB-500 | 15 mg | 0 | 30 | 30 |
| RXP-MAIN-GHKCU-1000 | GHK-Cu | 1000 mg | 0 | 9 | 9 |
| RXP-MAIN-GHKCU-500 | GHK-Cu | 500 mg | 0 | 19 | 19 |
| RXP-MAIN-TESAIPA-10-5 | Tesamorelin / Ipamorelin | 10/5 mg | 0 | 8 | 8 |
| RXP-MAIN-MOTSC-40 | MOTS-c | 40 mg | 0 | 8 | 8 |
| RXP-NEU-SELANK-10 | Selank | 10 mg | 0 | 10 | 10 |

## Propagation Notes

The second migration also extends `resolve_main_inventory_sku` and refreshes `public_inventory_status` so existing storefront products with strength in their product ID, such as `mark-retatrutide-30mg`, `warxlabz-mots-c-40mg`, and `warxlabz-selank-10mg`, resolve to the central inventory SKU without editing those storefront product records.

`RXP-MAIN-TB500-15`, `RXP-MAIN-GHKCU-1000`, `RXP-MAIN-GHKCU-500`, and `RXP-MAIN-TESAIPA-10-5` were added to master inventory from the report, but no currently connected storefront product resolves to those exact strengths. They will remain master/admin inventory items until a storefront product for the same exact item exists.

## Retail Prices

Retail prices were added to `inventory_items.retail_price` only. Storefront product prices were not changed.

| SKU | Retail | Source |
| --- | ---: | --- |
| RT15 | 279 | Main product retail |
| TR30 | 199 | Main product retail |
| SM10 | 99 | Main product retail |
| WA10 | 12 | Main product retail |
| RXP-MAIN-WOLVERINE-20 | 149 | Main product retail |
| RXP-MAIN-GLOW70 | 179 | Main product retail |
| RXP-MAIN-CJCIPA-10 | 149 | Main product retail |
| RXP-MAIN-GLUTA-1500 | 139 | Main product retail |
| RXP-MAIN-HGH-100IU-KIT | 349 | Main product retail |
| RXP-MAIN-TESA-10 | 159 | Main product retail |
| RXP-REC-BPC157-10 | 99 | Rx Plus suggested retail |
| RXP-LONG-NAD-500 | 119 | Rx Plus suggested retail |
| RXP-LONG-NAD-1000 | 179 | Rx Plus suggested retail |
| RXP-GLP-RETA-20 | 350 | Rx Plus suggested retail |
| RXP-GLP-RETA-30 | 349 | Rep intake suggested retail |
| RXP-GLP-CAGRI-10 | 300 | Existing storefront retail |
| RXP-MAIN-TB500-15 | 150 | Catalog family fallback |
| RXP-MAIN-GHKCU-1000 | 119 | Catalog family fallback |
| RXP-MAIN-GHKCU-500 | 119 | Catalog family fallback |
| RXP-MAIN-TESAIPA-10-5 | 248 | Component fallback |
| RXP-MAIN-MOTSC-40 | 150 | Existing storefront retail |
| RXP-NEU-SELANK-10 | 55 | Existing storefront retail |
