import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPowered316Cart, standardRetailPrice, type Powered316Product } from '../src/lib/powered316Catalog.ts';
const product: Powered316Product = { id:'shared-id',sku:'SHARED',product_name:'Shared product',strength:'10 mg',category:'Research',description:null,retail_price:199,suggested_retail_price:600, inventoryStatus:{inventory_status:'in_stock',inventory_status_label:'In stock',quantity_on_hand:5,low_stock_threshold:2,allow_special_order:false,estimated_fulfillment_days:14,was_special_order:false,checkout_allowed:true,supporting_copy:null} };
test('316 follows standard retail precedence without partner overrides', () => {
  assert.equal(standardRetailPrice(product),199);
  assert.equal(standardRetailPrice({...product,retail_price:null}),600);
  assert.equal(standardRetailPrice({...product,retail_price:0}),null);
  assert.equal(standardRetailPrice({...product,retail_price:null,suggested_retail_price:null}),null);
  assert.equal(standardRetailPrice({...product,retail_price:NaN}),null);
});
test('316 cart retains shared identity and pending configuration, rejects unavailable and invalid quantities', () => {
  const cart=buildPowered316Cart([product],{'shared-id':2});
  assert.equal(cart.total,398);assert.equal(cart.items[0].id,'shared-id');assert.equal(cart.items[0].strength,'10 mg');
  assert.equal(cart.store_slug,'316');assert.equal(cart.rep,'');assert.equal(cart.commission_rate,null);assert.equal(cart.commission_owner,null);assert.equal(cart.partner_payout_eligible,false);
  assert.equal(buildPowered316Cart([{...product,inventoryStatus:undefined}],{'shared-id':1}).items.length,0);
  assert.equal(buildPowered316Cart([{...product,inventoryStatus:{...product.inventoryStatus!,checkout_allowed:false}}],{'shared-id':1}).items.length,0);
  for(const qty of [-1,0,1.5,NaN]) assert.equal(buildPowered316Cart([product],{'shared-id':qty}).items.length,0);
});
