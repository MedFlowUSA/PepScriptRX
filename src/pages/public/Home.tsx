import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { DEFAULT_PRODUCTS, PRICING_DISCLAIMER, PRODUCT_IMAGES } from '../../data/products';

const faqs = [
  {
    q: 'Do I need a new prescription?',
    a: 'No. PepScriptRX is for patients who already have a valid prescription from a licensed provider within the last 5 months. You attest to that during intake — no new prescription required.',
  },
  {
    q: 'Do I need to upload anything?',
    a: 'No upload is required to submit. You can optionally upload your most recent receipt to unlock an additional 20% off your refill quote. The process is completely optional — just confirm your prescription and submit.',
  },
  {
    q: 'How does the 20% receipt discount work?',
    a: 'When you upload your current pharmacy or provider receipt with your submission, our team applies a 20% discount to your refill quote. This is our way of rewarding patients who help us verify current market pricing.',
  },
  {
    q: 'Is approval guaranteed?',
    a: 'No. Eligibility, pricing, fulfillment, and savings depend on review, partner availability, state rules, and applicable law. We are transparent about this from the start.',
  },
  {
    q: 'How long does review take?',
    a: 'Most reviews are completed within 1–2 business days. If eligible, you receive a quote and payment link by phone or email.',
  },
  {
    q: 'How do I pay?',
    a: 'Once approved, you receive a secure payment link. We accept PayPal, credit card, debit card, and cryptocurrency (BTC, ETH, USDT, XRP).',
  },
];

const COMPARE = [
  { name: 'Tirzepatide 30mg', retail: '$450 – $650/mo', ours: '$199', savings: 'Up to 65%' },
  { name: 'Tirzepatide 60mg', retail: '$700 – $950/mo', ours: '$249', savings: 'Up to 73%' },
  { name: 'Semaglutide 10mg', retail: '$350 – $500/mo', ours: '$99',  savings: 'Up to 80%' },
  { name: 'Retatrutide',      retail: '$550 – $800/mo', ours: '$279', savings: 'Up to 65%' },
];

const TESTIMONIALS = [
  {
    quote: 'I was paying over $600 a month at my med spa. PepScriptRX quoted me a fraction of that — same medication, same experience. The review took less than a day.',
    name: 'M.T.',
    location: 'California',
  },
  {
    quote: 'The process was easier than I expected. Fill out the form, upload your receipt, and they come back with a real quote. No runaround, no hidden fees.',
    name: 'J.R.',
    location: 'Texas',
  },
  {
    quote: 'My provider pointed me here when I mentioned what I was spending each month. The savings review was straightforward and the team was responsive throughout.',
    name: 'L.P.',
    location: 'Florida',
  },
];

const TRUST = [
  { icon: '🔒', label: 'HIPAA-Conscious', sub: 'Secure encrypted intake' },
  { icon: '⚕️', label: 'Physician Reviewed', sub: 'Licensed partner oversight' },
  { icon: '✅', label: 'Verified Fulfillment', sub: 'Third-party quality partners' },
  { icon: '💊', label: 'Prescription Required', sub: 'Valid Rx within 5 months' },
];

const FEATURED_CAMPAIGN = {
  src: '/marketing/pepscript-promo-5.png',
  alt: 'PepScriptRX Tirzepatide 30mg — premium refill savings',
};

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const activeProducts = DEFAULT_PRODUCTS.filter((p) => p.status === 'active');
  const reviewProducts = DEFAULT_PRODUCTS.filter((p) => p.status !== 'active');

  return (
    <PublicLayout>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-tag">Refill savings · Existing prescriptions only</div>
            <h1 className="hero-title">
              Already prescribed?<br />
              <span>Refill for less.</span>
            </h1>
            <p className="hero-subtitle">
              Confirm your prescription, upload your receipt, and our team reviews available refill pricing through verified partners. Most patients save significantly over current retail and telehealth pricing.
            </p>
            <div className="hero-actions">
              <Link to="/start" className="btn btn-primary btn-lg">Check My Savings →</Link>
              <Link to="/login" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>
                Returning patient
              </Link>
            </div>

            {/* Trust indicators inline in hero */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 36 }}>
              {TRUST.map((t) => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)', lineHeight: 1.2 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="campaign-feature">
            <div className="campaign-feature-copy">
              <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                Campaign preview
              </p>
              <h2 className="section-title">Premium visuals, simple refill flow.</h2>
              <p className="section-subtitle">
                PepScriptRX uses polished campaign assets for social traffic, while the order path stays clean: confirm your active prescription, upload a receipt if you want the discount, and wait for review.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
                <Link to="/start" className="btn btn-primary">Refill Now</Link>
                <Link to="/certificates" className="btn btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.32)' }}>View Quality Docs</Link>
              </div>
            </div>
            <figure className="campaign-feature-art">
              <img src={FEATURED_CAMPAIGN.src} alt={FEATURED_CAMPAIGN.alt} loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 0 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Simple process
            </p>
            <h2 className="section-title">Four steps to your savings quote</h2>
          </div>
          <div className="steps-grid">
            {[
              { n: 1, title: 'Choose your medication', desc: 'Select the compound you already have a valid prescription for.' },
              { n: 2, title: 'Fill out your intake', desc: 'Provide your current dose, price, and pharmacy. Takes about 2 minutes.' },
              { n: 3, title: 'Upload receipt for 20% off', desc: 'Optional — but uploading your current receipt unlocks an additional 20% discount on your refill quote.' },
              { n: 4, title: 'Receive your quote', desc: 'Eligible orders receive a payment link within 1–2 business days. Pay via PayPal, card, or crypto.' },
            ].map((s) => (
              <div key={s.n} className="step-card">
                <div className="step-number">{s.n}</div>
                <div className="step-title">{s.title}</div>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing comparison table ──────────────────────────────── */}
      <section className="section">
        <div className="container-md">
          <div className="text-center" style={{ marginBottom: 36 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Pricing transparency
            </p>
            <h2 className="section-title">What others charge vs. what we quote</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Typical cash-pay pricing at compounding pharmacies, med spas, and telehealth providers vs. PepScriptRX refill quotes for eligible patients.
            </p>
          </div>

          <div className="pricing-compare-table">
            <div className="pricing-compare-head">
              <div>Medication</div>
              <div>Typical retail / telehealth</div>
              <div>PepScriptRX quote</div>
              <div>Est. savings</div>
            </div>
            {COMPARE.map((row) => (
              <div key={row.name} className="pricing-compare-row">
                <div className="pricing-compare-name">{row.name}</div>
                <div className="pricing-compare-retail">{row.retail}</div>
                <div className="pricing-compare-ours">{row.ours}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>/mo</span></div>
                <div className="pricing-compare-savings">{row.savings}</div>
              </div>
            ))}
          </div>

          <div className="disclaimer" style={{ maxWidth: 700, margin: '20px auto 0' }}>
            <strong>Pricing note:</strong> {PRICING_DISCLAIMER} Retail pricing shown is a general range observed across compounding pharmacies and telehealth providers and is not a guarantee that any specific individual paid those prices.
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link to="/start" className="btn btn-primary btn-lg">See What I Qualify For →</Link>
          </div>
        </div>
      </section>

      {/* ─── Product listing ───────────────────────────────────────── */}
      <section className="section section-alt">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 32 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Available now
            </p>
            <h2 className="section-title">Current refill options</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Select the medication you have a prescription for to begin your savings check.
            </p>
          </div>

          {/* Products with marketing images */}
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', marginBottom: 24 }}>
            {activeProducts.map((product) => {
              const imgSrc = PRODUCT_IMAGES[product.id];
              return imgSrc ? (
                <Link
                  key={product.id}
                  to="/start"
                  style={{ display: 'block', textDecoration: 'none', borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'transform .15s, box-shadow .15s' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.transform = 'translateY(-3px)';
                    el.style.boxShadow = '0 12px 32px rgba(37,199,217,.22)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  <img src={imgSrc} alt={product.name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                </Link>
              ) : (
                <div key={product.id} className="card" style={{ padding: '24px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 6 }}>{product.category}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy)', marginBottom: 12, lineHeight: 1.3 }}>{product.name}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>${product.price}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>+ 20% off with receipt upload</div>
                  <Link to="/start" className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 18 }}>Check My Savings</Link>
                </div>
              );
            })}
          </div>

          {reviewProducts.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>Availability review items</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {reviewProducts.map((product) => (
                  <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{product.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{product.display_note}</div>
                    </div>
                    <Link to="/start" className="btn btn-outline btn-sm">Request Review</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────── */}
      <section className="section">
        <div className="container-md">
          <div className="text-center" style={{ marginBottom: 40 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Patient experiences
            </p>
            <h2 className="section-title">What our patients say</h2>
          </div>
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="testimonial-card">
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-byline">
                  <strong>{t.name}</strong> · {t.location}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
            Names abbreviated and locations generalized to protect patient privacy. Individual results vary — savings are not guaranteed.
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────── */}
      <section className="section section-alt">
        <div className="container-md">
          <h2 className="section-title text-center">Frequently asked questions</h2>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="faq-item">
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <span style={{ fontSize: 20, fontWeight: 300, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <div className="faq-answer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="section section-navy">
        <div className="container text-center">
          <h2 className="section-title" style={{ color: '#fff', marginBottom: 12 }}>Ready to check your savings?</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', margin: '0 auto 28px', maxWidth: 520 }}>
            No prescription upload required. Confirm your Rx, share your current dose, and let us do the rest.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/start" className="btn btn-primary btn-lg">Start Savings Check</Link>
            <Link to="/certificates" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>View Quality Documents</Link>
          </div>
        </div>
      </section>

      {/* ─── Disclaimer ───────────────────────────────────────────── */}
      <section style={{ padding: '32px 0', background: 'var(--surface)' }}>
        <div className="container">
          <div className="disclaimer">
            <strong>Important Notice:</strong> PepScriptRX is not a pharmacy, medical provider, or emergency medical service. PepScriptRX does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Eligibility depends on customer attestation, receipt review, partner review, state availability, and applicable law. Savings, approval, and fulfillment are not guaranteed.
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
