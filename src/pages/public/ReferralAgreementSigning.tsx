import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { downloadAgreement, electronicConsent, type ReferralAgreement } from '../../lib/referralAgreements';

export default function ReferralAgreementSigning() {
  const { id } = useParams();
  // Fragment avoids sending the invitation secret in HTTP paths or referrers.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [agreement, setAgreement] = useState<ReferralAgreement | null>(null);
  const [signature, setSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { if (!supabase) throw new Error('Service unavailable.'); await work(); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function load() {
    const { data, error } = await supabase!.rpc('referral_signer', { p_id: id, p_token: token });
    if (error) throw new Error(error.message);
    setAgreement(data as ReferralAgreement);
    if (data.status === 'partner_signed' || data.status === 'signed') window.history.replaceState(null, '', window.location.pathname);
  }
  return <main style={{ maxWidth: 860, width: 'calc(100% - 32px)', boxSizing: 'border-box', margin: '32px auto', padding: 24, background: '#f8fafc', color: '#12263a', borderRadius: 16 }}>
    <h1>Private referral agreement</h1>
    <p>Verify the email address named in your invitation to access the agreement. The link alone does not grant access.</p>
    {message && <div className="alert alert-info" role="status">{message}</div>}
    {!agreement ? <section className="card card-body" style={{ display: 'grid', gap: 16 }}>
      <label>Email address<input className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy || !email.trim()} onClick={() => void run(async () => {
        const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
        if (error) throw new Error(error.message);
        setSent(true); setMessage('Check your email for a verification code.');
      })}>Send verification code</button>
      {sent && <><label>Verification code<input className="form-input" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy || !code} onClick={() => void run(async () => {
          const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
          if (error) throw new Error(error.message);
          await load();
        })}>Verify and open agreement</button></>}
      <button className="btn btn-secondary" disabled={busy} onClick={() => void run(load)}>Open with verified session</button>
      <p>You may decline electronic signing and contact the Company for a paper agreement. Verification uses the existing PepScriptRX authentication service.</p>
    </section> : <section className="card card-body" style={{ display: 'grid', gap: 16 }}>
      <p>Version {agreement.version} · {agreement.status.replaceAll('_', ' ')}</p>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7 }}>{agreement.terms}</pre>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void run(() => downloadAgreement(agreement))}>Download {agreement.status === 'signed' ? 'signed agreement' : 'current agreement'} PDF</button>
      {agreement.status === 'issued' ? <>
        <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {electronicConsent}</label>
        <label>Full legal name<input className="form-input" autoComplete="name" value={signature} onChange={e => setSignature(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy || !consent || !signature.trim()} onClick={() => void run(async () => {
          const { data, error } = await supabase!.rpc('referral_signer', { p_id: id, p_token: token, p_signature: signature, p_consent: consent, p_terms_hash: agreement.terms_hash });
          if (error) throw new Error(error.message);
          setAgreement(data as ReferralAgreement); window.history.replaceState(null, '', window.location.pathname);
          setMessage('Signature recorded. Company countersignature is pending.');
        })}>Sign this agreement</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => { setAgreement(null); setSent(false); setCode(''); setConsent(false); }}>Verify email again if your code session expired</button>
      </> : <><p>Your signature: {agreement.partner_signature} · {agreement.partner_signed_at}</p><p>Company signature: {agreement.company_signature ?? 'Pending'} · {agreement.company_signed_at ?? ''}</p>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run(load)}>Refresh signing status</button></>}
    </section>}
  </main>;
}
