import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { useAuth } from '../../context/AuthContext';

type KitPackage = { package_id:string; package_tier:string; package_name:string; promo_label:string|null; retail_value:number; promo_price:number; savings:number; purchase_limit:number; commission_enabled:boolean; enabled:boolean; sort_order:number };
type KitVariation = { package_id:string; variation_id:string; variation_name:string; retail_value:number; promo_price:number; savings:number; sort_order:number };
type KitComponent = { id:string; package_id:string; variation_id:string|null; inventory_sku:string; display_name:string; quantity:number; sort_order:number };
type KitOrder = { id:string; package_id:string; package_name:string; variation_name:string|null; rep_name:string|null; rep_email:string|null; promo_price:number; payment_status:string; fulfillment_status:string; created_at:string };

export default function AdminAactivatedStarterKits(){
  const { profile }=useAuth();
  const [packages,setPackages]=useState<KitPackage[]>([]),[variations,setVariations]=useState<KitVariation[]>([]),[components,setComponents]=useState<KitComponent[]>([]),[orders,setOrders]=useState<KitOrder[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState('');
  const navItems=profile?.role==='rx_plus_admin'||profile?.role==='partner_admin_full'?RX_PLUS_ADMIN_NAV:ADMIN_NAV;
  useEffect(()=>{void load();},[]);
  async function load(){if(!supabase){setLoading(false);return;}setLoading(true);setError('');const [p,v,c,o]=await Promise.all([
    supabase.from('aactivated_starter_kit_packages').select('*').order('sort_order'),
    supabase.from('aactivated_starter_kit_variations').select('*').order('sort_order'),
    supabase.from('aactivated_starter_kit_components').select('*').order('sort_order'),
    supabase.from('aactivated_starter_kit_orders').select('id,package_id,package_name,variation_name,rep_name,rep_email,promo_price,payment_status,fulfillment_status,created_at').order('created_at',{ascending:false}).limit(100),
  ]);const failure=p.error||v.error||c.error||o.error;if(failure)setError(failure.message);setPackages((p.data??[]) as KitPackage[]);setVariations((v.data??[]) as KitVariation[]);setComponents((c.data??[]) as KitComponent[]);setOrders((o.data??[]) as KitOrder[]);setLoading(false);}
  async function toggle(row:KitPackage){if(!supabase)return;setSaving(row.package_id);setMessage('');const {error:saveError}=await supabase.from('aactivated_starter_kit_packages').update({enabled:!row.enabled}).eq('package_id',row.package_id);setSaving('');if(saveError){setError(saveError.message);return;}setMessage(`${row.package_name} is now ${row.enabled?'hidden':'available'}.`);await load();}
  const paid=orders.filter((row)=>row.payment_status==='paid');
  const revenue=useMemo(()=>paid.reduce((sum,row)=>sum+Number(row.promo_price||0),0),[paid]);
  return <DashLayout title="AACTIVATEDRX Starter Kits" navItems={navItems}><div style={{display:'grid',gap:18}}>
    <div className="card"><div className="card-header"><div><div className="card-title">Starter Kit Administration</div><div className="card-subtitle">Manage package availability and monitor purchases. Package contents remain tied to validated inventory SKUs.</div></div><button className="btn btn-outline btn-sm" onClick={()=>void load()}>Refresh</button></div></div>
    {error&&<div className="alert alert-error">{error}</div>}{message&&<div className="alert alert-success">{message}</div>}
    {loading?<div style={{padding:48,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>:<>
      <div className="stats-grid"><Stat label="Packages" value={String(packages.length)}/><Stat label="Available" value={String(packages.filter(row=>row.enabled).length)}/><Stat label="Orders" value={String(orders.length)}/><Stat label="Paid revenue" value={money(revenue)}/></div>
      <div className="card"><div className="card-header"><div><div className="card-title">Packages</div><div className="card-subtitle">Disable a package to remove it from rep availability without deleting its configuration.</div></div></div><div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Package</th><th>Tier</th><th>Price</th><th>Value / savings</th><th>Contents</th><th>Limit</th><th>Status</th><th>Action</th></tr></thead><tbody>{packages.map(row=>{const vars=variations.filter(v=>v.package_id===row.package_id);const parts=components.filter(c=>c.package_id===row.package_id);return <tr key={row.package_id}><td><strong>{row.package_name}</strong><br/><small>{row.promo_label||row.package_id}</small></td><td>{label(row.package_tier)}</td><td>{money(row.promo_price)}{vars.length>0&&<><br/><small>{vars.map(v=>`${v.variation_name}: ${money(v.promo_price)}`).join(' · ')}</small></>}</td><td>{money(row.retail_value)} / {money(row.savings)}</td><td>{parts.length}<br/><small>{parts.slice(0,3).map(p=>`${p.quantity}× ${p.display_name}`).join(', ')}{parts.length>3?'…':''}</small></td><td>{row.purchase_limit}</td><td><span className={`badge ${row.enabled?'badge-success':'badge-warning'}`}>{row.enabled?'Available':'Hidden'}</span></td><td><button className="btn btn-secondary btn-sm" disabled={saving===row.package_id} onClick={()=>void toggle(row)}>{saving===row.package_id?'Saving…':row.enabled?'Hide':'Enable'}</button></td></tr>})}</tbody></table></div></div>
      <div className="card"><div className="card-header"><div><div className="card-title">Recent Starter Kit Orders</div><div className="card-subtitle">Payment and fulfillment status for the latest 100 AACTIVATED starter-kit purchases.</div></div></div><div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Date</th><th>Rep</th><th>Package</th><th>Amount</th><th>Payment</th><th>Fulfillment</th></tr></thead><tbody>{orders.length===0?<tr><td colSpan={6}>No starter-kit orders yet.</td></tr>:orders.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString()}</td><td>{row.rep_name||'Unassigned'}<br/><small>{row.rep_email||''}</small></td><td>{row.package_name}{row.variation_name&&<><br/><small>{row.variation_name}</small></>}</td><td>{money(row.promo_price)}</td><td>{label(row.payment_status)}</td><td>{label(row.fulfillment_status)}</td></tr>)}</tbody></table></div></div>
    </>}
  </div></DashLayout>;
}
function Stat({label:caption,value}:{label:string;value:string}){return <div className="stat-card"><div className="stat-label">{caption}</div><div className="stat-value">{value}</div></div>}
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const label=(value:string)=>value.replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
