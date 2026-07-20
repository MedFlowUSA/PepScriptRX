import { useState } from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import MainLeadCaptureGate from '../../components/MainLeadCaptureGate';
import AiAssistedBadge from '../../components/ai/AiAssistedBadge';
import PepRxBotBadge from '../../components/ai/PepRxBotBadge';
import {
  buildStorefrontStartHref,
  type LeadCaptureSource,
} from '../../lib/mainLeadCapture';
import { PEPRXBOT_FAQ_CATEGORIES } from '../../lib/peprxbotFaq';
import { PRICING_DISCLAIMER } from '../../data/products';
import { getProductMetadata } from '../../lib/productMetadata';
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
  { name: 'Retatrutide 15mg', retail: '$550 - $800/mo', ours: '$279', savings: 'Up to 65%' },
  { name: 'BPC-157 10mg', retail: '$140 - $220', ours: '$99', savings: 'Up to 55%' },
  { name: 'TB-500 10mg', retail: '$190 - $280', ours: '$149', savings: 'Up to 47%' },
  { name: 'CJC-1295 / Ipamorelin 10mg', retail: '$220 - $320', ours: '$169', savings: 'Up to 47%' },
  { name: 'NAD+', retail: '$190 - $280', ours: '$149', savings: 'Up to 47%' },
  { name: 'GHK-Cu 100mg', retail: '$170 - $240', ours: '$129', savings: 'Up to 46%' },
];

const TRUST = [
  { icon: 'US', label: 'Nationwide shipping', sub: 'Available where eligible' },
  { icon: 'RX', label: 'Refill support', sub: 'For existing prescriptions' },
  { icon: 'SEC', label: 'Secure checkout', sub: 'Private intake and payment' },
  { icon: 'MD', label: 'Provider oversight', sub: 'Where applicable' },
];

const PRODUCT_CARDS = [
  { id: 'tirzepatide-30', title: 'Tirzepatide 30mg Vial', src: tirzepatide30Card, price: '$199', tag: 'Best seller', benefit: 'Popular refill option for eligible customers.' },
  { id: 'tirzepatide-60', title: 'Tirzepatide 60mg Vial', src: tirzepatide60Card, price: '$249', tag: 'Best value', benefit: 'Higher-size refill option with clear checkout pricing.' },
  { id: 'semaglutide-10', title: 'Semaglutide 10mg Vial', src: semaglutide10Card, price: '$99', tag: 'Starter pick', benefit: 'Lower entry price for eligible refill requests.' },
  { id: 'retatrutide', title: 'Retatrutide 15mg Vial', src: retatrutideCard, price: '$279', tag: 'Featured', benefit: 'Specialty refill request with secure intake.' },
  { id: 'igf1', title: 'IGF-1 / Insulin Growth Factor One', src: '/products/igf1.png', price: '$199', tag: 'Physician review', benefit: 'Growth and performance request with extra verification.' },
  { id: 'bpc-157-10mg', title: 'BPC-157 10mg Vial', src: '/products/bpc-157.png', price: '$99', tag: 'Recovery', benefit: 'Recovery and repair support with checkout availability.' },
  { id: 'tb-500-10mg', title: 'TB-500 10mg Vial', src: '/products/tb-500.png', price: '$149', tag: 'Recovery', benefit: 'Recovery-support option with secure intake and checkout.' },
  { id: 'wolverine-stack', title: 'Wolverine Stack / BB20 - BPC-157 + TB-500', src: '/products/wolverine-stack.png', price: '$149', tag: 'Stack', benefit: 'BPC-157 and TB-500 blend eligible for checkout review.' },
  { id: 'cjc-ipamorelin-10mg', title: 'CJC-1295 / Ipamorelin 10mg Vial', src: '/products/cjc-ipamorelin.png', price: '$169', tag: 'Performance', benefit: 'Growth and performance blend with standard verification.' },
  { id: 'nad-plus', title: 'NAD+ Vial', src: '/products/nad-plus.png', price: '$149', tag: 'Longevity', benefit: 'Longevity and wellness support with checkout availability.' },
  { id: 'ghk-cu-100mg', title: 'GHK-Cu 100mg Vial', src: '/products/ghk-cu.png', price: '$129', tag: 'Repair', benefit: 'Repair and skin-support peptide with standard verification.' },
  { id: 'bac-water', title: 'BAC Water + Syringe Kit', src: bacWaterKitCard, price: '$12', tag: 'Accessory', benefit: 'Supply kit reviewed separately from medication requests.' },
];

const PRODUCT_CARDS_WITH_METADATA = PRODUCT_CARDS.map((product) => ({
  ...product,
  metadata: getProductMetadata({ id: product.id, name: product.title }),
}));

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
  const leadSource: LeadCaptureSource = pathname.includes('ehwsub') ? 'EHWSub' : 'MAIN';
  const startHref = buildStorefrontStartHref(leadSource);
  const leadProducts = PRODUCT_CARDS_WITH_METADATA.map((product) => ({ id: product.id, label: `${product.metadata.commonName} ${product.metadata.doseLabel}` }));

  return (
    <PublicLayout>
      <MainLeadCaptureGate source={leadSource} products={leadProducts} />
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-tag">21+ checkout for eligible existing-prescription customers</div>
            <h1 className="hero-title">
              PepScriptRX refill support,<br />
              <span>ready to checkout.</span>
            </h1>
            <p className="hero-subtitle">
              Browse refill and supply options, confirm eligibility, and move into secure checkout with clear pricing and product-specific quality-document status.
            </p>
            <div className="hero-actions">
              <a href={startHref} className="btn btn-primary btn-lg">Shop Available Products</a>
              <a href="/certificates" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>View Lab Documents</a>
            </div>

            <div className="hero-featured-products" aria-label="Featured products">
              {PRODUCT_CARDS_WITH_METADATA.slice(0, 3).map((product) => (
                <a
                  key={product.id}
                  href={buildStorefrontStartHref(leadSource, { product: product.id })}
                  className="hero-featured-product"
                >
                  <span>{product.tag}</span>
                  <strong>{product.metadata.commonName}</strong>
                  <small>Dose: {product.metadata.doseLabel}</small>
                  <b>{product.price}</b>
                </a>
              ))}
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
          <div style={{ marginBottom: 24 }}>
            <PepRxBotBadge
              variant="section"
              context="shopping"
              title="Meet PEPRXbot"
              body="PEPRXbot helps customers navigate the catalog, find supplies, upload receipts, use the label-math calculator, and understand the checkout process. It does not provide treatment, dose, or preparation advice."
              secondaryHref="/mixing"
            />
          </div>
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
              <AiAssistedBadge />
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
            <a href={startHref} className="btn btn-primary btn-lg">Shop Available Products</a>
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
            {PRODUCT_CARDS_WITH_METADATA.map((product) => (
              <a
                key={product.title}
                href={buildStorefrontStartHref(leadSource, { product: product.id })}
                className="product-image-card"
                aria-label={`Check savings for ${product.metadata.commonName}`}
              >
                <img src={product.src} alt={`${product.metadata.commonName} refill savings card`} loading="lazy" />
                <div className="product-image-card-copy">
                  <span>{product.tag}</span>
                  <strong>{product.metadata.commonName}</strong>
                  <span>Dose: {product.metadata.doseLabel}</span>
                  <p>{product.benefit}</p>
                  <span className="peprxbot-product-helper">Need help understanding this product? Ask PEPRXbot</span>
                  <b>{product.price}</b>
                </div>
              </a>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <a href={startHref} className="btn btn-primary btn-lg">Shop Available Products</a>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>
              Medication requests require an existing prescription. Supply and accessory requests are reviewed separately.
            </p>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-md">
          <h2 className="section-title text-center">Frequently asked questions</h2>
          <div style={{ margin: '0 auto 24px', maxWidth: 760 }}>
            <PepRxBotBadge
              variant="inline"
              compact
              context="support"
              title="PEPRXbot FAQ Helper"
              body="General education and shopping support only."
            />
          </div>
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
          <div className="peprxbot-faq-section">
            {PEPRXBOT_FAQ_CATEGORIES.map((category) => (
              <div key={category.category} className="peprxbot-faq-category">
                <h3>{category.category}</h3>
                {category.items.slice(0, 3).map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
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
            <a href={startHref} className="btn btn-primary btn-lg">Start Refill Request</a>
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
