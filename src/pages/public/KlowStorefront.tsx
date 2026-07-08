import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductLane = 'signature' | 'recovery' | 'body' | 'performance';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const KLOW_SCOPE_CODE = 'KLOW';
const KLOW_STORE_NAME = 'KLOW Recovery Radiance';
const KLOW_STORE_SLUG = 'klow';
const ROCKPHORM_SOURCE_SLUG = 'rockphorm';
const HERO_IMAGE = '/brands/klow/klow-radiance-hero.png';
const SIGNATURE_IMAGE = '/brands/klow/klow-luxury-bundle.png';
const LOGO_IMAGE = '/brands/klow/klow-logo-wall.png';

const PRODUCT_PRIORITY = [
  'rockphorm-klow-peptide-blend',
  'rockphorm-bpc-157-tb-500-blend',
  'rockphorm-bpc-157-10mg',
  'rockphorm-tb-500-10mg',
  'rockphorm-ghk-cu-100mg',
  'rockphorm-glow-peptide-blend',
  'rockphorm-nad-plus',
  'rockphorm-glutathione-1500mg',
  'rockphorm-tesamorelin-10mg',
  'rockphorm-cjc-1295-ipamorelin',
  'rockphorm-retatrutide-15mg',
  'rockphorm-tirzepatide-15mg',
  'rockphorm-semaglutide-10mg',
];

const PRODUCT_COPY: Record<string, { short: string; bestFor: string; why: string; lane: ProductLane }> = {
  'rockphorm-klow-peptide-blend': {
    short: 'The KLOW signature blend, positioned for recovery, repair, calm, and whole-body wellness routines.',
    bestFor: 'Recovery radiance, whole-body wellness, repair-focused routines, and advanced support.',
    why: 'Customers choose KLOW when they want a premium recovery-centered blend with a softer wellness aesthetic.',
    lane: 'signature',
  },
  'rockphorm-bpc-157-tb-500-blend': {
    short: 'A recovery-focused combination commonly selected by active customers building a repair routine.',
    bestFor: 'Recovery, mobility-conscious wellness, and performance support.',
    why: 'The stack format keeps BPC-157 and TB-500 together for customers comparing recovery options.',
    lane: 'recovery',
  },
  'rockphorm-bpc-157-10mg': {
    short: 'Popular for customers exploring recovery, repair, and active wellness support.',
    bestFor: 'Repair-focused routines, recovery support, and active lifestyles.',
    why: 'BPC-157 is a familiar recovery option for customers reviewing single-product support.',
    lane: 'recovery',
  },
  'rockphorm-tb-500-10mg': {
    short: 'Often reviewed for repair-focused and recovery-support routines.',
    bestFor: 'Recovery, mobility support, and active wellness routines.',
    why: 'TB-500 fits customers comparing complementary recovery products.',
    lane: 'recovery',
  },
  'rockphorm-ghk-cu-100mg': {
    short: 'A skin and repair support option often associated with cosmetic wellness routines.',
    bestFor: 'Skin wellness, cosmetic support, and recovery-adjacent routines.',
    why: 'GHK-Cu pairs naturally with the recovery-radiance positioning of KLOW.',
    lane: 'signature',
  },
};

function sortKlowProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function priority(product: DistributorCatalogProduct) {
  const found = PRODUCT_PRIORITY.indexOf(product.id);
  if (found >= 0) return found;
  const search = productMetaSearchText(product).toLowerCase();
  if (search.includes('klow')) return 20;
  if (search.includes('bpc') || search.includes('tb-500') || search.includes('recovery')) return 100;
  if (search.includes('retatrutide') || search.includes('tirzepatide') || search.includes('semaglutide')) return 500;
  return 300;
}

function productCopy(product: DistributorCatalogProduct) {
  const meta = getProductMetadata(product);
  const search = productMetaSearchText(product).toLowerCase();
  const fallbackLane: ProductLane = search.includes('retatrutide') || search.includes('tirzepatide') || search.includes('semaglutide') || search.includes('cagri')
    ? 'body'
    : search.includes('hgh') || search.includes('igf') || search.includes('cjc') || search.includes('performance')
      ? 'performance'
      : 'recovery';
  return PRODUCT_COPY[product.id] ?? {
    short: product.description || 'A recovery-forward wellness option available through secure PepScriptRX checkout.',
    bestFor: `${meta.commonName} support, advanced wellness routines, and appropriate customer review.`,
    why: `${meta.commonName} is available for customers building a premium recovery and wellness routine.`,
    lane: fallbackLane,
  };
}

function laneLabel(lane: ProductLane) {
  if (lane === 'signature') return 'Signature Recovery';
  if (lane === 'body') return 'Body Composition';
  if (lane === 'performance') return 'Performance Support';
  return 'Recovery & Repair';
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

export default function KlowStorefront() {
  usePageMeta(
    'KLOW Recovery Radiance',
    'A premium recovery radiance storefront for repair-focused wellness, skin support, body composition, and performance routines.',
    HERO_IMAGE,
  );
  const navigate = useNavigate();
  const products = useMemo(() => sortKlowProducts(getDistributorProducts(ROCKPHORM_SOURCE_SLUG)), []);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const copy = productCopy(product);
    const q = search.trim().toLowerCase();
    return !q || [product.product_name, product.strength, product.category, product.description, productMetaSearchText(product), copy.short].join(' ').toLowerCase().includes(q);
  });

  const signatureProducts = visibleProducts.filter((product) => productCopy(product).lane === 'signature');
  const recoveryProducts = visibleProducts.filter((product) => productCopy(product).lane === 'recovery');
  const bodyProducts = visibleProducts.filter((product) => productCopy(product).lane === 'body');
  const performanceProducts = visibleProducts.filter((product) => productCopy(product).lane === 'performance');

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
      rep: KLOW_SCOPE_CODE,
      scope_code: KLOW_SCOPE_CODE,
      discount_code: '',
      discount_amount: 0,
      distributor: ROCKPHORM_SOURCE_SLUG,
      source_portal: KLOW_STORE_NAME,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: KLOW_STORE_SLUG,
      store_name: KLOW_STORE_NAME,
      admin_code: 'ROCKPHORM',
      account_type: 'admin',
      parent_type: 'platform',
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({ scope: KLOW_SCOPE_CODE, source: 'klow-portal', rep: KLOW_SCOPE_CODE, brand: 'klow' });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/klow" portalName="KLOW" portalKey="klow" portalLogoSrc={LOGO_IMAGE}>
      <section className="klow-hero">
        <div className="klow-shell klow-hero-grid">
          <div className="klow-hero-copy">
            <p className="klow-kicker">Recovery Radiance by PepScriptRX</p>
            <h1>KLOW</h1>
            <p className="klow-tagline">Recovery Radiance</p>
            <p className="klow-hero-text">
              A premium recovery-forward wellness experience for customers reviewing repair, calm, skin support, body composition, and performance options.
            </p>
            <div className="klow-actions">
              <a className="klow-btn klow-btn-primary" href="#klow-signature">Shop KLOW</a>
              <a className="klow-btn klow-btn-secondary" href="#klow-recovery">Explore Recovery</a>
            </div>
          </div>
          <div className="klow-hero-media">
            <img src={HERO_IMAGE} alt="KLOW Recovery Radiance hero" />
          </div>
          <ProductPurityGuaranteeBadge compact />
        </div>
      </section>

      <section className="klow-section klow-mist">
        <div className="klow-shell">
          <div className="klow-feature">
            <img src={SIGNATURE_IMAGE} alt="KLOW luxury recovery bundle" />
            <div>
              <p className="klow-kicker">Signature Blend</p>
              <h2>Recovery, repair, and radiance in one focused storefront.</h2>
              <p>KLOW keeps the shopping experience calm, premium, and direct while staying connected to PepScriptRX secure checkout.</p>
              <a className="klow-btn klow-btn-primary" href="#klow-signature">View Signature Products</a>
            </div>
          </div>

          <div className="klow-filter-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search KLOW products" aria-label="Search KLOW products" />
            <div className="klow-jump-links" aria-label="Product section links">
              <a href="#klow-signature">Signature</a>
              <a href="#klow-recovery">Recovery</a>
              <a href="#klow-body">Body</a>
              <a href="#klow-performance">Performance</a>
            </div>
          </div>

          <StoreSection id="klow-signature" eyebrow="Signature Recovery" title="The KLOW-centered recovery radiance edit." products={signatureProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="klow-recovery" eyebrow="Recovery & Repair" title="Repair-focused options for active wellness routines." products={recoveryProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="klow-body" eyebrow="Body Composition" title="Metabolic wellness options in a clean review path." products={bodyProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="klow-performance" eyebrow="Performance Support" title="Advanced wellness and performance options." products={performanceProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
        </div>
      </section>

      <section className="klow-section klow-process">
        <div className="klow-shell klow-process-grid">
          <article>
            <p className="klow-kicker">PepScriptRX Checkout</p>
            <h2>Secure ordering and guided support.</h2>
            <p>Orders move through the same trusted PepScriptRX checkout flow with customer account support and product education nearby.</p>
          </article>
          <article>
            <p className="klow-kicker">Mixing Center</p>
            <h2>Product preparation education.</h2>
            <p>Customers can review mixing, dosing math, and vial-preparation references after selecting products.</p>
            <Link className="klow-btn klow-btn-secondary" to="/klow/mixing">Open Mixing Center</Link>
          </article>
        </div>
      </section>

      {count > 0 && (
        <aside className="klow-cart" aria-label="KLOW cart summary">
          <div>
            <strong>{count} item{count === 1 ? '' : 's'}</strong>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <button type="button" onClick={checkout}>Checkout Available</button>
        </aside>
      )}

      <style>{KLOW_STYLES}</style>
    </PublicLayout>
  );
}

function StoreSection({ id, eyebrow, title, products, cart, addToCart, setQty, intro, children }: {
  id: string;
  eyebrow: string;
  title: string;
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  if (!products.length && !intro && !children) return null;
  return (
    <section id={id} className="klow-product-section">
      <div className="klow-section-head">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {intro}
      {products.length > 0 && (
        <div className="klow-product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function ProductCard({ product, qty, addToCart, setQty }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
}) {
  const meta = getProductMetadata(product);
  const copy = productCopy(product);
  const price = Number(product.displayPrice ?? product.suggested_retail_price ?? 0);
  return (
    <article className="klow-product-card">
      <img src={SIGNATURE_IMAGE} alt={`${meta.commonName} KLOW product presentation`} loading="lazy" />
      <div className="klow-product-copy">
        <span className="klow-product-category">{laneLabel(copy.lane)}</span>
        <h3>{meta.commonName}</h3>
        <p className="klow-strength">{meta.doseLabel}</p>
        <p>{copy.short}</p>
        <div className="klow-product-detail"><strong>Best For</strong><span>{copy.bestFor}</span></div>
        <div className="klow-product-detail"><strong>Why Customers Choose It</strong><span>{copy.why}</span></div>
        <div className="klow-badges">
          <span>Secure Checkout</span>
          <span>Product Education</span>
        </div>
        <div className="klow-card-footer">
          <strong>${price.toFixed(2)}</strong>
          <Link to={`/klow/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="klow-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="klow-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

const KLOW_STYLES = `
  :root {
    --klow-ink: #182325;
    --klow-muted: #5e6f70;
    --klow-mist: #e8f4f2;
    --klow-mint: #8ccbc3;
    --klow-deep: #176f68;
    --klow-lilac: #d6d4ee;
    --klow-ivory: #fffaf4;
    --klow-gold: #b88a3d;
  }
  .klow-shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
  .klow-hero { background: linear-gradient(135deg, #f8fbf8 0%, #e0f0ed 48%, #d9d7ef 100%); padding: clamp(38px, 7vw, 78px) 0 36px; overflow: hidden; }
  .klow-hero-grid { display: grid; gap: clamp(20px, 4vw, 36px); justify-items: center; text-align: center; }
  .klow-hero-copy { display: grid; gap: 15px; justify-items: center; max-width: 850px; }
  .klow-kicker { margin: 0; color: var(--klow-deep); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .klow-hero h1 { margin: 0; color: var(--klow-deep); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(58px, 12vw, 132px); line-height: .88; font-weight: 500; letter-spacing: .18em; text-shadow: 0 2px 0 rgba(255,255,255,.64); }
  .klow-tagline { margin: 0; color: var(--klow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(19px, 3vw, 31px); letter-spacing: .08em; text-transform: uppercase; line-height: 1.25; }
  .klow-hero-text { margin: 0; max-width: 720px; color: var(--klow-muted); font-size: 17px; line-height: 1.75; }
  .klow-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .klow-btn, .klow-add, .klow-cart button, .klow-jump-links a { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
  .klow-btn:hover, .klow-add:hover, .klow-cart button:hover, .klow-jump-links a:hover { transform: translateY(-1px); }
  .klow-btn-primary, .klow-add, .klow-cart button { background: var(--klow-deep); color: #fff; box-shadow: 0 14px 30px rgba(23,111,104,.20); }
  .klow-btn-secondary { background: rgba(255,255,255,.82); color: var(--klow-ink); border-color: rgba(23,111,104,.22); box-shadow: 0 12px 26px rgba(24,35,37,.08); }
  .klow-hero-media { width: min(920px, 100%); border: 1px solid rgba(23,111,104,.24); border-radius: 16px; overflow: hidden; box-shadow: 0 28px 70px rgba(24,35,37,.16); background: var(--klow-ivory); }
  .klow-hero-media img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: center; }
  .klow-section { padding: clamp(42px, 7vw, 74px) 0; }
  .klow-mist { background: linear-gradient(180deg, #f8fffc, var(--klow-mist)); }
  .klow-process { background: linear-gradient(180deg, var(--klow-mist), #fffaf7); }
  .klow-feature { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(280px, 1.1fr); gap: clamp(20px, 4vw, 38px); align-items: center; margin-bottom: 34px; background: rgba(255,255,255,.78); border: 1px solid rgba(23,111,104,.18); border-radius: 8px; padding: clamp(16px, 3vw, 24px); box-shadow: 0 18px 42px rgba(24,35,37,.08); }
  .klow-feature img { width: 100%; border-radius: 8px; aspect-ratio: 4 / 3; object-fit: cover; box-shadow: 0 16px 36px rgba(24,35,37,.13); }
  .klow-feature h2, .klow-section-head h2, .klow-process-grid h2 { margin: 0; color: var(--klow-ink); font-family: Georgia, 'Times New Roman', serif; font-weight: 500; line-height: 1.08; }
  .klow-feature h2 { font-size: clamp(30px, 4vw, 52px); margin: 8px 0 12px; }
  .klow-feature p, .klow-product-copy p, .klow-product-detail span, .klow-process-grid p { color: var(--klow-muted); line-height: 1.62; }
  .klow-filter-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 34px; align-items: center; }
  .klow-filter-row input { min-height: 46px; border: 1px solid rgba(23,111,104,.22); border-radius: 8px; padding: 0 14px; color: var(--klow-ink); background: #fff; }
  .klow-jump-links { display: flex; flex-wrap: wrap; gap: 8px; }
  .klow-jump-links a { background: #fff; color: var(--klow-muted); border-color: rgba(23,111,104,.20); min-height: 40px; padding: 8px 12px; }
  .klow-product-section { padding-top: 10px; margin-top: 32px; }
  .klow-product-section + .klow-product-section { margin-top: 56px; }
  .klow-section-head { max-width: 760px; margin: 0 0 24px; }
  .klow-section-head p { margin: 0 0 8px; color: var(--klow-deep); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .klow-section-head h2 { font-size: clamp(28px, 4vw, 48px); }
  .klow-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .klow-product-card { overflow: hidden; display: grid; grid-template-rows: 238px 1fr; background: #fff; border: 1px solid rgba(23,111,104,.18); border-radius: 8px; box-shadow: 0 18px 42px rgba(24,35,37,.10); min-height: 670px; }
  .klow-product-card > img { width: 100%; height: 238px; object-fit: cover; object-position: center; border-bottom: 1px solid rgba(23,111,104,.14); display: block; }
  .klow-product-copy { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .klow-product-category { color: var(--klow-deep); font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .klow-product-copy h3 { margin: 0; color: var(--klow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.1; font-weight: 500; }
  .klow-strength { margin: -6px 0 0; color: var(--klow-gold); font-weight: 900; }
  .klow-product-detail { display: grid; gap: 3px; padding-top: 2px; }
  .klow-product-detail strong { color: var(--klow-ink); font-size: 12px; }
  .klow-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  .klow-badges span { border: 1px solid rgba(23,111,104,.18); border-radius: 999px; background: #edf8f5; color: var(--klow-deep); padding: 6px 9px; font-size: 11px; font-weight: 900; }
  .klow-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px; }
  .klow-card-footer strong { color: var(--klow-ink); font-size: 24px; }
  .klow-card-footer a { color: var(--klow-deep); font-size: 13px; font-weight: 900; }
  .klow-add { width: 100%; }
  .klow-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(23,111,104,.22); border-radius: 8px; overflow: hidden; }
  .klow-qty button { height: 44px; border: 0; background: #edf8f5; color: var(--klow-deep); font-size: 20px; font-weight: 900; cursor: pointer; }
  .klow-qty span { text-align: center; color: var(--klow-ink); font-weight: 900; }
  .klow-process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .klow-process-grid article { background: rgba(255,255,255,.84); border: 1px solid rgba(23,111,104,.18); border-radius: 8px; padding: 22px; box-shadow: 0 16px 34px rgba(24,35,37,.08); }
  .klow-process-grid h2 { font-size: 27px; margin: 7px 0 8px; }
  .klow-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(24,35,37,.96); color: #fff; border: 1px solid rgba(140,203,195,.44); border-radius: 12px; padding: 12px; box-shadow: 0 18px 52px rgba(24,35,37,.25); }
  .klow-cart div { display: grid; gap: 2px; }
  .klow-cart strong { font-size: 15px; }
  .klow-cart span { color: var(--klow-mint); font-weight: 900; }
  @media (max-width: 820px) {
    .klow-feature, .klow-filter-row { grid-template-columns: 1fr; }
    .klow-actions, .klow-jump-links { width: 100%; }
    .klow-actions .klow-btn, .klow-jump-links a { flex: 1 1 180px; }
    .klow-hero h1 { letter-spacing: .12em; }
    .klow-hero-media img { aspect-ratio: 1 / 1; }
    .klow-cart { align-items: stretch; flex-direction: column; }
    .klow-cart button { width: 100%; }
  }
`;
