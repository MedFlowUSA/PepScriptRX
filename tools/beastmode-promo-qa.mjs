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
if (!url || !anonKey) throw new Error('Missing Supabase URL or anon key in .env.local/.env');

const supabase = createClient(url, anonKey);

const { data: product, error: productError } = await supabase
  .from('products')
  .select('id,name,price,category,status,active,customer_visible,sellable')
  .eq('id', 'wolverine-stack')
  .maybeSingle();
if (productError) throw productError;

const { data: status, error: statusError } = await supabase
  .from('public_inventory_status')
  .select('catalog_source,product_id,sku,quantity_on_hand,display_stock_label,checkout_allowed')
  .eq('catalog_source', 'products')
  .eq('product_id', 'wolverine-stack')
  .maybeSingle();
if (statusError) throw statusError;

const regularPrice = Number(product?.price ?? 149);
const promoPrice = 99;
const discount = Math.max(0, regularPrice - promoPrice);

console.log(JSON.stringify({
  product,
  inventory_status: status,
  promo: {
    code: 'BEASTMODE',
    case_insensitive_inputs: ['BEASTMODE', 'beastmode', 'BeastMode'].map((code) => code.trim().toUpperCase()),
    eligible_product: 'wolverine-stack',
    regular_price: regularPrice,
    discount_amount: discount,
    final_price: regularPrice - discount,
    wrong_product_message: 'BEASTMODE only applies to Wolverine Stack.',
    success_message: 'BEASTMODE applied — Wolverine Stack is now $99.',
  },
}, null, 2));
