import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type CartMap = Record<string, number>;
type ProductGroup = 'metabolic' | 'longevity' | 'recovery' | 'performance' | 'essentials';

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const STORE_NAME = 'Vitality Institute Labs';
const STORE_SLUG = 'vitality';
const SCOPE_CODE = 'VITALITY';
const LOGO_IMAGE = '/brands/vitality/vitality-logo.png';
const HERO_IMAGE = '/brands/vitality/vitality-basket-hero.png';
const VIAL_IMAGE = '/brands/vitality/vitality-vial.png';

const FEATURED_IDS = [
  'tirzepatide-30mg',
  'tirzepatide-60mg',
  'semaglutide-10mg',
  'retatrutide-15mg',
  'nad-500iu',
  'nad-1000iu',
  'mots-c-10mg',
  'glow-peptide-blend',
];

const GROUP_COPY: Record<ProductGroup, { label: string; short: string }> = {
  metabolic: {
    label: 'Metabolic Precision',
    short: 'GLP and body-goal options for structured review.',
  },
  longevity: {
    label: 'Cellular Longevity',
    short: 'NAD+, antioxidant, and mitochondrial wellness options.',
  },
  recovery: {
    label: 'Repair & Radiance',
    short: 'Recovery, skin, repair, and beauty-forward wellness.',
  },
  performance: {
    label: 'Performance Medicine',
    short: 'Advanced optimization products for experienced customers.',
  },
  essentials: {
    label: 'Clinical Essentials',
    short: 'Supporting supplies and additional catalog items.',
  },
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

export default function VitalityStorefront() {
  usePageMeta(
    `${STORE_NAME} | PepScriptRX`,
    'Luxury longevity, AI healthcare, and premium wellness storefront powered by PepScriptRX.',
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
      account_type: 'marketing_partner',
      parent_type: 'platform_owned_marketing_store',
      commission_owner: '',
      commission_rate: 0,
      partner_payout_eligible: false,
      platform_allocation: 1,
      store_owner_allocation: 0,
      partner_commission: 0,
      rep_commission: 0,
      downline_commission: 0,
      override_commission: 0,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({
      scope: SCOPE_CODE,
      source: 'vitality-portal',
      rep: SCOPE_CODE,
      brand: STORE_SLUG,
    });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/vitality" portalName={STORE_NAME} portalLogoSrc={LOGO_IMAGE} portalKey="vitality">
      <div className="vitality-store">
        <section className="vitality-hero">
          <div className="vitality-particles" aria-hidden="true" />
          <div className="vitality-shell vitality-hero-grid">
            <div className="vitality-hero-copy">
              <img src={LOGO_IMAGE} alt={STORE_NAME} className="vitality-hero-logo" />
              <p className="vitality-kicker">Science. Vitality. Transformation.</p>
              <h1>Vitality Institute Labs</h1>
              <p className="vitality-subhead">Premium longevity, precision wellness, and AI-enhanced healthcare through a luxury medical spa experience.</p>
              <div className="vitality-actions">
                <a className="vitality-btn vitality-btn-primary" href="#vitality-products">Shop Catalog</a>
                <Link className="vitality-btn vitality-btn-secondary" to="/vitality/product-confidence">Quality Review</Link>
              </div>
            </div>
            <div className="vitality-hero-card">
              <img src={HERO_IMAGE} alt="Jane holding a futuristic Vitality Institute Labs shopping basket" />
              <ProductPurityGuaranteeBadge compact />
            </div>
          </div>
        </section>

        <section className="vitality-section vitality-signals">
          <div className="vitality-shell vitality-signal-grid">
            {[
              ['Advanced Longevity', 'Cellular energy, metabolic wellness, recovery, and radiance in one concierge catalog.'],
              ['Clinical Elegance', 'A white, violet, and champagne experience designed to feel precise, calm, and premium.'],
              ['PepScriptRX Powered', 'Checkout, review, product education, and patient acquisition attribution remain synchronized.'],
            ].map(([title, body]) => (
              <article key={title}>
                <span />
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="vitality-section vitality-featured">
          <div className="vitality-shell">
            <div className="vitality-section-head">
              <p>Flagship Wellness Paths</p>
              <h2>Precision products presented with a medical science finish.</h2>
            </div>
            <div className="vitality-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} featured />
              ))}
            </div>
          </div>
        </section>

        <section className="vitality-section vitality-catalog" id="vitality-products">
          <div className="vitality-shell">
            <div className="vitality-catalog-toolbar">
              <div className="vitality-section-head">
                <p>Full PepScriptRX Catalog</p>
                <h2>Same products, descriptions, and prices as the platform catalog.</h2>
              </div>
              <div className="vitality-filter-stack">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search Vitality products" />
                <div className="vitality-segments" aria-label="Product filters">
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
              <div className="vitality-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
                ))}
              </div>
            ) : (
              <div className="vitality-empty">No products found. Try a different search or collection.</div>
            )}
          </div>
        </section>

        <section className="vitality-story">
          <div className="vitality-shell vitality-story-grid">
            <img src={VIAL_IMAGE} alt="Vitality Institute Labs purple vial placeholder" loading="lazy" />
            <div>
              <p className="vitality-kicker">AI Healthcare / Luxury Wellness</p>
              <h2>A premium patient acquisition storefront.</h2>
              <p>Vitality Institute Labs is configured as a 0% marketing partner storefront. Patients are still tagged to Vitality Institute Labs for traffic and sales analytics, while all profit remains with PepScriptRX.</p>
              <Link className="vitality-btn vitality-btn-primary" to="/vitality/mixing">Open Mixing Center</Link>
            </div>
          </div>
        </section>

        <section className="vitality-footer">
          <div className="vitality-shell">
            <img src={LOGO_IMAGE} alt={STORE_NAME} />
            <div>
              <strong>Concierge wellness review</strong>
              <p>Product availability, pricing, and fulfillment are subject to standard PepScriptRX review, state availability, and applicable requirements. This storefront does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</p>
              <nav aria-label="Vitality footer links">
                <Link to="/vitality/privacy">Privacy</Link>
                <Link to="/vitality/terms">Terms</Link>
                <Link to="/vitality/certificates">Quality Documents</Link>
              </nav>
            </div>
          </div>
        </section>

        {count > 0 && (
          <aside className="vitality-cart" aria-label="Vitality cart summary">
            <div>
              <strong>{count} item{count === 1 ? '' : 's'}</strong>
              <span>{money(subtotal)}</span>
            </div>
            <button type="button" onClick={checkout}>Checkout</button>
          </aside>
        )}
      </div>

      <style>{VITALITY_STYLES}</style>
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
    <article className={featured ? 'vitality-product-card is-featured' : 'vitality-product-card'}>
      <div className="vitality-product-media">
        <img src={VIAL_IMAGE} alt={`${meta.commonName} Vitality Institute Labs vial placeholder`} loading="lazy" />
        <span>{GROUP_COPY[group].label}</span>
      </div>
      <div className="vitality-product-body">
        <h3>{meta.commonName}</h3>
        <p className="vitality-strength">{meta.doseLabel}</p>
        <div className="product-bac-water-included">3 mL BAC Water Included</div>
        <p>{product.description || 'PepScriptRX catalog item available through secure checkout and standard review.'}</p>
        <div className="vitality-tags">
          <span>Physician Review</span>
          <span>AI Assisted</span>
          <span>Platform Pricing</span>
        </div>
        <div className="vitality-product-footer">
          <strong>{price != null ? money(price) : 'Review'}</strong>
          <Link to={`/vitality/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="vitality-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="vitality-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
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
  if (group === 'metabolic') return 100;
  if (group === 'longevity') return 200;
  if (group === 'recovery') return 300;
  if (group === 'performance') return 400;
  return 500;
}

function groupForProduct(product: DistributorCatalogProduct): ProductGroup {
  const text = `${product.id} ${product.product_name} ${product.category} ${product.description}`.toLowerCase();
  if (text.includes('tirzep') || text.includes('sema') || text.includes('reta') || text.includes('glp') || text.includes('cagri') || text.includes('aod')) return 'metabolic';
  if (text.includes('nad') || text.includes('mots') || text.includes('glutathione') || text.includes('epitalon') || text.includes('ss-31')) return 'longevity';
  if (text.includes('bpc') || text.includes('tb-500') || text.includes('wolverine') || text.includes('ghk') || text.includes('glow') || text.includes('klow') || text.includes('recovery') || text.includes('repair')) return 'recovery';
  if (text.includes('hgh') || text.includes('tesa') || text.includes('cjc') || text.includes('ipamorelin') || text.includes('igf') || text.includes('mk-677') || text.includes('performance')) return 'performance';
  return 'essentials';
}

function buildGroups(products: DistributorCatalogProduct[]) {
  const counts = products.reduce((acc, product) => {
    const productGroup = groupForProduct(product);
    acc[productGroup] = (acc[productGroup] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ProductGroup, number>>);
  const order: ProductGroup[] = ['metabolic', 'longevity', 'recovery', 'performance', 'essentials'];
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

const VITALITY_STYLES = `
  :root {
    --vil-ink: #211735;
    --vil-deep: #3b0b78;
    --vil-royal: #6d28d9;
    --vil-violet: #8b5cf6;
    --vil-lavender: #eee6ff;
    --vil-lilac: #d8c4ff;
    --vil-white: #fffaff;
    --vil-gold: #c8a45d;
    --vil-muted: #6f6482;
  }
  .vitality-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .vitality-store { min-height: 100vh; color: var(--vil-ink); background: #fbf8ff; overflow-x: clip; }
  .vitality-hero { position: relative; min-height: 82vh; display: grid; align-items: center; padding: clamp(42px, 7vw, 86px) 0 38px; color: #fff; background:
    linear-gradient(105deg, rgba(35, 12, 71, .96) 0%, rgba(58, 20, 105, .84) 42%, rgba(92, 53, 152, .28) 100%),
    url('/brands/vitality/vitality-basket-hero.png');
    background-size: cover;
    background-position: center;
    isolation: isolate;
  }
  .vitality-hero::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 110px; background: linear-gradient(180deg, transparent, #fbf8ff); z-index: -1; }
  .vitality-particles { position: absolute; inset: 0; z-index: -1; background-image: radial-gradient(circle, rgba(255,255,255,.42) 0 1px, transparent 1.8px); background-size: 54px 54px; opacity: .22; mask-image: linear-gradient(90deg, #000, transparent 72%); }
  .vitality-hero-grid { display: grid; grid-template-columns: minmax(0, .88fr) minmax(340px, 1.12fr); gap: clamp(26px, 5vw, 58px); align-items: center; }
  .vitality-hero-copy { display: grid; gap: 17px; align-content: center; }
  .vitality-hero-logo { width: min(280px, 76vw); height: auto; display: block; border-radius: 8px; box-shadow: 0 20px 58px rgba(27,7,56,.32); }
  .vitality-kicker { margin: 0; color: #f2d996; font-size: 12px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
  .vitality-hero h1 { margin: 0; color: #fff; font-size: clamp(46px, 7vw, 88px); line-height: .95; font-weight: 850; letter-spacing: 0; text-wrap: balance; text-shadow: 0 18px 48px rgba(36, 9, 73, .58); }
  .vitality-subhead { margin: 0; max-width: 650px; color: #f5ecff; font-size: clamp(18px, 2.2vw, 24px); line-height: 1.55; }
  .vitality-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .vitality-btn, .vitality-add, .vitality-cart button, .vitality-segments button { min-height: 44px; border-radius: 999px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 17px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
  .vitality-btn:hover, .vitality-add:hover, .vitality-cart button:hover, .vitality-segments button:hover { transform: translateY(-1px); }
  .vitality-btn-primary, .vitality-add, .vitality-cart button { background: linear-gradient(135deg, #ffffff, #d8c4ff 54%, #c8a45d); color: #291044; box-shadow: 0 16px 40px rgba(216,196,255,.28); }
  .vitality-btn-secondary { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.34); backdrop-filter: blur(12px); }
  .vitality-hero-card { position: relative; justify-self: end; width: min(520px, 100%); border: 1px solid rgba(255,255,255,.34); border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.13); box-shadow: 0 32px 90px rgba(36,9,73,.45); backdrop-filter: blur(16px); }
  .vitality-hero-card img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: center; }
  .vitality-section { padding: clamp(46px, 7vw, 78px) 0; }
  .vitality-signals { background: linear-gradient(180deg, #fbf8ff, #f1eaff); }
  .vitality-signal-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .vitality-signal-grid article, .vitality-product-card, .vitality-empty { border: 1px solid rgba(109,40,217,.16); border-radius: 8px; background: rgba(255,255,255,.72); box-shadow: 0 20px 54px rgba(59,11,120,.10); backdrop-filter: blur(14px); }
  .vitality-signal-grid article { padding: 22px; }
  .vitality-signal-grid span { width: 34px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, var(--vil-gold), var(--vil-violet)); display: block; margin-bottom: 16px; }
  .vitality-signal-grid h2 { margin: 0 0 8px; color: var(--vil-deep); font-size: 22px; line-height: 1.15; }
  .vitality-signal-grid p, .vitality-story p, .vitality-footer p { margin: 0; color: var(--vil-muted); line-height: 1.7; }
  .vitality-featured { background: linear-gradient(180deg, #f1eaff, #fbf8ff); }
  .vitality-section-head { max-width: 780px; margin: 0 0 24px; }
  .vitality-section-head p { margin: 0 0 8px; color: var(--vil-royal); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .vitality-section-head h2 { margin: 0; color: var(--vil-ink); font-size: clamp(30px, 4vw, 52px); line-height: 1.08; letter-spacing: 0; text-wrap: balance; }
  .vitality-featured-grid, .vitality-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .vitality-catalog { background: linear-gradient(180deg, #fbf8ff, #eee6ff); }
  .vitality-catalog-toolbar { display: grid; grid-template-columns: minmax(280px, .82fr) minmax(320px, 1.18fr); gap: 22px; align-items: end; margin-bottom: 28px; }
  .vitality-filter-stack { display: grid; gap: 12px; }
  .vitality-filter-stack input { min-height: 46px; border: 1px solid rgba(109,40,217,.22); border-radius: 999px; padding: 0 16px; color: var(--vil-ink); background: rgba(255,255,255,.86); outline: none; }
  .vitality-segments { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .vitality-segments button { min-height: 40px; background: rgba(255,255,255,.72); color: var(--vil-deep); border-color: rgba(109,40,217,.18); padding: 8px 12px; }
  .vitality-segments button.is-active { background: linear-gradient(135deg, var(--vil-deep), var(--vil-royal)); color: #fff; border-color: rgba(255,255,255,.36); box-shadow: 0 14px 34px rgba(109,40,217,.24); }
  .vitality-product-card { overflow: hidden; display: grid; grid-template-rows: 246px 1fr; min-height: 650px; }
  .vitality-product-card.is-featured { box-shadow: 0 24px 64px rgba(109,40,217,.16), 0 0 36px rgba(200,164,93,.14); }
  .vitality-product-media { position: relative; background: linear-gradient(180deg, #f8f2ff, #ffffff); border-bottom: 1px solid rgba(109,40,217,.14); }
  .vitality-product-media img { width: 100%; height: 246px; object-fit: cover; object-position: center; display: block; }
  .vitality-product-media span { position: absolute; left: 12px; top: 12px; border: 1px solid rgba(255,255,255,.54); border-radius: 999px; background: rgba(59,11,120,.84); color: #fff; padding: 6px 9px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .vitality-product-body { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .vitality-product-body h3 { margin: 0; color: var(--vil-ink); font-size: 24px; line-height: 1.1; font-weight: 900; }
  .vitality-strength { margin: -5px 0 0; color: var(--vil-royal); font-weight: 900; }
  .vitality-product-body p { margin: 0; color: var(--vil-muted); font-size: 14px; line-height: 1.58; }
  .vitality-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .vitality-tags span { border: 1px solid rgba(109,40,217,.16); border-radius: 999px; background: rgba(238,230,255,.84); color: var(--vil-deep); padding: 6px 8px; font-size: 11px; font-weight: 900; }
  .vitality-product-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .vitality-product-footer strong { color: var(--vil-ink); font-size: 25px; }
  .vitality-product-footer a { color: var(--vil-royal); font-size: 13px; font-weight: 900; }
  .vitality-add { width: 100%; }
  .vitality-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(109,40,217,.22); border-radius: 999px; overflow: hidden; }
  .vitality-qty button { height: 44px; border: 0; background: rgba(109,40,217,.12); color: var(--vil-deep); font-size: 20px; font-weight: 900; cursor: pointer; }
  .vitality-qty span { text-align: center; color: var(--vil-ink); font-weight: 900; }
  .vitality-empty { padding: 24px; font-weight: 800; color: var(--vil-muted); }
  .vitality-story { padding: clamp(48px, 7vw, 78px) 0; background: radial-gradient(circle at 18% 20%, rgba(139,92,246,.20), transparent 28%), linear-gradient(135deg, #ffffff, #efe7ff); }
  .vitality-story-grid { display: grid; grid-template-columns: minmax(280px, .86fr) minmax(0, 1.14fr); gap: clamp(22px, 5vw, 52px); align-items: center; }
  .vitality-story img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: center; display: block; border: 1px solid rgba(109,40,217,.18); border-radius: 8px; box-shadow: 0 24px 70px rgba(59,11,120,.18); }
  .vitality-story h2 { margin: 8px 0 12px; color: var(--vil-deep); font-size: clamp(32px, 4.8vw, 58px); line-height: 1.05; letter-spacing: 0; }
  .vitality-story .vitality-btn { margin-top: 18px; }
  .vitality-footer { padding: 28px 0 96px; background: #211735; color: #fff; border-top: 1px solid rgba(200,164,93,.28); }
  .vitality-footer .vitality-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
  .vitality-footer img { width: 150px; max-width: 100%; border-radius: 8px; display: block; }
  .vitality-footer strong { display: block; margin-bottom: 7px; }
  .vitality-footer p { color: #d8c4ff; font-size: 13px; }
  .vitality-footer nav { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .vitality-footer a { color: #f2d996; font-size: 13px; font-weight: 900; }
  .vitality-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(33,23,53,.96); color: #fff; border: 1px solid rgba(200,164,93,.56); border-radius: 18px; padding: 12px; box-shadow: 0 18px 56px rgba(33,23,53,.35); backdrop-filter: blur(12px); }
  .vitality-cart div { display: grid; gap: 2px; }
  .vitality-cart span { color: #f2d996; font-weight: 900; }
  @media (max-width: 940px) {
    .vitality-hero { min-height: 0; background-position: 58% center; }
    .vitality-hero-grid, .vitality-catalog-toolbar, .vitality-story-grid { grid-template-columns: 1fr; }
    .vitality-hero-copy { text-align: center; justify-items: center; }
    .vitality-hero-card { justify-self: center; }
    .vitality-actions, .vitality-segments { width: 100%; justify-content: center; }
    .vitality-actions .vitality-btn, .vitality-segments button { flex: 1 1 160px; }
    .vitality-signal-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .vitality-shell { width: min(100% - 24px, 1180px); }
    .vitality-hero h1 { font-size: 40px; }
    .vitality-hero-logo { width: min(230px, 72vw); }
    .vitality-hero-card img, .vitality-story img { aspect-ratio: 1 / 1; }
    .vitality-product-card { min-height: 0; grid-template-rows: 220px 1fr; }
    .vitality-product-media img { height: 220px; }
    .vitality-footer .vitality-shell { grid-template-columns: 1fr; }
    .vitality-footer img { width: 132px; }
    .vitality-cart { align-items: stretch; flex-direction: column; }
    .vitality-cart button { width: 100%; }
  }
`;
