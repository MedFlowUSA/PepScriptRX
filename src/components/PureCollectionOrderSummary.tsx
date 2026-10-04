import type { PatientSubmission } from '../types';
export default function PureCollectionOrderSummary({order}:{order:PatientSubmission}){
  const q=order.collection_summary;
  if(!q)return null;
  const margin=Math.max(0,Number(order.quoted_price??0)-Number(order.discount_amount??0)-Number(order.cost_of_goods??0));
  return <details style={{marginTop:12,fontSize:12}}><summary>Collection pricing & components</summary>
    <p>Component total: ${q.subtotal.toFixed(2)}<br/>Available bundle savings: ${q.bundle_discount.toFixed(2)}<br/>Promotion: {q.requested_code||'None'} (${q.promotion_discount.toFixed(2)})<br/>Applied single offer: {q.offer} · ${q.discount.toFixed(2)}<br/>Discounted merchandise: ${q.total.toFixed(2)}<br/>Order total including shipping: ${Number(order.order_total??0).toFixed(2)}<br/>Commissionable margin after costs: ${margin.toFixed(2)}</p>
    <p>{q.bundles.map(b=>`${b.name} ×${b.quantity}`).join(' / ')}</p>
    <ul>{(order.order_items as Array<{name:string;sku?:string;id:string;quantity?:number;qty?:number;line_paid_total?:number}>|null)?.map((item,index)=><li key={index}>{item.name} · {item.sku??item.id} · {item.quantity??item.qty} units{item.line_paid_total!=null?` · merchandise paid $${Number(item.line_paid_total).toFixed(2)}`:''}</li>)}</ul>
    <p>Use existing refund and inventory review procedures. Component amounts above exclude shipping.</p>
  </details>;
}
