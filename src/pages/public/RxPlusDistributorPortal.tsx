import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import {
  RX_PLUS_CATEGORIES,
  RX_PLUS_DISTRIBUTORS,
  WHOLESALE_TIERS,
  estimateDistributorCommission,
  getDistributorProducts,
} from '../../data/rxPlus';
import type { RxPlusCategory } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function RxPlusDistributorPortal() {
  const { distributorSlug = 'guy' } = useParams();
  const distributor = RX_PLUS_DISTRIBUTORS.find((item) => item.slug === distributorSlug);
  const products = getDistributorProducts(distributorSlug);
  const [category, setCategory] = useState<'All' | RxPlusCategory>('All');

  usePageMeta(
    distributor ? `${distributor.portal_name}` : 'PepScriptRX+ Distributor Portal',
    'Private PepScriptRX+ distributor storefront with expanded catalog visibility and wholesale inquiry access.',
  );

  const visibleProducts = useMemo(() => {
    if (category === 'All') return products;
    return products.filter((product) => product.category === category);
  }, [category, products]);

  const featuredProducts = products.filter((product) => product.distributorProduct.featured).slice(0, 4);
  const estimatedGross = products.reduce((sum, product) => sum + product.displayPrice, 0);
  const estimatedCost = products.reduce((sum, product) => sum + product.base_cost, 0);
  const commission = estimateDistributorCommission(estimatedGross, estimatedCost, distributor?.commission_rate ?? 0.6);

  if (!distributor) {
    return (
      <PublicLayout>
        <section className="section">
          <div className="container-sm">
            <div className="empty-state card">
              <div className="empty-state-icon">+</div>
              <div className="empty-state-title">Distributor portal not found</div>
              <p className="empty-state-desc">This PepScriptRX+ portal is not active or has not been configured yet.</p>
              <Link to="/rx-plus" className="btn btn-primary" style={{ marginTop: 18 }}>Back to PepScriptRX+</Link>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="rx-plus-storefront-hero">
        <div className="container">
          <div className="rx-plus-storefront-grid">
            <div>
              <div className="hero-tag">{distributor.portal_name}</div>
              <h1 className="rx-plus-storefront-title">PepScriptRX+ Advanced Wellness Access</h1>
              <p className="rx-plus-subtitle">
                Curated expanded catalog access for approved customers and wholesale partners.
                Availability is subject to verification, approval, and fulfillment status.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                <span className="badge badge-teal">{Math.round(distributor.commission_rate * 100)}% net profit comp</span>
                {distributor.white_label_enabled && <span className="badge badge-success">White label enabled</span>}
                {distributor.wholesale_enabled && <span className="badge badge-info">Wholesale enabled</span>}
              </div>
            </div>

            <div className="rx-plus-panel">
              <div className="rx-plus-panel-label">Portal Snapshot</div>
              <div className="rx-plus-metric-grid">
                <div>
                  <strong>{products.length}</strong>
                  <span>Enabled products</span>
                </div>
                <div>
                  <strong>{RX_PLUS_CATEGORIES.length}</strong>
                  <span>Catalog categories</span>
                </div>
                <div>
                  <strong>${Math.round(commission.distributorCommission)}</strong>
                  <span>Sample full-catalog commission</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="rx-plus-filter-row">
            <button className={`btn btn-sm ${category === 'All' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCategory('All')}>
              All
            </button>
            {RX_PLUS_CATEGORIES.filter((cat) => products.some((product) => product.category === cat)).map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {featuredProducts.length > 0 && category === 'All' && (
            <div className="rx-plus-feature-band">
              <div>
                <p className="text-teal font-semibold text-sm" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  Featured access
                </p>
                <h2>Guy-enabled featured products</h2>
              </div>
              <span>{featuredProducts.length} highlighted options</span>
            </div>
          )}

          <div className="rx-plus-product-grid">
            {visibleProducts.map((product) => (
              <article key={product.id} className="card rx-plus-product-card">
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <span className="badge badge-default">{product.category}</span>
                      <h3>{product.product_name}</h3>
                      <p className="rx-plus-strength">{product.strength}</p>
                    </div>
                    <div className="rx-plus-price">${product.displayPrice}</div>
                  </div>
                  <p>{product.description}</p>
                  <div className="rx-plus-product-meta">
                    <span>{product.sku}</span>
                    <span>{product.visibility_type.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="rx-plus-card-actions">
                    <Link to="/start" className="btn btn-primary btn-sm">Request / Add to Order</Link>
                    <Link to="/rx-plus" className="btn btn-ghost btn-sm">Wholesale Inquiry</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="rx-plus-wholesale-cta card">
            <div className="card-body">
              <div>
                <h2>Wholesale / white-label inquiry</h2>
                <p>
                  Approved partners can request tiered volume access. Pricing may vary based on availability,
                  fulfillment, approval status, and volume.
                </p>
              </div>
              <div className="rx-plus-tier-mini">
                {WHOLESALE_TIERS.map((tier) => (
                  <span key={tier.id}>{tier.tier_name}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="rx-plus-disclaimer">
            Availability subject to verification. PepScriptRX+ does not provide medical advice, diagnosis,
            treatment guidance, or aggressive product claims. Product access, pricing, and fulfillment may vary.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
