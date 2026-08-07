import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ONBOARDING_STEPS, completionPercent, type OnboardingSnapshot, type OnboardingStep, type StepStatus } from '../../lib/aactivatedOnboarding';

type ProfileRow = OnboardingSnapshot & { id: string; support_url?: string };
type Agreement = { id: string; title: string; version: string; content: string };
type KitPackage = { package_id:string; package_name:string; description:string; promo_price:number; retail_value:number; savings:number };
type KitVariation = { package_id:string; variation_id:string; variation_name:string; promo_price:number; retail_value:number; savings:number };

export default function AactivatedOnboarding() {
  const [profile, setProfile] = useState<ProfileRow | null>();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [active, setActive] = useState<OnboardingStep | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase!.from('aactivated_onboarding_profiles').select('id,state,account_status,agreement_status,w9_status,starter_kit_status,payout_status').maybeSingle();
    if (!data) { setProfile(null); return; }
    setProfile({ id: data.id, state: data.state, account: map(data.account_status), agreement: map(data.agreement_status), w9: map(data.w9_status), starter_kit: map(data.starter_kit_status), payout: map(data.payout_status) });
    const { data: current } = await supabase!.from('aactivated_agreements').select('id,title,version,content').eq('status', 'approved').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(1).maybeSingle();
    setAgreement(current);
  }
  if (profile === undefined) return <DashLayout role="rep"><p>Loading secure onboarding…</p></DashLayout>;
  if (profile === null) return <Navigate to="/rep/dashboard" replace />;
  const progress = completionPercent(profile);
  return <DashLayout role="rep"><div style={{ maxWidth: 960, margin: '0 auto' }}>
    <div className="card" style={{ padding: 28, marginBottom: 20 }}><p className="eyebrow">Representative setup</p><h1>Welcome to AACTIVATEDRX</h1><p>Complete the steps below to finish setting up your representative account.</p>
      <div aria-label={`${progress}% complete`} style={{ height: 12, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'var(--teal)' }} /></div><strong>{progress}% complete</strong>
    </div>
    {message && <div className="alert alert-info">{message}</div>}
    {!agreement && <div className="alert alert-info">The representative agreement is still under company review. You may complete the other onboarding steps now; the agreement must be signed before final activation.</div>}
    <div style={{ display: 'grid', gap: 12 }}>{ONBOARDING_STEPS.map((step, index) => {
      const status = profile[step.id];
      return <div className="card" key={step.id} style={{ padding: 20, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><strong>{index + 1}. {step.label}</strong><div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status.replaceAll('_', ' ')}</div>{step.id === 'agreement' && !agreement && <small>Available after company review and publication. Continue with the other steps.</small>}</div>
        <button className="btn btn-primary" disabled={isDone(status)} onClick={() => setActive(step.id)}>{stepButtonLabel(step.id, status, Boolean(agreement))}</button>
      </div>;
    })}</div>
    <p style={{ marginTop: 24 }}>Need help? <a href="mailto:support@aactivated.com">Contact AACTIVATEDRX support</a>.</p>
    {active === 'agreement' && <AgreementForm agreement={agreement} done={() => { setActive(null); setMessage('Agreement saved.'); void load(); }} />}
    {active === 'w9' && <W9Form done={() => { setActive(null); setMessage('Form W-9 submitted securely for review.'); void load(); }} />}
    {active === 'starter_kit' && <StarterKitForm close={() => setActive(null)} />}
    {active === 'payout' && <PayoutForm done={() => { setActive(null); setMessage('Payout information saved securely.'); void load(); }} />}
    {active === 'account' && <AccountForm done={() => { setActive(null); setMessage('Account setup confirmed securely.'); void load(); }} />}
  </div></DashLayout>;
}

function AgreementForm({ agreement, done }: { agreement: Agreement | null; done: () => void }) {
  if (!agreement) return <Dialog title="Rep Agreement" close={done}><div className="alert alert-info">The agreement is awaiting legal review and publication. This step cannot be signed yet.</div></Dialog>;
  return <Dialog title={agreement.title} close={done}><div style={{ maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #ddd', padding: 16 }}>{agreement.content}</div><SecureForm action="agreement" extra={{ agreement_id: agreement.id }} fields={[['read_consent','I have read the full agreement','checkbox'],['electronic_consent','I consent to electronic records and signatures','checkbox'],['legal_name','Typed legal name','text'],['signature_text','Electronic signature','text']]} done={done} /></Dialog>;
}

function W9Form({ done }: { done: () => void }) { return <Dialog title="Electronic Form W-9" close={done}><p>Complete the current Form W-9 structure. Review the <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noreferrer">official form and instructions</a>.</p><SecureForm action="w9" fields={[
  ['tax_name','Name as shown on your tax return','text'],['business_name','Business/disregarded entity name (if different)','text'],['federal_tax_classification','Federal tax classification','text'],['llc_classification','LLC classification, if applicable','text'],['exempt_payee_code','Exempt payee code, if applicable','text'],['fatca_exemption_code','FATCA exemption code, if applicable','text'],['address','Address','text'],['city','City','text'],['state','State','text'],['zip','ZIP code','text'],['account_numbers','Account number(s), optional','text'],['tin','Social Security number or EIN','password']
]} beforeSubmit={<><p><strong>Certification — penalties of perjury</strong></p><p>Under penalties of perjury, I certify that the information provided is correct and complete, and that I am a U.S. person unless otherwise indicated on the applicable official Form W-9.</p><label><input name="certification_accepted" type="checkbox" required /> I certify and intend to electronically sign this Form W-9.</label><label className="form-group"><span className="form-label">Electronic signature</span><input className="form-input" name="signature_text" required /></label></>} done={done} /></Dialog>; }

function PayoutForm({ done }: { done: () => void }) { return <Dialog title="Payout Information" close={done}><p>AACTIVATEDRX currently supports approved PayPal email destinations. Details are encrypted and masked in ordinary views.</p><SecureForm action="payout" extra={{ method: 'paypal' }} fields={[['destination','PayPal email address','email'],['confirmation','Confirm PayPal email address','email']]} done={done} /></Dialog>; }

function AccountForm({ done }: { done: () => void }) { return <Dialog title="Account Setup" close={done}><p>Your secure password and account recovery settings are managed through your authenticated account. No password is sent by email.</p><SecureForm action="account" fields={[]} done={done} submitLabel="Confirm account setup" /></Dialog>; }

function StarterKitForm({close}:{close:()=>void}) {
  const [packages,setPackages]=useState<KitPackage[]>([]),[variations,setVariations]=useState<KitVariation[]>([]),[selected,setSelected]=useState(''),[variation,setVariation]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  useEffect(()=>{void Promise.all([supabase!.from('aactivated_starter_kit_packages').select('package_id,package_name,description,promo_price,retail_value,savings').eq('enabled',true).order('sort_order'),supabase!.from('aactivated_starter_kit_variations').select('package_id,variation_id,variation_name,promo_price,retail_value,savings').order('sort_order')]).then(([p,v])=>{if(p.error||v.error)setError(p.error?.message||v.error?.message||'Unable to load kits');else{setPackages((p.data??[]) as KitPackage[]);setVariations((v.data??[]) as KitVariation[]);}setLoading(false);});},[]);
  const chosen=packages.find(row=>row.package_id===selected),choices=variations.filter(row=>row.package_id===selected);
  async function checkout(){if(!selected||(choices.length>0&&!variation)){setError('Choose a package and required variation.');return;}setSaving(true);setError('');const {data,error:fnError}=await supabase!.functions.invoke('create-aactivated-starter-kit-order',{body:{package_id:selected,variation_id:variation||null,shipping_speed:'standard'}});setSaving(false);if(fnError||!data?.payment_path){setError(String(data?.error||'Unable to start secure starter-kit checkout.'));return;}window.location.assign(String(data.payment_path));}
  return <Dialog title="Select and Purchase Starter Kit" close={close}>{loading?<p>Loading eligible packages…</p>:<div style={{display:'grid',gap:14}}><p>Choose one starter-kit package. This step completes only after payment is confirmed.</p>{packages.map(row=><label key={row.package_id} className="card" style={{padding:14,border:selected===row.package_id?'2px solid var(--teal)':'1px solid #ddd'}}><input type="radio" name="kit" value={row.package_id} checked={selected===row.package_id} onChange={()=>{setSelected(row.package_id);setVariation('');}}/> <strong>{row.package_name}</strong> — {money(row.promo_price)} <small>(value {money(row.retail_value)}, save {money(row.savings)})</small><div>{row.description}</div></label>)}{choices.length>0&&<label className="form-group"><span className="form-label">Package option</span><select className="form-select" value={variation} onChange={event=>setVariation(event.target.value)} required><option value="">Choose an option</option>{choices.map(row=><option key={row.variation_id} value={row.variation_id}>{row.variation_name} — {money(row.promo_price)}</option>)}</select></label>}{chosen&&<div className="alert alert-info">Secure checkout amount: {money((choices.find(row=>row.variation_id===variation)?.promo_price)??chosen.promo_price)}</div>}{error&&<div className="alert alert-error">{error}</div>}<button className="btn btn-primary" disabled={saving||!selected} onClick={()=>void checkout()}>{saving?'Preparing checkout…':'Continue to secure payment'}</button></div>}</Dialog>;
}

function SecureForm({ action, fields, extra = {}, beforeSubmit, done, submitLabel = 'Submit and sign' }: { action: string; fields: string[][]; extra?: Record<string, unknown>; beforeSubmit?: ReactNode; done: () => void; submitLabel?: string }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const data = Object.fromEntries(new FormData(event.currentTarget)); fields.filter((f) => f[2] === 'checkbox').forEach((f) => data[f[0]] = new FormData(event.currentTarget).has(f[0]) ? 'true' : ''); const { error: fnError } = await supabase!.functions.invoke('submit-aactivated-onboarding', { body: { action, ...extra, ...data, read_consent: data.read_consent === 'true', electronic_consent: data.electronic_consent === 'true', certification_accepted: new FormData(event.currentTarget).has('certification_accepted') } }); setSaving(false); if (fnError) setError('Unable to save this step securely. Check the required information and try again.'); else done(); }
  return <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 18 }}>{fields.map(([name,label,type]) => type === 'checkbox' ? <label key={name}><input name={name} type="checkbox" required /> {label}</label> : <label className="form-group" key={name}><span className="form-label">{label}</span><input className="form-input" name={name} type={type} required={!/optional|if applicable/i.test(label)} autoComplete="off" /></label>)}{beforeSubmit}{error && <div className="alert alert-error">{error}</div>}<button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting securely…' : submitLabel}</button></form>;
}

function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.65)', padding: 20, overflow: 'auto' }}><div className="card" style={{ maxWidth: 760, margin: '30px auto', padding: 24 }}><button className="btn btn-secondary" style={{ float: 'right' }} onClick={close}>Close</button><h2>{title}</h2>{children}</div></div>; }
function map(value: string): StepStatus { return value === 'complete' || value === 'accepted' || value === 'submitted' || value === 'under_review' || value === 'correction_required' ? value : value === 'verified' ? 'complete' : 'not_started'; }
function isDone(status: StepStatus) { return status === 'complete' || status === 'accepted' || status === 'submitted' || status === 'under_review'; }
function stepButtonLabel(step: OnboardingStep, status: StepStatus, agreementAvailable: boolean) { if (status === 'submitted' || status === 'under_review') return 'Under Review'; if (status === 'complete' || status === 'accepted') return 'Completed'; if (step === 'agreement' && !agreementAvailable) return 'Review Status'; return 'Continue'; }
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
