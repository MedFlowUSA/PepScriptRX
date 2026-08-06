import { useState, type FormEvent, type ReactNode } from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import { supabase } from '../../lib/supabase';

const initial = { first_name: '', last_name: '', email: '', phone: '', city: '', state: '', social_profile: '', referral_rep: '', discovery_source: '', motivation: '', consent: false };

export default function AactivatedRepApplication() {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (name: keyof typeof initial, value: string | boolean) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.city || !form.state || !form.discovery_source || !form.motivation || !form.consent) {
      setError('Please complete every required field and accept the application terms and privacy notice.'); return;
    }
    if (!supabase) { setError('Applications are temporarily unavailable. Please contact AACTIVATEDRX support.'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const { error: saveError } = await supabase.from('rep_store_intake_submissions').insert({
      status: 'new', approval_status: 'pending', full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), city: form.city.trim(), state: form.state.trim(),
      social_profile: form.social_profile.trim() || null, referral_rep: form.referral_rep.trim() || null, parent_rep_or_admin_name: form.referral_rep.trim() || 'AACTIVATEDRX',
      discovery_source: form.discovery_source.trim(), motivation: form.motivation.trim(), application_terms_accepted_at: now, privacy_accepted_at: now,
      paypal_account: null, selected_products: [], custom_products: [], store_type: 'Rep under another admin / parent account', store_brand_name: `${form.first_name.trim()} ${form.last_name.trim()} — AACTIVATEDRX Rep Application`,
      source_portal_id: 'aactivated', source_portal: 'AACTIVATEDRX', source_route: window.location.pathname, source_url: window.location.href,
      parent_store_slug: 'aactivated', parent_store_name: 'AACTIVATEDRX', partner_admin_email: 'guy@aactivated.com', approval_owner_email: 'guy@aactivated.com', review_queue: 'aactivated', review_admin_code: 'GUY60', review_admin_name: 'AACTIVATEDRX Administration',
      internal_notes: 'AACTIVATEDRX secure rep application. Payout, tax, agreement, and starter-kit data intentionally deferred to approved onboarding.',
    });
    setSaving(false);
    if (saveError) { setError('We could not submit your application. Please try again or contact support.'); return; }
    setSubmitted(true);
  }

  return <PublicLayout isolatedPortal portalKey="aactivated" portalHomePath="/aactivated" portalName="AACTIVATEDRX">
    <section className="section"><div className="container-sm">
      <div className="card" style={{ padding: 28 }}>
        <p className="eyebrow">AACTIVATEDRX Representative Program</p>
        <h1>{submitted ? 'Application received' : 'Apply to Become an AACTIVATEDRX Representative'}</h1>
        {submitted ? <p>Thank you. Our team will review your application and contact you through the secure next steps. Submitting an application does not activate an account or commissions.</p> :
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
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" required checked={form.consent} onChange={(e) => set('consent', e.target.checked)} /><span>I agree to the application terms and acknowledge the <a href="/privacy">privacy notice</a>.</span></label>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit application'}</button>
        </form>}
      </div>
    </div></section>
  </PublicLayout>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="form-group"><span className="form-label">{label}</span>{children}</label>; }
