// Read-only production quotes. Never submits an order, payment or inventory write.
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const project='ubfruugzofftwlomkqcl';const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
const db=createClient(`https://${project}.supabase.co`,keys.find(k=>k.name==='anon').api_key,{auth:{persistSession:false}});
const {data:rows,error}=await db.from('store_collections').select('*').eq('store_slug','purepeptidelabs').order('display_order');if(error)throw error;
assert.equal(rows.length,3);
const before=JSON.parse(readFileSync('artifacts/purepeptidelabs/bundle-audit.json','utf8'));
const catalog=await db.from('distributor_products').select('product_id,custom_price,custom_retail_price,commission_rate,distributor:distributors!inner(slug)').eq('distributor.slug','purepeptidelabs');if(catalog.error)throw catalog.error;
assert.equal(catalog.data.length,before.catalog.length);
for(const row of catalog.data){const old=before.catalog.find(x=>x.product_id===row.product_id);assert.ok(old);for(const key of ['custom_price','custom_retail_price','commission_rate'])assert.equal(row[key],old[key]);}
console.log('All 37 Pure retail prices and assignment commission rates unchanged.');
for(const [index,b] of rows.entries()){
 const items=b.components.map(c=>({id:c.product_id,sku:c.sku,strength:c.strength,qty:c.quantity,bundle_id:b.id}));
 for(const code of ['','PURE25']){const {data,error}=await db.rpc('quote_pure_cart',{p_items:items,p_code:code});if(error)throw error;
  assert.equal(data.total,(code?[275.25,216,365.25]:[311.95,244.8,413.95])[index]);console.log(b.name,code||'Bundle',data.total,data.items.map(i=>i.inventory_status_label_at_purchase).join(' / '));}
 const denied=await db.rpc('quote_pure_cart',{p_items:items,p_preview:true});assert.ok(denied.error,'Anonymous preview must be denied');
}
