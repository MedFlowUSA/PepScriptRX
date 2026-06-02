import { useState } from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { PRICING_DISCLAIMER } from '../../data/products';
import tirzepatide30Card from '../../assets/product-cards/tirzepatide-30.png';
import tirzepatide60Card from '../../assets/product-cards/tirzepatide-60.png';
import semaglutide10Card from '../../assets/product-cards/semaglutide-10.png';
import retatrutideCard from '../../assets/product-cards/retatrutide.png';
import bacWaterKitCard from '../../assets/product-cards/bac-water-kit.png';

const faqs = [
  {
    q: 'Do I need a new prescription?',
    a: 'No. PepScriptRX is for patients who already have a valid prescription from a licensed provider within the last 5 months. You attest to that during intake - no new prescription required.',
  },
  {
    q: 'Do I need to upload anything?',
    a: 'No upload is required for immediate checkout. You can optionally upload your most recent prior supplier receipt for a 20% discount review, which pauses payment until the receipt is verified.',
  },
  {
    q: 'How does the 20% receipt discount work?',
    a: 'When you upload your current pharmacy or provider receipt, our team verifies it before sending the discounted payment link. Skip the upload if you want the normal immediate checkout path.',
  },
  {
    q: 'Is approval guaranteed?',
    a: 'No. Eligibility, pricing, fulfillment, and savings depend on review, partner availability, state rules, and applicable law. We are transparent about this from the start.',
  },
  {
    q: 'How long does review take?',
    a: 'Listed checkout products can be paid for right after intake. Receipt-discount uploads are the exception and are verified before payment.',
  },
  {
    q: 'How do I pay?',
    a: 'After you submit a priced order, secure checkout opens immediately. We accept PayPal, credit card, debit card, and cryptocurrency (BTC, ETH, USDT, XRP).',
  },
];

const COMPARE = [
  { name: 'Tirzepatide 30mg', retail: '$450 - $650/mo', ours: '$199', savings: 'Up to 65%' },
  { name: 'Tirzepatide 60mg', retail: '$700 - $950/mo', ours: '$249', savings: 'Up to 73%' },
  { name: 'Semaglutide 10mg', retail: '$350 - $500/mo', ours: '$99', savings: 'Up to 80%' },
  { name: 'Retatrutide', retail: '$550 - $800/mo', ours: '$279', savings: 'Up to 65%' },
  { name: 'BPC-157 10mg', retail: '$140 - $220', ours: '$99', savings: 'Up to 55%' },
  { name: 'TB-500 10mg', retail: '$190 - $280', ours: '$149', savings: 'Up to 47%' },
  { name: 'CJC-1295 / Ipamorelin 10mg', retail: '$220 - $320', ours: '$169', savings: 'Up to 47%' },
  { name: 'NAD+', retail: '$190 - $280', ours: '$149', savings: 'Up to 47%' },
  { name: 'GHK-Cu 100mg', retail: '$170 - $240', ours: '$129', savings: 'Up to 46%' },
];

const TESTIMONIALS = [
  {
    quote: 'I was paying over $600 a month at my med spa. PepScriptRX quoted me a fraction of that - same medication, same experience. The review took less than a day.',
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
  { icon: 'US', label: 'Nationwide shipping', sub: 'Available where eligible' },
  { icon: 'RX', label: 'Refill support', sub: 'For existing prescriptions' },
  { icon: 'SEC', label: 'Secure checkout', sub: 'Private intake and payment' },
  { icon: 'MD', label: 'Provider oversight', sub: 'Where applicable' },
];

const PRODUCT_CARDS = [
  { title: 'Tirzepatide 30mg Vial', src: tirzepatide30Card },
  { title: 'Tirzepatide 60mg Vial', src: tirzepatide60Card },
  { title: 'Semaglutide 10mg Vial', src: semaglutide10Card },
  { title: 'Retatrutide Vial', src: retatrutideCard },
  { title: 'BAC Water + Syringe Kit', src: bacWaterKitCard },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PublicLayout>
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-tag">Simple refill requests for eligible customers</div>
            <h1 className="hero-title">
              Refill support,<br />
              <span>made simple.</span>
            </h1>
            <p className="hero-subtitle">
              Browse available products, submit your information, and our team follows up with next steps. Clear pricing, secure checkout, and fulfillment support in one clean flow.
            </p>
            <div className="hero-actions">
              <a href="/start" className="btn btn-primary btn-lg">Start Refill Request</a>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 36 }}>
              {TRUST.map((t) => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal-light)', minWidth: 26 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)', lineHeight: 1.2 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, maxWidth: 760 }}>
              <ProductPurityGuaranteeBadge compact />
            </div>

            <figure className="hero-brand-visual">
              <img
                src="/marketing/pepscript-promo-3.png"
                alt="PepScriptRX performance and wellness campaign"
                loading="eager"
              />
            </figure>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 0 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              How it works
            </p>
            <h2 className="section-title">Browse. Select. Submit. Pay. Ship.</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              A direct path from product selection to checkout and fulfillment.
            </p>
          </div>
          <div className="steps-grid premium-journey-grid">
            {[
              { n: 1, title: 'Browse', desc: 'Review available refill, supply, and accessory options.' },
              { n: 2, title: 'Select', desc: 'Choose the item you want to order.' },
              { n: 3, title: 'Submit info', desc: 'Share the details needed for follow-up. No clutter.' },
              { n: 4, title: 'Pay', desc: 'Complete secure checkout immediately unless you uploaded a receipt for discount review.' },
              { n: 5, title: 'Ship', desc: 'Fulfillment proceeds through verified partners where available.' },
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

      <section className="section precisionmix-showcase-section">
        <div className="container">
          <div className="precisionmix-showcase">
            <div className="precisionmix-showcase-copy">
              <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                Precision tool
              </p>
              <h2>PrecisionMix Calculator</h2>
              <p>
                A clean calculator for informational math support. It is separate from refill requests and does not provide medical or dosing advice.
              </p>
              <div className="precisionmix-showcase-actions">
                <a href="/peptide-calculator" className="btn btn-primary btn-lg">Open Calculator</a>
                <span>Mathematical estimates only. No dosing advice.</span>
              </div>
            </div>
            <a href="/peptide-calculator" className="precisionmix-preview-card" aria-label="Open PrecisionMix Calculator">
              <div className="precisionmix-preview-top">
                <span>Units to Draw</span>
                <strong>10</strong>
                <small>U-100 syringe units</small>
              </div>
              <div className="precisionmix-preview-syringe">
                <i />
                {Array.from({ length: 6 }).map((_, index) => <b key={index} style={{ left: `${index * 20}%` }} />)}
              </div>
              <div className="precisionmix-preview-grid">
                <div><span>Concentration</span><strong>5 mg/mL</strong></div>
                <div><span>Per unit</span><strong>50 mcg</strong></div>
              </div>
            </a>
          </div>
        </div>
      </section>

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
            <a href="/start" className="btn btn-primary btn-lg">Shop Available Products</a>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-md">
          <div className="text-center" style={{ marginBottom: 32 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Available now
            </p>
            <h2 className="section-title">Available products</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Select a product to begin a refill, supply, or accessory request.
            </p>
          </div>
          <div className="product-image-grid">
            {PRODUCT_CARDS.map((product) => (
              <a key={product.title} href="/start" className="product-image-card" aria-label={`Check savings for ${product.title}`}>
                <img src={product.src} alt={`${product.title} refill savings card`} loading="lazy" />
              </a>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <a href="/start" className="btn btn-primary btn-lg">Shop Available Products</a>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>
              Medication requests require an existing prescription. Supply and accessory requests are reviewed separately.
            </p>
          </div>
        </div>
      </section>

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
                <div className="testimonial-stars">*****</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-byline">
                  <strong>{t.name}</strong> - {t.location}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
            Names abbreviated and locations generalized to protect patient privacy. Individual results vary - savings are not guaranteed.
          </p>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-md">
          <h2 className="section-title text-center">Frequently asked questions</h2>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="faq-item">
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <span style={{ fontSize: 20, fontWeight: 300, flexShrink: 0 }}>{openFaq === i ? '-' : '+'}</span>
                </button>
                {openFaq === i && <div className="faq-answer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-navy">
        <div className="container text-center">
          <h2 className="section-title" style={{ color: '#fff', marginBottom: 12 }}>Ready to check your savings?</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', margin: '0 auto 28px', maxWidth: 520 }}>
            Choose a product, submit your details, and our team will follow up with next steps.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/start" className="btn btn-primary btn-lg">Start Refill Request</a>
            <a href="/certificates" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>View Quality Documents</a>
          </div>
        </div>
      </section>

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
