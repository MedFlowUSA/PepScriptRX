import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { paulRevereStorefront } from '../../config/paulRevere';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'weight' | 'recovery' | 'performance' | 'wellness' | 'longevity' | 'cognitive' | 'essentials';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE = paulRevereStorefront;

const FEATURED_IDS = [
  'tirzepatide-30mg',
  'semaglutide-10mg',
  'retatrutide-15mg',
  'wolverine-bpc-tb',
  'bpc-157-10mg',
  'tb-500-10mg',
  'cjc-ipamorelin-10mg',
  'nad-500iu',
];

const GROUP_COPY: Record<ProductGroup, { label: string; short: string }> = {
  weight: {
    label: 'Weight Management',
    short: 'A focused path for metabolic research products.',
  },
  recovery: {
    label: 'Recovery',
    short: 'Research products selected for repair and resilience categories.',
  },
  performance: {
    label: 'Performance',
    short: 'A bold collection for customers comparing performance-focused options.',
  },
  wellness: {
    label: 'Wellness',
    short: 'Everyday wellness selections in a clean, easy-to-shop catalog.',
  },
  longevity: {
    label: 'Longevity',
    short: 'Vitality-oriented products for long-range wellness research.',
  },
  cognitive: {
    label: 'Cognitive Support',
    short: 'Focused categories for customers comparing cognitive support options.',
  },
  essentials: {
    label: 'Essentials',
    short: 'Supporting items for a complete research order.',
  },
};

export default function PaulRevereStorefront() {
  usePageMeta(
    `${STORE.brandName} | A New Standard in American Performance`,
    'Premium Paul Revere Peptides research catalog with a bold American brand experience.',
    STORE.assets.lifestyle,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE.slug)), []);
  const featuredProducts = useMemo(() => products.filter((product) => FEATURED_IDS.includes(product.id)).slice(0, 8), [products]);
  const collectionGroups = useMemo(() => buildCollectionGroups(products), [products]);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ProductGroup | 'all'>('all');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const q = search.trim().toLowerCase();
    const productGroup = groupForProduct(product);
    return (group === 'all' || group === productGroup)
      && (!q || [
        product.product_name,
        product.strength,
        product.category,
        product.description,
        productMetaSearchText(product),
      ].join(' ').toLowerCase().includes(q));
  });

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
      rep: STORE.scopeCode,
      scope_code: STORE.scopeCode,
      discount_code: '',
      discount_amount: 0,
      distributor: STORE.slug,
      source_portal: STORE.brandName,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: STORE.slug,
      store_name: STORE.brandName,
      brand_id: STORE.id,
      admin_code: '',
      account_type: 'platform',
      parent_type: 'parked_platform_store',
      commission_owner: '',
      commission_rate: STORE.commissionRate,
      partner_payout_eligible: false,
      platform_allocation: STORE.platformShare,
      store_owner_allocation: 0,
      partner_commission: STORE.partnerCommission,
      rep_commission: STORE.repCommission,
      downline_commission: STORE.downlineCommission,
      override_commission: STORE.overrideCommission,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({
      scope: STORE.scopeCode,
      source: `${STORE.slug}-portal`,
      rep: STORE.scopeCode,
      brand: STORE.slug,
    });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/paulrevere" portalName={STORE.brandName} portalLogoSrc={STORE.assets.logo} portalKey={STORE.slug}>
      <div className="prp-store">
        <section className="prp-hero">
          <div className="prp-shell prp-hero-grid">
            <div className="prp-hero-copy">
              <img src={STORE.assets.logo} alt={STORE.brandName} className="prp-hero-logo" />
              <p className="prp-kicker">Quality. Purity. Integrity.</p>
              <h1>A New Standard in American Performance</h1>
              <p className="prp-subhead">Premium research products presented with strength, precision, and uncompromising standards.</p>
              <div className="prp-actions">
                <a className="prp-btn prp-btn-primary" href="#paulrevere-products">Shop Products</a>
                <Link className="prp-btn prp-btn-secondary" to="/paulrevere/library">Research Library</Link>
              </div>
            </div>
            <div className="prp-hero-panel">
              <video
                src={STORE.assets.heroVideo}
                poster={STORE.assets.lifestyle}
                autoPlay
                muted
                loop
                playsInline
                aria-label="Paul Revere Peptides brand video"
              />
              <ProductPurityGuaranteeBadge compact />
            </div>
          </div>
        </section>

        <section className="prp-section prp-collections" id="paulrevere-collections">
          <div className="prp-shell">
            <div className="prp-section-head">
              <p>Collection Paths</p>
              <h2>Explore the catalog by research focus.</h2>
            </div>
            <div className="prp-collection-grid">
              {collectionGroups.map(({ group: productGroup, count: productCount }) => (
                <button key={productGroup} type="button" className={group === productGroup ? 'is-active' : ''} onClick={() => setGroup(productGroup)}>
                  <span>{GROUP_COPY[productGroup].label}</span>
                  <strong>{productCount} product{productCount === 1 ? '' : 's'}</strong>
                  <small>{GROUP_COPY[productGroup].short}</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="prp-section prp-featured">
          <div className="prp-shell">
            <div className="prp-section-head">
              <p>Featured Research Catalog</p>
              <h2>Built on strength. Defined by standards.</h2>
            </div>
            <div className="prp-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
              ))}
            </div>
          </div>
        </section>

        <section className="prp-story">
          <div className="prp-shell prp-story-grid">
            <div>
              <p className="prp-kicker">Ready When It Matters</p>
              <h2>Precision worth standing for.</h2>
              <p>Paul Revere Peptides brings a bold American identity to a modern research catalog. Built around quality, purity, integrity, and disciplined presentation, the brand is designed for customers who expect high standards from every product they select.</p>
            </div>
            <img src={STORE.assets.lifestyle} alt="Paul Revere Peptides branded basket and historical display" loading="lazy" />
          </div>
        </section>

        <section className="prp-section prp-catalog" id="paulrevere-products">
          <div className="prp-shell">
            <div className="prp-catalog-toolbar">
              <div className="prp-section-head">
                <p>Product Catalog</p>
                <h2>Research products with Paul Revere presentation.</h2>
              </div>
              <div className="prp-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Paul Revere products" />
                <div className="prp-segments" aria-label="Product filters">
                  <button type="button" className={group === 'all' ? 'is-active' : ''} onClick={() => setGroup('all')}>All</button>
                  {collectionGroups.map(({ group: productGroup }) => (
                    <button key={productGroup} type="button" className={group === productGroup ? 'is-active' : ''} onClick={() => setGroup(productGroup)}>
                      {GROUP_COPY[productGroup].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleProducts.length > 0 ? (
              <div className="prp-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
                ))}
              </div>
            ) : (
              <div className="prp-empty">No products found. Try a different search or collection.</div>
            )}
          </div>
        </section>

        <section className="prp-disclaimer">
          <div className="prp-shell">
            <img src={STORE.assets.logo} alt={STORE.brandName} />
            <div>
              <strong>Research-use notice</strong>
              <p>Product availability, pricing, and fulfillment may vary by state availability and applicable requirements. This storefront does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</p>
              <nav aria-label="Paul Revere footer links">
                <Link to="/paulrevere/privacy">Privacy</Link>
                <Link to="/paulrevere/terms">Terms</Link>
                <Link to="/paulrevere/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {count > 0 && (
          <aside className="prp-cart" aria-label="Paul Revere cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{PAUL_REVERE_STYLES}</style>
    </PublicLayout>
  );
}

function sortProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function priority(product: DistributorCatalogProduct) {
  const found = FEATURED_IDS.indexOf(product.id);
  if (found >= 0) return found;
  const group = groupForProduct(product);
  if (group === 'weight') return 120;
  if (group === 'recovery') return 220;
  if (group === 'performance') return 320;
  if (group === 'longevity') return 420;
  if (group === 'cognitive') return 520;
  return 620;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category} ${product.description}`.toLowerCase();
  if (text.includes('weight') || text.includes('glp') || text.includes('tirzep') || text.includes('sema') || text.includes('reta') || text.includes('aod') || text.includes('cagri')) return 'weight';
  if (text.includes('bpc') || text.includes('tb-500') || text.includes('wolverine') || text.includes('recovery') || text.includes('repair') || text.includes('ghk')) return 'recovery';
  if (text.includes('growth') || text.includes('performance') || text.includes('tesa') || text.includes('cjc') || text.includes('hgh') || text.includes('mk-677')) return 'performance';
  if (text.includes('nad') || text.includes('mots') || text.includes('glutathione') || text.includes('longevity') || text.includes('epitalon')) return 'longevity';
  if (text.includes('cognitive') || text.includes('mood')) return 'cognitive';
  if (text.includes('supply') || text.includes('optional') || text.includes('kit')) return 'essentials';
  return 'wellness';
}

function buildCollectionGroups(products: DistributorCatalogProduct[]) {
  const counts = products.reduce((acc, product) => {
    const productGroup = groupForProduct(product);
    acc[productGroup] = (acc[productGroup] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ProductGroup, number>>);

  const order: ProductGroup[] = ['weight', 'recovery', 'performance', 'wellness', 'longevity', 'cognitive', 'essentials'];
  return order
    .filter((productGroup) => (counts[productGroup] ?? 0) > 0)
    .map((productGroup) => ({ group: productGroup, count: counts[productGroup] ?? 0 }));
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

function ProductCard({ product, qty, addToCart, setQty }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
}) {
  const meta = getProductMetadata(product);
  const group = groupForProduct(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  return (
    <article className={qty > 0 ? 'prp-product-card is-in-cart' : 'prp-product-card'}>
      <div className="prp-product-media">
        <img src={STORE.assets.productPlaceholder} alt={`${meta.commonName} Paul Revere Peptides vial placeholder`} loading="lazy" />
        <span>{GROUP_COPY[group].label}</span>
      </div>
      <div className="prp-product-body">
        <h3>{meta.commonName}</h3>
        <p className="prp-strength">{meta.doseLabel}</p>
        <div className="product-bac-water-included">3 mL BAC Water Included</div>
        <p>{product.description || 'Research catalog item in the Paul Revere Peptides collection.'}</p>
        <div className="prp-product-tags">
          <span>Research Catalog</span>
          <span>Secure Checkout</span>
          <span>Education Available</span>
        </div>
        <div className="prp-product-footer">
          <strong>${price?.toFixed(2) ?? 'Review'}</strong>
          <Link to={`/paulrevere/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="prp-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="prp-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

const PAUL_REVERE_STYLES = `
  :root {
    --prp-navy: #06152d;
    --prp-navy-2: #0b2347;
    --prp-red: #b61f2b;
    --prp-red-bright: #d5343f;
    --prp-white: #f8fafc;
    --prp-silver: #c7ced8;
    --prp-muted: #9facbf;
    --prp-brass: #c59a55;
    --prp-parchment: #eee3d0;
    --prp-wood: #21150f;
  }
  .prp-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .prp-store { min-height: 100vh; color: var(--prp-white); background: #071226; overflow-x: clip; }
  .prp-hero { position: relative; min-height: 78vh; display: grid; align-items: center; padding: clamp(42px, 7vw, 78px) 0 34px; background:
    linear-gradient(115deg, rgba(6,21,45,.98) 0%, rgba(6,21,45,.9) 48%, rgba(6,21,45,.64) 100%),
    repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 1px, transparent 1px 17px);
    border-bottom: 1px solid rgba(197,154,85,.42);
    isolation: isolate;
  }
  .prp-hero::before { content: ""; position: absolute; inset: 0; z-index: -1; background:
    radial-gradient(circle at 15% 22%, rgba(197,154,85,.18), transparent 24%),
    linear-gradient(135deg, transparent 0 56%, rgba(182,31,43,.26) 56% 58%, transparent 58% 100%);
    opacity: .9;
  }
  .prp-hero::after { content: "* * *"; position: absolute; right: clamp(18px, 5vw, 70px); top: clamp(18px, 6vw, 66px); color: rgba(248,250,252,.16); font-size: clamp(30px, 5vw, 64px); letter-spacing: .42em; pointer-events: none; }
  .prp-hero-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(320px, 1.08fr); gap: clamp(28px, 5vw, 58px); align-items: center; }
  .prp-hero-copy { display: grid; gap: 17px; align-content: center; }
  .prp-hero-logo { width: min(330px, 82vw); height: auto; display: block; filter: drop-shadow(0 18px 34px rgba(0,0,0,.34)); }
  .prp-kicker { margin: 0; color: var(--prp-brass); font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .prp-hero h1 { margin: 0; color: var(--prp-white); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(42px, 6.8vw, 84px); line-height: .98; font-weight: 800; letter-spacing: 0; text-wrap: balance; }
  .prp-subhead { margin: 0; max-width: 650px; color: #dbe4ef; font-size: clamp(17px, 2.1vw, 23px); line-height: 1.55; }
  .prp-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
  .prp-btn, .prp-add, .prp-cart button, .prp-segments button, .prp-collection-grid button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .prp-btn:hover, .prp-add:hover, .prp-cart button:hover, .prp-segments button:hover, .prp-collection-grid button:hover { transform: translateY(-1px); }
  .prp-btn-primary, .prp-add, .prp-cart button { background: linear-gradient(135deg, var(--prp-red-bright), var(--prp-red)); color: #fff; box-shadow: 0 16px 34px rgba(182,31,43,.28); }
  .prp-btn-secondary { background: rgba(248,250,252,.08); color: var(--prp-white); border-color: rgba(199,206,216,.38); }
  .prp-hero-panel { position: relative; border: 1px solid rgba(197,154,85,.5); border-radius: 8px; background: linear-gradient(145deg, rgba(238,227,208,.1), rgba(11,35,71,.7)); box-shadow: 0 30px 88px rgba(0,0,0,.45); overflow: hidden; }
  .prp-hero-panel video { width: 100%; aspect-ratio: 4 / 5; min-height: 520px; object-fit: cover; object-position: center; display: block; background: #06152d; }
  .prp-section { padding: clamp(46px, 7vw, 78px) 0; }
  .prp-collections { background: linear-gradient(180deg, #f7f1e6, #e8dcc8); color: #182236; }
  .prp-section-head { max-width: 760px; margin: 0 0 24px; }
  .prp-section-head p { margin: 0 0 8px; color: var(--prp-red); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .prp-section-head h2 { margin: 0; color: inherit; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(30px, 4vw, 50px); line-height: 1.08; letter-spacing: 0; }
  .prp-collection-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .prp-collection-grid button { min-height: 158px; align-items: start; justify-content: start; flex-direction: column; text-align: left; background: rgba(255,255,255,.62); color: #182236; border-color: rgba(6,21,45,.14); box-shadow: 0 18px 42px rgba(6,21,45,.11); }
  .prp-collection-grid button.is-active { background: #fff; border-color: rgba(182,31,43,.52); box-shadow: 0 20px 54px rgba(182,31,43,.18); }
  .prp-collection-grid span { color: var(--prp-navy); font-size: 20px; font-weight: 900; }
  .prp-collection-grid strong { color: var(--prp-red); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  .prp-collection-grid small { color: #5f6b7c; font-size: 13px; line-height: 1.55; }
  .prp-featured, .prp-catalog { background: linear-gradient(180deg, #071226, #0a1b39); }
  .prp-featured-grid, .prp-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .prp-product-card { overflow: hidden; display: grid; grid-template-rows: 236px 1fr; border: 1px solid rgba(199,206,216,.22); border-radius: 8px; background: linear-gradient(180deg, rgba(248,250,252,.07), rgba(6,21,45,.92)); box-shadow: 0 22px 58px rgba(0,0,0,.28); min-height: 642px; }
  .prp-product-card.is-in-cart { border-color: rgba(197,154,85,.66); box-shadow: 0 24px 64px rgba(0,0,0,.34), 0 0 30px rgba(197,154,85,.13); }
  .prp-product-media { position: relative; background: #f5f7fb; border-bottom: 1px solid rgba(197,154,85,.28); }
  .prp-product-media img { width: 100%; height: 236px; object-fit: cover; object-position: center; display: block; }
  .prp-product-media span { position: absolute; left: 12px; top: 12px; z-index: 2; border: 1px solid rgba(197,154,85,.56); border-radius: 999px; background: rgba(6,21,45,.88); color: #fff; padding: 6px 9px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .prp-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .prp-product-body h3 { margin: 0; color: var(--prp-white); font-size: 24px; line-height: 1.1; font-weight: 900; }
  .prp-strength { margin: -5px 0 0; color: var(--prp-brass); font-weight: 900; }
  .prp-product-body p { margin: 0; color: #bdcadb; font-size: 14px; line-height: 1.58; }
  .prp-product-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .prp-product-tags span { border: 1px solid rgba(199,206,216,.2); border-radius: 999px; background: rgba(248,250,252,.08); color: #e5ebf3; padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .prp-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .prp-product-footer strong { color: #fff; font-size: 25px; }
  .prp-product-footer a { color: #f1c26f; font-size: 13px; font-weight: 900; }
  .prp-add { width: 100%; }
  .prp-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(199,206,216,.28); border-radius: 8px; overflow: hidden; }
  .prp-qty button { height: 44px; border: 0; background: rgba(182,31,43,.22); color: #fff; font-size: 20px; font-weight: 900; cursor: pointer; }
  .prp-qty span { text-align: center; color: #fff; font-weight: 900; }
  .prp-story { padding: clamp(46px, 7vw, 76px) 0; background: linear-gradient(135deg, var(--prp-wood), #0d1a31 58%, #06152d); border-top: 1px solid rgba(197,154,85,.32); border-bottom: 1px solid rgba(197,154,85,.32); }
  .prp-story-grid { display: grid; grid-template-columns: minmax(0, .8fr) minmax(320px, 1.2fr); gap: clamp(22px, 4vw, 44px); align-items: center; }
  .prp-story h2 { margin: 8px 0 12px; color: #fff; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(30px, 4.6vw, 54px); line-height: 1.05; letter-spacing: 0; }
  .prp-story p { margin: 0; color: #d0d8e4; line-height: 1.75; }
  .prp-story img { width: 100%; aspect-ratio: 16 / 11; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(197,154,85,.5); border-radius: 8px; box-shadow: 0 24px 68px rgba(0,0,0,.42); }
  .prp-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .82fr) minmax(320px, 1.18fr); gap: 20px; align-items: end; margin-bottom: 28px; }
  .prp-filter-stack { display: grid; gap: 12px; }
  .prp-filter-stack input { min-height: 46px; border: 1px solid rgba(199,206,216,.3); border-radius: 8px; padding: 0 14px; color: #fff; background: rgba(248,250,252,.08); outline: none; }
  .prp-filter-stack input::placeholder { color: rgba(219,228,239,.62); }
  .prp-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .prp-segments button { min-height: 40px; background: rgba(248,250,252,.08); color: #dbe4ef; border-color: rgba(199,206,216,.24); padding: 8px 12px; }
  .prp-segments button.is-active { background: var(--prp-red); color: #fff; border-color: rgba(213,52,63,.8); }
  .prp-empty { border: 1px solid rgba(199,206,216,.24); border-radius: 8px; background: rgba(248,250,252,.07); color: #dbe4ef; padding: 24px; font-weight: 800; }
  .prp-disclaimer { padding: 26px 0 96px; background: #06152d; border-top: 1px solid rgba(197,154,85,.28); }
  .prp-disclaimer .prp-shell { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 20px; align-items: center; }
  .prp-disclaimer img { width: 170px; max-width: 100%; height: auto; display: block; }
  .prp-disclaimer strong { color: #fff; display: block; margin-bottom: 7px; }
  .prp-disclaimer p { margin: 0; color: #aebcd0; font-size: 13px; line-height: 1.75; }
  .prp-disclaimer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .prp-disclaimer a { color: #f1c26f; font-size: 13px; font-weight: 900; }
  .prp-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(6,21,45,.96); color: #fff; border: 1px solid rgba(197,154,85,.58); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(0,0,0,.44); }
  .prp-cart div { display: grid; gap: 2px; }
  .prp-cart span { color: #f1c26f; font-weight: 900; }
  @media (max-width: 940px) {
    .prp-hero-grid, .prp-story-grid, .prp-catalog-toolbar { grid-template-columns: 1fr; }
    .prp-hero-copy { text-align: center; justify-items: center; }
    .prp-actions, .prp-segments { width: 100%; justify-content: center; }
    .prp-actions .prp-btn, .prp-segments button { flex: 1 1 160px; }
    .prp-collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .prp-shell { width: min(100% - 24px, 1180px); }
    .prp-hero { min-height: 0; padding-top: 34px; }
    .prp-hero h1 { font-size: 38px; }
    .prp-hero-panel video { aspect-ratio: 1 / 1; min-height: 360px; }
    .prp-story img { aspect-ratio: 1 / 1; }
    .prp-collection-grid, .prp-disclaimer .prp-shell { grid-template-columns: 1fr; }
    .prp-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .prp-product-media img { height: 220px; }
    .prp-disclaimer img { width: 142px; }
    .prp-cart { align-items: stretch; flex-direction: column; }
    .prp-cart button { width: 100%; }
  }
`;
