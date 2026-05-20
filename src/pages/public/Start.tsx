import { useState, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { createPepScriptSubmission, isSupabaseConfigured } from '../../lib/supabase';
import { US_STATES, SHIPPING_OPTIONS } from '../../types';
import { INTAKE_PRODUCTS, PRODUCT_IMAGES } from '../../data/products';
import type { Product } from '../../data/products';
import { DEFAULT_REFERRAL_DISCOUNT_AMOUNT, REFERRAL_STORAGE_KEY, type StoredReferral } from '../../config/referrals';

export default function Start() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const storedReferral = getStoredReferral();
  const repSlug = searchParams.get('rep') || storedReferral?.repSlug || '';
  const discountCode = searchParams.get('discount') || storedReferral?.discountCode || '';
  const discountAmount = storedReferral?.discountAmount ?? (discountCode ? DEFAULT_REFERRAL_DISCOUNT_AMOUNT : 0);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleProductSelect(product: Product) {
    setSelectedProduct(product);
    setStep(2);
  }

  function handleFile(setter: (f: File | null) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => setter(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const fd = new FormData(formRef.current!);
    fd.set('medication', selectedProduct?.name ?? '');
    if (receiptFile) fd.set('receipt', receiptFile);

    setLoading(true);
    try {
      await createPepScriptSubmission(fd, repSlug);
      const email = String(fd.get('email') ?? '').trim();
      navigate(`/submitted${email ? `?email=${encodeURIComponent(email)}` : ''}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again or contact us.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div style={{ background: 'var(--ink)', padding: '48px 24px 36px' }}>
        <div className="container-sm">
          <Link to="/" style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16, display: 'inline-block' }}>← Back to Home</Link>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 10 }}>
            Check Your Savings
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>
            Already prescribed? Confirm your prescription and get a refill savings quote. Upload your receipt to unlock an additional 20% off your refill.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {repSlug && <span className="badge badge-teal">Referred by: {repSlug}</span>}
            {discountCode && <span className="badge badge-success">{discountCode} applied: ${discountAmount} off first eligible order</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: '48px 24px 64px' }}>
        <div className="container-sm">

          {/* Step 1: Choose product */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                Step 1: Select your medication or product
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
                Choose the medication or item you currently have a prescription for.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {INTAKE_PRODUCTS.map((product) => {
                  const imgSrc = PRODUCT_IMAGES[product.id];
                  const isPhysician = product.status === 'physician_review';
                  const isManualReview = product.status === 'manual_review';
                  return imgSrc ? (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      style={{
                        border: '3px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: 'transparent',
                        padding: 0,
                        transition: 'border-color .15s, transform .1s, box-shadow .15s',
                        display: 'block',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = 'var(--teal)';
                        el.style.transform = 'translateY(-2px)';
                        el.style.boxShadow = '0 8px 24px rgba(37,199,217,.25)';
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = 'transparent';
                        el.style.transform = 'translateY(0)';
                        el.style.boxShadow = 'none';
                      }}
                    >
                      <img
                        src={imgSrc}
                        alt={product.name}
                        style={{ width: '100%', display: 'block', borderRadius: 'calc(var(--radius-md) - 3px)' }}
                      />
                    </button>
                  ) : (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: '24px 20px',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--card)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'border-color .15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--teal)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 17 }}>{product.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{product.category}</div>
                      {product.display_note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.display_note}</div>}
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', marginTop: 4 }}>${product.price}</div>
                      {isPhysician && <span className="badge badge-purple">Physician review</span>}
                      {isManualReview && <span className="badge badge-warning">Subject to review</span>}
                      {product.status === 'active' && <span className="badge badge-success">Accepting submissions</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Full intake form */}
          {step === 2 && selectedProduct && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)} style={{ padding: '6px 10px' }}>←</button>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selected product</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>{selectedProduct.name}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>${selectedProduct.price}</div>
                  {selectedProduct.status === 'active' && <span className="badge badge-success">Accepting submissions</span>}
                  {selectedProduct.status === 'physician_review' && <span className="badge badge-purple">Physician review</span>}
                  {selectedProduct.status === 'manual_review' && <span className="badge badge-warning">Subject to review</span>}
                </div>
              </div>

              {!isSupabaseConfigured && (
                <div className="alert alert-info mb-6">
                  <strong>Demo mode:</strong> Supabase is not configured. Form submission is disabled until you add your environment variables.
                </div>
              )}

              {error && <div className="alert alert-error mb-6">{error}</div>}

              <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <input type="hidden" name="discount_code" value={discountCode} />

                {/* Personal info */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Personal Information</div>
                  </div>
                  <div className="card-body">
                    <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label form-required">Full name</label>
                        <input name="full_name" type="text" className="form-input" required placeholder="Jane Smith" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Date of birth</label>
                        <input name="date_of_birth" type="date" className="form-input" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Email address</label>
                        <input name="email" type="email" className="form-input" required placeholder="jane@example.com" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Phone number</label>
                        <input name="phone" type="tel" className="form-input" required placeholder="(555) 555-5555" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">State</label>
                        <select name="state" className="form-select" required>
                          <option value="">Select state…</option>
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medication info */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Current Medication Details</div>
                    <div className="card-subtitle">Tell us about your current prescription</div>
                  </div>
                  <div className="card-body">
                    <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label form-required">Current dose</label>
                        <input name="current_dose" type="text" className="form-input" required placeholder="e.g. 2.5 mg, 5 mg, 10 mg" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Current monthly price paid</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>$</span>
                          <input name="current_price" type="number" className="form-input" required placeholder="399.00" step="0.01" min="0" style={{ paddingLeft: 28 }} />
                        </div>
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="form-label form-required">Current pharmacy / source / provider</label>
                        <input name="current_pharmacy" type="text" className="form-input" required placeholder="e.g. compounding pharmacy name, telehealth provider, med spa" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Shipping Address</div>
                    <div className="card-subtitle">Where should your order be delivered?</div>
                  </div>
                  <div className="card-body">
                    <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="form-label form-required">Street address</label>
                        <input name="shipping_address" type="text" className="form-input" required placeholder="123 Main St, Apt 4B" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">City</label>
                        <input name="shipping_city" type="text" className="form-input" required placeholder="Los Angeles" />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">State</label>
                        <select name="shipping_state" className="form-select" required>
                          <option value="">Select state…</option>
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">ZIP code</label>
                        <input name="shipping_zip" type="text" className="form-input" required placeholder="90001" maxLength={10} />
                      </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <label className="form-label form-required">Shipping speed</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        {SHIPPING_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                          >
                            <input type="radio" name="shipping_speed" value={opt.value} defaultChecked={opt.value === 'standard'} required style={{ accentColor: 'var(--teal)', width: 18, height: 18, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>{opt.label}</div>
                              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{opt.days}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: opt.cost === 0 ? 'var(--success)' : 'var(--navy)', fontSize: 15 }}>
                              {opt.cost === 0 ? 'Included' : `+$${opt.cost}`}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document uploads */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Upload Receipt <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>(Optional)</span></div>
                    <div className="card-subtitle">Upload your most recent receipt to unlock an additional <strong style={{ color: 'var(--success)' }}>20% off your refill</strong>. No receipt? You can still submit.</div>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* 20% discount callout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--teal-pale)', border: '1px solid var(--teal-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                      <div style={{ fontSize: 24 }}>💸</div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14 }}>Receipt = 20% Off Your Refill</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload a receipt showing your current price and we'll apply a 20% discount to your refill quote.</div>
                      </div>
                    </div>

                    {/* Receipt */}
                    <div className="form-group">
                      <label className="form-label">Recent receipt <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                      <label className="file-upload">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" onChange={handleFile(setReceiptFile)} />
                        <div className="file-upload-icon">🧾</div>
                        <div className="file-upload-label">Upload your most recent receipt</div>
                        <div className="file-upload-hint">Shows your current medication, dose, and price paid. PDF, JPG, PNG, HEIC — max 10 MB</div>
                        {receiptFile && <div className="file-selected">✓ {receiptFile.name}</div>}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Consent */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Consent &amp; Acknowledgment</div>
                  </div>
                  <div className="card-body">
                    <div className="checkbox-group">
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent1" required />
                        <label htmlFor="consent1">
                          I confirm that I have received a valid prescription for <strong>{selectedProduct.name}</strong> from a licensed provider within the last 5 months, and I am submitting this information for a refill-savings review only.
                        </label>
                      </div>
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent2" required />
                        <label htmlFor="consent2">
                          I understand that PepScriptRX is not a pharmacy, medical provider, or emergency medical service, and does not provide medical advice, prescribing, dosing, injection, or reconstitution instructions.
                        </label>
                      </div>
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent3" required />
                        <label htmlFor="consent3">
                          I understand that eligibility, pricing, savings, and fulfillment are not guaranteed. Approval depends on my attestation, receipt review, licensed partner review, state availability, and applicable law.
                        </label>
                      </div>
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent4" required />
                        <label htmlFor="consent4">
                          I understand that any medication use must follow written instructions from a licensed provider or dispensing pharmacy. I will not mix, inject, or use any product without professional written instructions.
                        </label>
                      </div>
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent5" required />
                        <label htmlFor="consent5">
                          I consent to PepScriptRX contacting me via phone and email regarding my submission, review status, and available options. I agree to the{' '}
                          <Link to="/terms" target="_blank" style={{ color: 'var(--teal)', fontWeight: 600 }}>Terms of Service</Link>
                          {' '}and{' '}
                          <Link to="/privacy" target="_blank" style={{ color: 'var(--teal)', fontWeight: 600 }}>Privacy Policy</Link>.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-full"
                    disabled={loading || !isSupabaseConfigured}
                    style={{ justifyContent: 'center' }}
                  >
                    {loading ? 'Submitting your refill review…' : 'Submit My Refill Review →'}
                  </button>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                    Submitted securely. You will be contacted within 1–2 business days with your refill quote.
                  </p>
                </div>
              </form>

              <div className="disclaimer mt-6">
                <strong>Important:</strong> PepScriptRX is not a pharmacy, medical provider, or emergency medical service. Eligibility, pricing, savings, and fulfillment are not guaranteed and depend on your attestation, receipt review, licensed partner review, state availability, and applicable law. PepScriptRX does not provide medical advice, prescribing, dosing, injection, or reconstitution instructions. Any medication use must follow written instructions from a licensed provider or dispensing pharmacy.
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function getStoredReferral(): StoredReferral | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY)
    ?? window.sessionStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredReferral;
    return parsed.repSlug ? parsed : null;
  } catch {
    return null;
  }
}
