import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PetTidesLayout from '../../components/layout/PetTidesLayout';
import { createPepScriptSubmission, supabase } from '../../lib/supabase';
import { US_STATES } from '../../types';

type Quote = { items: { id: string; name: string; quantity: number; price: number }[]; subtotal: number };
const stateCodes = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const money = (n: number) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n);
export default function PetTidesCheckout() {
 const navigate=useNavigate();const [quote,setQuote]=useState<Quote|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [shipping,setShipping]=useState('standard');
 const shippingCost=shipping==='expedited'?25:shipping==='overnight'?50:0;
 useEffect(()=>{let alive=true;void(async()=>{try{
  const cart=JSON.parse(sessionStorage.getItem('pettides_cart')??'null');
  if(!cart?.items?.length)throw new Error('Your bag is empty.');
  if(!supabase)throw new Error('Checkout is temporarily unavailable.');
  const {data,error}=await supabase.rpc('pettides_quote',{p_items:cart.items});if(error)throw new Error(error.message);
  if(alive)setQuote(data as Quote);
 }catch(e){if(alive)setError((e as Error).message);}})();return()=>{alive=false};},[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!quote||busy)return;setBusy(true);setError('');try{
  const fd=new FormData(e.currentTarget);fd.set('shipping_speed',shipping);fd.set('state',String(fd.get('shipping_state')??''));
  fd.set('order_items',JSON.stringify(quote.items));fd.set('quoted_price',String(quote.subtotal));fd.set('order_total',String(quote.subtotal+shippingCost));fd.set('order_ready','true');fd.set('submission_type','availability_review');
  fd.set('medication',quote.items.map(x=>x.name).join(', '));fd.set('product_name','PetTides order');fd.set('product_category','PetTides');fd.set('product_type','manual_review');
  for(const [key,value] of Object.entries({store_slug:'pettides',store_name:'PetTides',brand_id:'pettides',source_store:'pettides',source_portal:'PetTides',source_route:'/pettides/checkout',checkout_scope_code:'MAIN',account_type:'platform',parent_type:'platform_owned',partner_payout_eligible:'false'}))fd.set(key,value);
  const order=await createPepScriptSubmission(fd,'');if(!order.publicPaymentToken)throw new Error('The payment link was not returned. Contact support before retrying.');
  sessionStorage.removeItem('pettides_cart');navigate(`/pay/${order.publicPaymentToken}?brand=pettides`);
 }catch(e){setError((e as Error).message);setBusy(false);}}
 return <PetTidesLayout><section className="pt-section"><Link to="/pettides#concepts">← Back to PetTides</Link><div className="pt-eyebrow">YOUR PETTIDES ORDER</div><h1>Checkout</h1>{error&&<p role="alert">{error}</p>}{!quote&&!error&&<p role="status">Checking current prices and availability…</p>}{quote&&<div className="pt-checkout"><form onSubmit={submit}><h3>Contact & shipping</h3>{[['full_name','Full name','name'],['email','Email address','email'],['phone','Phone number','tel'],['shipping_address','Street address','street-address'],['shipping_city','City','address-level2'],['shipping_zip','ZIP code','postal-code']].map(([name,label,autoComplete])=><label key={name}>{label}<input required name={name} type={name==='email'?'email':name==='phone'?'tel':'text'} autoComplete={autoComplete} maxLength={name==='email'?254:150} /></label>)}<label>State<select name="shipping_state" autoComplete="address-level1" required><option value="">Select a state</option>{US_STATES.map((s,i)=><option key={s} value={stateCodes[i]}>{s}</option>)}</select></label><label>Shipping<select value={shipping} onChange={e=>setShipping(e.target.value)}><option value="standard">Standard — Included</option><option value="expedited">Expedited — $25</option><option value="overnight">Overnight — $50</option></select></label><p>Shipping options use the existing platform rates. Fulfillment timing will be confirmed for your order.</p><label className="pt-consent"><input type="checkbox" required /> I agree to the <Link to="/terms">terms</Link> and <Link to="/privacy">privacy policy</Link>. This order does not include veterinary advice or treatment instructions.</label><button className="pt-button" disabled={busy}>{busy?'Preparing secure payment…':'Continue to secure payment ↗'}</button></form><aside className="pt-order-summary"><h3>Your order</h3>{quote.items.map(i=><p key={i.id}>{i.name} × {i.quantity}<strong>{money(i.price*i.quantity)}</strong></p>)}<p>Subtotal<strong>{money(Number(quote.subtotal))}</strong></p><p>Shipping<strong>{money(shippingCost)}</strong></p><p>Total<strong>{money(Number(quote.subtotal)+shippingCost)}</strong></p><small>Prices are checked on the server. Payment is handled by the existing PepScriptRX checkout.</small></aside></div>}</section></PetTidesLayout>;
}
