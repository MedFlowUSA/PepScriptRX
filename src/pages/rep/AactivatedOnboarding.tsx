import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ONBOARDING_STEPS, completionPercent, type OnboardingSnapshot, type OnboardingStep, type StepStatus } from '../../lib/aactivatedOnboarding';

type ProfileRow = OnboardingSnapshot & { id: string; support_url?: string };
type Agreement = { id: string; title: string; version: string; content: string };

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
    <div style={{ display: 'grid', gap: 12 }}>{ONBOARDING_STEPS.map((step, index) => {
      const status = profile[step.id]; const locked = index > 0 && !isDone(profile[ONBOARDING_STEPS[index - 1].id]);
      return <div className="card" key={step.id} style={{ padding: 20, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><strong>{index + 1}. {step.label}</strong><div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status.replaceAll('_', ' ')}</div>{locked && <small>Complete the previous step to continue.</small>}</div>
        <button className="btn btn-primary" disabled={locked || isDone(status)} onClick={() => setActive(step.id)}>{isDone(status) ? 'Completed' : locked ? 'Locked' : 'Continue'}</button>
      </div>;
    })}</div>
    <p style={{ marginTop: 24 }}>Need help? <a href="mailto:support@aactivated.com">Contact AACTIVATEDRX support</a>.</p>
    {active === 'agreement' && <AgreementForm agreement={agreement} done={() => { setActive(null); setMessage('Agreement saved.'); void load(); }} />}
    {active === 'w9' && <W9Form done={() => { setActive(null); setMessage('Form W-9 submitted securely for review.'); void load(); }} />}
    {active === 'starter_kit' && <Dialog title="Select and Purchase Starter Kit" close={() => setActive(null)}><p>Your eligible corrected AACTIVATEDRX starter-kit packages appear here. Choose exactly one RETA or Tirzepatide path. Payment—not selection—completes this step.</p><div className="alert alert-info">Starter-kit checkout is disabled in this development branch until staging package definitions and payment callbacks are validated.</div></Dialog>}
    {active === 'payout' && <PayoutForm done={() => { setActive(null); setMessage('Payout information saved securely.'); void load(); }} />}
    {active === 'account' && <Dialog title="Account Setup" close={() => setActive(null)}><p>Your secure password and account recovery settings are managed through your authenticated account. No password is sent by email.</p></Dialog>}
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

function SecureForm({ action, fields, extra = {}, beforeSubmit, done }: { action: string; fields: string[][]; extra?: Record<string, unknown>; beforeSubmit?: ReactNode; done: () => void }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const data = Object.fromEntries(new FormData(event.currentTarget)); fields.filter((f) => f[2] === 'checkbox').forEach((f) => data[f[0]] = new FormData(event.currentTarget).has(f[0]) ? 'true' : ''); const { error: fnError } = await supabase!.functions.invoke('submit-aactivated-onboarding', { body: { action, ...extra, ...data, read_consent: data.read_consent === 'true', electronic_consent: data.electronic_consent === 'true', certification_accepted: new FormData(event.currentTarget).has('certification_accepted') } }); setSaving(false); if (fnError) setError('Unable to save this step securely. Check the required information and try again.'); else done(); }
  return <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 18 }}>{fields.map(([name,label,type]) => type === 'checkbox' ? <label key={name}><input name={name} type="checkbox" required /> {label}</label> : <label className="form-group" key={name}><span className="form-label">{label}</span><input className="form-input" name={name} type={type} required={!/optional|if applicable/i.test(label)} autoComplete="off" /></label>)}{beforeSubmit}{error && <div className="alert alert-error">{error}</div>}<button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting securely…' : 'Submit and sign'}</button></form>;
}

function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.65)', padding: 20, overflow: 'auto' }}><div className="card" style={{ maxWidth: 760, margin: '30px auto', padding: 24 }}><button className="btn btn-secondary" style={{ float: 'right' }} onClick={close}>Close</button><h2>{title}</h2>{children}</div></div>; }
function map(value: string): StepStatus { return value === 'complete' || value === 'accepted' || value === 'submitted' || value === 'under_review' || value === 'correction_required' ? value : value === 'verified' ? 'complete' : 'not_started'; }
function isDone(status: StepStatus) { return status === 'complete' || status === 'accepted'; }
