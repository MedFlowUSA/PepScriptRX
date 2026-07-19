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
const STORE_NAME = 'Blackline Peptides';
const STORE_SLUG = 'blackline';
const SCOPE_CODE = 'BLACKLINE';
const LOGO_IMAGE = '/brands/blackline/blackline-logo.png';
const HERO_IMAGE = '/brands/blackline/blackline-hero.png';
const VIAL_IMAGE = '/brands/blackline/blackline-vial-placeholder.png';

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

export default function BlacklineStorefront() {
  usePageMeta(
    `${STORE_NAME} | Precision. Strength. Legacy.`,
    'Blackline Peptides premium research catalog powered by PepScriptRX checkout, inventory, and fulfillment.',
    HERO_IMAGE,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE_SLUG)), []);
  const featuredProducts = useMemo(() => FEATURED_IDS.map((id) => products.find((product) => product.id === id)).filter(Boolean) as DistributorCatalogProduct[], [products]);
  const groups = useMemo(() => buildGroups(products), [products]);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ProductGroup | 'all'>('all');
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [ageAccepted, setAgeAccepted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('blackline_age_gate_v1') === 'accepted';
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

  function acceptAgeGate() {
    window.localStorage.setItem('blackline_age_gate_v1', 'accepted');
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
    <PublicLayout isolatedPortal portalHomePath="/blackline" portalName={STORE_NAME} portalLogoSrc={LOGO_IMAGE} portalKey={STORE_SLUG}>
      <div className="blackline-store">
        {!ageAccepted && (
          <div className="blackline-age-gate" role="dialog" aria-modal="true" aria-label="Age verification">
            <div className="blackline-age-card">
              <img src={LOGO_IMAGE} alt={STORE_NAME} />
              <p>Age Verification</p>
              <h2>Blackline Peptides is intended for adults 21 and older.</h2>
              <span>Products are for research use only. This site does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</span>
              <button type="button" onClick={acceptAgeGate}>I am 21 or older</button>
              <Link to="/">Leave Store</Link>
            </div>
          </div>
        )}

        <section className="blackline-hero">
          <div className="blackline-shell blackline-hero-grid">
            <div className="blackline-hero-copy">
              <img src={LOGO_IMAGE} alt={STORE_NAME} className="blackline-hero-logo" />
              <p className="blackline-kicker">Precision. Strength. Legacy.</p>
              <h1>Blackline Peptides</h1>
              <p className="blackline-subhead">A premium research catalog with sharp product curation, secure checkout, and clear order support.</p>
              <div className="blackline-actions">
                <a className="blackline-btn blackline-btn-primary" href="#blackline-products">Shop Catalog</a>
                <Link className="blackline-btn blackline-btn-secondary" to="/blackline/certificates">Quality Docs</Link>
              </div>
            </div>
            <div className="blackline-hero-panel">
              <img src={VIAL_IMAGE} alt="Blackline Peptides vial" />
              <ProductPurityGuaranteeBadge compact />
            </div>
          </div>
        </section>

        <section className="blackline-band">
          <div className="blackline-shell blackline-band-grid">
            {[
              ['Secure Checkout', 'A simple, protected order experience from cart to confirmation.'],
              ['Focused Catalog', 'A sharp product collection with clear retail pricing and categories.'],
              ['Research Notice', 'Availability, eligibility, state rules, and fulfillment timing are confirmed through standard review.'],
            ].map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="blackline-section blackline-featured">
          <div className="blackline-shell">
            <div className="blackline-section-head">
              <p>Featured Selections</p>
              <h2>Built for metabolic, recovery, and performance research paths.</h2>
            </div>
            <div className="blackline-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} featured />
              ))}
            </div>
          </div>
        </section>

        <section className="blackline-section blackline-catalog" id="blackline-products">
          <div className="blackline-shell">
            <div className="blackline-catalog-toolbar">
              <div className="blackline-section-head">
                <p>Product Catalog</p>
                <h2>Search, filter, compare, and choose your selections.</h2>
              </div>
              <div className="blackline-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Blackline products" />
                <div className="blackline-segments" aria-label="Product filters">
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
              <div className="blackline-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} />
                ))}
              </div>
            ) : (
              <div className="blackline-empty">No products found. Try a different search or category.</div>
            )}
          </div>
        </section>

        <section className="blackline-story">
          <div className="blackline-shell blackline-story-grid">
            <img src={HERO_IMAGE} alt="Blackline branded studio and peptide display" />
            <div>
              <p className="blackline-kicker">Store Experience</p>
              <h2>Premium presentation from catalog to checkout.</h2>
              <p>Blackline keeps the shopping experience focused, polished, and easy to navigate, with product details and checkout support available along the way.</p>
              <div className="blackline-story-actions">
                <Link className="blackline-btn blackline-btn-primary" to="/blackline/mixing">Mixing Center</Link>
                <Link className="blackline-btn blackline-btn-dark" to="/blackline/library">Library</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="blackline-footer">
          <div className="blackline-shell">
            <img src={LOGO_IMAGE} alt={STORE_NAME} />
            <div>
              <strong>Required notices</strong>
              <p>Products are listed for research use only and are not intended to diagnose, treat, cure, or prevent disease. This storefront does not provide medical advice. Shipping, availability, eligibility, and fulfillment are subject to standard PepScriptRX review and applicable requirements.</p>
              <nav aria-label="Blackline footer links">
                <Link to="/blackline/privacy">Privacy</Link>
                <Link to="/blackline/terms">Terms</Link>
                <Link to="/blackline/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {detailProduct && (
          <ProductDetailModal product={detailProduct} qty={cart[detailProduct.id] ?? 0} addToCart={addToCart} setQty={setQty} close={() => setDetailProduct(null)} />
        )}

        {count > 0 && (
          <aside className="blackline-cart" aria-label="Blackline cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>{money(subtotal)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{BLACKLINE_STYLES}</style>
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
    <article className={featured ? 'blackline-product-card is-featured' : 'blackline-product-card'}>
      <div className="blackline-product-media">
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Blackline vial placeholder`} loading="lazy" />
        <span>{GROUP_COPY[productGroup].label}</span>
      </div>
      <div className="blackline-product-body">
        <h3>{meta.commonName}</h3>
        <p className="blackline-strength">{meta.doseLabel}</p>
        <p>{product.description || 'Blackline catalog item available through standard order review.'}</p>
        <div className="blackline-tags">
          {(product.badges ?? ['Research Use', 'Quality Reviewed']).slice(0, 3).map((badge) => <span key={badge}>{badge}</span>)}
        </div>
        <div className="blackline-product-footer">
          <strong>{price != null ? money(price) : 'Review'}</strong>
          <button type="button" onClick={() => openDetail(product)}>Details</button>
        </div>
        {qty > 0 ? (
          <div className="blackline-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="blackline-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
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
    <div className="blackline-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${meta.commonName} details`}>
      <div className="blackline-modal">
        <button className="blackline-modal-close" type="button" onClick={close} aria-label="Close product details">x</button>
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Blackline vial placeholder`} />
        <div>
          <p className="blackline-kicker">{product.category}</p>
          <h2>{meta.commonName}</h2>
          <strong>{meta.doseLabel}</strong>
          <p>{product.description}</p>
          <div className="blackline-detail-list">
            <span>SKU: {product.sku}</span>
            <span>Price: {money(product.displayPrice)}</span>
            <span>Fulfillment: Confirmed during order review</span>
            <span>Shipping: Confirmed during checkout and fulfillment review</span>
          </div>
          {qty > 0 ? (
            <div className="blackline-qty">
              <button type="button" onClick={() => setQty(product.id, qty - 1)}>-</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty(product.id, qty + 1)}>+</button>
            </div>
          ) : (
            <button className="blackline-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
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

const BLACKLINE_STYLES = `
  :root {
    --blackline-black: #050505;
    --blackline-ink: #0b0b0d;
    --blackline-panel: #141416;
    --blackline-gunmetal: #272a2e;
    --blackline-silver: #d5d7da;
    --blackline-muted: #a4a7ad;
    --blackline-red: #b1121d;
    --blackline-red-bright: #e31d2d;
    --blackline-line: rgba(213, 215, 218, .18);
  }
  .blackline-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .blackline-store { min-height: 100vh; color: var(--blackline-silver); background: var(--blackline-black); overflow-x: clip; }
  .blackline-hero { position: relative; min-height: 84vh; display: grid; align-items: center; padding: clamp(42px, 7vw, 88px) 0 38px; background:
    linear-gradient(95deg, rgba(5,5,5,.98) 0%, rgba(5,5,5,.88) 43%, rgba(5,5,5,.30) 100%),
    url('/brands/blackline/blackline-hero.png') center / cover no-repeat; border-bottom: 1px solid rgba(177,18,29,.42); isolation: isolate; }
  .blackline-hero::after, .blackline-story::after { content: ""; position: absolute; inset: 0; pointer-events: none; background:
    repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 1px, transparent 1px 14px),
    linear-gradient(120deg, transparent 0 38%, rgba(177,18,29,.18) 52%, transparent 70%); opacity: .42; mix-blend-mode: screen; }
  .blackline-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, .92fr) minmax(320px, .86fr); gap: clamp(28px, 6vw, 66px); align-items: center; }
  .blackline-hero-copy { display: grid; gap: 16px; align-content: center; }
  .blackline-hero-logo { width: min(340px, 78vw); height: auto; display: block; border-radius: 8px; background: rgba(0,0,0,.74); border: 1px solid rgba(213,215,218,.22); box-shadow: 0 24px 70px rgba(0,0,0,.64), 0 0 34px rgba(177,18,29,.22); }
  .blackline-kicker { margin: 0; color: var(--blackline-red-bright); font-size: 12px; font-weight: 950; letter-spacing: .18em; text-transform: uppercase; }
  .blackline-hero h1 { margin: 0; color: #fff; font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(48px, 8vw, 96px); line-height: .92; letter-spacing: .02em; text-transform: uppercase; text-shadow: 0 20px 56px rgba(0,0,0,.8); }
  .blackline-subhead { margin: 0; max-width: 670px; color: #f4f4f5; font-size: clamp(17px, 2.1vw, 23px); line-height: 1.55; }
  .blackline-actions, .blackline-story-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .blackline-btn, .blackline-add, .blackline-cart button, .blackline-segments button, .blackline-product-footer button, .blackline-age-card button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .blackline-btn:hover, .blackline-add:hover, .blackline-cart button:hover, .blackline-segments button:hover, .blackline-product-footer button:hover, .blackline-age-card button:hover { transform: translateY(-1px); }
  .blackline-btn-primary, .blackline-add, .blackline-cart button, .blackline-age-card button { background: linear-gradient(135deg, var(--blackline-red-bright), #760d15); color: #fff; box-shadow: 0 18px 42px rgba(177,18,29,.28); }
  .blackline-btn-secondary { background: rgba(16,16,18,.82); color: #fff; border-color: rgba(213,215,218,.32); backdrop-filter: blur(12px); }
  .blackline-btn-dark { color: #fff; background: rgba(5,5,5,.72); border-color: rgba(177,18,29,.44); }
  .blackline-hero-panel { justify-self: end; width: min(430px, 100%); border: 1px solid rgba(213,215,218,.24); border-radius: 8px; overflow: hidden; background: rgba(5,5,5,.72); box-shadow: 0 34px 90px rgba(0,0,0,.66), 0 0 42px rgba(177,18,29,.16); }
  .blackline-hero-panel img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; object-position: center; }
  .blackline-band { padding: 18px 0; background: #0a0a0b; border-bottom: 1px solid rgba(177,18,29,.28); }
  .blackline-band-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .blackline-band article { border: 1px solid var(--blackline-line); border-radius: 8px; background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025)); padding: 16px; display: grid; gap: 5px; }
  .blackline-band strong { color: #fff; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
  .blackline-band span { color: var(--blackline-muted); font-size: 13px; line-height: 1.5; }
  .blackline-section { padding: clamp(46px, 7vw, 78px) 0; }
  .blackline-featured { background: linear-gradient(180deg, #080809, #141416); }
  .blackline-catalog { background: linear-gradient(180deg, #141416, #080809); }
  .blackline-section-head { max-width: 800px; margin: 0 0 24px; }
  .blackline-section-head p { margin: 0 0 8px; color: var(--blackline-red-bright); font-size: 12px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
  .blackline-section-head h2 { margin: 0; color: #fff; font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(31px, 4.6vw, 58px); line-height: 1; letter-spacing: .02em; text-transform: uppercase; text-wrap: balance; }
  .blackline-featured-grid, .blackline-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .blackline-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .86fr) minmax(320px, 1.14fr); gap: 22px; align-items: end; margin-bottom: 28px; }
  .blackline-filter-stack { display: grid; gap: 12px; }
  .blackline-filter-stack input { min-height: 46px; border: 1px solid rgba(213,215,218,.22); border-radius: 8px; padding: 0 14px; color: #fff; background: rgba(5,5,5,.64); outline: none; }
  .blackline-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .blackline-segments button { min-height: 40px; background: rgba(255,255,255,.06); color: var(--blackline-silver); border-color: var(--blackline-line); padding: 8px 12px; font-size: 12px; }
  .blackline-segments button.is-active { background: var(--blackline-red); color: #fff; border-color: rgba(227,29,45,.72); box-shadow: 0 14px 32px rgba(177,18,29,.22); }
  .blackline-product-card, .blackline-empty { border: 1px solid rgba(213,215,218,.16); border-radius: 8px; background: linear-gradient(180deg, #18181b, #0b0b0d); box-shadow: 0 22px 58px rgba(0,0,0,.38); }
  .blackline-product-card { overflow: hidden; display: grid; grid-template-rows: 246px 1fr; min-height: 656px; }
  .blackline-product-card.is-featured { border-color: rgba(227,29,45,.46); box-shadow: 0 26px 70px rgba(0,0,0,.48), 0 0 32px rgba(177,18,29,.16); }
  .blackline-product-media { position: relative; background: #050505; border-bottom: 1px solid rgba(177,18,29,.30); }
  .blackline-product-media img { width: 100%; height: 246px; object-fit: cover; object-position: center; display: block; }
  .blackline-product-media span { position: absolute; left: 12px; top: 12px; border: 1px solid rgba(227,29,45,.52); border-radius: 999px; background: rgba(5,5,5,.86); color: #fff; padding: 6px 9px; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .blackline-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .blackline-product-body h3 { margin: 0; color: #fff; font-size: 25px; line-height: 1.1; font-weight: 950; text-transform: uppercase; }
  .blackline-strength { margin: -5px 0 0; color: var(--blackline-red-bright); font-weight: 950; }
  .blackline-product-body p { margin: 0; color: var(--blackline-muted); font-size: 14px; line-height: 1.58; }
  .blackline-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .blackline-tags span { border: 1px solid rgba(213,215,218,.16); border-radius: 999px; background: rgba(255,255,255,.055); color: var(--blackline-silver); padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .blackline-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .blackline-product-footer strong { color: #fff; font-size: 25px; }
  .blackline-product-footer button { min-height: 36px; padding: 7px 11px; color: #fff; background: rgba(255,255,255,.06); border-color: rgba(213,215,218,.22); font-size: 12px; }
  .blackline-add { width: 100%; }
  .blackline-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(213,215,218,.22); border-radius: 8px; overflow: hidden; }
  .blackline-qty button { height: 44px; border: 0; background: rgba(177,18,29,.24); color: #fff; font-size: 20px; font-weight: 950; cursor: pointer; }
  .blackline-qty span { text-align: center; color: #fff; font-weight: 950; }
  .blackline-empty { padding: 24px; font-weight: 800; color: var(--blackline-muted); }
  .blackline-story { position: relative; padding: clamp(48px, 7vw, 78px) 0; background: linear-gradient(135deg, #050505, #1b1b1e); color: #fff; border-top: 1px solid rgba(177,18,29,.28); border-bottom: 1px solid rgba(177,18,29,.28); overflow: hidden; }
  .blackline-story-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(280px, 1.12fr) minmax(0, .88fr); gap: clamp(22px, 5vw, 52px); align-items: center; }
  .blackline-story img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(213,215,218,.22); border-radius: 8px; box-shadow: 0 28px 78px rgba(0,0,0,.48); background: #050505; }
  .blackline-story h2 { margin: 8px 0 12px; color: #fff; font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(34px, 5vw, 62px); line-height: 1; letter-spacing: .02em; text-transform: uppercase; }
  .blackline-story p { margin: 0; color: var(--blackline-muted); line-height: 1.75; }
  .blackline-footer { padding: 28px 0 96px; background: #050505; color: #fff; }
  .blackline-footer .blackline-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
  .blackline-footer img { width: 150px; max-width: 100%; border-radius: 8px; display: block; }
  .blackline-footer strong { display: block; margin-bottom: 7px; }
  .blackline-footer p { margin: 0; color: var(--blackline-muted); font-size: 13px; line-height: 1.75; }
  .blackline-footer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .blackline-footer a { color: var(--blackline-red-bright); font-size: 13px; font-weight: 900; }
  .blackline-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(5,5,5,.96); color: #fff; border: 1px solid rgba(227,29,45,.58); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(0,0,0,.54); backdrop-filter: blur(12px); }
  .blackline-cart div { display: grid; gap: 2px; }
  .blackline-cart span { color: var(--blackline-red-bright); font-weight: 950; }
  .blackline-age-gate, .blackline-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(0,0,0,.78); backdrop-filter: blur(14px); }
  .blackline-age-card, .blackline-modal { width: min(520px, 100%); border: 1px solid rgba(227,29,45,.42); border-radius: 8px; background: linear-gradient(180deg, #151518, #060607); box-shadow: 0 34px 100px rgba(0,0,0,.68); padding: 24px; }
  .blackline-age-card { display: grid; gap: 13px; text-align: center; justify-items: center; }
  .blackline-age-card img { width: min(260px, 72vw); border-radius: 8px; }
  .blackline-age-card p { margin: 0; color: var(--blackline-red-bright); font-weight: 950; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; }
  .blackline-age-card h2 { margin: 0; color: #fff; font-size: 28px; line-height: 1.15; }
  .blackline-age-card span { color: var(--blackline-muted); line-height: 1.6; }
  .blackline-age-card a { color: var(--blackline-muted); font-weight: 800; }
  .blackline-modal { position: relative; display: grid; grid-template-columns: minmax(160px, .78fr) minmax(0, 1.22fr); gap: 20px; width: min(820px, 100%); text-align: left; }
  .blackline-modal > img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 8px; border: 1px solid var(--blackline-line); }
  .blackline-modal h2 { margin: 4px 0 4px; color: #fff; font-size: clamp(30px, 4vw, 48px); line-height: 1; text-transform: uppercase; }
  .blackline-modal strong { color: var(--blackline-red-bright); }
  .blackline-modal p { color: var(--blackline-muted); line-height: 1.65; }
  .blackline-modal-close { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--blackline-line); color: #fff; background: rgba(0,0,0,.64); cursor: pointer; }
  .blackline-detail-list { display: grid; gap: 7px; margin: 12px 0; }
  .blackline-detail-list span { border: 1px solid var(--blackline-line); border-radius: 8px; padding: 8px 10px; color: var(--blackline-silver); background: rgba(255,255,255,.045); font-size: 13px; }
  @media (max-width: 940px) {
    .blackline-hero { min-height: 0; background-position: 62% center; }
    .blackline-hero-grid, .blackline-catalog-toolbar, .blackline-story-grid, .blackline-modal { grid-template-columns: 1fr; }
    .blackline-hero-copy { text-align: center; justify-items: center; }
    .blackline-hero-panel { justify-self: center; }
    .blackline-actions, .blackline-story-actions, .blackline-segments { width: 100%; justify-content: center; }
    .blackline-actions .blackline-btn, .blackline-story-actions .blackline-btn, .blackline-segments button { flex: 1 1 160px; }
    .blackline-band-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .blackline-shell { width: min(100% - 24px, 1180px); }
    .blackline-hero h1 { font-size: 42px; }
    .blackline-hero-logo { width: min(270px, 76vw); }
    .blackline-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .blackline-product-media img { height: 220px; }
    .blackline-footer .blackline-shell { grid-template-columns: 1fr; }
    .blackline-footer img { width: 132px; }
    .blackline-cart { align-items: stretch; flex-direction: column; }
    .blackline-cart button { width: 100%; }
  }
`;
