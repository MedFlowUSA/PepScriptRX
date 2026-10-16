import { useCallback, useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ADMIN_NAV } from './adminNav';

type LedgerRow = { transaction_id:string; created_at:string; customer_email:string; order_number:string|null; usd_amount:number; token_amount:number; transaction_type:string; funding_source:string; processor_payment_id:string|null; status:string; remaining_balance:number };

export default function AdminTokenLedger() {
  const [rows,setRows]=useState<LedgerRow[]>([]);
  const [enabled,setEnabled]=useState(false);
  const [rate,setRate]=useState('1');
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const load=useCallback(async()=>{
    if(!supabase){setLoading(false);return;}
    const [ledger,settings]=await Promise.all([
      supabase.from('admin_token_ledger').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('token_settings').select('stripe_funding_enabled,tokens_per_usd').eq('id',true).single(),
    ]);
    setRows((ledger.data as LedgerRow[])??[]);
    setEnabled(Boolean(settings.data?.stripe_funding_enabled));
    setRate(String(settings.data?.tokens_per_usd??1));
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function save(){
    if(!supabase)return;
    const parsed=Number(rate);
    if(!Number.isFinite(parsed)||parsed<=0){setMessage('Conversion rate must be greater than zero.');return;}
    const {error}=await supabase.from('token_settings').update({stripe_funding_enabled:enabled,tokens_per_usd:parsed,updated_at:new Date().toISOString()}).eq('id',true);
    setMessage(error?error.message:'Token settings saved and audited.');
  }
  return <DashLayout title="Payments · Token Ledger" navItems={ADMIN_NAV}>
    <div className="card mb-6"><div className="card-body" style={{display:'grid',gap:16}}>
      <div className="card-title">Stripe credit funding</div>
      <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable Stripe-funded PepScriptRX Credits</label>
      <label style={{display:'grid',gap:6,maxWidth:280}}>Credits per $1 USD<input className="form-input" type="number" min="0.0001" step="0.0001" value={rate} onChange={e=>setRate(e.target.value)}/></label>
      <button className="btn btn-primary" style={{width:'fit-content'}} onClick={save}>Save settings</button>
      {message&&<div className="alert alert-info">{message}</div>}
    </div></div>
    <div className="card"><div className="card-header"><div className="card-title">Immutable token transactions</div></div>
      {loading?<div style={{padding:48,textAlign:'center'}}><div className="spinner"/></div>:<div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Customer</th><th>Order</th><th>USD</th><th>Credits</th><th>Type</th><th>Processor</th><th>Payment ID</th><th>Balance</th><th>Status</th></tr></thead><tbody>
        {!rows.length?<tr><td colSpan={10} style={{padding:40,textAlign:'center'}}>No token transactions yet.</td></tr>:rows.map(row=><tr key={row.transaction_id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.customer_email}</td><td>{row.order_number??'-'}</td><td>${Number(row.usd_amount).toFixed(2)}</td><td>{Number(row.token_amount).toFixed(2)}</td><td>{row.transaction_type}</td><td>{row.funding_source}</td><td style={{fontFamily:'monospace'}}>{row.processor_payment_id??'-'}</td><td>{Number(row.remaining_balance).toFixed(2)}</td><td>{row.status}</td></tr>)}
      </tbody></table></div>}
    </div>
  </DashLayout>;
}
