import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { thePLoungeStorefront } from '../../config/thePLounge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'glp' | 'recovery' | 'optional' | 'supplies';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE = thePLoungeStorefront;
const FEATURED_IDS = [
  'retatrutide-30mg',
  'tirzepatide-30mg',
  'cagrisema',
  'wolverine-bpc-tb',
  'nad-1000mg',
  'glow-peptide-blend',
];

const GROUP_COPY: Record<ProductGroup, { label: string; short: string }> = {
  glp: {
    label: 'GLP / Weight Management',
    short: 'Metabolic research selections curated for a boutique wellness experience.',
  },
  recovery: {
    label: 'Recovery & Wellness',
    short: 'Repair, radiance, cellular wellness, and performance-support categories.',
  },
  optional: {
    label: 'Optional Catalog',
    short: 'Additional wellness selections available through standard review.',
  },
  supplies: {
    label: 'Supplies',
    short: 'Add-ons for eligible research orders.',
  },
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

function customerDescription(description: string) {
  return description
    .replace(/sourced through central platform inventory/gi, 'available through curated inventory review')
    .replace(/standard platform review/gi, 'standard order review')
    .replace(/platform review/gi, 'order review')
    .replace(/configured for The P Lounge catalog/gi, 'selected for The P Lounge')
    .replace(/configured for The P Lounge/gi, 'selected for The P Lounge')
    .replace(/The P Lounge catalog item/gi, 'The P Lounge selection');
}

export default function ThePLoungeStorefront() {
  usePageMeta(
    `${STORE.brandName} | Elevated Wellness`,
    'The P Lounge luxury wellness collection with secure checkout, curated product browsing, and refined customer support.',
    STORE.assets.hero,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE.slug)), []);
  const featuredProducts = useMemo(() => FEATURED_IDS.map((id) => products.find((product) => product.id === id)).filter(Boolean) as DistributorCatalogProduct[], [products]);
  const groups = useMemo(() => buildGroups(products), [products]);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ProductGroup | 'all'>('all');
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [ageAccepted, setAgeAccepted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('the_p_lounge_age_gate_v1') === 'accepted';
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
    window.localStorage.setItem('the_p_lounge_age_gate_v1', 'accepted');
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
      admin_code: STORE.scopeCode,
      admin_scope: STORE.scopeCode,
      account_type: 'admin',
      parent_type: 'platform_direct_whitelabel_store',
      commission_owner: STORE.scopeCode,
      commission_type: STORE.commissionType,
      commission_rate: STORE.commissionRate,
      partner_payout_eligible: true,
      platform_allocation: STORE.platformShare,
      store_owner_allocation: STORE.commissionRate,
      partner_commission: STORE.commissionRate,
      rep_commission: 0,
      downline_commission: 0,
      override_commission: 0,
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
    <PublicLayout isolatedPortal portalHomePath="/the-p-lounge" portalName={STORE.brandName} portalLogoSrc={STORE.assets.logo} portalKey={STORE.slug}>
      <div className="plounge-store">
        {!ageAccepted && (
          <div className="plounge-age-gate" role="dialog" aria-modal="true" aria-label="Age verification">
            <div className="plounge-age-card">
              <img src={STORE.assets.logo} alt={STORE.brandName} />
              <p>Age Verification</p>
              <h2>{STORE.brandName} is intended for adults 21 and older.</h2>
              <span>Products are for research use only. This storefront does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</span>
              <button type="button" onClick={acceptAgeGate}>I am 21 or older</button>
              <Link to="/">Leave Store</Link>
            </div>
          </div>
        )}

        <section className="plounge-hero">
          <div className="plounge-shell plounge-hero-grid">
            <div className="plounge-hero-copy">
              <img src={STORE.assets.logo} alt={STORE.brandName} className="plounge-hero-logo" />
              <p className="plounge-kicker">Luxury Wellness Collection</p>
              <h1>Welcome to The P Lounge</h1>
              <p className="plounge-subhead">Elevated Wellness. Beautifully Curated.</p>
              <div className="plounge-actions">
                <a className="plounge-btn plounge-btn-primary" href="#plounge-products">Explore the Collection</a>
                <a className="plounge-btn plounge-btn-secondary" href="#plounge-products">Shop All Products</a>
              </div>
            </div>
          </div>
        </section>

        <section className="plounge-band">
          <div className="plounge-shell plounge-band-grid">
            {[
              ['Secure Checkout', 'A simple, protected order experience from cart to confirmation.'],
              ['Boutique Curation', 'A focused product collection selected for a polished wellness routine.'],
              ['Quality Minded', 'Clear research-use notices, age verification, and product documentation stay within reach.'],
            ].map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="plounge-film-section">
          <div className="plounge-shell plounge-film-grid">
            <div>
              <p className="plounge-kicker">Inside The Lounge</p>
              <h2>A calm, elevated way to shop the collection.</h2>
              <p>Browse a refined catalog, review each selection clearly, and complete checkout when you are ready.</p>
              <a className="plounge-btn plounge-btn-primary" href="#plounge-products">View Products</a>
            </div>
            <video className="plounge-film" src={STORE.assets.film} poster={STORE.assets.lounge} autoPlay muted loop playsInline controls />
          </div>
        </section>

        <section className="plounge-section plounge-featured">
          <div className="plounge-shell">
            <div className="plounge-section-head">
              <p>Featured Collection</p>
              <h2>Signature selections for a refined wellness routine.</h2>
            </div>
            <div className="plounge-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} featured />
              ))}
            </div>
          </div>
        </section>

        <section className="plounge-section plounge-collections">
          <div className="plounge-shell">
            <div className="plounge-section-head">
              <p>Shop by Category</p>
              <h2>Choose your collection path.</h2>
            </div>
            <div className="plounge-collection-grid">
              {groups.map(({ group: productGroup, count: productCount }) => (
                <button key={productGroup} type="button" className={group === productGroup ? 'is-active' : ''} onClick={() => setGroup(productGroup)}>
                  <span>{GROUP_COPY[productGroup].label}</span>
                  <strong>{productCount} product{productCount === 1 ? '' : 's'}</strong>
                  <small>{GROUP_COPY[productGroup].short}</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="plounge-section plounge-catalog" id="plounge-products">
          <div className="plounge-shell">
            <div className="plounge-catalog-toolbar">
              <div className="plounge-section-head">
                <p>Product Catalog</p>
                <h2>Search, filter, compare, and choose your selections.</h2>
              </div>
              <div className="plounge-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search The P Lounge products" />
                <div className="plounge-segments" aria-label="Product filters">
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
              <div className="plounge-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} openDetail={setDetailProduct} />
                ))}
              </div>
            ) : (
              <div className="plounge-empty">No products found. Try a different search or category.</div>
            )}
          </div>
        </section>

        <section className="plounge-story">
          <div className="plounge-shell plounge-story-grid">
            <img src={STORE.assets.lounge} alt="Customers browsing The P Lounge wellness collection" />
            <div>
              <p className="plounge-kicker">Luxury Lounge Experience</p>
              <h2>Designed for a more polished wellness visit.</h2>
              <p>The P Lounge brings a boutique feel to product browsing, with clear product details, secure checkout, and order support after purchase.</p>
              <div className="plounge-story-actions">
                <Link className="plounge-btn plounge-btn-primary" to="/the-p-lounge/mixing">Mixing Center</Link>
                <Link className="plounge-btn plounge-btn-dark" to="/the-p-lounge/library">Library</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="plounge-footer">
          <div className="plounge-shell">
            <img src={STORE.assets.logo} alt={STORE.brandName} />
            <div>
              <strong>Required notices</strong>
              <p>Products are listed for research use only and are not intended to diagnose, treat, cure, or prevent disease. This storefront does not provide medical advice. Shipping, availability, eligibility, and fulfillment are subject to standard PepScriptRX review and applicable requirements.</p>
              <nav aria-label="The P Lounge footer links">
                <Link to="/the-p-lounge/privacy">Privacy</Link>
                <Link to="/the-p-lounge/terms">Terms</Link>
                <Link to="/the-p-lounge/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {detailProduct && (
          <ProductDetailModal product={detailProduct} qty={cart[detailProduct.id] ?? 0} addToCart={addToCart} setQty={setQty} close={() => setDetailProduct(null)} />
        )}

        {count > 0 && (
          <aside className="plounge-cart" aria-label="The P Lounge cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>{money(subtotal)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{P_LOUNGE_STYLES}</style>
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
    <article className={featured ? 'plounge-product-card is-featured' : 'plounge-product-card'}>
      <div className="plounge-product-media">
        <img src={STORE.assets.productPlaceholder} alt={`${meta.commonName} The P Lounge vial placeholder`} loading="lazy" />
        <span>{GROUP_COPY[productGroup].label}</span>
      </div>
      <div className="plounge-product-body">
        <h3>{meta.commonName}</h3>
        <p className="plounge-strength">{meta.doseLabel}</p>
        <p>{customerDescription(product.description || 'The P Lounge catalog item available through standard order review.')}</p>
        <div className="plounge-tags">
          {(product.badges ?? ['Research Use', 'Quality Reviewed']).slice(0, 3).map((badge) => <span key={badge}>{badge}</span>)}
        </div>
        <div className="plounge-product-footer">
          <strong>{price != null ? money(price) : 'Review'}</strong>
          <button type="button" onClick={() => openDetail(product)}>Details</button>
        </div>
        {qty > 0 ? (
          <div className="plounge-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="plounge-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
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
    <div className="plounge-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${meta.commonName} details`}>
      <div className="plounge-modal">
        <button className="plounge-modal-close" type="button" onClick={close} aria-label="Close product details">x</button>
        <img src={STORE.assets.productPlaceholder} alt={`${meta.commonName} The P Lounge vial placeholder`} />
        <div>
          <p className="plounge-kicker">{product.category}</p>
          <h2>{meta.commonName}</h2>
          <strong>{meta.doseLabel}</strong>
          <p>{customerDescription(product.description)}</p>
          <div className="plounge-detail-list">
            <span>SKU: {product.sku}</span>
            <span>Price: {money(product.displayPrice)}</span>
            <span>Fulfillment: Confirmed during order review</span>
            <span>Shipping: Confirmed during checkout and fulfillment review</span>
          </div>
          {qty > 0 ? (
            <div className="plounge-qty">
              <button type="button" onClick={() => setQty(product.id, qty - 1)}>-</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty(product.id, qty + 1)}>+</button>
            </div>
          ) : (
            <button className="plounge-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
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
  if (productGroup === 'glp') return 100;
  if (productGroup === 'recovery') return 200;
  if (productGroup === 'optional') return 300;
  return 400;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category} ${product.description}`.toLowerCase();
  if (text.includes('supplies') || text.includes('syringe') || text.includes('bac water') || text.includes('pen kit')) return 'supplies';
  if (text.includes('optional') || text.includes('pt-141') || text.includes('melanotan') || text.includes('epitalon') || text.includes('epithalon') || text.includes('ss-31') || text.includes('kisspeptin') || text.includes('thymosin') || text.includes('dsip') || text.includes('selank') || text.includes('semax') || text.includes('ll-37')) return 'optional';
  if (text.includes('tirzep') || text.includes('sema') || text.includes('reta') || text.includes('cagri') || text.includes('glp')) return 'glp';
  return 'recovery';
}

function buildGroups(products: DistributorCatalogProduct[]) {
  const counts = products.reduce((acc, product) => {
    const productGroup = groupForProduct(product);
    acc[productGroup] = (acc[productGroup] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ProductGroup, number>>);
  const order: ProductGroup[] = ['glp', 'recovery', 'optional', 'supplies'];
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

const P_LOUNGE_STYLES = `
  :root {
    --plounge-ivory: #fffaf0;
    --plounge-cream: #f7ecd7;
    --plounge-champagne: #d8af4f;
    --plounge-gold: #b98322;
    --plounge-ink: #111111;
    --plounge-muted: #6d6253;
    --plounge-line: rgba(185, 131, 34, .28);
  }
  .plounge-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .plounge-store { min-height: 100vh; color: var(--plounge-ink); background: var(--plounge-ivory); overflow-x: clip; }
  .plounge-hero { position: relative; min-height: min(86vh, 860px); display: grid; align-items: center; padding: clamp(54px, 8vw, 96px) 0 48px; background:
    linear-gradient(90deg, rgba(255,250,240,.08) 0%, rgba(255,250,240,.34) 45%, rgba(255,250,240,.88) 67%, rgba(255,250,240,.98) 100%),
    url('/brands/the-p-lounge/the-p-lounge-hero.png') center / cover no-repeat; border-bottom: 1px solid var(--plounge-line); }
  .plounge-hero-grid { display: grid; grid-template-columns: minmax(0, .96fr) minmax(360px, .82fr); align-items: center; }
  .plounge-hero-copy { grid-column: 2; display: grid; gap: 16px; justify-items: start; max-width: 570px; }
  .plounge-hero-logo { width: min(290px, 74vw); height: auto; display: block; background: rgba(255,255,255,.88); border: 1px solid var(--plounge-line); border-radius: 8px; box-shadow: 0 20px 56px rgba(85,61,18,.16); }
  .plounge-kicker { margin: 0; color: var(--plounge-gold); font-size: 12px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
  .plounge-hero h1, .plounge-section-head h2, .plounge-film-section h2, .plounge-story h2, .plounge-modal h2 { margin: 0; color: var(--plounge-ink); font-family: Georgia, 'Times New Roman', serif; font-weight: 500; line-height: .98; letter-spacing: 0; text-wrap: balance; }
  .plounge-hero h1 { font-size: clamp(48px, 7vw, 92px); }
  .plounge-subhead { margin: 0; color: #1f1b17; font-size: clamp(18px, 2.3vw, 25px); line-height: 1.55; }
  .plounge-actions, .plounge-story-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .plounge-btn, .plounge-add, .plounge-cart button, .plounge-segments button, .plounge-product-footer button, .plounge-age-card button, .plounge-collection-grid button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .plounge-btn:hover, .plounge-add:hover, .plounge-cart button:hover, .plounge-segments button:hover, .plounge-product-footer button:hover, .plounge-age-card button:hover, .plounge-collection-grid button:hover { transform: translateY(-1px); }
  .plounge-btn-primary, .plounge-add, .plounge-cart button, .plounge-age-card button { background: linear-gradient(135deg, #19130d, #b98322); color: #fff; box-shadow: 0 18px 42px rgba(185,131,34,.24); }
  .plounge-btn-secondary { background: rgba(255,255,255,.76); color: var(--plounge-ink); border-color: var(--plounge-line); backdrop-filter: blur(10px); }
  .plounge-btn-dark { color: #fff; background: #14100c; border-color: rgba(216,175,79,.42); }
  .plounge-band { padding: 18px 0; background: #fffdf8; border-bottom: 1px solid var(--plounge-line); }
  .plounge-band-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .plounge-band article { border: 1px solid var(--plounge-line); border-radius: 8px; background: rgba(255,250,240,.82); padding: 16px; display: grid; gap: 5px; box-shadow: 0 18px 38px rgba(85,61,18,.08); }
  .plounge-band strong { color: var(--plounge-ink); font-size: 13px; text-transform: uppercase; }
  .plounge-band span { color: var(--plounge-muted); font-size: 13px; line-height: 1.5; }
  .plounge-film-section { padding: clamp(48px, 7vw, 86px) 0; background: linear-gradient(180deg, #14100c, #241910); color: #fffaf0; border-bottom: 1px solid rgba(216,175,79,.32); }
  .plounge-film-grid { display: grid; grid-template-columns: minmax(280px, .78fr) minmax(320px, 1.22fr); gap: clamp(22px, 5vw, 54px); align-items: center; }
  .plounge-film-section h2 { margin-top: 10px; color: #fffaf0; font-size: clamp(34px, 5vw, 62px); }
  .plounge-film-section p:not(.plounge-kicker) { margin: 14px 0 22px; color: #ddccb0; line-height: 1.72; font-size: 16px; }
  .plounge-film { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(216,175,79,.34); border-radius: 8px; background: #090706; box-shadow: 0 30px 84px rgba(0,0,0,.36); }
  .plounge-section { padding: clamp(48px, 7vw, 82px) 0; }
  .plounge-featured { background: linear-gradient(180deg, #fffaf0, #f5ead6); }
  .plounge-collections { background: #fffdf8; }
  .plounge-catalog { background: linear-gradient(180deg, #fffdf8, #f3e7d0); }
  .plounge-section-head { max-width: 820px; margin: 0 0 24px; }
  .plounge-section-head p { margin: 0 0 8px; color: var(--plounge-gold); font-size: 12px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
  .plounge-section-head h2 { font-size: clamp(32px, 4.8vw, 60px); }
  .plounge-featured-grid, .plounge-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .plounge-collection-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .plounge-collection-grid button { min-height: 150px; align-items: flex-start; flex-direction: column; gap: 8px; text-align: left; color: var(--plounge-ink); background: rgba(255,255,255,.8); border-color: var(--plounge-line); box-shadow: 0 18px 42px rgba(85,61,18,.08); }
  .plounge-collection-grid button.is-active { background: #19130d; color: #fff; border-color: rgba(216,175,79,.58); }
  .plounge-collection-grid span { color: var(--plounge-gold); font-weight: 950; font-size: 12px; text-transform: uppercase; }
  .plounge-collection-grid strong { font-size: 22px; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  .plounge-collection-grid small { color: inherit; opacity: .72; line-height: 1.45; }
  .plounge-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .86fr) minmax(320px, 1.14fr); gap: 22px; align-items: end; margin-bottom: 28px; }
  .plounge-filter-stack { display: grid; gap: 12px; }
  .plounge-filter-stack input { min-height: 46px; border: 1px solid var(--plounge-line); border-radius: 8px; padding: 0 14px; color: var(--plounge-ink); background: rgba(255,255,255,.9); outline: none; }
  .plounge-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .plounge-segments button { min-height: 40px; background: rgba(255,255,255,.78); color: var(--plounge-ink); border-color: var(--plounge-line); padding: 8px 12px; font-size: 12px; }
  .plounge-segments button.is-active { background: #19130d; color: #fff; border-color: rgba(216,175,79,.72); box-shadow: 0 14px 32px rgba(185,131,34,.18); }
  .plounge-product-card, .plounge-empty { border: 1px solid rgba(185,131,34,.22); border-radius: 8px; background: rgba(255,255,255,.84); box-shadow: 0 22px 58px rgba(85,61,18,.12); }
  .plounge-product-card { overflow: hidden; display: grid; grid-template-rows: 246px 1fr; min-height: 650px; }
  .plounge-product-card.is-featured { border-color: rgba(185,131,34,.48); box-shadow: 0 26px 72px rgba(85,61,18,.18); }
  .plounge-product-media { position: relative; background: radial-gradient(circle at center, #fff9e8, #f1dfbf); border-bottom: 1px solid rgba(185,131,34,.24); }
  .plounge-product-media img { width: 100%; height: 246px; object-fit: contain; object-position: center; display: block; padding: 16px; }
  .plounge-product-media span { position: absolute; left: 12px; top: 12px; border: 1px solid rgba(185,131,34,.42); border-radius: 999px; background: rgba(255,255,255,.88); color: var(--plounge-ink); padding: 6px 9px; font-size: 11px; font-weight: 950; }
  .plounge-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .plounge-product-body h3 { margin: 0; color: var(--plounge-ink); font-size: 25px; line-height: 1.1; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  .plounge-strength { margin: -5px 0 0; color: var(--plounge-gold); font-weight: 950; }
  .plounge-product-body p { margin: 0; color: var(--plounge-muted); font-size: 14px; line-height: 1.58; }
  .plounge-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .plounge-tags span { border: 1px solid rgba(185,131,34,.18); border-radius: 999px; background: rgba(255,250,240,.86); color: var(--plounge-muted); padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .plounge-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .plounge-product-footer strong { color: var(--plounge-ink); font-size: 25px; }
  .plounge-product-footer button { min-height: 36px; padding: 7px 11px; color: var(--plounge-ink); background: rgba(255,255,255,.86); border-color: var(--plounge-line); font-size: 12px; }
  .plounge-add { width: 100%; }
  .plounge-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid var(--plounge-line); border-radius: 8px; overflow: hidden; }
  .plounge-qty button { height: 44px; border: 0; background: rgba(185,131,34,.18); color: var(--plounge-ink); font-size: 20px; font-weight: 950; cursor: pointer; }
  .plounge-qty span { text-align: center; color: var(--plounge-ink); font-weight: 950; }
  .plounge-empty { padding: 24px; font-weight: 800; color: var(--plounge-muted); }
  .plounge-story { padding: clamp(48px, 7vw, 78px) 0; background: #16110c; color: #fff; border-top: 1px solid rgba(216,175,79,.32); border-bottom: 1px solid rgba(216,175,79,.32); }
  .plounge-story-grid { display: grid; grid-template-columns: minmax(280px, 1.12fr) minmax(0, .88fr); gap: clamp(22px, 5vw, 52px); align-items: center; }
  .plounge-story img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(216,175,79,.26); border-radius: 8px; box-shadow: 0 28px 78px rgba(0,0,0,.32); background: #fffaf0; }
  .plounge-story h2 { color: #fffaf0; font-size: clamp(34px, 5vw, 62px); }
  .plounge-story p { margin: 12px 0 0; color: #d9c7a9; line-height: 1.75; }
  .plounge-footer { padding: 28px 0 96px; background: #fffaf0; color: var(--plounge-ink); }
  .plounge-footer .plounge-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
  .plounge-footer img { width: 150px; max-width: 100%; border-radius: 8px; display: block; }
  .plounge-footer strong { display: block; margin-bottom: 7px; }
  .plounge-footer p { margin: 0; color: var(--plounge-muted); font-size: 13px; line-height: 1.75; }
  .plounge-footer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .plounge-footer a { color: var(--plounge-gold); font-size: 13px; font-weight: 900; }
  .plounge-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(255,250,240,.96); color: var(--plounge-ink); border: 1px solid rgba(185,131,34,.58); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(85,61,18,.24); backdrop-filter: blur(12px); }
  .plounge-cart div { display: grid; gap: 2px; }
  .plounge-cart span { color: var(--plounge-gold); font-weight: 950; }
  .plounge-age-gate, .plounge-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(20,16,12,.62); backdrop-filter: blur(14px); }
  .plounge-age-card, .plounge-modal { width: min(520px, 100%); border: 1px solid rgba(216,175,79,.42); border-radius: 8px; background: #fffaf0; box-shadow: 0 34px 100px rgba(20,16,12,.32); padding: 24px; }
  .plounge-age-card { display: grid; gap: 13px; text-align: center; justify-items: center; }
  .plounge-age-card img { width: min(260px, 72vw); border-radius: 8px; }
  .plounge-age-card p { margin: 0; color: var(--plounge-gold); font-weight: 950; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; }
  .plounge-age-card h2 { margin: 0; color: var(--plounge-ink); font-size: 28px; line-height: 1.15; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  .plounge-age-card span { color: var(--plounge-muted); line-height: 1.6; }
  .plounge-age-card a { color: var(--plounge-muted); font-weight: 800; }
  .plounge-modal { position: relative; display: grid; grid-template-columns: minmax(160px, .78fr) minmax(0, 1.22fr); gap: 20px; width: min(820px, 100%); text-align: left; }
  .plounge-modal > img { width: 100%; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 8px; border: 1px solid var(--plounge-line); background: #fff6e3; padding: 12px; }
  .plounge-modal h2 { margin: 4px 0 4px; font-size: clamp(30px, 4vw, 48px); }
  .plounge-modal strong { color: var(--plounge-gold); }
  .plounge-modal p { color: var(--plounge-muted); line-height: 1.65; }
  .plounge-modal-close { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--plounge-line); color: var(--plounge-ink); background: rgba(255,255,255,.86); cursor: pointer; }
  .plounge-detail-list { display: grid; gap: 7px; margin: 12px 0; }
  .plounge-detail-list span { border: 1px solid var(--plounge-line); border-radius: 8px; padding: 8px 10px; color: var(--plounge-muted); background: rgba(255,255,255,.72); font-size: 13px; }
  @media (max-width: 940px) {
    .plounge-hero { min-height: 0; background-position: 38% center; }
    .plounge-hero-grid, .plounge-catalog-toolbar, .plounge-film-grid, .plounge-story-grid, .plounge-modal { grid-template-columns: 1fr; }
    .plounge-hero-copy { grid-column: 1; text-align: center; justify-items: center; padding: 24px; background: rgba(255,250,240,.82); border: 1px solid var(--plounge-line); border-radius: 8px; }
    .plounge-actions, .plounge-story-actions, .plounge-segments { width: 100%; justify-content: center; }
    .plounge-actions .plounge-btn, .plounge-story-actions .plounge-btn, .plounge-segments button { flex: 1 1 160px; }
    .plounge-band-grid, .plounge-collection-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .plounge-shell { width: min(100% - 24px, 1180px); }
    .plounge-hero { background-position: 34% center; }
    .plounge-hero h1 { font-size: 43px; }
    .plounge-hero-logo { width: min(250px, 72vw); }
    .plounge-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .plounge-product-media img { height: 220px; }
    .plounge-footer .plounge-shell { grid-template-columns: 1fr; }
    .plounge-footer img { width: 132px; }
    .plounge-cart { align-items: stretch; flex-direction: column; }
    .plounge-cart button { width: 100%; }
  }
`;
