import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const project='ubfruugzofftwlomkqcl';
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
const db=createClient(`https://${project}.supabase.co`,keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false}});
async function read(q){const {data,error}=await q;if(error)throw error;return data;}
const catalog=await read(db.from('distributor_products').select('*,distributor:distributors!inner(slug),product:rx_plus_products(*)').eq('distributor.slug','purepeptidelabs'));
const inventory=await read(db.from('public_inventory_status').select('*').eq('catalog_source','rx_plus_products').in('product_id',catalog.map(r=>r.product_id)));
const brand=await read(db.from('partner_brands').select('pricing_guardrails,colors').eq('brand_id','purepeptidelabs').single());
const promos=await read(db.from('aactivated_promo_links').select('discount_code,discount_percent,product_id,is_active,store_scope_code,promo_kind,starts_at,expires_at,usage_limit,min_subtotal').in('store_scope_code',['PUREPEPTIDELABS','GLOBAL']));
const snapshot={catalog,inventory,brand,promos};writeFileSync('artifacts/purepeptidelabs/bundle-audit.json',JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({brand,promos,products:catalog.map(r=>({id:r.product_id,sku:r.product.sku,strength:r.product.strength,name:r.product.product_name,price:r.custom_price??r.custom_retail_price,enabled:r.is_enabled&&r.enabled!==false,inventory:inventory.find(i=>i.product_id===r.product_id)}))},null,2));
