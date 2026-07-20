import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';
import { usePageMeta } from '../../hooks/usePageMeta';

type CartMap = Record<string, number>;

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const GLOW_SCOPE_CODE = 'GLOW';
const GLOW_STORE_NAME = 'GLOW';
const GLOW_STORE_SLUG = 'glow';
const HERO_IMAGE = '/brands/glow/glow-luxury-gift.png';
const SIGNATURE_IMAGE = '/brands/glow/glow-peptide-complex.png';
const SUPPLIES_IMAGE = '/brands/glow/glow-supplies.png';

const PRODUCT_PRIORITY = [
  'glow-peptide-blend',
  'ghk-cu-100mg',
  'glutathione-1500mg',
  'nad-500iu',
  'nad-1000iu',
  'klow-peptide-blend',
  'tesamorelin-10mg',
  'aod-9604-10mg',
  'semaglutide-10mg',
  'tirzepatide-30mg',
  'tirzepatide-60mg',
  'retatrutide-15mg',
  'cagrisema',
  'cjc-ipamorelin-10mg',
  'mots-c-10mg',
  'bpc-157-10mg',
  'tb-500-10mg',
  'wolverine-bpc-tb',
  'igf-1-lr3-1mg',
  'hgh-10iu',
];

type ProductGroup = 'beauty' | 'energy' | 'body' | 'performance';

const PRODUCT_COPY: Record<string, { short: string; bestFor: string; why: string; group: ProductGroup }> = {
  'glow-peptide-blend': {
    short: 'A beauty-centered peptide complex created for radiance, renewal, and confidence from within.',
    bestFor: 'Skin-focused wellness, radiance, recovery support, and beauty routines.',
    why: 'GLOW is positioned as the signature premium option for women who want an elegant peptide wellness routine centered around beauty, skin, and overall radiance.',
    group: 'beauty',
  },
  'ghk-cu-100mg': {
    short: 'A beauty and skin-support peptide commonly associated with skin quality, cosmetic wellness routines, and repair-focused support.',
    bestFor: 'Skin wellness, cosmetic support, hair, skin, nail-focused routines, and repair support.',
    why: 'Customers often select GHK-Cu when they want a beauty-forward peptide option that fits naturally into a radiance and skin wellness routine.',
    group: 'beauty',
  },
  'glutathione-1500mg': {
    short: 'A master antioxidant option commonly selected for beauty, wellness, and cellular support routines.',
    bestFor: 'Antioxidant support, beauty wellness, cellular wellness, and glow-focused routines.',
    why: 'Glutathione is popular in beauty and wellness routines because it is commonly associated with antioxidant support and overall wellness from within.',
    group: 'beauty',
  },
  'nad-100iu': {
    short: 'A cellular energy support option for customers focused on energy, clarity, recovery, and longevity routines.',
    bestFor: 'Cellular energy support, longevity routines, wellness optimization, and fatigue-conscious customers.',
    why: 'NAD+ is often chosen by customers looking to support cellular wellness, energy metabolism, and a more elevated longevity-focused routine.',
    group: 'beauty',
  },
  'nad-500iu': {
    short: 'A premium longevity and cellular energy support option for customers focused on energy, clarity, recovery, and healthy aging routines.',
    bestFor: 'Cellular energy support, longevity routines, wellness optimization, and fatigue-conscious customers.',
    why: 'NAD+ is often chosen by customers looking to support cellular wellness, energy metabolism, and a more elevated longevity-focused routine.',
    group: 'beauty',
  },
  'nad-1000iu': {
    short: 'An elevated cellular energy support option for customers focused on energy, clarity, recovery, and longevity routines.',
    bestFor: 'Cellular energy support, longevity routines, wellness optimization, and fatigue-conscious customers.',
    why: 'NAD+ is often chosen by customers looking to support cellular wellness, energy metabolism, and a more elevated longevity-focused routine.',
    group: 'beauty',
  },
  'klow-peptide-blend': {
    short: 'A wellness and recovery support option designed for customers interested in repair, calm, and whole-body wellness support.',
    bestFor: 'Recovery-focused routines, wellness support, and advanced peptide users.',
    why: 'Klow is commonly selected as a more advanced wellness blend for customers building a recovery and whole-body support routine.',
    group: 'beauty',
  },
  'tirzepatide-30mg': {
    short: 'A physician-reviewed metabolic wellness option commonly selected by customers pursuing structured body-goal support under appropriate guidance.',
    bestFor: 'Body goals, metabolic wellness, confidence support, and lifestyle-supported progress.',
    why: 'Customers choose Tirzepatide when they want a structured pathway for metabolic wellness with physician review where applicable.',
    group: 'body',
  },
  'tirzepatide-60mg': {
    short: 'A higher-strength physician-reviewed metabolic wellness option for structured body-goal support under appropriate guidance.',
    bestFor: 'Body goals, metabolic wellness, confidence support, and lifestyle-supported progress.',
    why: 'Customers choose Tirzepatide when they want a structured pathway for metabolic wellness with physician review where applicable.',
    group: 'body',
  },
  'retatrutide-15mg': {
    short: 'An advanced metabolic wellness option for customers looking for a physician-reviewed body-goal support pathway.',
    bestFor: 'Advanced body-goal support, metabolic wellness, and structured routines.',
    why: 'Retatrutide is commonly selected by customers exploring a more advanced metabolic wellness option.',
    group: 'body',
  },
  'semaglutide-10mg': {
    short: 'A popular metabolic wellness option commonly selected by customers looking for structured support on their wellness journey.',
    bestFor: 'Body goals, metabolic wellness, and structured lifestyle-supported progress.',
    why: 'Semaglutide is often selected as a familiar metabolic wellness option with secure checkout and standard review.',
    group: 'body',
  },
  cagrisema: {
    short: 'An advanced metabolic support blend for customers pursuing a structured, physician-reviewed wellness pathway.',
    bestFor: 'Advanced body-goal routines, metabolic support, and physician-reviewed options.',
    why: 'CagriSema is commonly selected by customers looking for an advanced body-goal support pathway.',
    group: 'body',
  },
  'aod-9604-10mg': {
    short: 'A body-composition-focused peptide option commonly selected by customers interested in metabolic and physique support.',
    bestFor: 'Body composition, metabolic wellness, and confidence-centered routines.',
    why: 'AOD-9604 fits customers looking for a body-composition support option within a broader wellness routine.',
    group: 'body',
  },
  'tesamorelin-10mg': {
    short: 'A longevity and wellness optimization option often selected by customers interested in advanced body-composition routines.',
    bestFor: 'Longevity-focused wellness, body composition, and advanced vitality routines.',
    why: 'Tesamorelin is often selected by customers who want a more elevated cellular wellness and body-composition pathway.',
    group: 'energy',
  },
  'bpc-157-10mg': {
    short: 'Popular for recovery and repair support routines.',
    bestFor: 'Recovery support, repair-focused routines, and active wellness.',
    why: 'BPC-157 is selected by customers building recovery and repair support into a broader wellness plan.',
    group: 'performance',
  },
  'tb-500-10mg': {
    short: 'Often selected for repair-focused and performance-support routines.',
    bestFor: 'Recovery support, mobility-conscious routines, and active wellness.',
    why: 'TB-500 is commonly selected by customers interested in recovery support and repair-focused routines.',
    group: 'performance',
  },
  'wolverine-bpc-tb': {
    short: 'A recovery-focused combination commonly selected by active customers.',
    bestFor: 'Advanced recovery support, repair-focused routines, and active wellness.',
    why: 'The Wolverine Stack is selected by customers who want a combined recovery-support pathway.',
    group: 'performance',
  },
  'mots-c-10mg': {
    short: 'A mitochondrial wellness option commonly selected for energy, longevity, and recovery-focused routines.',
    bestFor: 'Energy support, longevity routines, mitochondrial wellness, and active recovery.',
    why: 'MOTS-C fits customers looking to support energy and mitochondrial wellness within a premium routine.',
    group: 'energy',
  },
  'cjc-ipamorelin-10mg': {
    short: 'Commonly chosen for recovery, wellness optimization, and performance-focused routines.',
    bestFor: 'Advanced performance support, recovery routines, and experienced wellness customers.',
    why: 'Customers choose CJC / Ipamorelin when they want a more performance-oriented option with standard review.',
    group: 'performance',
  },
  'igf-1-lr3-1mg': {
    short: 'An advanced wellness option placed in the performance area for experienced customers.',
    bestFor: 'Advanced performance-oriented wellness routines and experienced peptide customers.',
    why: 'Customers choose IGF-1 LR3 when they want a more specialized option with standard review.',
    group: 'performance',
  },
  'hgh-10iu': {
    short: 'A performance-oriented wellness option kept lower in the boutique for advanced customers.',
    bestFor: 'Advanced wellness, performance support, and experienced customer routines.',
    why: 'HGH options are placed in the additional performance area to keep the page focused on beauty first.',
    group: 'performance',
  },
  'hgh-15iu': {
    short: 'A performance-oriented wellness option kept lower in the boutique for advanced customers.',
    bestFor: 'Advanced wellness, performance support, and experienced customer routines.',
    why: 'HGH options are placed in the additional performance area to keep the page focused on beauty first.',
    group: 'performance',
  },
  'hgh-24iu': {
    short: 'A performance-oriented wellness option kept lower in the boutique for advanced customers.',
    bestFor: 'Advanced wellness, performance support, and experienced customer routines.',
    why: 'HGH options are placed in the additional performance area to keep the page focused on beauty first.',
    group: 'performance',
  },
  'hgh-36iu': {
    short: 'A performance-oriented wellness option kept lower in the boutique for advanced customers.',
    bestFor: 'Advanced wellness, performance support, and experienced customer routines.',
    why: 'HGH options are placed in the additional performance area to keep the page focused on beauty first.',
    group: 'performance',
  },
};

const SUPPLY_CARDS = [
  {
    title: 'Bacteriostatic Water',
    imageAlt: 'GLOW bacteriostatic water vial and supplies',
    body: 'A dedicated mixing essential for customers who need vial-preparation support after product review.',
  },
  {
    title: 'Sterile Syringes',
    imageAlt: 'GLOW pastel sterile syringes on blush packaging',
    body: 'Clean, clinical supplies presented in the same blush and champagne GLOW visual system.',
  },
];

function sortGlowProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function priority(product: DistributorCatalogProduct) {
  const found = PRODUCT_PRIORITY.indexOf(product.id);
  if (found >= 0) return found;
  const search = productMetaSearchText(product).toLowerCase();
  if (search.includes('hgh') || search.includes('igf') || search.includes('performance')) return 900;
  return 500;
}

function productCopy(product: DistributorCatalogProduct) {
  const meta = getProductMetadata(product);
  const search = productMetaSearchText(product).toLowerCase();
  const fallbackGroup: ProductGroup = search.includes('hgh') || search.includes('igf') || search.includes('cjc') || search.includes('performance')
    ? 'performance'
    : search.includes('mots') || search.includes('tesamorelin')
      ? 'energy'
      : 'body';
  return PRODUCT_COPY[product.id] ?? {
    short: product.description || 'A physician-reviewed wellness support option available through secure PepScriptRX checkout.',
    bestFor: `${meta.commonName} support, advanced wellness routines, and appropriate customer review.`,
    why: `${meta.commonName} is available for customers looking to build a physician-reviewed wellness support routine.`,
    group: fallbackGroup,
  };
}

function groupLabel(group: ProductGroup) {
  if (group === 'beauty') return 'Beauty & Radiance';
  if (group === 'energy') return 'Energy & Longevity';
  if (group === 'body') return 'Body Goals & Metabolic Wellness';
  return "Men's Wellness & Performance";
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

export default function GlowStorefront() {
  usePageMeta(
    'GLOW Sheer Radiance',
    'A luxury peptide wellness and beauty storefront for radiance, energy, metabolic wellness, recovery support, and confidence from within.',
    HERO_IMAGE,
  );
  const navigate = useNavigate();
  const products = useMemo(() => sortGlowProducts(getDistributorProducts(GLOW_STORE_SLUG)), []);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const copy = productCopy(product);
    const q = search.trim().toLowerCase();
    const searchMatch = !q || [product.product_name, product.strength, product.category, product.description, productMetaSearchText(product), copy.short].join(' ').toLowerCase().includes(q);
    return searchMatch;
  });

  const beautyProducts = visibleProducts.filter((product) => productCopy(product).group === 'beauty');
  const energyProducts = visibleProducts.filter((product) => productCopy(product).group === 'energy');
  const bodyProducts = visibleProducts.filter((product) => productCopy(product).group === 'body');
  const performanceProducts = visibleProducts.filter((product) => productCopy(product).group === 'performance');

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
      rep: GLOW_SCOPE_CODE,
      scope_code: GLOW_SCOPE_CODE,
      discount_code: '',
      discount_amount: 0,
      distributor: GLOW_STORE_SLUG,
      source_portal: 'GLOW Sheer Radiance',
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: GLOW_STORE_SLUG,
      store_name: GLOW_STORE_NAME,
      admin_code: GLOW_SCOPE_CODE,
      account_type: 'admin',
      parent_type: 'platform',
      commission_rate: 0.8,
      partner_payout_eligible: true,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({ scope: GLOW_SCOPE_CODE, source: 'glow-portal', rep: GLOW_SCOPE_CODE, brand: 'glow' });
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath="/glow" portalName="GLOW" portalKey="glow">
      <section className="glow-hero">
        <div className="glow-shell glow-hero-stack">
          <div className="glow-hero-copy">
            <div className="glow-lotus" aria-hidden="true"><span /></div>
            <p className="glow-kicker">PepScriptRX beauty wellness boutique</p>
            <h1>GLOW</h1>
            <p className="glow-tagline">Sheer Radiance - Peptide Wellness & Beauty</p>
            <p className="glow-hero-text">
              A luxury peptide wellness and beauty experience designed for women who want to feel radiant, energized, confident, and beautifully supported from within.
            </p>
            <p className="glow-hero-note">Curated for women, with wellness and performance peptide options also available for men.</p>
            <div className="glow-actions">
              <a className="glow-btn glow-btn-primary" href="#glow-beauty">Shop Beauty & Wellness</a>
              <a className="glow-btn glow-btn-secondary" href="#glow-men">Explore Men's Wellness</a>
            </div>
          </div>
          <div className="glow-hero-media">
            <img src={HERO_IMAGE} alt="GLOW luxury peptide wellness gift arrangement" />
          </div>
          <ProductPurityGuaranteeBadge compact />
        </div>
      </section>

      <section className="glow-section glow-blush">
        <div className="glow-shell">
          <div className="glow-filter-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search GLOW products" aria-label="Search GLOW products" />
            <div className="glow-jump-links" aria-label="Product section links">
              <a href="#glow-beauty">Beauty</a>
              <a href="#glow-energy">Energy</a>
              <a href="#glow-body">Body Goals</a>
              <a href="#glow-men">Men's Wellness</a>
            </div>
          </div>

          <StoreSection id="glow-beauty" eyebrow="Beauty & Radiance" title="Signature beauty wellness, antioxidant support, and skin-focused routines." products={beautyProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="glow-energy" eyebrow="Energy & Longevity" title="Cellular vitality options without repeating the beauty catalog." products={energyProducts} cart={cart} addToCart={addToCart} setQty={setQty} intro={
            <p className="glow-section-note">NAD+ is featured in Beauty & Radiance for radiance-centered routines. This section highlights complementary energy and longevity options so each product stays easy to find.</p>
          } />
          <StoreSection id="glow-body" eyebrow="Body Goals & Metabolic Wellness" title="Metabolic and body-composition support in one organized section." products={bodyProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="glow-men" eyebrow="Also for Men" title="Men's Wellness & Performance" products={performanceProducts} cart={cart} addToCart={addToCart} setQty={setQty} className="glow-men-section" intro={
            <p className="glow-section-note glow-men-note">GLOW is beauty-forward by design, while also offering carefully selected peptide options for men seeking wellness, recovery, metabolic support, and performance-focused routines.</p>
          } />
        </div>
      </section>

      <section className="glow-section glow-aqua">
        <div className="glow-shell">
          <div className="glow-section-head">
            <p>Supplies & Mixing Essentials</p>
            <h2>Dedicated visuals for preparation support.</h2>
          </div>
          <div className="glow-supply-grid">
            {SUPPLY_CARDS.map((card, index) => (
              <article className="glow-supply-card" key={card.title}>
                <img src={SUPPLIES_IMAGE} alt={card.imageAlt} className={index === 0 ? 'focus-bac' : 'focus-syringe'} loading="lazy" />
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="glow-section glow-blush">
        <div className="glow-shell glow-process-grid">
          <article>
            <p className="glow-kicker">Physician review / safe process</p>
            <h2>Processed through PepScriptRX.</h2>
            <p>
              Every order is processed through the PepScriptRX system with physician review where applicable, secure checkout, and guided support through the Mixing Center and Product Library.
            </p>
          </article>
          <article>
            <p className="glow-kicker">Mixing Center</p>
            <h2>Guided education and vial preparation support.</h2>
            <p>
              Need help understanding mixing, dosing math, or vial preparation? Visit the Mixing Center for guided education and support.
            </p>
            <Link className="glow-btn glow-btn-primary" to="/glow/mixing">Open Mixing Center</Link>
          </article>
        </div>
      </section>

      {count > 0 && (
        <aside className="glow-cart" aria-label="GLOW cart summary">
          <div>
            <strong>{count} item{count === 1 ? '' : 's'}</strong>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <button type="button" onClick={checkout}>Checkout Available</button>
        </aside>
      )}

      <style>{GLOW_STYLES}</style>
    </PublicLayout>
  );
}

function StoreSection({ id, eyebrow, title, products, cart, addToCart, setQty, className, intro, children }: {
  id: string;
  eyebrow: string;
  title: string;
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  className?: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  if (!products.length && !intro && !children) return null;
  return (
    <section id={id} className={`glow-product-section${className ? ` ${className}` : ''}`}>
      <div className="glow-section-head">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {intro}
      {products.length > 0 && <ProductGrid products={products} cart={cart} addToCart={addToCart} setQty={setQty} />}
      {children}
    </section>
  );
}

function ProductGrid({ products, cart, addToCart, setQty }: {
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
}) {
  return (
    <div className="glow-product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} />
      ))}
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
  const copy = productCopy(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  return (
    <article className="glow-product-card">
      <ProductVisual label={meta.commonName} />
      <div className="glow-product-copy">
        <span className="glow-product-category">{groupLabel(copy.group)}</span>
        <h3>{meta.commonName}</h3>
        <p className="glow-strength">{meta.doseLabel}</p>
        <p>{copy.short}</p>
        <div className="glow-product-detail"><strong>Best For</strong><span>{copy.bestFor}</span></div>
        <div className="glow-product-detail"><strong>Why Customers Choose It</strong><span>{copy.why}</span></div>
        <div className="glow-badges">
          <span>Physician Review</span>
          <span>Checkout Available</span>
        </div>
        <div className="glow-card-footer">
          <strong>${price?.toFixed(2) ?? 'Review'}</strong>
          <Link to={`/glow/mixing/${product.id}`}>Mixing Center</Link>
        </div>
        {qty > 0 ? (
          <div className="glow-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`Add another ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="glow-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
        )}
      </div>
    </article>
  );
}

function ProductVisual({ label }: { label: string }) {
  return <img src={SIGNATURE_IMAGE} alt={`${label} GLOW product placeholder`} loading="lazy" />;
}

const GLOW_STYLES = `
  :root {
    --glow-ink: #2f2527;
    --glow-muted: #725f63;
    --glow-pink: #f6d5d0;
    --glow-pink-soft: #fff3f0;
    --glow-aqua: #b8dcd8;
    --glow-aqua-deep: #2f7f7a;
    --glow-gold: #b88a3d;
    --glow-ivory: #fffaf4;
  }
  .glow-shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
  .glow-hero { background: linear-gradient(135deg, #fff7f3 0%, #f7d9d5 48%, #d2ebe7 100%); padding: clamp(36px, 7vw, 76px) 0 34px; overflow: hidden; }
  .glow-hero-stack { display: grid; gap: clamp(20px, 4vw, 36px); justify-items: center; text-align: center; }
  .glow-hero-copy { display: grid; gap: 16px; justify-items: center; max-width: 860px; }
  .glow-lotus { width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid rgba(184, 138, 61, .36); border-radius: 50%; color: var(--glow-gold); }
  .glow-lotus span { width: 24px; height: 34px; border: 2px solid currentColor; border-radius: 24px 24px 4px 4px; transform: rotate(45deg); box-shadow: -11px 11px 0 -2px currentColor, 11px -11px 0 -2px currentColor; }
  .glow-kicker { margin: 0; color: var(--glow-aqua-deep); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .glow-hero h1 { margin: 0; color: var(--glow-gold); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(58px, 12vw, 132px); line-height: .9; font-weight: 500; letter-spacing: .14em; text-shadow: 0 2px 0 rgba(255,255,255,.6); }
  .glow-tagline { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(18px, 3vw, 30px); letter-spacing: .08em; text-transform: uppercase; line-height: 1.25; }
  .glow-hero-text { margin: 0; max-width: 680px; color: var(--glow-muted); font-size: 17px; line-height: 1.75; }
  .glow-hero-note { margin: 0; max-width: 690px; color: var(--glow-ink); background: rgba(255,255,255,.58); border: 1px solid rgba(184,138,61,.26); border-radius: 8px; padding: 12px 16px; font-size: 15px; line-height: 1.55; box-shadow: 0 12px 30px rgba(84,54,43,.08); }
  .glow-actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .glow-btn, .glow-add, .glow-cart button, .glow-jump-links a { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
  .glow-btn:hover, .glow-add:hover, .glow-cart button:hover, .glow-jump-links a:hover { transform: translateY(-1px); }
  .glow-btn-primary, .glow-add, .glow-cart button { background: var(--glow-aqua-deep); color: #fff; box-shadow: 0 14px 30px rgba(47,127,122,.20); }
  .glow-btn-secondary { background: rgba(255,255,255,.78); color: var(--glow-ink); border-color: rgba(184,138,61,.34); box-shadow: 0 12px 26px rgba(84,54,43,.08); }
  .glow-hero-media { width: min(920px, 100%); border: 1px solid rgba(184,138,61,.30); border-radius: 18px; overflow: hidden; box-shadow: 0 28px 70px rgba(84,54,43,.18); background: var(--glow-ivory); }
  .glow-hero-media img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: center; }
  .glow-section { padding: clamp(42px, 7vw, 74px) 0; background: var(--glow-ivory); }
  .glow-blush { background: linear-gradient(180deg, var(--glow-pink-soft), #fffaf7); }
  .glow-aqua { background: linear-gradient(180deg, #eef9f6, #fffaf7); }
  .glow-section-head { max-width: 760px; margin: 0 0 24px; }
  .glow-section-head p { margin: 0 0 8px; color: var(--glow-aqua-deep); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .glow-section-head h2 { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(28px, 4vw, 48px); line-height: 1.08; font-weight: 500; }
  .glow-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .glow-product-card { overflow: hidden; display: grid; grid-template-rows: 240px 1fr; background: #fff; border: 1px solid rgba(184,138,61,.22); border-radius: 8px; box-shadow: 0 18px 42px rgba(84,54,43,.10); min-height: 680px; }
  .glow-product-card > img { width: 100%; height: 240px; object-fit: cover; object-position: center; border-bottom: 1px solid rgba(184,138,61,.18); display: block; }
  .glow-product-copy { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .glow-product-category { color: var(--glow-aqua-deep); font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .glow-product-copy h3 { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.1; font-weight: 500; }
  .glow-strength { margin: -6px 0 0; color: var(--glow-gold); font-weight: 900; }
  .glow-product-copy p, .glow-product-detail span, .glow-process-grid p, .glow-section-note, .glow-supply-card p { margin: 0; color: var(--glow-muted); font-size: 14px; line-height: 1.6; }
  .glow-product-detail { display: grid; gap: 3px; padding-top: 2px; }
  .glow-product-detail strong { color: var(--glow-ink); font-size: 12px; }
  .glow-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  .glow-badges span { border: 1px solid rgba(47,127,122,.18); border-radius: 999px; background: #eef9f6; color: var(--glow-aqua-deep); padding: 6px 9px; font-size: 11px; font-weight: 900; }
  .glow-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px; }
  .glow-card-footer strong { color: var(--glow-ink); font-size: 24px; }
  .glow-card-footer a { color: var(--glow-aqua-deep); font-size: 13px; font-weight: 900; }
  .glow-add { width: 100%; }
  .glow-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(47,127,122,.22); border-radius: 8px; overflow: hidden; }
  .glow-qty button { height: 44px; border: 0; background: #eef9f6; color: var(--glow-aqua-deep); font-size: 20px; font-weight: 900; cursor: pointer; }
  .glow-qty span { text-align: center; color: var(--glow-ink); font-weight: 900; }
  .glow-process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .glow-process-grid article { background: rgba(255,255,255,.82); border: 1px solid rgba(184,138,61,.20); border-radius: 8px; padding: 22px; box-shadow: 0 16px 34px rgba(84,54,43,.08); }
  .glow-process-grid h2 { margin: 0 0 8px; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  .glow-filter-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 32px; align-items: center; }
  .glow-filter-row input { min-height: 46px; border: 1px solid rgba(184,138,61,.24); border-radius: 8px; padding: 0 14px; color: var(--glow-ink); background: #fff; }
  .glow-jump-links { display: flex; flex-wrap: wrap; gap: 8px; }
  .glow-jump-links a { background: #fff; color: var(--glow-muted); border-color: rgba(184,138,61,.24); min-height: 40px; padding: 8px 12px; }
  .glow-product-section { padding-top: 10px; margin-top: 32px; }
  .glow-product-section + .glow-product-section { margin-top: 58px; }
  .glow-section-note { background: #fff; border: 1px solid rgba(184,138,61,.20); border-radius: 8px; padding: 16px; margin-bottom: 18px; }
  .glow-men-section { background: linear-gradient(135deg, rgba(255,250,244,.94), rgba(238,249,246,.88)); border: 1px solid rgba(184,138,61,.24); border-radius: 8px; padding: clamp(22px, 4vw, 34px); box-shadow: 0 18px 42px rgba(84,54,43,.09); }
  .glow-men-section .glow-section-head { position: relative; padding-left: 18px; }
  .glow-men-section .glow-section-head::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 2px; width: 3px; border-radius: 999px; background: linear-gradient(180deg, var(--glow-gold), var(--glow-aqua-deep)); }
  .glow-men-note { background: rgba(255,255,255,.72); }
  .glow-supply-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
  .glow-supply-card { overflow: hidden; display: grid; grid-template-columns: 220px 1fr; gap: 18px; align-items: center; background: rgba(255,255,255,.86); border: 1px solid rgba(184,138,61,.22); border-radius: 8px; box-shadow: 0 16px 34px rgba(84,54,43,.08); }
  .glow-supply-card img { width: 100%; height: 220px; object-fit: cover; border-right: 1px solid rgba(184,138,61,.18); }
  .glow-supply-card img.focus-bac { object-position: 42% 58%; }
  .glow-supply-card img.focus-syringe { object-position: 76% 54%; }
  .glow-supply-card div { padding: 18px 20px 18px 0; }
  .glow-supply-card h3 { margin: 0 0 8px; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.1; font-weight: 500; }
  .glow-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(47,37,39,.96); color: #fff; border: 1px solid rgba(184,138,61,.44); border-radius: 12px; padding: 12px; box-shadow: 0 18px 52px rgba(47,37,39,.25); }
  .glow-cart div { display: grid; gap: 2px; }
  .glow-cart strong { font-size: 15px; }
  .glow-cart span { color: #f6d5d0; font-weight: 900; }
  @media (max-width: 820px) {
    .glow-filter-row, .glow-supply-card { grid-template-columns: 1fr; }
    .glow-actions, .glow-jump-links { width: 100%; }
    .glow-actions .glow-btn, .glow-jump-links a { flex: 1 1 180px; }
    .glow-hero h1 { letter-spacing: .12em; }
    .glow-hero-media img { aspect-ratio: 1 / 1; }
    .glow-supply-card img { height: 240px; border-right: 0; border-bottom: 1px solid rgba(184,138,61,.18); }
    .glow-supply-card div { padding: 0 18px 18px; }
    .glow-cart { align-items: stretch; flex-direction: column; }
    .glow-cart button { width: 100%; }
  }
`;
