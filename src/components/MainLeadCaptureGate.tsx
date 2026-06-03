import { useMemo, useState, type FormEvent } from 'react';
import { recordAbandonedLead } from '../lib/supabase';
import { storeCheckoutScope } from '../lib/checkoutScope';
import {
  buildStorefrontStartHref,
  getEhwSubScopeCode,
  getLeadCaptureDiscountCode,
  type LeadCaptureSource,
} from '../lib/mainLeadCapture';

type LeadCaptureProduct = {
  id: string;
  label: string;
};

type MainLeadCaptureGateProps = {
  source: LeadCaptureSource;
  products: LeadCaptureProduct[];
};

const DISCOUNT_PERCENT = 0.10;

export default function MainLeadCaptureGate({ source, products }: MainLeadCaptureGateProps) {
  const storageKey = `pepscriptrx_lead_capture:${source}`;
  const discountCode = getLeadCaptureDiscountCode(source);
  const [visible, setVisible] = useState(() => shouldShowGate(storageKey));
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [productInterest, setProductInterest] = useState(products[0]?.id ?? '');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productInterest) ?? products[0],
    [productInterest, products],
  );
  const ehwSubScopeCode = getEhwSubScopeCode();

  if (!visible) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!ageConfirmed) {
      setMessage('Please confirm you are 21 or older to continue.');
      return;
    }

    if (!email.trim()) {
      setMessage('Enter an email so we can reserve the code.');
      return;
    }

    if (source === 'EHWSub') {
      storeCheckoutScope({ code: ehwSubScopeCode, source: 'url' });
    }

    setSaving(true);
    try {
      await recordAbandonedLead({
        status: 'captured',
        age_confirmed: true,
        first_name: firstName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        source_scope: source,
        source_portal: source === 'EHWSub' ? 'EHWSUB' : 'MAIN',
        source_route: source === 'EHWSub' ? '/ehwsub' : '/',
        source_path: typeof window !== 'undefined' ? window.location.pathname : null,
        rep_code: source === 'EHWSub' ? ehwSubScopeCode : null,
        checkout_scope_code: source === 'EHWSub' ? ehwSubScopeCode : null,
        discount_code: discountCode,
        discount_percent: DISCOUNT_PERCENT,
        product_interest: selectedProduct?.label ?? null,
        product_interest_id: selectedProduct?.id ?? null,
        metadata: {
          public_brand: 'PepScriptRX',
          capture_offer: '10% off first order',
          capture_surface: 'storefront_lead_gate',
        },
        domain: typeof window !== 'undefined' ? window.location.hostname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      window.localStorage.setItem(storageKey, JSON.stringify({
        capturedAt: new Date().toISOString(),
        discountCode,
        productInterest: selectedProduct?.label ?? null,
      }));
      setMessage(`Saved. Use code ${discountCode} at checkout for 10% off.`);
      window.setTimeout(() => setVisible(false), 1200);
    } catch (error) {
      console.error('Lead capture failed', error);
      setMessage(`Your code is ${discountCode}. Continue to checkout and enter it there.`);
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(storageKey, JSON.stringify({
      dismissedAt: new Date().toISOString(),
      discountCode,
    }));
    setVisible(false);
  }

  return (
    <div className="lead-capture-panel" role="dialog" aria-modal="false" aria-label="First order discount">
      <button type="button" className="lead-capture-close" onClick={handleDismiss} aria-label="Close discount offer">
        x
      </button>
      <div className="lead-capture-kicker">First order offer</div>
      <h2>Get 10% off today.</h2>
      <p>Confirm age and save your code before checkout. We will keep the offer attached even if you come back later.</p>
      <form onSubmit={handleSubmit} className="lead-capture-form">
        <div className="lead-capture-grid">
          <label className="form-group">
            <span className="form-label">First name</span>
            <input className="form-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
          </label>
          <label className="form-group">
            <span className="form-label form-required">Email</span>
            <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
        </div>
        <label className="form-group">
          <span className="form-label">Phone</span>
          <input className="form-input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
        </label>
        <label className="form-group">
          <span className="form-label">Product interest</span>
          <select className="form-select" value={productInterest} onChange={(event) => setProductInterest(event.target.value)}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.label}</option>
            ))}
          </select>
        </label>
        <label className="lead-capture-check">
          <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
          <span>I confirm I am 21 or older.</span>
        </label>
        <div className="lead-capture-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : `Unlock ${discountCode}`}
          </button>
          <a className="btn btn-outline" href={buildStorefrontStartHref(source)}>Checkout</a>
        </div>
        {message && <div className="lead-capture-message">{message}</div>}
      </form>
    </div>
  );
}

function shouldShowGate(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return true;

  try {
    const parsed = JSON.parse(stored) as { capturedAt?: string; dismissedAt?: string };
    const marker = parsed.capturedAt ?? parsed.dismissedAt;
    if (!marker) return true;
    const ageMs = Date.now() - new Date(marker).getTime();
    return ageMs > 1000 * 60 * 60 * 24 * 7;
  } catch {
    return true;
  }
}
