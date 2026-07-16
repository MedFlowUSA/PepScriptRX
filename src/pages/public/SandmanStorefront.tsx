import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'restore' | 'metabolic' | 'recovery' | 'performance' | 'essentials';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE_NAME = 'Sandman Wellness Labs';
const STORE_SLUG = 'sandman';
const SCOPE_CODE = 'SANDMAN';
const COMMISSION_RATE = 0.5;
const LOGO_IMAGE = '/brands/sandman/sandman-logo.png';
const HERO_IMAGE = '/brands/sandman/sandman-basket-hero.png';
const VIAL_IMAGE = '/brands/sandman/sandman-vial-placeholder.png';
const BRAND_VIDEO = '/brands/sandman/sandman-brand-video.mov';

const FEATURED_IDS = [
  'bpc-157-10mg',
  'tb-500-10mg',
  'cjc-ipamorelin-10mg',
  'ipamorelin-10mg',
  'tirzepatide-30mg',
  'semaglutide-10mg',
  'nad-500iu',
  'wolverine-bpc-tb',
];

const GROUP_COPY: Record<ProductGroup, { label: string; short: string }> = {
  restore: {
    label: 'Restore',
    short: 'Sleep, repair, and whole-body restoration research paths.',
  },
  metabolic: {
    label: 'Metabolic',
    short: 'Weight-management and GLP catalog options.',
  },
  recovery: {
    label: 'Recovery',
    short: 'Repair, resilience, and soft-tissue support categories.',
  },
  performance: {
    label: 'Performance',
    short: 'Advanced optimization and performance-forward options.',
  },
  essentials: {
    label: 'Essentials',
    short: 'Supporting supplies and full catalog add-ons.',
  },
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

export default function SandmanStorefront() {
  usePageMeta(
    `${STORE_NAME} | Align. Restore. Live Well.`,
    'Sandman Wellness Labs restorative wellness catalog for recovery, metabolic support, and performance-focused research.',
    HERO_IMAGE,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE_SLUG)), []);
  const featuredProducts = useMemo(() => products.filter((product) => FEATURED_IDS.includes(product.id)).slice(0, 8), [products]);
  const groups = useMemo(() => buildGroups(products), [products]);
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
      commission_rate: COMMISSION_RATE,
      commission_type: 'net_profit_after_true_landed_cost',
      true_cost_rule: 'selling_price_minus_true_landed_cost',
      partner_payout_eligible: true,
      platform_allocation: 0.5,
      store_owner_allocation: 0.5,
      partner_commission: COMMISSION_RATE,
      rep_commission: 0,
      downline_commission: 0,
      override_commission: 0,
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
    <PublicLayout isolatedPortal portalHomePath="/sandman" portalName={STORE_NAME} portalLogoSrc={LOGO_IMAGE} portalKey={STORE_SLUG}>
      <div className="sandman-store">
        <section className="sandman-hero">
          <div className="sandman-shell sandman-hero-grid">
            <div className="sandman-hero-copy">
              <img src={LOGO_IMAGE} alt={STORE_NAME} className="sandman-hero-logo" />
              <p className="sandman-kicker">Align. Restore. Live Well.</p>
              <h1>Sandman Wellness Labs</h1>
              <p className="sandman-subhead">A premium wellness catalog for restorative research, performance recovery, and modern metabolic support.</p>
              <div className="sandman-actions">
                <a className="sandman-btn sandman-btn-primary" href="#sandman-products">Shop Catalog</a>
                <Link className="sandman-btn sandman-btn-secondary" to="/sandman/certificates">Certificates</Link>
              </div>
            </div>
            <div className="sandman-hero-panel">
              <img src={HERO_IMAGE} alt="Sandman Wellness Labs branded product basket" />
              <ProductPurityGuaranteeBadge compact />
            </div>
          </div>
        </section>

        <section className="sandman-band">
          <div className="sandman-shell sandman-band-grid">
            {[
              ['Restorative Focus', 'Thoughtfully organized wellness selections for recovery, balance, and daily resilience.'],
              ['Purity Minded', 'Quality documentation and product education stay close while you compare options.'],
              ['Easy Ordering', 'A clean catalog experience designed for calm browsing from any device.'],
            ].map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="sandman-section sandman-featured">
          <div className="sandman-shell">
            <div className="sandman-section-head">
              <p>Featured Selections</p>
              <h2>Explore Sandman favorites by wellness goal.</h2>
            </div>
            <div className="sandman-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} featured />
              ))}
            </div>
          </div>
        </section>

        <section className="sandman-section sandman-catalog" id="sandman-products">
          <div className="sandman-shell">
            <div className="sandman-catalog-toolbar">
              <div className="sandman-section-head">
                <p>Product Catalog</p>
                <h2>Browse restorative, metabolic, recovery, and performance options.</h2>
              </div>
              <div className="sandman-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Sandman products" />
                <div className="sandman-segments" aria-label="Product filters">
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
              <div className="sandman-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
                ))}
              </div>
            ) : (
              <div className="sandman-empty">No products found. Try a different search or collection.</div>
            )}
          </div>
        </section>

        <section className="sandman-story">
          <div className="sandman-shell sandman-story-grid">
            <video
              className="sandman-story-video"
              src={BRAND_VIDEO}
              poster={VIAL_IMAGE}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Sandman Wellness Labs brand video"
            />
            <div>
              <p className="sandman-kicker">Restorative Wellness</p>
              <h2>Designed around calm, clarity, and consistency.</h2>
              <p>Sandman Wellness Labs brings a focused lens to peptide research categories, with product education, quality references, and simple shopping tools in one branded experience.</p>
              <div className="sandman-story-actions">
                <Link className="sandman-btn sandman-btn-primary" to="/sandman/mixing">Mixing Center</Link>
                <Link className="sandman-btn sandman-btn-secondary sandman-btn-dark" to="/sandman/library">Library</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="sandman-footer">
          <div className="sandman-shell">
            <img src={LOGO_IMAGE} alt={STORE_NAME} />
            <div>
              <strong>Wellness review notice</strong>
              <p>Product availability, pricing, and fulfillment are subject to standard review, state availability, and applicable requirements. This storefront does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</p>
              <nav aria-label="Sandman footer links">
                <Link to="/sandman/privacy">Privacy</Link>
                <Link to="/sandman/terms">Terms</Link>
                <Link to="/sandman/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {count > 0 && (
          <aside className="sandman-cart" aria-label="Sandman cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>{money(subtotal)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{SANDMAN_STYLES}</style>
    </PublicLayout>
  );
}

function ProductCard({ product, qty, addToCart, setQty, featured = false }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  featured?: boolean;
}) {
  const meta = getProductMetadata(product);
  const group = groupForProduct(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  return (
    <article className={featured ? 'sandman-product-card is-featured' : 'sandman-product-card'}>
      <div className="sandman-product-media">
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Sandman Wellness Labs vial placeholder`} loading="lazy" />
        <span>{GROUP_COPY[group].label}</span>
      </div>
      <div className="sandman-product-body">
        <h3>{meta.commonName}</h3>
        <p className="sandman-strength">{meta.doseLabel}</p>
        <p>{product.description || 'Wellness catalog item available through standard review.'}</p>
        <div className="sandman-tags">
          <span>Wellness Selection</span>
          <span>Guided Review</span>
          <span>Purity Focus</span>
        </div>
        <div className="sandman-product-footer">
          <strong>{price != null ? money(price) : 'Review'}</strong>
          <Link to={`/sandman/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="sandman-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="sandman-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

function sortProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function priority(product: DistributorCatalogProduct) {
  const found = FEATURED_IDS.indexOf(product.id);
  if (found >= 0) return found;
  const group = groupForProduct(product);
  if (group === 'restore') return 100;
  if (group === 'recovery') return 200;
  if (group === 'metabolic') return 300;
  if (group === 'performance') return 400;
  return 500;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category} ${product.description}`.toLowerCase();
  if (text.includes('nad') || text.includes('mots') || text.includes('glutathione') || text.includes('epitalon') || text.includes('ss-31')) return 'restore';
  if (text.includes('tirzep') || text.includes('sema') || text.includes('reta') || text.includes('glp') || text.includes('cagri') || text.includes('aod')) return 'metabolic';
  if (text.includes('bpc') || text.includes('tb-500') || text.includes('wolverine') || text.includes('ghk') || text.includes('recovery') || text.includes('repair')) return 'recovery';
  if (text.includes('hgh') || text.includes('tesa') || text.includes('cjc') || text.includes('ipamorelin') || text.includes('igf') || text.includes('mk-677') || text.includes('performance')) return 'performance';
  return 'essentials';
}

function buildGroups(products: DistributorCatalogProduct[]) {
  const counts = products.reduce((acc, product) => {
    const productGroup = groupForProduct(product);
    acc[productGroup] = (acc[productGroup] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ProductGroup, number>>);
  const order: ProductGroup[] = ['restore', 'metabolic', 'recovery', 'performance', 'essentials'];
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

const SANDMAN_STYLES = `
  :root {
    --sand-ink: #11100e;
    --sand-black: #171511;
    --sand-coal: #24211c;
    --sand-gold: #c9a86a;
    --sand-bright-gold: #ead39a;
    --sand-stone: #d8d0c2;
    --sand-paper: #f5f0e8;
    --sand-muted: #786f63;
    --sand-line: rgba(201, 168, 106, .32);
  }
  .sandman-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .sandman-store { min-height: 100vh; color: var(--sand-ink); background: var(--sand-paper); overflow-x: clip; }
  .sandman-hero { position: relative; min-height: 82vh; display: grid; align-items: center; padding: clamp(42px, 7vw, 82px) 0 34px; color: #fff; background:
    linear-gradient(108deg, rgba(17,16,14,.96) 0%, rgba(17,16,14,.86) 46%, rgba(17,16,14,.30) 100%),
    url('/brands/sandman/sandman-basket-hero.png') center / cover no-repeat;
    border-bottom: 1px solid var(--sand-line);
  }
  .sandman-hero-grid { display: grid; grid-template-columns: minmax(0, .88fr) minmax(340px, 1.12fr); gap: clamp(26px, 5vw, 58px); align-items: center; }
  .sandman-hero-copy { display: grid; gap: 17px; align-content: center; }
  .sandman-hero-logo { width: min(330px, 78vw); height: auto; display: block; border-radius: 8px; box-shadow: 0 24px 64px rgba(0,0,0,.38); }
  .sandman-kicker { margin: 0; color: var(--sand-bright-gold); font-size: 12px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
  .sandman-hero h1 { margin: 0; color: #fff; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(44px, 7vw, 84px); line-height: .96; font-weight: 800; letter-spacing: 0; text-wrap: balance; text-shadow: 0 18px 50px rgba(0,0,0,.62); }
  .sandman-subhead { margin: 0; max-width: 650px; color: #f1eadf; font-size: clamp(17px, 2.1vw, 23px); line-height: 1.58; }
  .sandman-actions, .sandman-story-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .sandman-btn, .sandman-add, .sandman-cart button, .sandman-segments button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .sandman-btn:hover, .sandman-add:hover, .sandman-cart button:hover, .sandman-segments button:hover { transform: translateY(-1px); }
  .sandman-btn-primary, .sandman-add, .sandman-cart button { background: linear-gradient(135deg, #f7e6b5, var(--sand-gold)); color: #171511; box-shadow: 0 16px 36px rgba(201,168,106,.24); }
  .sandman-btn-secondary { background: rgba(255,255,255,.11); color: #fff; border-color: rgba(234,211,154,.46); backdrop-filter: blur(12px); }
  .sandman-btn-dark { color: var(--sand-black); background: rgba(255,255,255,.64); border-color: rgba(36,33,28,.18); }
  .sandman-hero-panel { position: relative; justify-self: end; width: min(560px, 100%); border: 1px solid rgba(234,211,154,.46); border-radius: 8px; overflow: hidden; background: rgba(17,16,14,.48); box-shadow: 0 32px 90px rgba(0,0,0,.5); }
  .sandman-hero-panel img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; object-position: center; }
  .sandman-band { padding: 18px 0; background: var(--sand-black); border-bottom: 1px solid var(--sand-line); }
  .sandman-band-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .sandman-band article { border: 1px solid rgba(234,211,154,.26); border-radius: 8px; background: rgba(255,255,255,.05); padding: 16px; display: grid; gap: 5px; }
  .sandman-band strong { color: #fff; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
  .sandman-band span { color: var(--sand-stone); font-size: 13px; line-height: 1.5; }
  .sandman-section { padding: clamp(46px, 7vw, 78px) 0; }
  .sandman-featured { background: linear-gradient(180deg, #f5f0e8, #ebe2d5); }
  .sandman-catalog { background: linear-gradient(180deg, #ebe2d5, #f5f0e8); }
  .sandman-section-head { max-width: 780px; margin: 0 0 24px; }
  .sandman-section-head p { margin: 0 0 8px; color: #8a6426; font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .sandman-section-head h2 { margin: 0; color: var(--sand-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(30px, 4vw, 50px); line-height: 1.08; letter-spacing: 0; text-wrap: balance; }
  .sandman-featured-grid, .sandman-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .sandman-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .82fr) minmax(320px, 1.18fr); gap: 22px; align-items: end; margin-bottom: 28px; }
  .sandman-filter-stack { display: grid; gap: 12px; }
  .sandman-filter-stack input { min-height: 46px; border: 1px solid rgba(120,111,99,.28); border-radius: 8px; padding: 0 14px; color: var(--sand-ink); background: rgba(255,255,255,.82); outline: none; }
  .sandman-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .sandman-segments button { min-height: 40px; background: rgba(255,255,255,.68); color: var(--sand-coal); border-color: rgba(120,111,99,.22); padding: 8px 12px; }
  .sandman-segments button.is-active { background: var(--sand-black); color: #fff; border-color: var(--sand-line); box-shadow: 0 14px 32px rgba(17,16,14,.18); }
  .sandman-product-card, .sandman-empty { border: 1px solid rgba(120,111,99,.18); border-radius: 8px; background: rgba(255,255,255,.78); box-shadow: 0 20px 54px rgba(36,33,28,.12); }
  .sandman-product-card { overflow: hidden; display: grid; grid-template-rows: 244px 1fr; min-height: 650px; }
  .sandman-product-card.is-featured { border-color: rgba(201,168,106,.46); box-shadow: 0 24px 64px rgba(36,33,28,.18); }
  .sandman-product-media { position: relative; background: #171511; border-bottom: 1px solid var(--sand-line); }
  .sandman-product-media img { width: 100%; height: 244px; object-fit: cover; object-position: center; display: block; }
  .sandman-product-media span { position: absolute; left: 12px; top: 12px; border: 1px solid rgba(234,211,154,.52); border-radius: 999px; background: rgba(17,16,14,.86); color: #fff; padding: 6px 9px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .sandman-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .sandman-product-body h3 { margin: 0; color: var(--sand-ink); font-size: 24px; line-height: 1.1; font-weight: 900; }
  .sandman-strength { margin: -5px 0 0; color: #8a6426; font-weight: 900; }
  .sandman-product-body p { margin: 0; color: var(--sand-muted); font-size: 14px; line-height: 1.58; }
  .sandman-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .sandman-tags span { border: 1px solid rgba(120,111,99,.18); border-radius: 999px; background: rgba(245,240,232,.84); color: var(--sand-coal); padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .sandman-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sandman-product-footer strong { color: var(--sand-ink); font-size: 25px; }
  .sandman-product-footer a { color: #8a6426; font-size: 13px; font-weight: 900; }
  .sandman-add { width: 100%; }
  .sandman-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(120,111,99,.26); border-radius: 8px; overflow: hidden; }
  .sandman-qty button { height: 44px; border: 0; background: rgba(201,168,106,.22); color: var(--sand-black); font-size: 20px; font-weight: 900; cursor: pointer; }
  .sandman-qty span { text-align: center; color: var(--sand-ink); font-weight: 900; }
  .sandman-empty { padding: 24px; font-weight: 800; color: var(--sand-muted); }
  .sandman-story { padding: clamp(48px, 7vw, 78px) 0; background: linear-gradient(135deg, #171511, #2d2a24); color: #fff; border-top: 1px solid var(--sand-line); border-bottom: 1px solid var(--sand-line); }
  .sandman-story-grid { display: grid; grid-template-columns: minmax(280px, .86fr) minmax(0, 1.14fr); gap: clamp(22px, 5vw, 52px); align-items: center; }
  .sandman-story-video { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(234,211,154,.44); border-radius: 8px; box-shadow: 0 24px 70px rgba(0,0,0,.36); background: #171511; }
  .sandman-story h2 { margin: 8px 0 12px; color: #fff; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(32px, 4.8vw, 56px); line-height: 1.05; letter-spacing: 0; }
  .sandman-story p { margin: 0; color: var(--sand-stone); line-height: 1.75; }
  .sandman-footer { padding: 28px 0 96px; background: #11100e; color: #fff; }
  .sandman-footer .sandman-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
  .sandman-footer img { width: 150px; max-width: 100%; border-radius: 8px; display: block; }
  .sandman-footer strong { display: block; margin-bottom: 7px; }
  .sandman-footer p { margin: 0; color: var(--sand-stone); font-size: 13px; line-height: 1.75; }
  .sandman-footer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .sandman-footer a { color: var(--sand-bright-gold); font-size: 13px; font-weight: 900; }
  .sandman-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(17,16,14,.96); color: #fff; border: 1px solid rgba(234,211,154,.58); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(0,0,0,.38); backdrop-filter: blur(12px); }
  .sandman-cart div { display: grid; gap: 2px; }
  .sandman-cart span { color: var(--sand-bright-gold); font-weight: 900; }
  @media (max-width: 940px) {
    .sandman-hero { min-height: 0; background-position: 58% center; }
    .sandman-hero-grid, .sandman-catalog-toolbar, .sandman-story-grid { grid-template-columns: 1fr; }
    .sandman-hero-copy { text-align: center; justify-items: center; }
    .sandman-hero-panel { justify-self: center; }
    .sandman-actions, .sandman-story-actions, .sandman-segments { width: 100%; justify-content: center; }
    .sandman-actions .sandman-btn, .sandman-story-actions .sandman-btn, .sandman-segments button { flex: 1 1 160px; }
    .sandman-band-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .sandman-shell { width: min(100% - 24px, 1180px); }
    .sandman-hero h1 { font-size: 39px; }
    .sandman-hero-logo { width: min(250px, 74vw); }
    .sandman-hero-panel img, .sandman-story-video { aspect-ratio: 1 / 1; }
    .sandman-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .sandman-product-media img { height: 220px; }
    .sandman-footer .sandman-shell { grid-template-columns: 1fr; }
    .sandman-footer img { width: 132px; }
    .sandman-cart { align-items: stretch; flex-direction: column; }
    .sandman-cart button { width: 100%; }
  }
`;
