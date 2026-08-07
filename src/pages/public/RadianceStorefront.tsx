import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';

type CartMap = Record<string, number>;

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const ATTRIBUTION_CODE = 'EHWSUB';
const STORE_SLUG = 'ehwsub';
const STORE_NAME = 'Radiance Wellness';
const LOGO_IMAGE = '/brands/radiance/radiance-logo.png';
const HERO_IMAGE = '/brands/radiance/radiance-hero.png';
const VIAL_IMAGE = '/brands/radiance/radiance-vial.png';
const RADIANCE_PRICE_MULTIPLIER = 0.70;
const RADIANCE_PRICE_OVERRIDES: Record<string, number> = {
  'retatrutide|30mg': 275,
  'tirzepatide|30mg': 275,
  'hgh/somatropin|10iux10,100iutotal': 285,
};

function isOralProduct(product: DistributorCatalogProduct) {
  const productText = [product.product_name, product.strength, product.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\b(oral|capsule|capsules|tablet|tablets|troche|troches)\b/.test(productText);
}

function productPrice(product: DistributorCatalogProduct) {
  const overrideKey = `${product.product_name}|${product.strength}`.toLowerCase().replace(/\s+/g, '');
  const overridePrice = RADIANCE_PRICE_OVERRIDES[overrideKey];
  if (overridePrice !== undefined) return overridePrice;
  const standardPrice = Number(product.displayPrice ?? product.suggested_retail_price ?? 0);
  return Math.round(standardPrice * RADIANCE_PRICE_MULTIPLIER * 100) / 100;
}

function productTitle(product: DistributorCatalogProduct) {
  return [product.product_name, product.strength && product.strength !== 'Standard' ? product.strength : '']
    .filter(Boolean)
    .join(' ');
}

export default function RadianceStorefront() {
  usePageMeta(
    'Radiance Wellness',
    'Explore premium wellness products through a clean, trusted, and elevated shopping experience.',
    HERO_IMAGE,
  );
  const navigate = useNavigate();
  const products = useMemo(
    () => getDistributorProducts(STORE_SLUG).filter((product) => !isOralProduct(product)),
    [],
  );
  const topProducts = useMemo(() => products.slice(0, 10), [products]);
  const [cart, setCart] = useState<CartMap>({});
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFullCatalog, setShowFullCatalog] = useState(false);

  const visibleProducts = products.filter((product) => {
    const search = query.trim().toLowerCase();
    return !search || [product.product_name, product.strength, product.category]
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const subtotal = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return sum + (product ? productPrice(product) * quantity : 0);
  }, 0);

  function addToCart(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  function checkout() {
    const items = Object.entries(cart)
      .map(([id, quantity]) => {
        const product = products.find((item) => item.id === id);
        if (!product) return null;
        return {
          id: product.id,
          product_id: product.id,
          name: product.product_name,
          product_name: product.product_name,
          strength: product.strength,
          category: product.category,
          price: productPrice(product),
          quantity,
          qty: quantity,
          inventory_status_at_purchase: 'checkout_available',
          inventory_status_label_at_purchase: 'Available',
          was_special_order: false,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!items.length) return;

    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      rep: ATTRIBUTION_CODE,
      scope_code: ATTRIBUTION_CODE,
      distributor: STORE_SLUG,
      source_portal: STORE_NAME,
      source_route: `${window.location.pathname}${window.location.search}`,
      store_slug: STORE_SLUG,
      store_name: STORE_NAME,
      account_type: 'rep',
      parent_type: 'admin',
      commission_rate: 0.45,
      partner_payout_eligible: true,
      discount_code: '',
      discount_amount: 0,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));
    const params = new URLSearchParams({ source: 'radiance', brand: 'radiance' });
    navigate(`/start?${params.toString()}`);
  }

  const closeMenu = () => setMenuOpen(false);
  const openFullCatalog = () => {
    setShowFullCatalog(true);
    setMenuOpen(false);
    window.setTimeout(() => document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' }), 40);
  };

  return (
    <div className="radiance-store">
      <header className="radiance-header">
        <div className="radiance-shell radiance-nav">
          <a className="radiance-brand" href="#home" aria-label="Radiance Wellness home" onClick={closeMenu}>
            <img src={LOGO_IMAGE} alt="Radiance Wellness" />
          </a>
          <button className="radiance-menu" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span /><span /><span />
          </button>
          <nav className={menuOpen ? 'is-open' : ''} aria-label="Main navigation">
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#featured" onClick={closeMenu}>Shop</a>
            <a href="#featured" onClick={closeMenu}>Featured</a>
            <a href="#about" onClick={closeMenu}>About</a>
            <a href="#faq" onClick={closeMenu}>FAQ</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
            <Link to="/radiance/customer" onClick={closeMenu}>Account</Link>
          </nav>
          <button className="radiance-cart-button" type="button" onClick={() => document.querySelector('#cart')?.scrollIntoView({ behavior: 'smooth' })}>
            Cart <span>{itemCount}</span>
          </button>
        </div>
      </header>

      <main>
        <section id="home" className="radiance-hero">
          <div className="radiance-shell radiance-hero-grid">
            <div className="radiance-hero-copy">
              <p className="radiance-eyebrow">Premium Peptides. Real Results.</p>
              <h1>Elevated Wellness.<br />Refined Results.</h1>
              <p>Explore premium wellness products through a clean, trusted, and elevated shopping experience.</p>
              <div className="radiance-actions">
                <a className="radiance-button primary" href="#featured">Shop Now</a>
                <a className="radiance-button secondary" href="#featured">Featured Products</a>
              </div>
            </div>
            <div className="radiance-hero-image">
              <img src={HERO_IMAGE} alt="Radiance Wellness premium product collection" />
            </div>
          </div>
        </section>

        <section id="featured" className="radiance-section radiance-featured">
          <div className="radiance-shell">
            <SectionHeading eyebrow="Top Ten Products" title="A thoughtful place to begin." copy="Explore our ten featured products, presented with clear sizing and pricing." />
            <ProductGrid products={topProducts} cart={cart} addToCart={addToCart} updateQuantity={updateQuantity} />
            <div className="radiance-catalog-action">
              <button className="radiance-button primary" type="button" onClick={openFullCatalog}>View Full Catalog</button>
            </div>
          </div>
        </section>

        {showFullCatalog && <section id="shop" className="radiance-section">
          <div className="radiance-shell">
            <div className="radiance-shop-heading">
              <SectionHeading eyebrow="The Collection" title="Shop Radiance Wellness." copy="Browse our complete collection and select the options that fit your wellness goals." />
              <label className="radiance-search">
                <span>Search products</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or category" />
              </label>
            </div>
            {visibleProducts.length ? (
              <ProductGrid products={visibleProducts} cart={cart} addToCart={addToCart} updateQuantity={updateQuantity} />
            ) : (
              <p className="radiance-empty">No products match your search. Try another name or category.</p>
            )}
          </div>
        </section>}

        <section id="about" className="radiance-story">
          <div className="radiance-shell radiance-story-grid">
            <img src={VIAL_IMAGE} alt="Radiance Wellness premium product presentation" />
            <div>
              <p className="radiance-eyebrow">About Radiance Wellness</p>
              <h2>Wellness, beautifully considered.</h2>
              <p>Radiance Wellness brings together quality-focused products, transparent presentation, and a calm, attentive customer experience. Every detail is designed to make browsing and ordering feel simple, polished, and dependable.</p>
              <p>From clear product information to trusted fulfillment and responsive support, our focus is helping you shop with confidence.</p>
            </div>
          </div>
        </section>

        <section className="radiance-trust">
          <div className="radiance-shell radiance-trust-grid">
            {[
              ['◇', 'Premium Quality', 'A carefully selected wellness collection.'],
              ['✦', 'Carefully Presented', 'Clear details in an elegant, easy-to-shop format.'],
              ['⌁', 'Secure Checkout', 'A protected checkout and order-review experience.'],
              ['→', 'Fast Fulfillment', 'Prompt handling with updates along the way.'],
              ['○', 'Customer Support', 'Helpful service when you need assistance.'],
            ].map(([icon, title, copy]) => (
              <article key={title}><span>{icon}</span><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section id="faq" className="radiance-section radiance-faq">
          <div className="radiance-shell">
            <SectionHeading eyebrow="Questions, Answered" title="A clear shopping experience." copy="Helpful information for ordering through Radiance Wellness." />
            <div className="radiance-faq-list">
              <details><summary>How do I place an order?</summary><p>Add your selections to the cart, review the total, and continue to secure checkout.</p></details>
              <details><summary>When will my order ship?</summary><p>Fulfillment timing depends on product availability and required review. You will receive updates as your order progresses.</p></details>
              <details><summary>Can I update my cart?</summary><p>Yes. Use the quantity controls on any product card before continuing to checkout.</p></details>
              <details><summary>Where can I view my order?</summary><p>Use the Account link to securely access your order history and updates.</p></details>
              <details><summary>What if I need help?</summary><p>Radiance Wellness customer support is available through the approved PepScriptRX support channel.</p></details>
            </div>
          </div>
        </section>
      </main>

      {itemCount > 0 && (
        <aside id="cart" className="radiance-cart" aria-label="Shopping cart summary">
          <div><strong>{itemCount} item{itemCount === 1 ? '' : 's'}</strong><span>${subtotal.toFixed(2)}</span></div>
          <button type="button" onClick={checkout}>Continue to Secure Checkout</button>
        </aside>
      )}

      <footer id="contact" className="radiance-footer">
        <div className="radiance-shell radiance-footer-grid">
          <div className="radiance-footer-brand">
            <img src={LOGO_IMAGE} alt="Radiance Wellness" />
            <p>Premium Peptides. Real Results.</p>
          </div>
          <div><h3>Shop</h3><a href="#featured">Top Ten Products</a><button className="radiance-footer-link" type="button" onClick={openFullCatalog}>Full Catalog</button></div>
          <div><h3>Support</h3><a href="#faq">FAQ</a><Link to="/radiance/customer">Customer Account</Link><a href="mailto:support@pepscriptrx.com">Contact Support</a></div>
          <div><h3>Information</h3><Link to="/radiance/privacy">Privacy</Link><Link to="/radiance/terms">Terms</Link><a href="#faq">Shipping Information</a></div>
        </div>
        <div className="radiance-shell radiance-legal">
          <p>Product availability and fulfillment are subject to applicable review, location, and current inventory. Product information is provided for general informational purposes and is not medical advice.</p>
          <span>© {new Date().getFullYear()} Radiance Wellness</span>
        </div>
      </footer>

      <style>{RADIANCE_STYLES}</style>
    </div>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="radiance-section-heading"><p>{eyebrow}</p><h2>{title}</h2><span>{copy}</span></div>;
}

function ProductGrid({ products, cart, addToCart, updateQuantity }: {
  products: DistributorCatalogProduct[];
  cart: CartMap;
  addToCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
}) {
  return (
    <div className="radiance-products">
      {products.map((product) => {
        const quantity = cart[product.id] ?? 0;
        return (
          <article className="radiance-product" key={product.id}>
            <div className="radiance-product-image"><img src={VIAL_IMAGE} alt={`${product.product_name} product presentation`} loading="lazy" /></div>
            <div className="radiance-product-copy">
              <p>{product.category || 'Wellness Collection'}</p>
              <h3>{product.product_name}</h3>
              <span>{product.strength && product.strength !== 'Standard' ? product.strength : 'Product details available at checkout'}</span>
              <strong>${productPrice(product).toFixed(2)}</strong>
              {quantity > 0 ? (
                <div className="radiance-quantity" aria-label={`Quantity for ${productTitle(product)}`}>
                  <button type="button" aria-label="Decrease quantity" onClick={() => updateQuantity(product.id, quantity - 1)}>−</button>
                  <span>{quantity}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
                </div>
              ) : (
                <button className="radiance-add" type="button" onClick={() => addToCart(product.id)}>Add to Cart</button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const RADIANCE_STYLES = `
  .radiance-store{--ivory:#f9f6f0;--cream:#efe8dc;--gold:#ad7d3b;--gold-dark:#86602e;--ink:#242220;--muted:#6f6961;background:#fff;color:var(--ink);font-family:Montserrat,Arial,sans-serif;line-height:1.6}
  .radiance-store *{box-sizing:border-box}.radiance-store a{color:inherit}.radiance-shell{width:min(1200px,calc(100% - 40px));margin:auto}
  .radiance-header{height:84px;position:sticky;top:0;z-index:30;background:rgba(255,255,255,.96);border-bottom:1px solid #e9e2d7;backdrop-filter:blur(12px)}
  .radiance-nav{height:100%;display:flex;align-items:center;gap:30px}.radiance-brand{width:210px;height:68px;overflow:hidden;display:flex;align-items:center;text-decoration:none}.radiance-brand img{width:100%;display:block}
  .radiance-nav nav{display:flex;align-items:center;gap:24px;margin-left:auto}.radiance-nav nav a{text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}.radiance-nav nav a:hover{color:var(--gold)}
  .radiance-cart-button{border:1px solid var(--gold);background:#fff;color:var(--ink);padding:10px 15px;font:600 12px Montserrat;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.radiance-cart-button span{display:inline-grid;place-items:center;margin-left:6px;width:21px;height:21px;border-radius:50%;background:var(--gold);color:#fff}
  .radiance-menu{display:none;border:0;background:none;padding:8px}.radiance-menu span{display:block;width:25px;height:1px;background:var(--ink);margin:6px}
  .radiance-hero{background:linear-gradient(120deg,#fff 0%,var(--ivory) 100%);padding:60px 0}.radiance-hero-grid{display:grid;grid-template-columns:.8fr 1.2fr;align-items:center;gap:55px}.radiance-hero-copy{padding:20px 0}
  .radiance-eyebrow,.radiance-section-heading>p{margin:0 0 14px;color:var(--gold-dark);font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}.radiance-hero h1,.radiance-section-heading h2,.radiance-story h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;line-height:.98}
  .radiance-hero h1{font-size:clamp(52px,6vw,84px);margin:0 0 24px}.radiance-hero-copy>p:not(.radiance-eyebrow){font-size:16px;color:var(--muted);max-width:560px}
  .radiance-actions{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}.radiance-button{min-height:48px;padding:13px 23px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}.radiance-button.primary,.radiance-add,.radiance-cart button{background:var(--gold-dark);color:#fff;border:1px solid var(--gold-dark)}.radiance-button.secondary{border:1px solid var(--gold);background:#fff}
  .radiance-hero-image{overflow:hidden;border:1px solid #d9c9ae;box-shadow:0 24px 60px rgba(78,62,42,.16)}.radiance-hero-image img{width:100%;display:block;aspect-ratio:16/10;object-fit:cover}
  .radiance-section{padding:90px 0}.radiance-featured{background:var(--ivory)}.radiance-section-heading{max-width:680px;margin-bottom:38px}.radiance-section-heading h2{font-size:clamp(38px,5vw,58px);margin:0 0 12px}.radiance-section-heading>span{color:var(--muted)}
  .radiance-catalog-action{display:flex;justify-content:center;margin-top:38px}.radiance-catalog-action button{cursor:pointer}
  .radiance-shop-heading{display:flex;justify-content:space-between;gap:30px;align-items:end}.radiance-search{display:grid;gap:8px;min-width:min(360px,100%);margin-bottom:38px}.radiance-search span{font-size:11px;text-transform:uppercase;letter-spacing:.12em}.radiance-search input{height:48px;border:1px solid #d9d0c5;padding:0 15px;background:#fff;font:14px Montserrat}
  .radiance-products{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}.radiance-product{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e6dfd5}.radiance-product-image{background:linear-gradient(145deg,#f7f2ea,#fff);overflow:hidden}.radiance-product-image img{width:100%;display:block;aspect-ratio:1/1;object-fit:cover}
  .radiance-product-copy{padding:20px;display:flex;flex:1;flex-direction:column}.radiance-product-copy>p{margin:0 0 6px;color:var(--gold-dark);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}.radiance-product h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;line-height:1.05;margin:0 0 8px}.radiance-product-copy>span{color:var(--muted);font-size:12px;min-height:38px}.radiance-product-copy>strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;margin:14px 0}
  .radiance-add{min-height:44px;margin-top:auto;font:600 11px Montserrat;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}.radiance-quantity{margin-top:auto;height:44px;border:1px solid #cbb897;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;text-align:center}.radiance-quantity button{height:100%;border:0;background:var(--ivory);font-size:20px;cursor:pointer}
  .radiance-empty{padding:40px;background:var(--ivory);color:var(--muted)}.radiance-story{padding:90px 0;background:#272522;color:#fff}.radiance-story-grid{display:grid;grid-template-columns:.8fr 1.2fr;align-items:center;gap:70px}.radiance-story img{width:100%;aspect-ratio:1/1;object-fit:cover}.radiance-story h2{font-size:clamp(42px,5vw,64px);margin:0 0 24px}.radiance-story p:not(.radiance-eyebrow){color:#d7d0c7}
  .radiance-trust{padding:55px 0;background:var(--cream)}.radiance-trust-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.radiance-trust article{text-align:center}.radiance-trust article>span{color:var(--gold-dark);font-size:28px}.radiance-trust h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;margin:8px 0}.radiance-trust p{color:var(--muted);font-size:12px;margin:0}
  .radiance-faq{background:var(--ivory)}.radiance-faq-list{max-width:860px}.radiance-faq details{border-top:1px solid #d9d0c5;padding:20px 0}.radiance-faq details:last-child{border-bottom:1px solid #d9d0c5}.radiance-faq summary{cursor:pointer;font-family:'Cormorant Garamond',Georgia,serif;font-size:25px}.radiance-faq details p{color:var(--muted)}
  .radiance-cart{position:fixed;z-index:40;right:20px;bottom:20px;width:min(380px,calc(100% - 40px));padding:16px;background:#fff;border:1px solid #c7ad81;box-shadow:0 18px 50px rgba(50,40,28,.22)}.radiance-cart>div{display:flex;justify-content:space-between;margin-bottom:12px}.radiance-cart button{width:100%;min-height:46px;font:600 11px Montserrat;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
  .radiance-footer{background:#1f1e1c;color:#eee8df;padding:65px 0 25px}.radiance-footer-grid{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:50px}.radiance-footer-brand img{width:230px;background:#fff}.radiance-footer h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;margin:0 0 14px}.radiance-footer a,.radiance-footer-link{display:block;color:#cfc7bc;text-decoration:none;font:12px Montserrat,Arial,sans-serif;margin:8px 0}.radiance-footer-link{padding:0;border:0;background:none;cursor:pointer}.radiance-legal{border-top:1px solid #46423d;margin-top:45px;padding-top:20px;display:flex;gap:30px;justify-content:space-between;color:#a8a095;font-size:10px}.radiance-legal p{max-width:850px;margin:0}
  @media(max-width:960px){.radiance-products{grid-template-columns:repeat(2,1fr)}.radiance-trust-grid{grid-template-columns:repeat(3,1fr)}.radiance-nav nav{display:none;position:absolute;left:0;right:0;top:83px;background:#fff;padding:24px 20px;border-bottom:1px solid #ddd;flex-direction:column;align-items:flex-start}.radiance-nav nav.is-open{display:flex}.radiance-menu{display:block;margin-left:auto}.radiance-hero-grid,.radiance-story-grid{grid-template-columns:1fr}.radiance-hero-copy{order:1}.radiance-shop-heading{display:block}.radiance-footer-grid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:620px){.radiance-shell{width:min(100% - 28px,1200px)}.radiance-header{height:72px}.radiance-brand{width:150px;height:58px}.radiance-nav nav{top:71px}.radiance-cart-button{padding:8px 10px}.radiance-hero{padding:24px 0 48px}.radiance-hero-grid{gap:28px}.radiance-hero-copy{padding:0}.radiance-section,.radiance-story{padding:62px 0}.radiance-products{grid-template-columns:1fr}.radiance-product{display:grid;grid-template-columns:42% 58%}.radiance-product-image img{height:100%;aspect-ratio:auto}.radiance-product h3{font-size:23px}.radiance-trust-grid{grid-template-columns:1fr 1fr}.radiance-footer-grid{grid-template-columns:1fr 1fr;gap:30px}.radiance-footer-brand{grid-column:1/-1}.radiance-legal{display:block}.radiance-legal span{display:block;margin-top:15px}}
`;
