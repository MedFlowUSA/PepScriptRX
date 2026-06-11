import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const migrationPath = 'supabase/migrations/20260610200000_inventory_status_special_order.sql';
const portalPath = 'src/pages/public/RxPlusDistributorPortal.tsx';
const startPath = 'src/pages/public/Start.tsx';
const submittedPath = 'src/pages/public/Submitted.tsx';
const helperPath = 'src/lib/inventoryStatus.ts';

const requiredFiles = [migrationPath, portalPath, startPath, submittedPath, helperPath];
const failures = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

const read = (file) => existsSync(file) ? readFileSync(file, 'utf8') : '';
const allCustomerFacing = [portalPath, startPath, submittedPath, helperPath]
  .map((file) => read(file))
  .join('\n');
const migration = read(migrationPath);

const requiredSnippets = [
  'public_inventory_status',
  'allow_special_order',
  'estimated_fulfillment_days',
  'inventory_status_at_purchase',
  'was_special_order',
  'This item is currently out of stock. Fulfillment may take up to 14 business days.',
  'Your order includes one or more out-of-stock items. Fulfillment may take up to 14 business days.',
];

for (const snippet of requiredSnippets) {
  if (!`${allCustomerFacing}\n${migration}`.includes(snippet)) {
    failures.push(`Missing required snippet: ${snippet}`);
  }
}

const forbiddenPatterns = [
  /research purposes/i,
  /ships immediately/i,
  /ready to ship/i,
  /special order/i,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(allCustomerFacing)) failures.push(`Forbidden customer-facing phrase found: ${pattern}`);
}

if (!/create trigger patient_submissions_inventory_snapshot/i.test(migration)) {
  failures.push('Missing patient_submissions inventory snapshot trigger.');
}

const cleanEnv = (value) => String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
const supabaseUrl = cleanEnv(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const supabaseKey = cleanEnv(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

let liveViewSample = null;
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('public_inventory_status')
    .select('catalog_source, product_id, sku, display_stock_status, display_stock_label, checkout_allowed, was_special_order')
    .limit(10);
  if (error) {
    warnings.push(`Live public_inventory_status read failed: ${error.message}`);
  } else {
    liveViewSample = data ?? [];
  }
} else {
  warnings.push('Supabase env vars not set; live public_inventory_status read skipped.');
}

const result = {
  auditName: 'inventory-status',
  checkedAt: new Date().toISOString(),
  migrationPath,
  requiredFiles,
  liveViewSampleCount: liveViewSample?.length ?? null,
  liveViewSample,
  warnings,
  failures,
};

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) process.exit(1);
