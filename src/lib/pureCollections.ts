import { supabase } from './supabase';
export type CollectionComponent = { product_id: string; sku: string; strength: string; quantity: number };
export type PureCollection = { id: string; slug: string; name: string; description: string; image_url: string; components: CollectionComponent[]; discount_percent: number; display_order: number; published: boolean };
export type PureCartLine = { id: string; sku?: string; strength: string; qty: number; name: string; category: string; price: number; bundle_id?: string | null; bundle_name?: string | null; line_discount_amount?: number; line_paid_total?: number; was_special_order?: boolean; inventory_status_at_purchase?: string; inventory_status_label_at_purchase?: string; estimated_fulfillment_days_at_purchase?: number };
export type PureQuote = { items: PureCartLine[]; subtotal: number; bundle_discount: number; promotion_discount: number; discount: number; total: number; applied_code: string; requested_code: string; offer: string; bundles: {id:string;name:string;quantity:number;regular_total:number;discount:number;total:number;discount_percent:number}[] };
export async function quotePureCart(items: PureCartLine[], code = '', preview = false): Promise<PureQuote> {
  if (!supabase) throw new Error('Checkout is temporarily unavailable.');
  const {data,error} = await supabase.rpc('quote_pure_cart',{p_items:items,p_code:code,p_preview:preview});
  if (error) throw new Error(error.message);
  return data as PureQuote;
}
export const collectionLines = (collection: PureCollection, quantity = 1): PureCartLine[] => collection.components.map(c => ({id:c.product_id,sku:c.sku,strength:c.strength,qty:c.quantity*quantity,bundle_id:collection.id,name:'',category:'',price:0}));
export function applyPureQuote<T extends {items: PureCartLine[];total:number}>(cart:T, quote:PureQuote) {
  return {...cart,items:quote.items,total:quote.subtotal,discount_code:quote.applied_code,discount_amount:quote.discount,bundle_discount_amount:quote.bundle_discount,pure_quote:quote,pure_bundles:quote.bundles.map(b=>({id:b.id,quantity:b.quantity}))};
}
