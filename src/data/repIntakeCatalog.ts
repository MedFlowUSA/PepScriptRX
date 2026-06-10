export type RepIntakeProduct = {
  id: string;
  category: string;
  productName: string;
  suggestedRetailPrice: number;
};

export const REP_INTAKE_PRODUCT_CATEGORIES = [
  'GLP / Weight Management',
  'Recovery / Performance / Wellness',
  'Additional Catalog / Optional Items',
  'Supplies / Add-ons',
] as const;

export const REP_INTAKE_PRODUCTS: RepIntakeProduct[] = [
  { id: 'retatrutide-5mg', category: 'GLP / Weight Management', productName: 'Retatrutide 5mg', suggestedRetailPrice: 179 },
  { id: 'retatrutide-10mg', category: 'GLP / Weight Management', productName: 'Retatrutide 10mg', suggestedRetailPrice: 229 },
  { id: 'retatrutide-15mg', category: 'GLP / Weight Management', productName: 'Retatrutide 15mg', suggestedRetailPrice: 269 },
  { id: 'retatrutide-20mg', category: 'GLP / Weight Management', productName: 'Retatrutide 20mg', suggestedRetailPrice: 299 },
  { id: 'retatrutide-30mg', category: 'GLP / Weight Management', productName: 'Retatrutide 30mg', suggestedRetailPrice: 349 },
  { id: 'tirzepatide-10mg', category: 'GLP / Weight Management', productName: 'Tirzepatide 10mg', suggestedRetailPrice: 129 },
  { id: 'tirzepatide-15mg', category: 'GLP / Weight Management', productName: 'Tirzepatide 15mg', suggestedRetailPrice: 149 },
  { id: 'tirzepatide-20mg', category: 'GLP / Weight Management', productName: 'Tirzepatide 20mg', suggestedRetailPrice: 169 },
  { id: 'tirzepatide-30mg', category: 'GLP / Weight Management', productName: 'Tirzepatide 30mg', suggestedRetailPrice: 199 },
  { id: 'tirzepatide-60mg', category: 'GLP / Weight Management', productName: 'Tirzepatide 60mg', suggestedRetailPrice: 249 },
  { id: 'semaglutide-10mg', category: 'GLP / Weight Management', productName: 'Semaglutide 10mg', suggestedRetailPrice: 99 },
  { id: 'cagrisema', category: 'GLP / Weight Management', productName: 'CagriSema - 2.4 mg + 2.4 mg, 4.8 mg total', suggestedRetailPrice: 249 },
  { id: 'cagrilintide-5mg', category: 'GLP / Weight Management', productName: 'Cagrilintide 5mg', suggestedRetailPrice: 179 },
  { id: 'bpc-157-5mg', category: 'Recovery / Performance / Wellness', productName: 'BPC-157 5mg', suggestedRetailPrice: 99 },
  { id: 'bpc-157-10mg', category: 'Recovery / Performance / Wellness', productName: 'BPC-157 10mg', suggestedRetailPrice: 139 },
  { id: 'tb-500-5mg', category: 'Recovery / Performance / Wellness', productName: 'TB-500 5mg', suggestedRetailPrice: 99 },
  { id: 'tb-500-10mg', category: 'Recovery / Performance / Wellness', productName: 'TB-500 10mg', suggestedRetailPrice: 149 },
  { id: 'bpc-157-tb-500-blend', category: 'Recovery / Performance / Wellness', productName: 'Wolverine Stack - BPC-157 10 mg + TB-500 10 mg, 20 mg total', suggestedRetailPrice: 159 },
  { id: 'nad-plus', category: 'Recovery / Performance / Wellness', productName: 'NAD+ - 1000 mg', suggestedRetailPrice: 149 },
  { id: 'glutathione-1500mg', category: 'Recovery / Performance / Wellness', productName: 'Glutathione 1500mg', suggestedRetailPrice: 149 },
  { id: 'ghk-cu-100mg', category: 'Recovery / Performance / Wellness', productName: 'GHK-Cu 100mg', suggestedRetailPrice: 129 },
  { id: 'glow-peptide-blend', category: 'Recovery / Performance / Wellness', productName: 'Glow Stack - 70 mg total', suggestedRetailPrice: 169 },
  { id: 'tesamorelin-2mg', category: 'Recovery / Performance / Wellness', productName: 'Tesamorelin 2mg', suggestedRetailPrice: 99 },
  { id: 'tesamorelin-5mg', category: 'Recovery / Performance / Wellness', productName: 'Tesamorelin 5mg', suggestedRetailPrice: 149 },
  { id: 'tesamorelin-10mg', category: 'Recovery / Performance / Wellness', productName: 'Tesamorelin 10mg', suggestedRetailPrice: 199 },
  { id: 'sermorelin', category: 'Recovery / Performance / Wellness', productName: 'Sermorelin', suggestedRetailPrice: 129 },
  { id: 'ipamorelin', category: 'Recovery / Performance / Wellness', productName: 'Ipamorelin - 5 mg', suggestedRetailPrice: 129 },
  { id: 'cjc-1295-ipamorelin', category: 'Recovery / Performance / Wellness', productName: 'CJC-1295 / Ipamorelin - 5 mg + 5 mg, 10 mg total', suggestedRetailPrice: 169 },
  { id: 'hgh-somatropin', category: 'Recovery / Performance / Wellness', productName: 'HGH / Somatropin - 24 IU x 10, 240 IU total', suggestedRetailPrice: 199 },
  { id: 'aod-9604-5mg', category: 'Additional Catalog / Optional Items', productName: 'AOD-9604 5mg', suggestedRetailPrice: 119 },
  { id: 'aod-9604-10mg', category: 'Additional Catalog / Optional Items', productName: 'AOD-9604 10mg', suggestedRetailPrice: 169 },
  { id: 'pt-141', category: 'Additional Catalog / Optional Items', productName: 'PT-141', suggestedRetailPrice: 119 },
  { id: 'melanotan-ii', category: 'Additional Catalog / Optional Items', productName: 'Melanotan II', suggestedRetailPrice: 119 },
  { id: 'epitalon', category: 'Additional Catalog / Optional Items', productName: 'Epitalon', suggestedRetailPrice: 129 },
  { id: 'mots-c-10mg', category: 'Additional Catalog / Optional Items', productName: 'MOTS-c 10mg', suggestedRetailPrice: 149 },
  { id: 'ss-31', category: 'Additional Catalog / Optional Items', productName: 'SS-31', suggestedRetailPrice: 169 },
  { id: 'kisspeptin', category: 'Additional Catalog / Optional Items', productName: 'Kisspeptin', suggestedRetailPrice: 129 },
  { id: 'thymosin-alpha-1', category: 'Additional Catalog / Optional Items', productName: 'Thymosin Alpha-1', suggestedRetailPrice: 159 },
  { id: 'dsip', category: 'Additional Catalog / Optional Items', productName: 'DSIP', suggestedRetailPrice: 119 },
  { id: 'selank', category: 'Additional Catalog / Optional Items', productName: 'Selank', suggestedRetailPrice: 119 },
  { id: 'semax', category: 'Additional Catalog / Optional Items', productName: 'Semax', suggestedRetailPrice: 119 },
  { id: 'll-37', category: 'Additional Catalog / Optional Items', productName: 'LL-37', suggestedRetailPrice: 149 },
  { id: 'bac-water-syringe-kit', category: 'Supplies / Add-ons', productName: 'BAC Water + 8-Pack Syringe Kit', suggestedRetailPrice: 12 },
  { id: 'reusable-pen-kit', category: 'Supplies / Add-ons', productName: 'Reusable Pen Kit', suggestedRetailPrice: 19 },
  { id: 'insulin-syringe-pack', category: 'Supplies / Add-ons', productName: 'Insulin Syringe Pack', suggestedRetailPrice: 12 },
];
