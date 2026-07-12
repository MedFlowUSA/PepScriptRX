import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { WHOLESALE_TIERS } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function RxPlusLanding() {
  usePageMeta(
    'PepScriptRX+ Expanded Access',
    'PepScriptRX+ is the private distributor and wholesale layer for curated expanded wellness access.',
  );

  return (
    <PublicLayout>
      <section className="rx-plus-hero">
        <div className="container">
          <div className="rx-plus-hero-grid">
            <div>
              <div className="hero-tag">Advanced Wellness Access</div>
              <h1 className="rx-plus-title">
                PepScriptRX<span>+</span>
              </h1>
              <p className="rx-plus-subtitle">
                A private distributor layer for expanded catalog access, curated wholesale opportunities,
                and white-label wellness programs. Built to feel premium, controlled, and approval-based.
              </p>
              <div className="hero-actions">
                <Link to="/aactivated" className="btn btn-primary btn-lg">View AACTIVATED Portal</Link>
                <Link to="/start" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.36)' }}>
                  Request Expanded Access
                </Link>
              </div>
            </div>

            <div className="rx-plus-panel">
              <div className="rx-plus-panel-label">Distributor Layer</div>
              <div className="rx-plus-panel-title">Curated access, not a public warehouse.</div>
              <div className="rx-plus-metric-grid">
                <div>
                  <strong>60%</strong>
                  <span>Net profit distributor comp</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>Wholesale tiers</span>
                </div>
                <div>
                  <strong>Private</strong>
                  <span>Portal-level catalog control</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 32 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              What it unlocks
            </p>
            <h2 className="section-title">Expanded access with clean controls</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              PepScriptRX stays simple for customers. PepScriptRX+ gives approved distributors a broader,
              curated catalog and wholesale pathway.
            </p>
          </div>

          <div className="steps-grid">
            {[
              ['Distributor storefronts', 'Custom storefronts such as /aactivated with portal-level product visibility.'],
              ['Wholesale / white label', 'Tiered volume inquiries for approved partners and strategic accounts.'],
              ['Portal clarity', 'Private storefront controls with product visibility and inquiry tracking.'],
            ].map(([title, desc], index) => (
              <div key={title} className="step-card">
                <div className="step-number">{index + 1}</div>
                <div className="step-title">{title}</div>
                <p className="step-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 32 }}>
            <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Wholesale tiers
            </p>
            <h2 className="section-title">Approval-based volume options</h2>
          </div>
          <div className="rx-plus-tier-grid">
            {WHOLESALE_TIERS.map((tier) => (
              <div key={tier.id} className="card rx-plus-tier-card">
                <div className="card-body">
                  <div className="badge badge-teal" style={{ marginBottom: 14 }}>
                    {tier.max_vials ? `${tier.min_vials}-${tier.max_vials} vials` : `${tier.min_vials}+ vials`}
                  </div>
                  <h3>{tier.tier_name}</h3>
                  <p>{tier.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="rx-plus-disclaimer">
            Wholesale and white-label access requires approval. Pricing may vary based on product availability,
            fulfillment, approval status, and applicable requirements.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
