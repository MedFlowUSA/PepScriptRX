import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'metabolic' | 'recovery' | 'performance' | 'wellness';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE_NAME = 'Peak Vital Peptides';
const STORE_SLUG = 'peakvital';
const SCOPE_CODE = 'PEAKVITAL';
const LOGO_IMAGE = '/brands/peakvital/peakvital-logo.svg';
const HERO_IMAGE = '/brands/peakvital/peakvital-lab-basket.png';
const VIAL_IMAGE = '/brands/peakvital/peakvital-product-vial.png';
const BRAND_PANEL_IMAGE = '/brands/peakvital/peakvital-brand-panel.png';
const BRAND_FILM = '/brands/peakvital/peakvital-brand-film.mov';

const FEATURED_IDS = [
  'tirzepatide-10mg',
  'retatrutide-30mg',
  'wolverine-bpc-tb',
  'cjc-ipamorelin-10mg',
  'nad-1000iu',
  'hgh-somatropin-240iu-kit',
];

const GROUP_COPY: Record<ProductGroup, { label: string; short: string }> = {
  metabolic: {
    label: 'GLP / Weight Management',
    short: 'Metabolic research options and GLP-focused selections.',
  },
  recovery: {
    label: 'Recovery',
    short: 'Repair, resilience, and soft-tissue support categories.',
  },
  performance: {
    label: 'Performance',
    short: 'Growth-pathway and performance-forward research options.',
  },
  wellness: {
    label: 'Wellness',
    short: 'Cellular support, antioxidant, and blend-based wellness picks.',
  },
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

export default function PeakVitalStorefront() {
  usePageMeta(
    `${STORE_NAME} | Elevate What Is Possible.`,
    'Peak Vital Peptides premium research catalog powered by PepScriptRX checkout, inventory, and fulfillment.',
    HERO_IMAGE,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE_SLUG)), []);
  const featuredProducts = useMemo(() => FEATURED_IDS.map((id) => products.find((product) => product.id === id)).filter(Boolean) as DistributorCatalogProduct[], [products]);
  const groups = useMemo(() => buildGroups(products), [products]);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ProductGroup | 'all'>('all');
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [ageAccepted, setAgeAccepted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('peakvital_age_gate_v1') === 'accepted';
  });

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const query = search.trim().toLowerCase();
    const productGroup = groupForProduct(product);
    return (group === 'all' || group === productGroup)
      && (!query || [
        product.product_name,
        product.strength,
        product.category,
        product.description,
        productMetaSearchText(product),
      ].join(' ').toLowerCase().includes(query));
  });
  const displayedProducts = catalogExpanded || search.trim() || group !== 'all'
    ? visibleProducts
    : visibleProducts.slice(0, 10);
  const hiddenProductCount = Math.max(0, visibleProducts.length - displayedProducts.length);

  function acceptAgeGate() {
    window.localStorage.setItem('peakvital_age_gate_v1', 'accepted');
    setAgeAccepted(true);
  }

  function addToCart(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  }

  function setQty(productId: string, qty: number) {
    setCart((current) => {
      const next = { ...current };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  function checkout() {
    const items = Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((item) => item.id === id);
        if (!product) return null;
        const meta = getProductMetadata(product);
        return {
          id: product.id,
          sku: product.sku,
          name: meta.commonName,
          strength: meta.doseLabel,
          technical_name: meta.technicalName,
          category: product.category,
          price: Number(product.displayPrice ?? 0),
          qty,
          inventory_status_at_purchase: 'checkout_available',
          inventory_status_label_at_purchase: 'Checkout Available',
          was_special_order: false,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!items.length) return;

    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      rep: SCOPE_CODE,
      scope_code: SCOPE_CODE,
      discount_code: '',
      discount_amount: 0,
      distributor: STORE_SLUG,
      source_portal: STORE_NAME,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: STORE_SLUG,
      store_name: STORE_NAME,
      brand_id: STORE_SLUG,
      admin_code: SCOPE_CODE,
      admin_scope: SCOPE_CODE,
      account_type: 'admin',
      parent_type: 'platform_direct_partner_store',
      commission_owner: SCOPE_CODE,
      commission_type: 'requires_configuration',
      partner_payout_eligible: false,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({
      scope: SCOPE_CODE,
      source: `${STORE_SLUG}-portal`,
      rep: SCOPE_CODE,
      brand: STORE_SLUG,
    });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/peakvital" portalName={STORE_NAME} portalLogoSrc={LOGO_IMAGE} portalKey={STORE_SLUG}>
      <div className="peakvital-store">
        {!ageAccepted && (
          <div className="peakvital-age-gate" role="dialog" aria-modal="true" aria-label="Age verification">
            <div className="peakvital-age-card">
              <img src={LOGO_IMAGE} alt={STORE_NAME} />
              <p>Age Verification</p>
              <h2>Peak Vital Peptides is intended for adults 21 and older.</h2>
              <span>Products are for research use only. This site does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</span>
              <button type="button" onClick={acceptAgeGate}>I am 21 or older</button>
              <Link to="/">Leave Store</Link>
            </div>
          </div>
        )}

        <section className="peakvital-hero">
          <div className="peakvital-shell peakvital-hero-grid">
            <div className="peakvital-hero-copy">
              <img src={LOGO_IMAGE} alt={STORE_NAME} className="peakvital-hero-logo" />
              <p className="peakvital-kicker">Elevate What Is Possible.</p>
              <h1>Peak Vital Peptides</h1>
              <p className="peakvital-subhead">Precision research compounds presented with uncompromising clarity, secure fulfillment, and a distinctly elevated standard.</p>
              <div className="peakvital-actions">
                <a className="peakvital-btn peakvital-btn-primary" href="#peakvital-products">Shop Catalog</a>
                <Link className="peakvital-btn peakvital-btn-secondary" to="/peakvital/certificates">Quality Docs</Link>
              </div>
            </div>
            <div className="peakvital-hero-panel">
              <img src={VIAL_IMAGE} alt="Peak Vital Peptides vial" />
              <ProductPurityGuaranteeBadge compact />
            </div>
          </div>
        </section>

        <section className="peakvital-band">
          <div className="peakvital-shell peakvital-band-grid">
            {[
              ['Verified Quality', 'Documentation-led quality standards and transparent research specifications.'],
              ['Precision Catalog', 'A complete platform collection with clear pricing and scientific categories.'],
              ['Secure Fulfillment', 'Protected checkout, inventory-aware ordering, and dedicated order support.'],
            ].map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="peakvital-section peakvital-featured">
          <div className="peakvital-shell">
            <div className="peakvital-section-head">
              <p>Featured Selections</p>
              <h2>Built for metabolic, recovery, and performance research paths.</h2>
            </div>
            <div className="peakvital-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} featured />
              ))}
            </div>
          </div>
        </section>

        <section className="peakvital-section peakvital-catalog" id="peakvital-products">
          <div className="peakvital-shell">
            <div className="peakvital-catalog-toolbar">
              <div className="peakvital-section-head">
                <p>Product Catalog</p>
                <h2>Search, filter, compare, and choose your selections.</h2>
              </div>
              <div className="peakvital-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Peak Vital products" />
                <div className="peakvital-segments" aria-label="Product filters">
                  <button type="button" className={group === 'all' ? 'is-active' : ''} onClick={() => setGroup('all')}>All</button>
                  {groups.map(({ group: productGroup }) => (
                    <button key={productGroup} type="button" className={group === productGroup ? 'is-active' : ''} onClick={() => setGroup(productGroup)}>
                      {GROUP_COPY[productGroup].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleProducts.length > 0 ? (
              <>
                <div className="peakvital-product-grid" id="peakvital-product-grid">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} />
                  ))}
                </div>
                {group === 'all' && !search.trim() && visibleProducts.length > 10 && (
                  <div className="peakvital-catalog-drawer">
                    <button
                      type="button"
                      aria-expanded={catalogExpanded}
                      aria-controls="peakvital-product-grid"
                      onClick={() => setCatalogExpanded((current) => !current)}
                    >
                      <span>
                        <small>{catalogExpanded ? 'Curated view' : 'Complete collection'}</small>
                        <strong>{catalogExpanded ? 'Show Top 10 Products' : `Explore ${hiddenProductCount} More Products`}</strong>
                      </span>
                      <i aria-hidden="true">{catalogExpanded ? '−' : '+'}</i>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="peakvital-empty">No products found. Try a different search or category.</div>
            )}
          </div>
        </section>

        <section className="peakvital-pillars" aria-label="The Peak Vital standard">
          <div className="peakvital-shell">
            <div className="peakvital-section-head">
              <p>The Peak Vital Standard</p>
              <h2>Designed around purity, precision, and trust.</h2>
            </div>
            <div className="peakvital-pillar-grid">
              {[
                ['01', 'Research-grade focus', 'Clear specifications and quality documentation support confident product review.'],
                ['02', 'Purity first', 'Every selection is presented with an uncompromising focus on consistency and transparency.'],
                ['03', 'Premium experience', 'From discovery through fulfillment, every interaction is calm, secure, and intentional.'],
              ].map(([number, title, body]) => (
                <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>
              ))}
            </div>
            <img className="peakvital-brand-panel" src={BRAND_PANEL_IMAGE} alt="Peak Vital Peptides high purity, lab tested, research grade brand standards" loading="lazy" />
          </div>
        </section>

        <section className="peakvital-story">
          <div className="peakvital-shell peakvital-story-grid">
            <figure className="peakvital-film">
              <video autoPlay muted loop playsInline preload="metadata" poster={HERO_IMAGE} aria-label="Peak Vital Peptides brand film">
                <source src={BRAND_FILM} type="video/quicktime" />
              </video>
              <figcaption><span>Peak Vital Film</span><strong>Precision in motion</strong></figcaption>
            </figure>
            <div>
              <p className="peakvital-kicker">Science, beautifully considered</p>
              <h2>Performance begins with a higher standard.</h2>
              <p>Peak Vital pairs a modern biotech sensibility with an effortless shopping experience—giving researchers clear product details, quality resources, and trusted checkout support.</p>
              <div className="peakvital-story-actions">
                <Link className="peakvital-btn peakvital-btn-primary" to="/peakvital/mixing">Mixing Center</Link>
                <Link className="peakvital-btn peakvital-btn-dark" to="/peakvital/library">Library</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="peakvital-newsletter">
          <div className="peakvital-shell peakvital-newsletter-inner">
            <div><p className="peakvital-kicker">Peak Notes</p><h2>Ideas for a more vital future.</h2><span>Research education, product releases, and quality updates—delivered with restraint.</span></div>
            <form onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="peakvital-email">Email address</label>
              <div><input id="peakvital-email" type="email" placeholder="you@example.com" required /><button type="submit">Join the list</button></div>
            </form>
          </div>
        </section>

        <section className="peakvital-footer">
          <div className="peakvital-shell">
            <img src={LOGO_IMAGE} alt={STORE_NAME} />
            <div>
              <strong>Required notices</strong>
              <p>Products are listed for research use only and are not intended to diagnose, treat, cure, or prevent disease. This storefront does not provide medical advice. Shipping, availability, eligibility, and fulfillment are subject to standard PepScriptRX review and applicable requirements.</p>
              <nav aria-label="Peak Vital footer links">
                <Link to="/peakvital/privacy">Privacy</Link>
                <Link to="/peakvital/terms">Terms</Link>
                <Link to="/peakvital/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {detailProduct && (
          <ProductDetailModal product={detailProduct} qty={cart[detailProduct.id] ?? 0} addToCart={addToCart} setQty={setQty} close={() => setDetailProduct(null)} />
        )}

        {count > 0 && (
          <aside className="peakvital-cart" aria-label="Peak Vital cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>{money(subtotal)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{PEAKVITAL_STYLES}</style>
    </PublicLayout>
  );
}

function ProductCard({ product, qty, addToCart, setQty, openDetail, featured = false }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  openDetail: (product: DistributorCatalogProduct) => void;
  featured?: boolean;
}) {
  const meta = getProductMetadata(product);
  const productGroup = groupForProduct(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  return (
    <article className={featured ? 'peakvital-product-card is-featured' : 'peakvital-product-card'}>
      <div className="peakvital-product-media">
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Peak Vital vial`} loading="lazy" />
        <span>{GROUP_COPY[productGroup].label}</span>
      </div>
      <div className="peakvital-product-body">
        <h3>{meta.commonName}</h3>
        <p className="peakvital-strength">{meta.doseLabel}</p>
        <div className="product-bac-water-included">3 mL BAC Water Included</div>
        <p>{product.description || 'Peak Vital catalog item available through standard order review.'}</p>
        <div className="peakvital-tags">
          {(product.badges ?? ['Research Use', 'Quality Reviewed']).slice(0, 3).map((badge) => <span key={badge}>{badge}</span>)}
        </div>
        <div className="peakvital-product-footer">
          <strong>{price != null ? money(price) : 'Review'}</strong>
          <button type="button" onClick={() => openDetail(product)}>Details</button>
        </div>
        {qty > 0 ? (
          <div className="peakvital-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="peakvital-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

function ProductDetailModal({ product, qty, addToCart, setQty, close }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  close: () => void;
}) {
  const meta = getProductMetadata(product);
  return (
    <div className="peakvital-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${meta.commonName} details`}>
      <div className="peakvital-modal">
        <button className="peakvital-modal-close" type="button" onClick={close} aria-label="Close product details">x</button>
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Peak Vital vial`} />
        <div>
          <p className="peakvital-kicker">{product.category}</p>
          <h2>{meta.commonName}</h2>
          <strong>{meta.doseLabel}</strong>
          <p>{product.description}</p>
          <div className="peakvital-detail-list">
            <span>SKU: {product.sku}</span>
            <span>Price: {money(product.displayPrice)}</span>
            <span>Fulfillment: Confirmed during order review</span>
            <span>Shipping: Confirmed during checkout and fulfillment review</span>
          </div>
          {qty > 0 ? (
            <div className="peakvital-qty">
              <button type="button" onClick={() => setQty(product.id, qty - 1)}>-</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty(product.id, qty + 1)}>+</button>
            </div>
          ) : (
            <button className="peakvital-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
          )}
        </div>
      </div>
    </div>
  );
}

function sortProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function priority(product: DistributorCatalogProduct) {
  const featured = FEATURED_IDS.indexOf(product.id);
  if (featured >= 0) return featured;
  const productGroup = groupForProduct(product);
  if (productGroup === 'metabolic') return 100;
  if (productGroup === 'recovery') return 200;
  if (productGroup === 'performance') return 300;
  return 400;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category} ${product.description}`.toLowerCase();
  if (text.includes('tirzep') || text.includes('sema') || text.includes('reta') || text.includes('cagri') || text.includes('glp')) return 'metabolic';
  if (text.includes('bpc') || text.includes('tb-500') || text.includes('wolverine') || text.includes('recovery') || text.includes('repair')) return 'recovery';
  if (text.includes('hgh') || text.includes('tesa') || text.includes('sermorelin') || text.includes('ipamorelin') || text.includes('cjc') || text.includes('performance')) return 'performance';
  return 'wellness';
}

function buildGroups(products: DistributorCatalogProduct[]) {
  const counts = products.reduce((acc, product) => {
    const productGroup = groupForProduct(product);
    acc[productGroup] = (acc[productGroup] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ProductGroup, number>>);
  const order: ProductGroup[] = ['metabolic', 'recovery', 'performance', 'wellness'];
  return order.filter((productGroup) => (counts[productGroup] ?? 0) > 0).map((productGroup) => ({ group: productGroup, count: counts[productGroup] ?? 0 }));
}

function cartCount(cart: CartMap) {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function cartSubtotal(cart: CartMap, products: DistributorCatalogProduct[]) {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = products.find((item) => item.id === id);
    return sum + Number(product?.displayPrice ?? 0) * qty;
  }, 0);
}

const PEAKVITAL_STYLES = `
  :root {
    --peakvital-black: #f6f9f8;
    --peakvital-ink: #10241e;
    --peakvital-panel: #ffffff;
    --peakvital-gunmetal: #dce7e3;
    --peakvital-silver: #203b32;
    --peakvital-muted: #63766f;
    --peakvital-red: #075b43;
    --peakvital-red-bright: #0b8a62;
    --peakvital-line: rgba(34, 82, 66, .18);
  }
  .peakvital-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .peakvital-store { min-height: 100vh; color: var(--peakvital-silver); background: var(--peakvital-black); font-family: Inter, ui-sans-serif, system-ui, sans-serif; overflow-x: clip; }
  .peakvital-hero { position: relative; min-height: 84vh; display: grid; align-items: center; padding: clamp(42px, 7vw, 88px) 0 38px; background:
    linear-gradient(95deg, rgba(246,249,248,.98) 0%, rgba(246,249,248,.91) 43%, rgba(246,249,248,.18) 100%),
    url('/brands/peakvital/peakvital-lab-basket.png') center / cover no-repeat; border-bottom: 1px solid rgba(7,91,67,.42); isolation: isolate; }
  .peakvital-hero::after, .peakvital-story::after { content: ""; position: absolute; inset: 0; pointer-events: none; background:
    repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 1px, transparent 1px 14px),
    linear-gradient(120deg, transparent 0 38%, rgba(7,91,67,.18) 52%, transparent 70%); opacity: .42; mix-blend-mode: screen; }
  .peakvital-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, .92fr) minmax(320px, .86fr); gap: clamp(28px, 6vw, 66px); align-items: center; }
  .peakvital-hero-copy { display: grid; gap: 16px; align-content: center; }
  .peakvital-hero-logo { width: min(340px, 78vw); height: auto; display: block; border-radius: 8px; background: rgba(255,255,255,.78); border: 1px solid rgba(34,82,66,.14); box-shadow: 0 24px 70px rgba(16,55,43,.12); }
  .peakvital-kicker { margin: 0; color: var(--peakvital-red-bright); font-size: 12px; font-weight: 950; letter-spacing: .18em; text-transform: uppercase; }
  .peakvital-hero h1 { margin: 0; color: var(--peakvital-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(48px, 8vw, 92px); line-height: .94; letter-spacing: -.045em; text-wrap: balance; }
  .peakvital-subhead { margin: 0; max-width: 670px; color: var(--peakvital-muted); font-size: clamp(17px, 2.1vw, 22px); line-height: 1.62; }
  .peakvital-actions, .peakvital-story-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .peakvital-btn, .peakvital-add, .peakvital-cart button, .peakvital-segments button, .peakvital-product-footer button, .peakvital-age-card button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .peakvital-btn:hover, .peakvital-add:hover, .peakvital-cart button:hover, .peakvital-segments button:hover, .peakvital-product-footer button:hover, .peakvital-age-card button:hover { transform: translateY(-1px); }
  .peakvital-btn-primary, .peakvital-add, .peakvital-cart button, .peakvital-age-card button, .peakvital-newsletter button { background: linear-gradient(135deg, var(--peakvital-red-bright), #064735); color: #fff; box-shadow: 0 18px 42px rgba(7,91,67,.22); }
  .peakvital-btn-secondary { background: rgba(16,16,18,.82); color: #fff; border-color: rgba(34,82,66,.32); backdrop-filter: blur(12px); }
  .peakvital-btn-dark { color: #fff; background: rgba(5,5,5,.72); border-color: rgba(7,91,67,.44); }
  .peakvital-hero-panel { justify-self: end; width: min(430px, 100%); border: 1px solid rgba(34,82,66,.24); border-radius: 8px; overflow: hidden; background: rgba(5,5,5,.72); box-shadow: 0 34px 90px rgba(0,0,0,.66), 0 0 42px rgba(7,91,67,.16); }
  .peakvital-hero-panel img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: contain; object-position: center; background: #f4f7f6; }
  .peakvital-band { padding: 18px 0; background: #0b3b2e; border-bottom: 1px solid rgba(7,91,67,.28); }
  .peakvital-band-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .peakvital-band article { border: 1px solid var(--peakvital-line); border-radius: 8px; background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025)); padding: 16px; display: grid; gap: 5px; }
  .peakvital-band strong { color: #fff; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
  .peakvital-band span { color: #c9dbd5; font-size: 13px; line-height: 1.5; }
  .peakvital-section { padding: clamp(46px, 7vw, 78px) 0; }
  .peakvital-featured { background: linear-gradient(180deg, #eef5f2, #ffffff); }
  .peakvital-catalog { background: linear-gradient(180deg, #ffffff, #eef5f2); }
  .peakvital-section-head { max-width: 800px; margin: 0 0 24px; }
  .peakvital-section-head p { margin: 0 0 8px; color: var(--peakvital-red-bright); font-size: 12px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
  .peakvital-section-head h2 { margin: 0; color: var(--peakvital-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(31px, 4.6vw, 58px); line-height: 1.05; letter-spacing: -.035em; text-wrap: balance; }
  .peakvital-featured-grid, .peakvital-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .peakvital-catalog-drawer { display: grid; place-items: center; margin-top: 30px; }
  .peakvital-catalog-drawer > button { width: min(620px, 100%); min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border: 1px solid rgba(34,82,66,.18); border-radius: 16px; padding: 15px 18px 15px 22px; color: var(--peakvital-ink); background: rgba(255,255,255,.9); box-shadow: 0 20px 50px rgba(15,66,50,.1); cursor: pointer; text-align: left; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
  .peakvital-catalog-drawer > button:hover { transform: translateY(-2px); border-color: rgba(11,138,98,.42); box-shadow: 0 24px 58px rgba(15,66,50,.15); }
  .peakvital-catalog-drawer span { display: grid; gap: 4px; }
  .peakvital-catalog-drawer small { color: var(--peakvital-red-bright); font-size: 10px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .peakvital-catalog-drawer strong { font: 500 clamp(18px, 3vw, 25px)/1.1 Georgia, serif; }
  .peakvital-catalog-drawer i { width: 44px; height: 44px; flex: 0 0 44px; display: grid; place-items: center; border-radius: 50%; color: #fff; background: linear-gradient(135deg, var(--peakvital-red-bright), #064735); font: normal 28px/1 system-ui; }
  .peakvital-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .86fr) minmax(320px, 1.14fr); gap: 22px; align-items: end; margin-bottom: 28px; }
  .peakvital-filter-stack { display: grid; gap: 12px; }
  .peakvital-filter-stack input { min-height: 46px; border: 1px solid rgba(34,82,66,.22); border-radius: 8px; padding: 0 14px; color: #fff; background: rgba(5,5,5,.64); outline: none; }
  .peakvital-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .peakvital-segments button { min-height: 40px; background: rgba(255,255,255,.06); color: var(--peakvital-silver); border-color: var(--peakvital-line); padding: 8px 12px; font-size: 12px; }
  .peakvital-segments button.is-active { background: var(--peakvital-red); color: #fff; border-color: rgba(11,138,98,.72); box-shadow: 0 14px 32px rgba(7,91,67,.22); }
  .peakvital-product-card, .peakvital-empty { border: 1px solid rgba(34,82,66,.14); border-radius: 14px; background: rgba(255,255,255,.92); box-shadow: 0 22px 58px rgba(15,66,50,.09); }
  .peakvital-product-card { overflow: hidden; display: grid; grid-template-rows: 246px 1fr; min-height: 656px; }
  .peakvital-product-card.is-featured { border-color: rgba(11,138,98,.46); box-shadow: 0 26px 70px rgba(0,0,0,.48), 0 0 32px rgba(7,91,67,.16); }
  .peakvital-product-media { position: relative; background: #f6f9f8; border-bottom: 1px solid rgba(7,91,67,.30); }
  .peakvital-product-media img { width: 100%; height: 246px; object-fit: contain; object-position: center; display: block; }
  .peakvital-product-media span { position: absolute; left: 12px; top: 12px; border: 1px solid rgba(11,138,98,.52); border-radius: 999px; background: rgba(5,5,5,.86); color: #fff; padding: 6px 9px; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .peakvital-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .peakvital-product-body h3 { margin: 0; color: var(--peakvital-ink); font-family: Georgia, serif; font-size: 25px; line-height: 1.1; }
  .peakvital-strength { margin: -5px 0 0; color: var(--peakvital-red-bright); font-weight: 950; }
  .peakvital-product-body p { margin: 0; color: var(--peakvital-muted); font-size: 14px; line-height: 1.58; }
  .peakvital-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .peakvital-tags span { border: 1px solid rgba(34,82,66,.16); border-radius: 999px; background: rgba(255,255,255,.055); color: var(--peakvital-silver); padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .peakvital-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .peakvital-product-footer strong { color: var(--peakvital-ink); font-size: 25px; }
  .peakvital-product-footer button { min-height: 36px; padding: 7px 11px; color: #fff; background: rgba(255,255,255,.06); border-color: rgba(34,82,66,.22); font-size: 12px; }
  .peakvital-add { width: 100%; }
  .peakvital-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(34,82,66,.22); border-radius: 8px; overflow: hidden; }
  .peakvital-qty button { height: 44px; border: 0; background: rgba(7,91,67,.24); color: #fff; font-size: 20px; font-weight: 950; cursor: pointer; }
  .peakvital-qty span { text-align: center; color: var(--peakvital-ink); font-weight: 950; }
  .peakvital-pillars { padding: clamp(52px, 8vw, 96px) 0; background: #082f24; color: #fff; }
  .peakvital-pillars .peakvital-section-head h2 { color: #fff; }
  .peakvital-pillar-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,.15); }
  .peakvital-pillar-grid article { padding: clamp(24px, 4vw, 44px); background: #082f24; }
  .peakvital-pillar-grid span { color: #7dd3b1; font-size: 12px; letter-spacing: .18em; }
  .peakvital-pillar-grid h3 { margin: 42px 0 12px; font-family: Georgia, serif; font-size: 25px; font-weight: 500; }
  .peakvital-pillar-grid p { color: #bcd1ca; line-height: 1.7; }
  .peakvital-brand-panel { width: 100%; display: block; margin-top: clamp(28px, 5vw, 58px); aspect-ratio: 16 / 10; object-fit: cover; border: 1px solid rgba(255,255,255,.18); border-radius: 18px; box-shadow: 0 32px 80px rgba(0,0,0,.28); }
  .peakvital-empty { padding: 24px; font-weight: 800; color: var(--peakvital-muted); }
  .peakvital-story { position: relative; padding: clamp(48px, 7vw, 78px) 0; background: linear-gradient(135deg, #f6f9f8, #1b1b1e); color: #fff; border-top: 1px solid rgba(7,91,67,.28); border-bottom: 1px solid rgba(7,91,67,.28); overflow: hidden; }
  .peakvital-story-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(280px, 1.12fr) minmax(0, .88fr); gap: clamp(22px, 5vw, 52px); align-items: center; }
  .peakvital-film { position: relative; margin: 0; overflow: hidden; border: 1px solid rgba(34,82,66,.22); border-radius: 18px; box-shadow: 0 28px 78px rgba(0,0,0,.32); background: #071f18; }
  .peakvital-film video { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
  .peakvital-film figcaption { position: absolute; inset: auto 16px 16px; display: grid; gap: 2px; padding: 12px 14px; border: 1px solid rgba(255,255,255,.2); border-radius: 12px; color: #fff; background: rgba(5,35,26,.7); backdrop-filter: blur(12px); }
  .peakvital-film figcaption span { color: #92d8bd; font-size: 10px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .peakvital-story h2 { margin: 8px 0 12px; color: #fff; font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(34px, 5vw, 62px); line-height: 1; letter-spacing: .02em; text-transform: uppercase; }
  .peakvital-story p { margin: 0; color: var(--peakvital-muted); line-height: 1.75; }
  .peakvital-newsletter { padding: clamp(44px, 7vw, 78px) 0; background: #fff; }
  .peakvital-newsletter-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 42px; align-items: end; }
  .peakvital-newsletter h2 { margin: 8px 0; color: var(--peakvital-ink); font: 500 clamp(30px, 4vw, 52px)/1.05 Georgia, serif; }
  .peakvital-newsletter span { color: var(--peakvital-muted); }
  .peakvital-newsletter label { display: block; margin-bottom: 8px; color: var(--peakvital-ink); font-size: 12px; font-weight: 800; }
  .peakvital-newsletter form div { display: flex; gap: 8px; }
  .peakvital-newsletter input { min-width: 0; flex: 1; min-height: 48px; border: 1px solid var(--peakvital-line); border-radius: 8px; padding: 0 14px; }
  .peakvital-newsletter button { min-height: 48px; border: 0; border-radius: 8px; padding: 0 18px; font-weight: 800; cursor: pointer; }
  .peakvital-footer { padding: 28px 0 96px; background: #071f18; color: #fff; }
  .peakvital-footer .peakvital-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
  .peakvital-footer img { width: 150px; max-width: 100%; border-radius: 8px; display: block; }
  .peakvital-footer strong { display: block; margin-bottom: 7px; }
  .peakvital-footer p { margin: 0; color: var(--peakvital-muted); font-size: 13px; line-height: 1.75; }
  .peakvital-footer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .peakvital-footer a { color: var(--peakvital-red-bright); font-size: 13px; font-weight: 900; }
  .peakvital-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(5,5,5,.96); color: #fff; border: 1px solid rgba(11,138,98,.58); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(0,0,0,.54); backdrop-filter: blur(12px); }
  .peakvital-cart div { display: grid; gap: 2px; }
  .peakvital-cart span { color: var(--peakvital-red-bright); font-weight: 950; }
  .peakvital-age-gate, .peakvital-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(0,0,0,.78); backdrop-filter: blur(14px); }
  .peakvital-age-card, .peakvital-modal { width: min(520px, 100%); border: 1px solid rgba(11,138,98,.42); border-radius: 8px; background: linear-gradient(180deg, #151518, #060607); box-shadow: 0 34px 100px rgba(0,0,0,.68); padding: 24px; }
  .peakvital-age-card { display: grid; gap: 13px; text-align: center; justify-items: center; }
  .peakvital-age-card img { width: min(260px, 72vw); border-radius: 8px; }
  .peakvital-age-card p { margin: 0; color: var(--peakvital-red-bright); font-weight: 950; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; }
  .peakvital-age-card h2 { margin: 0; color: #fff; font-size: 28px; line-height: 1.15; }
  .peakvital-age-card span { color: var(--peakvital-muted); line-height: 1.6; }
  .peakvital-age-card a { color: var(--peakvital-muted); font-weight: 800; }
  .peakvital-modal { position: relative; display: grid; grid-template-columns: minmax(160px, .78fr) minmax(0, 1.22fr); gap: 20px; width: min(820px, 100%); text-align: left; }
  .peakvital-modal > img { width: 100%; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 8px; border: 1px solid var(--peakvital-line); background: #f4f7f6; }
  .peakvital-modal h2 { margin: 4px 0 4px; color: #fff; font-size: clamp(30px, 4vw, 48px); line-height: 1; text-transform: uppercase; }
  .peakvital-modal strong { color: var(--peakvital-red-bright); }
  .peakvital-modal p { color: var(--peakvital-muted); line-height: 1.65; }
  .peakvital-modal-close { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--peakvital-line); color: #fff; background: rgba(0,0,0,.64); cursor: pointer; }
  .peakvital-detail-list { display: grid; gap: 7px; margin: 12px 0; }
  .peakvital-detail-list span { border: 1px solid var(--peakvital-line); border-radius: 8px; padding: 8px 10px; color: var(--peakvital-silver); background: rgba(255,255,255,.045); font-size: 13px; }
  @media (max-width: 940px) {
    .peakvital-hero { min-height: 0; background-position: 62% center; }
    .peakvital-hero-grid, .peakvital-catalog-toolbar, .peakvital-story-grid, .peakvital-modal { grid-template-columns: 1fr; }
    .peakvital-hero-copy { text-align: center; justify-items: center; }
    .peakvital-hero-panel { justify-self: center; }
    .peakvital-actions, .peakvital-story-actions, .peakvital-segments { width: 100%; justify-content: center; }
    .peakvital-actions .peakvital-btn, .peakvital-story-actions .peakvital-btn, .peakvital-segments button { flex: 1 1 160px; }
    .peakvital-band-grid { grid-template-columns: 1fr; }
    .peakvital-pillar-grid, .peakvital-newsletter-inner { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .peakvital-shell { width: min(100% - 24px, 1180px); }
    .peakvital-hero h1 { font-size: 42px; }
    .peakvital-hero-logo { width: min(270px, 76vw); }
    .peakvital-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .peakvital-product-media img { height: 220px; }
    .peakvital-hero { background-position: 58% center; }
    .peakvital-brand-panel { aspect-ratio: 4 / 5; object-position: center; }
    .peakvital-footer .peakvital-shell { grid-template-columns: 1fr; }
    .peakvital-footer img { width: 132px; }
    .peakvital-cart { align-items: stretch; flex-direction: column; }
    .peakvital-cart button { width: 100%; }
  }
`;


