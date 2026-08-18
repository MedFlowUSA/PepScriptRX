import { useState, type FormEvent, type ReactNode } from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';

const initial = { first_name: '', last_name: '', email: '', phone: '', city: '', state: '', social_profile: '', referral_rep: '', discovery_source: '', motivation: '', password: '', confirm_password: '', consent: false };

export default function AactivatedRepApplication() {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirmationEmailDelayed, setConfirmationEmailDelayed] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (name: keyof typeof initial, value: string | boolean) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.city || !form.state || !form.discovery_source || !form.motivation || !form.password || !form.consent) {
      setError('Please complete every required field and accept the application terms and privacy notice.'); return;
    }
    if (!strongPassword(form.password)) { setError('Choose a password with at least 10 characters including uppercase, lowercase, a number, and a symbol.'); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    if (!supabase) { setError('Applications are temporarily unavailable. Please contact AACTIVATEDRX support.'); return; }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-aactivated-application`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey!,
          Authorization: `Bearer ${sessionData.session?.access_token ?? supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, confirm_password: undefined }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string; confirmation_email_delayed?: boolean } | null;
      if (!response.ok || payload?.ok === false) {
        setError(payload?.error || `Application service returned HTTP ${response.status}. Please contact support.`);
        return;
      }
      setConfirmationEmailDelayed(Boolean(payload?.confirmation_email_delayed));
      setSubmitted(true);
    } catch {
      setError('The application service could not be reached. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return <PublicLayout isolatedPortal portalKey="aactivated" portalHomePath="/aactivated" portalName="AACTIVATEDRX">
    <section className="section"><div className="container-sm">
      <div className="card" style={{ padding: 28 }}>
        <p className="eyebrow">AACTIVATEDRX Representative Program</p>
        <h1>{submitted ? 'Application received' : 'Apply to Become an AACTIVATEDRX Representative'}</h1>
        {submitted ? <>
          <p>{confirmationEmailDelayed
            ? 'Thank you. Your application was received. Confirmation email delivery is temporarily delayed; if you are approved, a secure account invitation will be sent during activation.'
            : 'Thank you. Check your email to confirm your secure applicant account and view your application status.'}</p>
          <p>Submitting an application does not activate representative tools, referrals, or commissions.</p>
        </> :
        <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
          <p>Tell us how to reach you and why you’re interested. Tax, payout, agreement, and starter-kit details are collected only after approval.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-grid-2">
            <Field label="First name"><input className="form-input" required autoComplete="given-name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></Field>
            <Field label="Last name"><input className="form-input" required autoComplete="family-name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></Field>
            <Field label="Email"><input className="form-input" required type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Mobile phone"><input className="form-input" required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="City"><input className="form-input" required autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="State"><input className="form-input" required autoComplete="address-level1" value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
            <Field label="Social-media profile or handle (optional)"><input className="form-input" value={form.social_profile} onChange={(e) => set('social_profile', e.target.value)} /></Field>
            <Field label="Referring or sponsoring representative (optional)"><input className="form-input" value={form.referral_rep} onChange={(e) => set('referral_rep', e.target.value)} /></Field>
          </div>
          <Field label="How did you hear about AACTIVATEDRX?"><input className="form-input" required value={form.discovery_source} onChange={(e) => set('discovery_source', e.target.value)} /></Field>
          <Field label="Why do you want to become a representative?"><textarea className="form-textarea" required rows={5} value={form.motivation} onChange={(e) => set('motivation', e.target.value)} /></Field>
          <div className="form-grid-2">
            <Field label="Create password"><input className="form-input" required type="password" minLength={10} autoComplete="new-password" aria-describedby="aactivated-password-help" value={form.password} onChange={(e) => set('password', e.target.value)} /><small id="aactivated-password-help">At least 10 characters with uppercase, lowercase, a number, and a symbol.</small></Field>
            <Field label="Confirm password"><input className="form-input" required type="password" minLength={10} autoComplete="new-password" value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} /></Field>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" required checked={form.consent} onChange={(e) => set('consent', e.target.checked)} /><span>I agree to the application terms and acknowledge the <a href="/privacy">privacy notice</a>.</span></label>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit application'}</button>
        </form>}
      </div>
    </div></section>
  </PublicLayout>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="form-group"><span className="form-label">{label}</span>{children}</label>; }
function strongPassword(password: string) { return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password); }
