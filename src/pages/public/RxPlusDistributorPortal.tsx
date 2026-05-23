import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import {
  RX_PLUS_DISTRIBUTORS,
  WHOLESALE_TIERS,
  getDistributorProducts,
} from '../../data/rxPlus';
import type { RxPlusCategory } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function RxPlusDistributorPortal() {
  const { distributorSlug = 'guy' } = useParams();
  const { pathname } = useLocation();
  const resolvedDistributorSlug = pathname.toLowerCase() === '/empirehealth&wellness'
    ? 'mark'
    : ['/aactivated', '/guy'].includes(pathname.toLowerCase())
      ? 'guy'
      : distributorSlug;
  const distributor = RX_PLUS_DISTRIBUTORS.find((item) => item.slug === resolvedDistributorSlug);
  const products = getDistributorProducts(resolvedDistributorSlug);
  const [category, setCategory] = useState<'All' | RxPlusCategory>('All');
  const [search, setSearch] = useState('');
  const isMarkPortal = resolvedDistributorSlug === 'mark';
  const requestPath = isMarkPortal ? '/r/MARK65' : '/start';

  usePageMeta(
    distributor ? `${distributor.portal_name}` : 'PepScriptRX+ Distributor Portal',
    isMarkPortal
      ? 'Empire Health & Wellness approved portal catalog with MARK65 referral attribution.'
      : 'Private PepScriptRX+ distributor storefront with expanded catalog visibility and wholesale inquiry access.',
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === 'All' || product.category === category;
      const matchesSearch = !q || [
        product.product_name,
        product.strength,
        product.category,
        ...(product.badges ?? []),
      ].some((value) => value.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [category, products, search]);

  const featuredProducts = products.filter((product) => product.distributorProduct.featured).slice(0, 4);
  const categories = Array.from(new Set(products.map((product) => product.category)));

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
              <h1 className="rx-plus-storefront-title">
                {isMarkPortal ? 'Approved Wellness Catalog' : 'PepScriptRX+ Advanced Wellness Access'}
              </h1>
              <p className="rx-plus-subtitle">
                {isMarkPortal
                  ? 'Browse Mark Ayala\'s approved portal inventory. MARK65 attribution stays attached for eligible requests and checkout follow-up.'
                  : 'Curated expanded catalog access for approved customers and wholesale partners. Availability is subject to verification, approval, and fulfillment status.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                <span className="badge badge-teal">{products.length} approved options</span>
                <span className="badge badge-success">{isMarkPortal ? 'MARK65 applied' : 'Curated access'}</span>
                <span className="badge badge-info">{isMarkPortal ? '65% net profit commission route' : 'Wholesale inquiry available'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section rx-plus-catalog-section">
        <div className="container">
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Search product, dosage, or category..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ flex: '1 1 260px' }}
              />
              {isMarkPortal && (
                <span className="badge badge-success">You're shopping with Mark Ayala</span>
              )}
            </div>
          </div>

          <div className="rx-plus-filter-row">
            <button className={`btn btn-sm ${category === 'All' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCategory('All')}>
              All
            </button>
            {categories.map((cat) => (
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
                <h2>{isMarkPortal ? 'Popular portal options' : 'Featured expanded products'}</h2>
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
                      {product.badges && product.badges.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {product.badges.map((badge) => (
                            <span key={badge} className={badge === 'best seller' ? 'badge badge-success' : 'badge badge-teal'}>
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rx-plus-price">${product.displayPrice}</div>
                  </div>
                  <p>{product.description}</p>
                  {!isMarkPortal && (
                    <div className="rx-plus-product-meta">
                      <span>{product.sku}</span>
                      <span>{product.visibility_type.replaceAll('_', ' ')}</span>
                    </div>
                  )}
                  <div className="rx-plus-card-actions">
                    <Link to={requestPath} className="btn btn-primary btn-sm">
                      {isMarkPortal ? 'Request Availability' : 'Request / Add to Order'}
                    </Link>
                    {!isMarkPortal && <Link to="/rx-plus" className="btn btn-ghost btn-sm">Wholesale Inquiry</Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!isMarkPortal && (
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
          )}

          <p className="rx-plus-disclaimer">
            Availability subject to verification. PepScriptRX+ does not provide medical advice, diagnosis,
            treatment guidance, or aggressive product claims. Product access, pricing, and fulfillment may vary.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
