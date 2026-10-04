import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { collectionLines, quotePureCart, type PureCollection, type PureQuote } from '../lib/pureCollections';
import { mapPureCatalogRow, PURE_CATALOG_SELECT, type PureCatalogProduct, type PureCatalogRow } from '../lib/purePeptideLabsCatalog';

export default function PureCollectionManager(){
  const [rows,setRows]=useState<PureCollection[]>([]);const [products,setProducts]=useState<PureCatalogProduct[]>([]);
  const [selected,setSelected]=useState<PureCollection|null>(null);const [quote,setQuote]=useState<PureQuote|null>(null);
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function load(){if(!supabase)return;const [r,p]=await Promise.all([supabase.from('store_collections').select('*').eq('store_slug','purepeptidelabs').order('display_order'),supabase.from('distributor_products').select(PURE_CATALOG_SELECT).eq('distributor.slug','purepeptidelabs')]);
    if(r.error||p.error){setMessage(r.error?.message??p.error!.message);return;}setRows(r.data as PureCollection[]);setProducts((p.data as unknown as PureCatalogRow[]).flatMap(row=>{const product=mapPureCatalogRow(row);return product?[product]:[];}));}
  useEffect(()=>{void load();},[]);
  function edit(patch:Partial<PureCollection>){if(selected)setSelected({...selected,...patch});setQuote(null);setMessage('');}
  async function preview(row:PureCollection){setSelected(row);setQuote(null);setBusy(true);try{setQuote(await quotePureCart(collectionLines(row),'',true));setMessage('Current prices and component eligibility verified.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function save(publish=false){if(!selected||!supabase)return;setBusy(true);setMessage('');const {data,error}=await supabase.rpc('save_pure_collection',{p_collection:{...selected,published:publish,reviewed_items:publish?quote?.items:null},p_expected_total:publish?quote?.subtotal:null});if(error)setMessage(error.message);else{setQuote(data);setSelected({...selected,id:data.id,published:publish});setMessage(publish?'Collection published.':'Draft saved. Review the current totals, then publish.');await load();}setBusy(false);}
  async function unpublish(){if(!selected||!supabase)return;setBusy(true);const {error}=await supabase.rpc('unpublish_pure_collection',{p_id:selected.id});setMessage(error?.message??'Collection unpublished.');if(!error){setSelected({...selected,published:false});await load();}setBusy(false);}
  return <section className="card"><div className="card-header"><h2 className="card-title">Pure Peptide Labs · Research collections</h2><p>Review exact variants and current prices. Save edits as a draft, review the calculated offer, then publish.</p></div><div className="card-body">
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{rows.map(r=><button className="btn btn-outline" key={r.id} onClick={()=>void preview(r)}>{r.name} · {r.published?'Published':'Draft'}</button>)}</div>
    {message&&<p role="status">{message}</p>}
    {selected&&<div style={{display:'grid',gap:16,marginTop:20}}>
      <label>Name<input className="form-input" value={selected.name} onChange={e=>edit({name:e.target.value})}/></label>
      <label>Description<textarea className="form-input" value={selected.description} onChange={e=>edit({description:e.target.value})}/></label>
      <label>Pure image path<input className="form-input" value={selected.image_url} onChange={e=>edit({image_url:e.target.value})}/></label>
      <label>Discount percent<input className="form-input" type="number" min="1" max="99" value={selected.discount_percent} onChange={e=>edit({discount_percent:Number(e.target.value)})}/></label>
      <label>Display order<input className="form-input" type="number" value={selected.display_order} onChange={e=>edit({display_order:Number(e.target.value)})}/></label>
      {selected.components.map((c,index)=><div key={index} style={{border:'1px solid var(--border)',padding:15,display:'grid',gap:10}}>
        <label>Component {index+1}<select className="form-input" value={c.product_id} onChange={e=>{const p=products.find(p=>p.id===e.target.value);if(p)edit({components:selected.components.map((v,i)=>i===index?{product_id:p.id,sku:p.sku,strength:p.strength,quantity:v.quantity}:v)});}}>
          {!products.some(p=>p.id===c.product_id)&&<option value={c.product_id}>Missing or archived · {c.sku}</option>}
          {products.map(p=><option key={p.id} value={p.id}>{p.product_name} · {p.strength} · {p.sku} · ${p.displayPrice?.toFixed(2)}</option>)}</select></label>
        <small>Variant ID: {c.product_id}<br/>SKU: {c.sku} · Approved strength: {c.strength}</small>
        <label>Quantity<input className="form-input" type="number" min="1" max="20" value={c.quantity} onChange={e=>edit({components:selected.components.map((v,i)=>i===index?{...v,quantity:Number(e.target.value)}:v)})}/></label>
        <div style={{display:'flex',gap:10}}><button className="btn btn-outline" disabled={!index} onClick={()=>{const cs=[...selected.components];[cs[index-1],cs[index]]=[cs[index],cs[index-1]];edit({components:cs});}}>Move up</button><button className="btn btn-outline" onClick={()=>edit({components:selected.components.filter((_,i)=>i!==index)})}>Remove component</button></div>
      </div>)}
      <button className="btn btn-outline" onClick={()=>{const p=products.find(p=>!selected.components.some(c=>c.product_id===p.id));if(p)edit({components:[...selected.components,{product_id:p.id,sku:p.sku,strength:p.strength,quantity:1}]});}}>Add component</button>
      {quote&&<div className="alert alert-info">Current individual total: ${quote.subtotal.toFixed(2)} · Savings: ${quote.discount.toFixed(2)} · Collection: ${quote.total.toFixed(2)}<br/>{quote.items.map(i=>`${i.name} ${i.strength}: ${i.inventory_status_label_at_purchase}`).join(' / ')}</div>}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-outline" disabled={busy} onClick={()=>void save(false)}>Save draft & validate</button><button className="btn btn-primary" disabled={busy||!quote} onClick={()=>void save(true)}>Publish reviewed collection</button><button className="btn btn-outline" disabled={busy||!selected.published} onClick={()=>void unpublish()}>Unpublish</button></div>
    </div>}
  </div></section>;
}
