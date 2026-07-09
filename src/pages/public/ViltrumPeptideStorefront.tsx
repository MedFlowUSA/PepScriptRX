import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'performance' | 'recovery' | 'longevity' | 'metabolic';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE_SLUG = 'viltrumpeptide';
const STORE_NAME = 'Viltrum Peptide';
const SCOPE_CODE = 'VILTRUMPEPTIDE';
const REP_CODE = 'DEAN50';
const COMMISSION_RATE = 0.5;
const LOGO_IMAGE = '/brands/viltrumpeptide/viltrum-logo.png';
const VIAL_IMAGE = '/brands/viltrumpeptide/viltrum-vial.png';
const BUNDLE_IMAGE = '/brands/viltrumpeptide/viltrum-bundle.png';

const FEATURED_IDS = [
  'wolverine-bpc-tb',
  'bpc-157-10mg',
  'tb-500-10mg',
  'cjc-ipamorelin-10mg',
  'tesamorelin-10mg',
  'nad-500iu',
  'tirzepatide-30mg',
  'semaglutide-10mg',
];

export default function ViltrumPeptideStorefront() {
  usePageMeta(
    'Viltrum Peptide | Strength Beyond Human',
    'Futuristic performance peptide storefront powered by PepScriptRX secure checkout.',
    BUNDLE_IMAGE,
  );

  const navigate = useNavigate();
  const products = useMemo(() => sortProducts(getDistributorProducts(STORE_SLUG)), []);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ProductGroup | 'all'>('all');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const productGroup = groupForProduct(product);
    const q = search.trim().toLowerCase();
    return (group === 'all' || group === productGroup)
      && (!q || [product.product_name, product.strength, product.category, product.description, productMetaSearchText(product)].join(' ').toLowerCase().includes(q));
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
      rep: REP_CODE,
      scope_code: SCOPE_CODE,
      discount_code: '',
      discount_amount: 0,
      distributor: STORE_SLUG,
      source_portal: STORE_NAME,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: STORE_SLUG,
      store_name: STORE_NAME,
      admin_code: REP_CODE,
      admin_scope: SCOPE_CODE,
      account_type: 'admin',
      parent_type: 'independent_partner_store',
      commission_owner: REP_CODE,
      commission_rate: COMMISSION_RATE,
      commission_type: 'net_profit_after_true_cost',
      true_cost_rule: 'customer_amount_collected_minus_true_landed_product_fulfillment_shipping_payment_costs',
      partner_payout_eligible: true,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({
      scope: SCOPE_CODE,
      source: `${STORE_SLUG}-portal`,
      rep: REP_CODE,
      brand: STORE_SLUG,
    });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/viltrumpeptide" portalName={STORE_NAME} portalLogoSrc={LOGO_IMAGE} portalKey={STORE_SLUG}>
      <div className="viltrum-store">
        <section className="viltrum-hero">
          <div className="viltrum-shell viltrum-hero-grid">
            <div className="viltrum-hero-copy">
              <img src={LOGO_IMAGE} alt="Viltrum Peptide" className="viltrum-logo" />
              <p className="viltrum-kicker">Independent PepScriptRX Partner Store</p>
              <h1>Strength Beyond Human</h1>
              <p className="viltrum-subhead">A dark, high-performance peptide catalog built with futuristic anime-inspired energy and secure PepScriptRX checkout.</p>
              <div className="viltrum-actions">
                <a href="#viltrum-products" className="viltrum-btn viltrum-btn-primary">Shop Catalog</a>
                <Link to="/viltrumpeptide/library" className="viltrum-btn viltrum-btn-secondary">Research Library</Link>
              </div>
            </div>
            <div className="viltrum-hero-media">
              <img src={BUNDLE_IMAGE} alt="Viltrum Peptide sci-fi product bundle scene" />
            </div>
            <ProductPurityGuaranteeBadge compact />
          </div>
        </section>

        <section className="viltrum-strip">
          <div className="viltrum-shell viltrum-strip-grid">
            {[
              ['Advanced Catalog', 'Standard PepScriptRX product selection and pricing.'],
              ['Secure Checkout', 'Brand context stays attached from cart to order.'],
              ['Quality References', 'Education, certificates, and product review paths stay close.'],
              ['Dean Attribution', 'Orders route to Viltrum Peptide / DEAN50.'],
            ].map(([title, copy]) => (
              <div key={title}>
                <strong>{title}</strong>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="viltrum-showcase">
          <div className="viltrum-shell viltrum-showcase-grid">
            <img src={VIAL_IMAGE} alt="Viltrum Peptide vial placeholder" />
            <div>
              <p className="viltrum-kicker">Research Purposes Only</p>
              <h2>Powerful presentation, standard platform guardrails.</h2>
              <p>Viltrum Peptide uses original gray, metallic, red, black, and white branding while preserving PepScriptRX product review, fulfillment, and disclaimer language.</p>
            </div>
          </div>
        </section>

        <section id="viltrum-products" className="viltrum-products">
          <div className="viltrum-shell">
            <div className="viltrum-filter-row">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Viltrum products" />
              <div className="viltrum-segments" aria-label="Product filters">
                {(['all', 'performance', 'recovery', 'longevity', 'metabolic'] as const).map((option) => (
                  <button key={option} type="button" className={group === option ? 'is-active' : ''} onClick={() => setGroup(option)}>
                    {groupLabel(option)}
                  </button>
                ))}
              </div>
            </div>

            <StoreSection products={visibleProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          </div>
        </section>

        <section className="viltrum-notice">
          <div className="viltrum-shell">
            <strong>Important Notice</strong>
            <p>All products are compounded peptides intended for use under the supervision of a licensed healthcare provider. Viltrum Peptide and PepScriptRX do not provide medical advice, diagnosis, or treatment. Product availability, pricing, and fulfillment are subject to standard verification and applicable state regulations.</p>
            <div>
              <Link to="/viltrumpeptide/privacy">Privacy</Link>
              <Link to="/viltrumpeptide/terms">Terms</Link>
              <Link to="/viltrumpeptide/certificates">Quality Documents</Link>
            </div>
          </div>
        </section>

        {count > 0 && (
          <aside className="viltrum-cart" aria-label="Viltrum cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{VILTRUM_STYLES}</style>
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
  if (group === 'performance') return 120;
  if (group === 'recovery') return 220;
  if (group === 'metabolic') return 320;
  return 420;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category}`.toLowerCase();
  if (text.includes('weight') || text.includes('glp') || text.includes('tirzep') || text.includes('sema') || text.includes('reta')) return 'metabolic';
  if (text.includes('nad') || text.includes('glutathione') || text.includes('mots') || text.includes('longevity')) return 'longevity';
  if (text.includes('bpc') || text.includes('tb-500') || text.includes('recovery') || text.includes('ghk')) return 'recovery';
  return 'performance';
}

function groupLabel(group: ProductGroup | 'all') {
  if (group === 'all') return 'All';
  if (group === 'performance') return 'Performance';
  if (group === 'recovery') return 'Recovery';
  if (group === 'longevity') return 'Longevity';
  return 'Metabolic';
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

function StoreSection({ products, cart, addToCart, setQty, children }: {
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  children?: ReactNode;
}) {
  if (!products.length && !children) {
    return <div className="viltrum-empty">No products found. Try a different search.</div>;
  }
  return (
    <div className="viltrum-product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
      ))}
      {children}
    </div>
  );
}

function ProductCard({ product, qty, addToCart, setQty }: {
  product: DistributorCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
}) {
  const meta = getProductMetadata(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  const group = groupForProduct(product);
  return (
    <article className="viltrum-product-card">
      <div className="viltrum-product-media">
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Viltrum Peptide vial placeholder`} loading="lazy" />
        <span>{groupLabel(group)}</span>
      </div>
      <div className="viltrum-product-copy">
        <h3>{meta.commonName}</h3>
        <p className="viltrum-strength">{meta.doseLabel}</p>
        <p>{product.description || 'Research catalog item available through secure PepScriptRX checkout and standard fulfillment review.'}</p>
        <div className="viltrum-badges">
          <span>Research Catalog</span>
          <span>Secure Checkout</span>
          <span>Quality Review</span>
        </div>
        <div className="viltrum-card-footer">
          <strong>${price?.toFixed(2) ?? 'Review'}</strong>
          <Link to={`/viltrumpeptide/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="viltrum-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="viltrum-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

const VILTRUM_STYLES = `
  :root {
    --viltrum-bg: #050505;
    --viltrum-surface: #111113;
    --viltrum-panel: #18181b;
    --viltrum-text: #f8fafc;
    --viltrum-muted: #cbd5e1;
    --viltrum-red: #c1121f;
    --viltrum-red-bright: #ef233c;
    --viltrum-metal: #9ca3af;
    --viltrum-white: #ffffff;
  }
  .viltrum-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .viltrum-store { min-height: 100vh; color: var(--viltrum-text); background: var(--viltrum-bg); }
  .viltrum-hero { min-height: 76vh; padding: clamp(44px, 7vw, 82px) 0 34px; background: linear-gradient(90deg, rgba(5,5,5,.94), rgba(5,5,5,.68) 48%, rgba(5,5,5,.22)), url('/brands/viltrumpeptide/viltrum-bundle.png') center/cover no-repeat; border-bottom: 1px solid rgba(193,18,31,.44); position: relative; overflow: hidden; }
  .viltrum-hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 0 42%, rgba(193,18,31,.16) 42% 44%, transparent 44% 100%); pointer-events: none; }
  .viltrum-hero-grid { display: grid; grid-template-columns: minmax(0,.9fr) minmax(320px,1.1fr); gap: clamp(24px, 5vw, 56px); align-items: center; position: relative; z-index: 1; }
  .viltrum-hero-copy { display: grid; gap: 17px; align-content: center; }
  .viltrum-logo { width: min(360px, 82vw); height: auto; display: block; filter: drop-shadow(0 18px 38px rgba(193,18,31,.28)); }
  .viltrum-kicker { margin: 0; color: var(--viltrum-red-bright); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .viltrum-hero h1 { margin: 0; color: var(--viltrum-white); font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(48px, 7vw, 92px); line-height: .94; font-weight: 900; letter-spacing: 0; text-transform: uppercase; text-shadow: 0 18px 54px rgba(0,0,0,.72); }
  .viltrum-subhead { margin: 0; max-width: 650px; color: rgba(248,250,252,.82); font-size: clamp(17px, 2.1vw, 22px); line-height: 1.55; font-weight: 700; }
  .viltrum-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
  .viltrum-btn, .viltrum-add, .viltrum-cart button, .viltrum-segments button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
  .viltrum-btn:hover, .viltrum-add:hover, .viltrum-cart button:hover, .viltrum-segments button:hover { transform: translateY(-1px); }
  .viltrum-btn-primary, .viltrum-add, .viltrum-cart button { background: linear-gradient(135deg, var(--viltrum-red-bright), var(--viltrum-red)); color: var(--viltrum-white); box-shadow: 0 16px 36px rgba(193,18,31,.28); }
  .viltrum-btn-secondary { background: rgba(17,17,19,.78); color: var(--viltrum-text); border-color: rgba(156,163,175,.46); box-shadow: 0 12px 30px rgba(0,0,0,.3); }
  .viltrum-hero-media { border: 1px solid rgba(239,35,60,.42); border-radius: 8px; overflow: hidden; box-shadow: 0 30px 86px rgba(0,0,0,.58), 0 0 36px rgba(193,18,31,.16); background: #050505; }
  .viltrum-hero-media img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: center; }
  .viltrum-strip { background: #09090b; border-bottom: 1px solid rgba(156,163,175,.18); padding: 18px 0; }
  .viltrum-strip-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
  .viltrum-strip-grid div { background: linear-gradient(145deg, rgba(24,24,27,.96), rgba(5,5,5,.96)); border: 1px solid rgba(156,163,175,.2); border-radius: 8px; padding: 15px; display: grid; gap: 5px; }
  .viltrum-strip-grid strong { color: var(--viltrum-white); font-size: 13px; text-transform: uppercase; }
  .viltrum-strip-grid span { color: var(--viltrum-muted); font-size: 13px; line-height: 1.5; }
  .viltrum-showcase, .viltrum-products { padding: clamp(42px, 7vw, 76px) 0; background: linear-gradient(180deg, #050505, #111113); }
  .viltrum-showcase-grid { display: grid; grid-template-columns: minmax(260px,.78fr) minmax(0,1.22fr); gap: clamp(22px, 4vw, 42px); align-items: center; }
  .viltrum-showcase-grid img { width: 100%; max-height: 520px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(193,18,31,.32); box-shadow: 0 22px 64px rgba(0,0,0,.52); }
  .viltrum-showcase-grid h2 { margin: 0 0 12px; color: var(--viltrum-white); font-family: Impact, 'Arial Black', system-ui, sans-serif; font-size: clamp(34px, 5vw, 64px); line-height: 1; text-transform: uppercase; letter-spacing: 0; }
  .viltrum-showcase-grid p { margin: 0; color: var(--viltrum-muted); font-size: 16px; line-height: 1.7; font-weight: 650; }
  .viltrum-products { background: #050505; }
  .viltrum-filter-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 28px; align-items: center; }
  .viltrum-filter-row input { min-height: 46px; border: 1px solid rgba(156,163,175,.32); border-radius: 8px; padding: 0 14px; color: var(--viltrum-text); background: rgba(24,24,27,.94); outline: none; }
  .viltrum-filter-row input::placeholder { color: rgba(203,213,225,.62); }
  .viltrum-segments { display: flex; flex-wrap: wrap; gap: 8px; }
  .viltrum-segments button { background: rgba(24,24,27,.94); color: var(--viltrum-muted); border-color: rgba(156,163,175,.28); min-height: 40px; padding: 8px 12px; }
  .viltrum-segments button.is-active { color: var(--viltrum-white); background: rgba(193,18,31,.86); border-color: rgba(239,35,60,.72); }
  .viltrum-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .viltrum-product-card { overflow: hidden; display: grid; grid-template-rows: 238px 1fr; background: linear-gradient(180deg, #18181b, #09090b); border: 1px solid rgba(156,163,175,.22); border-radius: 8px; box-shadow: 0 22px 56px rgba(0,0,0,.42); min-height: 655px; }
  .viltrum-product-media { position: relative; background: linear-gradient(145deg,#050505,#18181b 48%,#3b060b); border-bottom: 1px solid rgba(193,18,31,.28); }
  .viltrum-product-media img { width: 100%; height: 238px; object-fit: cover; object-position: center; display: block; }
  .viltrum-product-media span { position: absolute; left: 12px; top: 12px; background: rgba(5,5,5,.82); border: 1px solid rgba(239,35,60,.48); border-radius: 999px; color: var(--viltrum-white); padding: 6px 9px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .viltrum-product-copy { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .viltrum-product-copy h3 { margin: 0; color: var(--viltrum-text); font-size: 25px; line-height: 1.1; font-weight: 900; }
  .viltrum-strength { margin: -6px 0 0; color: var(--viltrum-metal); font-weight: 900; }
  .viltrum-product-copy p { margin: 0; color: var(--viltrum-muted); font-size: 14px; line-height: 1.6; }
  .viltrum-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  .viltrum-badges span { border: 1px solid rgba(156,163,175,.22); border-radius: 999px; background: rgba(156,163,175,.10); color: #e5e7eb; padding: 6px 9px; font-size: 11px; font-weight: 900; }
  .viltrum-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px; }
  .viltrum-card-footer strong { color: var(--viltrum-white); font-size: 24px; }
  .viltrum-card-footer a { color: #fca5a5; font-size: 13px; font-weight: 900; }
  .viltrum-add { width: 100%; }
  .viltrum-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(156,163,175,.28); border-radius: 8px; overflow: hidden; }
  .viltrum-qty button { height: 44px; border: 0; background: rgba(193,18,31,.24); color: var(--viltrum-white); font-size: 20px; font-weight: 900; cursor: pointer; }
  .viltrum-qty span { text-align: center; color: var(--viltrum-text); font-weight: 900; }
  .viltrum-empty { border: 1px solid rgba(156,163,175,.24); border-radius: 8px; background: #111113; color: var(--viltrum-muted); padding: 24px; font-weight: 800; }
  .viltrum-notice { background: #09090b; padding: 24px 0 96px; border-top: 1px solid rgba(156,163,175,.18); }
  .viltrum-notice .viltrum-shell { border: 1px solid rgba(156,163,175,.24); border-radius: 8px; background: #111113; padding: 20px; }
  .viltrum-notice strong { color: var(--viltrum-white); display: block; margin-bottom: 8px; }
  .viltrum-notice p { margin: 0; color: var(--viltrum-muted); font-size: 13px; line-height: 1.8; }
  .viltrum-notice div div { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .viltrum-notice a { color: #fca5a5; font-size: 13px; font-weight: 900; }
  .viltrum-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(5,5,5,.96); color: var(--viltrum-text); border: 1px solid rgba(239,35,60,.54); border-radius: 12px; padding: 12px; box-shadow: 0 18px 56px rgba(0,0,0,.48), 0 0 24px rgba(193,18,31,.16); }
  .viltrum-cart div { display: grid; gap: 2px; }
  .viltrum-cart strong { font-size: 15px; }
  .viltrum-cart span { color: #fca5a5; font-weight: 900; }
  @media (max-width: 880px) {
    .viltrum-hero { background-position: 58% top; }
    .viltrum-hero-grid, .viltrum-showcase-grid, .viltrum-filter-row { grid-template-columns: 1fr; }
    .viltrum-hero-copy { text-align: center; justify-items: center; }
    .viltrum-actions, .viltrum-segments { width: 100%; }
    .viltrum-actions .viltrum-btn, .viltrum-segments button { flex: 1 1 150px; }
    .viltrum-hero-media img { aspect-ratio: 1 / 1; }
    .viltrum-cart { align-items: stretch; flex-direction: column; }
    .viltrum-cart button { width: 100%; }
  }
`;
