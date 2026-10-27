import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { isPlatformAdmin } from '../../lib/partnerTenant';
import { supabase } from '../../lib/supabase';
import type { Article, Concept } from '../../lib/pettides';
import { ADMIN_NAV } from './adminNav';

type AdminConcept = Omit<Concept, 'public_price'> & { provisional_price: number; active: boolean; purchasable: boolean; show_price: boolean; cost: number | null; launch_checklist: Record<string, boolean> };
type Lead = { id: string; first_name: string | null; email: string; created_at: string };
type Promo = { id: string; promo_title: string; discount_code: string; discount_amount: number; product_id: string | null; is_active: boolean };
const checks = [['legal','Legal and regulatory status'],['evidence','Veterinary and scientific evidence'],['quality','Manufacturing and product quality'],['labeling','Labeling and marketing language'],['distribution','Payment processor and distribution requirements']];
export default function AdminPetTides() {
  const { profile } = useAuth();
  const allowed = isPlatformAdmin(profile);
  const [products, setProducts] = useState<AdminConcept[]>([]);
  const [articles, setArticles] = useState<(Article & { source_verified: boolean })[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [message, setMessage] = useState('');
  const [salesEnabled,setSalesEnabled]=useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase || !allowed) return;
    const results = await Promise.all([
      supabase.from('pettides_concepts').select('*').order('slug'),
      supabase.from('pettides_articles').select('*').order('title'),
      supabase.from('portal_age_lead_captures').select('id,first_name,email,created_at').eq('portal_id','pettides').order('created_at',{ascending:false}).limit(500),
      supabase.from('aactivated_promo_links').select('id,promo_title,discount_code,discount_amount,product_id,is_active').eq('store_scope_code','PETTIDES'),
      supabase.from('pettides_store_settings').select('sales_enabled').eq('id',true).single(),
    ]);
    const error = results.find(r => r.error)?.error;
    if (error) throw new Error(error.message);
    setSalesEnabled(Boolean(results[4].data?.sales_enabled)); setProducts(results[0].data as AdminConcept[]); setArticles(results[1].data as (Article & { source_verified: boolean })[]); setLeads(results[2].data as Lead[]); setPromos(results[3].data as Promo[]);
  }, [allowed]);
  useEffect(() => { if (!supabase) setMessage('Supabase is not configured.'); else void load().catch(e => setMessage(`PetTides configuration unavailable: ${e.message}. Apply the PetTides migration before managing content.`)); }, [load]);
  async function save(table: string, key: string, value: Record<string, unknown>) {
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error, data } = await supabase.from(table).update(value).eq('slug',key).select('slug');
      if (error) throw error;
      if (!data?.length) throw new Error('No record updated. Check permissions.');
      await load(); setMessage('Saved. Server-side price and availability checks remain enforced.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  if (!allowed) return <Navigate to="/admin" replace />;
  return <DashLayout title="PetTides" navItems={ADMIN_NAV}><div style={{maxWidth:1100,display:'grid',gap:24}}>
    <section className="card" style={{padding:24}}><h2>PetTides · {salesEnabled ? 'Live' : 'Ordering paused'}</h2><p>Owned and operated by PepScriptRX. Platform → PetTides. No external owner, parent, or rep commission assigned. Orders use the existing PepScriptRX checkout. Subscriptions are not enabled.</p><Link to="/pettides" target="_blank">Open PetTides ↗</Link><p>Checklist completion records internal review only; it does not establish legal approval or activate sales.</p><p>Sales launch was authorized by the user on October 27, 2026. This is an authorization record, not a certification.</p><button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);const {error}=await supabase!.from('pettides_store_settings').update({sales_enabled:!salesEnabled}).eq('id',true);setMessage(error?error.message:'Sales availability updated.');await load().catch(e=>setMessage(e.message));setBusy(false);}}>{salesEnabled ? 'Pause new purchases' : 'Enable new purchases'}</button></section>
    <p role="status">{message}</p>
    <h2>Products & launch checklist</h2>
    {products.map((p,i) => <section className="card" style={{padding:24}} key={p.slug}><h3>{p.name}</h3><div style={{display:'grid',gap:12}}>
      {(['name','description','image'] as const).map(field => <label key={field}>{field}<input className="form-input" value={p[field]} onChange={e => setProducts(products.map((x,j) => j===i ? {...x,[field]:e.target.value} : x))} /></label>)}
      <label>Retail price (USD)<input className="form-input" type="number" min="0" step="0.01" value={p.provisional_price} onChange={e => setProducts(products.map((x,j) => j===i ? {...x,provisional_price:Number(e.target.value)} : x))} /></label>
      <label>Product cost (USD; blank = unknown)<input className="form-input" type="number" min="0" step="0.01" value={p.cost ?? ''} onChange={e => setProducts(products.map((x,j) => j===i ? {...x,cost:e.target.value==='' ? null : Number(e.target.value)} : x))} /></label>
      <label><input type="checkbox" checked={p.show_price} onChange={e => setProducts(products.map((x,j) => j===i ? {...x,show_price:e.target.checked} : x))} /> Display price publicly</label>
      <label><input type="checkbox" checked={p.active&&p.purchasable} onChange={e=>setProducts(products.map((x,j)=>j===i?{...x,active:e.target.checked,purchasable:e.target.checked}:x))} /> Accept orders for this product</label><fieldset><legend>Product-specific review records</legend>{checks.map(([key,label]) => <label style={{display:'block',margin:8}} key={key}><input type="checkbox" checked={Boolean(p.launch_checklist[key])} onChange={e => setProducts(products.map((x,j) => j===i ? {...x,launch_checklist:{...x.launch_checklist,[key]:e.target.checked}} : x))} /> {label}</label>)}</fieldset>
      <button className="btn btn-primary" disabled={busy} onClick={() => void save('pettides_concepts',p.slug,{name:p.name,description:p.description,image:p.image,provisional_price:p.provisional_price,cost:p.cost,active:p.active,purchasable:p.purchasable,show_price:p.show_price,launch_checklist:p.launch_checklist})}>Save product</button>
    </div></section>)}
    <h2>Educational library review</h2><p>Draft → In Review → Approved → Published. Editing substantive content resets approval. Approval requires verification of original sources. Only publish after appropriate professional review.</p>
    {articles.map((a,i) => <section className="card" key={a.slug} style={{padding:24,display:'grid',gap:12}}><h3>{a.title}</h3><p>Status: {a.status} · {a.reviewed_at ? `Reviewed ${new Date(a.reviewed_at).toLocaleString()} by ${a.reviewed_by}` : 'Not reviewed'}</p>
      <label>Title<input className="form-input" value={a.title} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,title:e.target.value} : x))} /></label>
      <label>Category<input className="form-input" value={a.category} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,category:e.target.value} : x))} /></label>
      <label>Article text<textarea className="form-input" rows={8} value={a.body} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,body:e.target.value} : x))} /></label>
      <label>Original sources (one HTTPS URL per line)<textarea className="form-input" value={a.sources.join('\n')} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,sources:e.target.value.split('\n').filter(Boolean)} : x))} /></label>
      <label>Review notes<textarea className="form-input" value={a.review_note} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,review_note:e.target.value} : x))} /></label>
      <button className="btn btn-primary" disabled={busy} onClick={() => void save('pettides_articles',a.slug,{title:a.title,category:a.category,body:a.body,sources:a.sources,review_note:a.review_note})}>Save article</button>
      <label><input type="checkbox" checked={a.source_verified} onChange={e => setArticles(articles.map((x,j) => j===i ? {...x,source_verified:e.target.checked} : x))} /> I have verified the sources and their support for each claim</label>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{(['draft','in_review','approved','published'] as const).map(status => <button className="btn btn-secondary" key={status} disabled={busy || status===a.status || (status==='approved' && (a.status!=='in_review' || !a.source_verified || !a.sources.length)) || (status==='published' && a.status!=='approved')} onClick={() => void save('pettides_articles',a.slug,{status,source_verified:a.source_verified})}>{status==='draft' ? 'Unpublish / Draft' : status==='in_review' ? 'Submit for review' : status==='approved' ? 'Record approval' : 'Publish'}</button>)}</div>
    </section>)}
    <section className="card" style={{padding:24}}><h2>Interest list</h2><p>Latest 500 PetTides contacts. No medical records or treatment requests collected.</p>{leads.map(l => <p key={l.id}>{l.first_name || 'Contact'} · {l.email} · {new Date(l.created_at).toLocaleDateString()}</p>)}{!leads.length && <p>No contacts recorded.</p>}</section>
    <section className="card" style={{padding:24}}><h2>Future discount settings & financial reporting</h2><p>PetTides reserves scope PETTIDES in the existing discount system. Discount records remain inactive and cannot enable checkout.</p>{promos.map((p,i) => <div key={p.id} style={{display:'grid',gap:10,marginBottom:20}}><strong>Inactive planning record</strong>{(['promo_title','discount_code','product_id'] as const).map(field => <label key={field}>{field}<input className="form-input" value={p[field] ?? ''} onChange={e=>setPromos(promos.map((x,j)=>j===i ? {...x,[field]:e.target.value || null} as Promo : x))} /></label>)}<label>Fixed discount amount (USD)<input className="form-input" type="number" min="0" step="0.01" value={p.discount_amount} onChange={e=>setPromos(promos.map((x,j)=>j===i ? {...x,discount_amount:Number(e.target.value)} : x))} /></label><button disabled={busy} className="btn btn-secondary" onClick={async()=>{setBusy(true);try {const {error}=await supabase!.from('aactivated_promo_links').update({promo_title:p.promo_title,discount_code:p.discount_code,discount_amount:p.discount_amount,product_id:p.product_id,is_active:false}).eq('id',p.id).eq('store_scope_code','PETTIDES');if(error)throw error;await load();setMessage('Inactive discount settings saved.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Save inactive discount</button></div>)}<button disabled={busy || !supabase} className="btn btn-secondary" onClick={async () => {setBusy(true); const {error}=await supabase!.rpc('pettides_prepare_discount'); setMessage(error ? error.message : 'Inactive future discount record prepared.'); await load().catch(e=>setMessage(e.message)); setBusy(false);}}>Prepare inactive discount record</button><p>Existing fixed-dollar and product scope fields are retained. The current promo-link schema does not support percentage types, dates, or usage limits; those require a separate shared-system enhancement before launch.</p><p>Costs are editable above and unknown by default. Order revenue is available in the existing main admin Orders and Analytics screens; filter by PetTides. Unknown product costs default to the legacy reporting placeholder of zero, so do not treat reported margins as verified profit. Processing fees, shipping, manufacturing, and distribution costs have not been established. Existing commission configuration is preserved; PetTides has no payout recipient.</p></section>
  </div></DashLayout>;
}
