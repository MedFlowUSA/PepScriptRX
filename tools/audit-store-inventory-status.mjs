import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase URL or anon key in .env.local/.env');
}

const supabase = createClient(url, anonKey);

const { data: statuses, error: statusError } = await supabase
  .from('public_inventory_status')
  .select('catalog_source,product_id,sku,quantity_on_hand,stock_status,display_stock_label,was_special_order,status_message')
  .limit(1000);

if (statusError) throw statusError;

const { data: products, error: productsError } = await supabase
  .from('rx_plus_products')
  .select('id,sku,product_name,strength,category,active')
  .order('sku')
  .limit(1000);

if (productsError) throw productsError;

const statusByProductId = new Map((statuses || []).map((row) => [row.product_id, row]));
const rxRows = (products || []).map((product) => ({
  ...product,
  inventory_status: statusByProductId.get(product.id) ?? null,
}));

const genericCheckout = rxRows.filter((row) => row.inventory_status?.display_stock_label === 'Checkout Available');
const stockedWithNotice = (statuses || []).filter(
  (row) => Number(row.quantity_on_hand || 0) > 0 && (row.was_special_order || /fulfillment may take/i.test(row.status_message || '')),
);
const rowsWithLegacy14DayCopy = (statuses || []).filter(
  (row) => /14 business days|fulfillment may take up to/i.test(row.status_message || ''),
);

const mappedMainSkus = [
  'TR30',
  'TR60',
  'SM10',
  'RT15',
  'WA10',
  'PNKIT',
  'RXP-MAIN-CAGRISEMA-48',
  'RXP-MAIN-CJCIPA-10',
  'RXP-MAIN-GHKCU-100',
  'RXP-MAIN-GLOW-GLOM-70',
  'RXP-MAIN-GLUTA-1500',
  'RXP-MAIN-HGH-100IU-KIT',
  'RXP-MAIN-HGH-240IU-KIT',
  'RXP-MAIN-IPA-10',
  'RXP-MAIN-IPA-5',
  'RXP-MAIN-MOTSC-10',
  'RXP-MAIN-TESA-10',
  'RXP-MAIN-WOLVERINE-20',
];
const mappedSamples = rxRows
  .filter((row) => mappedMainSkus.includes(row.inventory_status?.sku))
  .slice(0, 60)
  .map((row) => ({
    sku: row.sku,
    product_name: row.product_name,
    strength: row.strength,
    inventory_sku: row.inventory_status.sku,
    quantity_on_hand: row.inventory_status.quantity_on_hand,
    label: row.inventory_status.display_stock_label,
  }));
const mappedCounts = rxRows.reduce((acc, row) => {
  const sku = row.inventory_status?.sku;
  if (mappedMainSkus.includes(sku)) {
    acc[sku] = (acc[sku] || 0) + 1;
  }
  return acc;
}, {});

console.log(JSON.stringify({
  statusRows: statuses?.length ?? 0,
  rxPlusProducts: products?.length ?? 0,
  rxPlusGenericCheckout: genericCheckout.length,
  stockedRowsWithFulfillmentNotice: stockedWithNotice.length,
  rowsWithLegacy14DayCopy: rowsWithLegacy14DayCopy.length,
  legacy14DayCopySamples: rowsWithLegacy14DayCopy.slice(0, 20).map((row) => ({
    catalog_source: row.catalog_source,
    product_id: row.product_id,
    sku: row.sku,
    quantity_on_hand: row.quantity_on_hand,
    label: row.display_stock_label,
    status_message: row.status_message,
  })),
  mappedCounts,
  mappedSamples,
  genericCheckoutSamples: genericCheckout.slice(0, 40).map((row) => ({
    sku: row.sku,
    product_name: row.product_name,
    strength: row.strength,
    status_sku: row.inventory_status?.sku,
    label: row.inventory_status?.display_stock_label,
  })),
}, null, 2));
