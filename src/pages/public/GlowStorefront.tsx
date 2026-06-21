import { useMemo, useState } from 'react';
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

const GOALS = [
  ['Radiant Skin', 'Skin-focused wellness and cosmetic support routines.'],
  ['Beauty From Within', 'Peptide wellness options selected for radiance-focused rituals.'],
  ['Energy & Longevity', 'Cellular wellness, clarity, and recovery support.'],
  ['Body Goals', 'Structured metabolic wellness options under appropriate guidance.'],
  ['Recovery & Repair', 'Repair-focused options for active wellness routines.'],
  ['Advanced Wellness', 'Additional performance and optimization options lower in the catalog.'],
];

const RITUAL = [
  ['Radiance Support', 'Start with beauty-focused peptides and antioxidant wellness support.'],
  ['Energy & Longevity', 'Layer in cellular energy options often selected for elevated routines.'],
  ['Body Confidence', 'Explore metabolic wellness support with physician review where applicable.'],
];

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
  'hgh-15iu',
  'hgh-24iu',
  'hgh-36iu',
];

const PRODUCT_COPY: Record<string, { short: string; bestFor: string; why: string; group: 'beauty' | 'metabolic' | 'additional' }> = {
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
    group: 'metabolic',
  },
  'tirzepatide-60mg': {
    short: 'A higher-strength physician-reviewed metabolic wellness option for structured body-goal support under appropriate guidance.',
    bestFor: 'Body goals, metabolic wellness, confidence support, and lifestyle-supported progress.',
    why: 'Customers choose Tirzepatide when they want a structured pathway for metabolic wellness with physician review where applicable.',
    group: 'metabolic',
  },
  'retatrutide-15mg': {
    short: 'An advanced metabolic wellness option for customers looking for a physician-reviewed body-goal support pathway.',
    bestFor: 'Advanced body-goal support, metabolic wellness, and structured routines.',
    why: 'Retatrutide is commonly selected by customers exploring a more advanced metabolic wellness option.',
    group: 'metabolic',
  },
  'semaglutide-10mg': {
    short: 'A popular metabolic wellness option commonly selected by customers looking for structured support on their wellness journey.',
    bestFor: 'Body goals, metabolic wellness, and structured lifestyle-supported progress.',
    why: 'Semaglutide is often selected as a familiar metabolic wellness option with secure checkout and standard review.',
    group: 'metabolic',
  },
  cagrisema: {
    short: 'An advanced metabolic support blend for customers pursuing a structured, physician-reviewed wellness pathway.',
    bestFor: 'Advanced body-goal routines, metabolic support, and physician-reviewed options.',
    why: 'CagriSema is commonly selected by customers looking for an advanced body-goal support pathway.',
    group: 'metabolic',
  },
  'aod-9604-10mg': {
    short: 'A body-composition-focused peptide option commonly selected by customers interested in metabolic and physique support.',
    bestFor: 'Body composition, metabolic wellness, and confidence-centered routines.',
    why: 'AOD-9604 fits customers looking for a body-composition support option within a broader wellness routine.',
    group: 'metabolic',
  },
  'tesamorelin-10mg': {
    short: 'A wellness and body-composition support option often selected by customers interested in advanced metabolic routines.',
    bestFor: 'Body composition, wellness optimization, and advanced metabolic routines.',
    why: 'Tesamorelin is often selected by customers who want advanced support within a structured wellness pathway.',
    group: 'metabolic',
  },
  'bpc-157-10mg': {
    short: 'A recovery support peptide commonly selected for repair-focused wellness routines.',
    bestFor: 'Recovery support, repair-focused routines, and active wellness.',
    why: 'BPC-157 is selected by customers building recovery and repair support into a broader wellness plan.',
    group: 'additional',
  },
  'tb-500-10mg': {
    short: 'A recovery support option commonly selected for mobility, repair, and wellness routines.',
    bestFor: 'Recovery support, mobility-conscious routines, and active wellness.',
    why: 'TB-500 is commonly selected by customers interested in recovery support and repair-focused routines.',
    group: 'additional',
  },
  'wolverine-bpc-tb': {
    short: 'A BPC-157 and TB-500 recovery stack commonly selected by advanced wellness customers.',
    bestFor: 'Advanced recovery support, repair-focused routines, and active wellness.',
    why: 'The Wolverine Stack is selected by customers who want a combined recovery-support pathway.',
    group: 'additional',
  },
  'mots-c-10mg': {
    short: 'A mitochondrial wellness option commonly selected for energy, longevity, and recovery-focused routines.',
    bestFor: 'Energy support, longevity routines, mitochondrial wellness, and active recovery.',
    why: 'MOTS-C fits customers looking to support energy and mitochondrial wellness within a premium routine.',
    group: 'additional',
  },
  'cjc-ipamorelin-10mg': {
    short: 'An advanced performance and recovery support blend available lower in the GLOW catalog.',
    bestFor: 'Advanced performance support, recovery routines, and experienced wellness customers.',
    why: 'Customers choose CJC / Ipamorelin when they want a more performance-oriented option with standard review.',
    group: 'additional',
  },
};

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
  return PRODUCT_COPY[product.id] ?? {
    short: product.description || 'A physician-reviewed wellness support option available through secure PepScriptRX checkout.',
    bestFor: `${meta.commonName} support, advanced wellness routines, and appropriate customer review.`,
    why: `${meta.commonName} is available for customers looking to build a physician-reviewed wellness support routine.`,
    group: 'additional' as const,
  };
}

function productImage(product: DistributorCatalogProduct) {
  if (product.id === 'glow-peptide-blend') return SIGNATURE_IMAGE;
  if (product.id === 'ghk-cu-100mg' || product.id === 'glutathione-1500mg' || product.id.startsWith('nad-')) return SUPPLIES_IMAGE;
  if (product.category.includes('GLP') || product.category.includes('Weight')) return HERO_IMAGE;
  return SIGNATURE_IMAGE;
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
  const [activeGoal, setActiveGoal] = useState<'all' | 'beauty' | 'metabolic' | 'additional'>('all');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const copy = productCopy(product);
    const goalMatch = activeGoal === 'all' || copy.group === activeGoal;
    const q = search.trim().toLowerCase();
    const searchMatch = !q || [product.product_name, product.strength, product.category, product.description, productMetaSearchText(product), copy.short].join(' ').toLowerCase().includes(q);
    return goalMatch && searchMatch;
  });

  const beautyProducts = visibleProducts.filter((product) => productCopy(product).group === 'beauty').slice(0, 8);
  const metabolicProducts = visibleProducts.filter((product) => productCopy(product).group === 'metabolic').slice(0, 8);
  const additionalProducts = visibleProducts.filter((product) => productCopy(product).group === 'additional').slice(0, 10);

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
        <div className="glow-shell glow-hero-grid">
          <div className="glow-hero-copy">
            <div className="glow-lotus" aria-hidden="true"><span /></div>
            <p className="glow-kicker">PepScriptRX beauty wellness boutique</p>
            <h1>GLOW</h1>
            <p className="glow-tagline">Sheer Radiance</p>
            <p className="glow-hero-text">
              A luxury peptide wellness and beauty experience designed for women who want to feel radiant, energized, confident, and beautifully supported from within.
            </p>
            <div className="glow-actions">
              <a className="glow-btn glow-btn-primary" href="#glow-beauty">Shop Beauty & Radiance</a>
              <a className="glow-btn glow-btn-secondary" href="#glow-ritual">Explore Wellness Support</a>
            </div>
            <ProductPurityGuaranteeBadge compact />
          </div>
          <div className="glow-hero-media">
            <img src={HERO_IMAGE} alt="GLOW luxury peptide wellness gift arrangement" />
          </div>
        </div>
      </section>

      <section id="glow-beauty" className="glow-section glow-blush">
        <div className="glow-shell">
          <div className="glow-section-head">
            <p>Beauty & Radiance Best Sellers</p>
            <h2>Signature beauty wellness, first.</h2>
          </div>
          <ProductGrid products={beautyProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
        </div>
      </section>

      <section id="glow-ritual" className="glow-section">
        <div className="glow-shell">
          <div className="glow-section-head">
            <p>The GLOW Ritual</p>
            <h2>Radiance support in three refined steps.</h2>
          </div>
          <div className="glow-ritual-grid">
            {RITUAL.map(([title, body], index) => (
              <article className="glow-ritual-card" key={title}>
                <span>{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="glow-section glow-aqua">
        <div className="glow-shell">
          <div className="glow-section-head">
            <p>Shop by Goal</p>
            <h2>Choose the wellness focus that fits the routine.</h2>
          </div>
          <div className="glow-goal-grid">
            {GOALS.map(([title, body]) => (
              <article className="glow-goal-card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="glow-section">
        <div className="glow-shell">
          <div className="glow-filter-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search GLOW products" aria-label="Search GLOW products" />
            <div className="glow-segments" aria-label="Filter products">
              {[
                ['all', 'All'],
                ['beauty', 'Beauty'],
                ['metabolic', 'Body Goals'],
                ['additional', 'Additional'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={activeGoal === value ? 'active' : ''} onClick={() => setActiveGoal(value as typeof activeGoal)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <StoreSection id="glow-featured" eyebrow="Featured Female-Focused Products" title="Radiance, cellular wellness, and beauty support." products={beautyProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="glow-metabolic" eyebrow="Metabolic & Body Goal Support" title="Structured body-goal options with physician review where applicable." products={metabolicProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
          <StoreSection id="glow-additional" eyebrow="Additional Wellness & Performance" title="Recovery and advanced performance support, placed lower in the boutique." products={additionalProducts} cart={cart} addToCart={addToCart} setQty={setQty} />
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

function StoreSection({ id, eyebrow, title, products, cart, addToCart, setQty }: {
  id: string;
  eyebrow: string;
  title: string;
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
}) {
  if (!products.length) return null;
  return (
    <section id={id} className="glow-product-section">
      <div className="glow-section-head">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <ProductGrid products={products} cart={cart} addToCart={addToCart} setQty={setQty} />
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
      <img src={productImage(product)} alt={`${meta.commonName} GLOW product visual`} loading="lazy" />
      <div className="glow-product-copy">
        <span className="glow-product-category">{copy.group === 'beauty' ? 'Beauty & Radiance' : copy.group === 'metabolic' ? 'Body Goals' : 'Advanced Wellness'}</span>
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
  .glow-hero { background: linear-gradient(135deg, #fff7f3 0%, #f7d9d5 48%, #d2ebe7 100%); padding: clamp(34px, 7vw, 74px) 0 34px; overflow: hidden; }
  .glow-hero-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(300px, 1.08fr); gap: clamp(24px, 5vw, 58px); align-items: center; }
  .glow-hero-copy { display: grid; gap: 16px; align-content: center; }
  .glow-lotus { width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid rgba(184, 138, 61, .36); border-radius: 50%; color: var(--glow-gold); }
  .glow-lotus span { width: 24px; height: 34px; border: 2px solid currentColor; border-radius: 24px 24px 4px 4px; transform: rotate(45deg); box-shadow: -11px 11px 0 -2px currentColor, 11px -11px 0 -2px currentColor; }
  .glow-kicker { margin: 0; color: var(--glow-aqua-deep); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .glow-hero h1 { margin: 0; color: var(--glow-gold); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(64px, 13vw, 142px); line-height: .82; font-weight: 500; letter-spacing: .18em; text-shadow: 0 2px 0 rgba(255,255,255,.6); }
  .glow-tagline { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(22px, 4vw, 38px); letter-spacing: .18em; text-transform: uppercase; }
  .glow-hero-text { margin: 0; max-width: 620px; color: var(--glow-muted); font-size: 17px; line-height: 1.75; }
  .glow-actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .glow-btn, .glow-add, .glow-cart button, .glow-segments button { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
  .glow-btn:hover, .glow-add:hover, .glow-cart button:hover, .glow-segments button:hover { transform: translateY(-1px); }
  .glow-btn-primary, .glow-add, .glow-cart button { background: var(--glow-aqua-deep); color: #fff; box-shadow: 0 14px 30px rgba(47,127,122,.20); }
  .glow-btn-secondary { background: rgba(255,255,255,.72); color: var(--glow-ink); border-color: rgba(184,138,61,.34); }
  .glow-hero-media { border: 1px solid rgba(184,138,61,.30); border-radius: 18px; overflow: hidden; box-shadow: 0 28px 70px rgba(84,54,43,.18); background: var(--glow-ivory); }
  .glow-hero-media img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
  .glow-section { padding: clamp(42px, 7vw, 74px) 0; background: var(--glow-ivory); }
  .glow-blush { background: linear-gradient(180deg, var(--glow-pink-soft), #fffaf7); }
  .glow-aqua { background: linear-gradient(180deg, #eef9f6, #fffaf7); }
  .glow-section-head { max-width: 760px; margin: 0 0 24px; }
  .glow-section-head p { margin: 0 0 8px; color: var(--glow-aqua-deep); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .glow-section-head h2 { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(28px, 4vw, 48px); line-height: 1.08; font-weight: 500; }
  .glow-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
  .glow-product-card { overflow: hidden; display: grid; grid-template-rows: 210px 1fr; background: #fff; border: 1px solid rgba(184,138,61,.22); border-radius: 8px; box-shadow: 0 18px 42px rgba(84,54,43,.10); }
  .glow-product-card img { width: 100%; height: 100%; object-fit: cover; }
  .glow-product-copy { padding: 18px; display: grid; gap: 10px; }
  .glow-product-category { color: var(--glow-aqua-deep); font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .glow-product-copy h3 { margin: 0; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.1; font-weight: 500; }
  .glow-strength { margin: -6px 0 0; color: var(--glow-gold); font-weight: 900; }
  .glow-product-copy p, .glow-product-detail span, .glow-goal-card p, .glow-ritual-card p, .glow-process-grid p { margin: 0; color: var(--glow-muted); font-size: 14px; line-height: 1.6; }
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
  .glow-ritual-grid, .glow-goal-grid, .glow-process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .glow-ritual-card, .glow-goal-card, .glow-process-grid article { background: rgba(255,255,255,.82); border: 1px solid rgba(184,138,61,.20); border-radius: 8px; padding: 22px; box-shadow: 0 16px 34px rgba(84,54,43,.08); }
  .glow-ritual-card span { width: 38px; height: 38px; border-radius: 50%; background: var(--glow-pink); color: var(--glow-gold); display: grid; place-items: center; font-weight: 900; margin-bottom: 12px; }
  .glow-ritual-card h3, .glow-goal-card h3, .glow-process-grid h2 { margin: 0 0 8px; color: var(--glow-ink); font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  .glow-filter-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 32px; align-items: center; }
  .glow-filter-row input { min-height: 46px; border: 1px solid rgba(184,138,61,.24); border-radius: 8px; padding: 0 14px; color: var(--glow-ink); background: #fff; }
  .glow-segments { display: flex; flex-wrap: wrap; gap: 8px; }
  .glow-segments button { background: #fff; color: var(--glow-muted); border-color: rgba(184,138,61,.24); min-height: 40px; padding: 8px 12px; }
  .glow-segments button.active { background: var(--glow-pink); color: var(--glow-ink); border-color: rgba(184,138,61,.34); }
  .glow-product-section { padding-top: 10px; margin-top: 32px; }
  .glow-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(47,37,39,.96); color: #fff; border: 1px solid rgba(184,138,61,.44); border-radius: 12px; padding: 12px; box-shadow: 0 18px 52px rgba(47,37,39,.25); }
  .glow-cart div { display: grid; gap: 2px; }
  .glow-cart strong { font-size: 15px; }
  .glow-cart span { color: #f6d5d0; font-weight: 900; }
  @media (max-width: 820px) {
    .glow-hero-grid, .glow-filter-row { grid-template-columns: 1fr; }
    .glow-hero h1 { letter-spacing: .12em; }
    .glow-hero-media { order: -1; }
    .glow-cart { align-items: stretch; flex-direction: column; }
    .glow-cart button { width: 100%; }
  }
`;
