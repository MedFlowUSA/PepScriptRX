export const STORE_PRICING_IMPORT_COLUMNS = [
  'product_slug',
  'product_name',
  'category',
  'retail_price',
  'display_price',
  'is_active',
  'image_path',
  'admin_code',
  'store_slug',
] as const;

export type StorePricingImportColumn = typeof STORE_PRICING_IMPORT_COLUMNS[number];

export type StorePricingImportRow = Record<StorePricingImportColumn, string | number | boolean>;

export const OPTIMAX_STORE_SLUG = 'optimax-peptide-therapy';
export const OPTIMAX_ADMIN_CODE = 'GABE50';
export const OPTIMAX_PRODUCT_IMAGE_PATH = '/marketing/optimax-vial.png';

export const OPTIMAX_PRICING_IMPORT_ROWS: StorePricingImportRow[] = [
  { product_slug: 'optimax-retatrutide-5mg', product_name: 'Retatrutide 5mg', category: 'GLP / Weight Management', retail_price: 119, display_price: 119, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-retatrutide-10mg', product_name: 'Retatrutide 10mg', category: 'GLP / Weight Management', retail_price: 169, display_price: 169, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-retatrutide-15mg', product_name: 'Retatrutide 15mg', category: 'GLP / Weight Management', retail_price: 229, display_price: 229, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-retatrutide-20mg', product_name: 'Retatrutide 20mg', category: 'GLP / Weight Management', retail_price: 289, display_price: 289, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-retatrutide-30mg', product_name: 'Retatrutide 30mg', category: 'GLP / Weight Management', retail_price: 379, display_price: 379, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tirzepatide-10mg', product_name: 'Tirzepatide 10mg', category: 'GLP / Weight Management', retail_price: 109, display_price: 109, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tirzepatide-15mg', product_name: 'Tirzepatide 15mg', category: 'GLP / Weight Management', retail_price: 149, display_price: 149, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tirzepatide-20mg', product_name: 'Tirzepatide 20mg', category: 'GLP / Weight Management', retail_price: 189, display_price: 189, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tirzepatide-30mg', product_name: 'Tirzepatide 30mg', category: 'GLP / Weight Management', retail_price: 259, display_price: 259, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tirzepatide-60mg', product_name: 'Tirzepatide 60mg', category: 'GLP / Weight Management', retail_price: 429, display_price: 429, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-semaglutide-10mg', product_name: 'Semaglutide 10mg', category: 'GLP / Weight Management', retail_price: 99, display_price: 99, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-cagrisema', product_name: 'CagriSema', category: 'GLP / Weight Management', retail_price: 299, display_price: 299, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-cagrilintide-5mg', product_name: 'Cagrilintide 5mg', category: 'GLP / Weight Management', retail_price: 179, display_price: 179, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-bpc-157', product_name: 'BPC-157', category: 'Recovery / Performance / Wellness', retail_price: 89, display_price: 89, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tb-500', product_name: 'TB-500', category: 'Recovery / Performance / Wellness', retail_price: 99, display_price: 99, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-bpc-157-tb-500-blend', product_name: 'BPC-157 / TB-500 Blend', category: 'Recovery / Performance / Wellness', retail_price: 129, display_price: 129, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-nad-plus', product_name: 'NAD+', category: 'Recovery / Performance / Wellness', retail_price: 119, display_price: 119, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-glutathione', product_name: 'Glutathione', category: 'Recovery / Performance / Wellness', retail_price: 79, display_price: 79, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-ghk-cu', product_name: 'GHK-Cu', category: 'Recovery / Performance / Wellness', retail_price: 119, display_price: 119, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-glow-peptide-blend', product_name: 'Glow Peptide Blend', category: 'Recovery / Performance / Wellness', retail_price: 139, display_price: 139, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-tesamorelin', product_name: 'Tesamorelin', category: 'Recovery / Performance / Wellness', retail_price: 179, display_price: 179, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-sermorelin', product_name: 'Sermorelin', category: 'Recovery / Performance / Wellness', retail_price: 129, display_price: 129, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-ipamorelin', product_name: 'Ipamorelin', category: 'Recovery / Performance / Wellness', retail_price: 109, display_price: 109, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-cjc-1295-ipamorelin', product_name: 'CJC-1295 / Ipamorelin', category: 'Recovery / Performance / Wellness', retail_price: 149, display_price: 149, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-hgh-somatropin', product_name: 'HGH / Somatropin', category: 'Recovery / Performance / Wellness', retail_price: 399, display_price: 399, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-aod-9604', product_name: 'AOD-9604', category: 'Additional Catalog / Optional', retail_price: 129, display_price: 129, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-pt-141', product_name: 'PT-141', category: 'Additional Catalog / Optional', retail_price: 109, display_price: 109, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-melanotan-ii', product_name: 'Melanotan II', category: 'Additional Catalog / Optional', retail_price: 89, display_price: 89, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-epitalon', product_name: 'Epitalon', category: 'Additional Catalog / Optional', retail_price: 119, display_price: 119, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-mots-c', product_name: 'MOTS-c', category: 'Additional Catalog / Optional', retail_price: 159, display_price: 159, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-ss-31', product_name: 'SS-31', category: 'Additional Catalog / Optional', retail_price: 169, display_price: 169, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-kisspeptin', product_name: 'Kisspeptin', category: 'Additional Catalog / Optional', retail_price: 149, display_price: 149, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-thymosin-alpha-1', product_name: 'Thymosin Alpha-1', category: 'Additional Catalog / Optional', retail_price: 149, display_price: 149, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-dsip', product_name: 'DSIP', category: 'Additional Catalog / Optional', retail_price: 119, display_price: 119, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-selank', product_name: 'Selank', category: 'Additional Catalog / Optional', retail_price: 109, display_price: 109, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-semax', product_name: 'Semax', category: 'Additional Catalog / Optional', retail_price: 109, display_price: 109, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
  { product_slug: 'optimax-ll-37', product_name: 'LL-37', category: 'Additional Catalog / Optional', retail_price: 179, display_price: 179, is_active: true, image_path: OPTIMAX_PRODUCT_IMAGE_PATH, admin_code: OPTIMAX_ADMIN_CODE, store_slug: OPTIMAX_STORE_SLUG },
];
