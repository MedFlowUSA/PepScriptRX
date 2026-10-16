import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';

type Cart = Record<string, number>;
type Collection = 'weight' | 'recovery' | 'performance' | 'longevity' | 'cognitive' | 'cellular';

const STORE = 'Vita Theory Wellness';
const SLUG = 'vita-theory';
const SCOPE = 'VITATHEORY';
const OWNER = 'VALERIE50';
const CART_KEY = 'pepscriptrx_portal_cart';
const ASSET = '/brands/vita-theory';
const featured = ['bpc-157-10mg', 'cjc-ipamorelin-10mg', 'mots-c-10mg', 'nad-1000mg', 'tirzepatide-30mg'];

const collections: Record<Collection, { label: string; copy: string }> = {
  weight: { label: 'Weight Management', copy: 'Thoughtfully presented metabolic wellness options.' },
  recovery: { label: 'Recovery & Wellness', copy: 'A considered collection focused on restoration.' },
  performance: { label: 'Performance', copy: 'Products selected for modern performance goals.' },
  longevity: { label: 'Longevity', copy: 'An elevated approach to long-range wellbeing.' },
  cognitive: { label: 'Cognitive Wellness', copy: 'A curated path for cognitive wellness research.' },
  cellular: { label: 'Cellular Wellness', copy: 'Cellular and mitochondrial wellness options.' },
};

export default function VitaTheoryStorefront() {
  usePageMeta(`${STORE} | Wellness. Elevated. From Within.`, 'A refined approach to modern wellness, thoughtfully curated and powered by AACTIVATEDRX.', `${ASSET}/vita-theory-basket.png`);
  const navigate = useNavigate();
  const products = useMemo(() => getDistributorProducts('guy').sort((a, b) => rank(a) - rank(b) || a.product_name.localeCompare(b.product_name)), []);
  const availableCollections = useMemo(() => Object.keys(collections).filter((key) => products.some((p) => collectionFor(p) === key)) as Collection[], [products]);
  const [cart, setCart] = useState<Cart>({});
  const [filter, setFilter] = useState<Collection | 'all'>('all');
  const [query, setQuery] = useState('');
  const visible = products.filter((product) => {
    const q = query.trim().toLowerCase();
    return (filter === 'all' || collectionFor(product) === filter) && (!q || productMetaSearchText(product).includes(q) || `${product.product_name} ${product.strength} ${product.category}`.toLowerCase().includes(q));
  });
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => sum + Number(products.find((p) => p.id === id)?.displayPrice ?? 0) * qty, 0);

  const setQty = (id: string, qty: number) => setCart((current) => {
    const next = { ...current };
    if (qty <= 0) delete next[id]; else next[id] = qty;
    return next;
  });

  function checkout() {
    const items = Object.entries(cart).flatMap(([id, qty]) => {
      const product = products.find((row) => row.id === id);
      if (!product) return [];
      const meta = getProductMetadata(product);
      return [{ id: product.id, sku: product.sku, name: meta.commonName, strength: meta.doseLabel, technical_name: meta.technicalName, category: product.category, price: Number(product.displayPrice ?? 0), qty, inventory_status_at_purchase: 'checkout_available', inventory_status_label_at_purchase: 'Checkout Available', was_special_order: false }];
    });
    if (!items.length) return;
    sessionStorage.setItem(CART_KEY, JSON.stringify({
      rep: OWNER, scope_code: SCOPE, discount_code: '', discount_amount: 0, distributor: 'guy', source_portal: STORE,
      source_route: `${window.location.pathname}${window.location.search}`, store_slug: SLUG, store_name: STORE, brand_id: SLUG,
      admin_code: SCOPE, account_type: 'aactivated_child_store', parent_type: 'aactivated_child_brand', parent_brand_id: 'aactivated',
      commission_owner: OWNER, commission_rate: 0.5, partner_payout_eligible: true, platform_allocation: 0.5,
      store_owner_allocation: 0.5, partner_commission: 0.5, rep_commission: 0.5, downline_commission: 0, override_commission: 0,
      items, total: subtotal, capturedAt: new Date().toISOString(),
    }));
    navigate(`/start?scope=${SCOPE}&source=vita-theory&rep=${OWNER}&brand=${SLUG}`);
  }

  return <PublicLayout isolatedPortal portalHomePath="/vita-theory" portalName={STORE} portalLogoSrc={`${ASSET}/vita-theory-logo.png`}>
    <main className="vt">
      <section className="vt-hero">
        <div className="vt-wrap vt-hero-grid">
          <div className="vt-hero-copy">
            <img className="vt-logo" src={`${ASSET}/vita-theory-logo.png`} alt={STORE} />
            <p className="vt-eyebrow">A boutique wellness collection</p>
            <h1>Wellness. Elevated.<br />From Within.</h1>
            <p>A refined approach to modern wellness, thoughtfully curated for those who believe feeling your best begins from within.</p>
            <div className="vt-actions"><a className="vt-button primary" href="#collection">Explore the collection</a><a className="vt-button ghost" href="#story">Discover Vita Theory</a></div>
          </div>
          <figure><img src={`${ASSET}/vita-theory-single-vial.png`} alt="Vita Theory Wellness luxury single-vial presentation" /></figure>
        </div>
      </section>

      <section className="vt-intro" id="story"><div className="vt-wrap vt-narrow"><p className="vt-eyebrow">Our philosophy</p><h2>Science Meets Self-Care</h2><p>Vita Theory Wellness brings together thoughtful wellness, modern science, and an elevated experience designed around one simple philosophy: <em>you are the formula.</em></p></div></section>

      <section className="vt-categories"><div className="vt-wrap"><div className="vt-heading"><p className="vt-eyebrow">Wellness, considered</p><h2>Explore your path</h2></div><div className="vt-category-grid">{availableCollections.map((key) => <button key={key} onClick={() => { setFilter(key); document.querySelector('#collection')?.scrollIntoView({ behavior: 'smooth' }); }}><span>0{availableCollections.indexOf(key) + 1}</span><h3>{collections[key].label}</h3><p>{collections[key].copy}</p></button>)}</div></div></section>

      <section className="vt-editorial"><div className="vt-wrap vt-editorial-grid"><img src={`${ASSET}/vita-theory-basket.png`} alt="Curated Vita Theory Wellness collection in a luxury basket" loading="lazy" /><div><p className="vt-eyebrow">Thoughtfully selected</p><h2>Curated Wellness.<br />Beautifully Delivered.</h2><p>Thoughtfully selected products presented through an elevated wellness experience designed to make every interaction with Vita Theory feel intentional.</p><a className="vt-button primary" href="#collection">Shop Vita Theory</a></div></div></section>

      <section className="vt-catalog" id="collection"><div className="vt-wrap"><div className="vt-heading"><p className="vt-eyebrow">The Vita Theory collection</p><h2>Modern wellness, beautifully presented</h2></div><div className="vt-toolbar"><input aria-label="Search Vita Theory products" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the collection" /><div><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>{availableCollections.map((key) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{collections[key].label}</button>)}</div></div><div className="vt-products">{visible.map((product) => <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} setQty={setQty} />)}</div>{!visible.length && <p className="vt-empty">No products match this collection.</p>}</div></section>

      <section className="vt-about"><div className="vt-wrap vt-about-grid"><div><p className="vt-eyebrow">The Vita Theory vision</p><h2>Small Molecules.<br />Big Vision.</h2><p>Vita Theory Wellness was created around the belief that modern wellness should feel personal, thoughtful, and elevated. We combine carefully curated wellness products with an experience centered on education, accessibility, and exceptional service.</p></div><img src={`${ASSET}/vita-theory-collection.png`} alt="Vita Theory Wellness curated collection display" loading="lazy" /></div></section>

      <footer><div className="vt-wrap"><img src={`${ASSET}/vita-theory-logo.png`} alt={STORE} /><div><strong>Vita Theory Wellness</strong><p>An AACTIVATEDRX child storefront, powered by PepScriptRX.</p><p className="vt-legal">Products are subject to eligibility review, availability, and applicable requirements. Content is educational and does not provide medical advice, dosing guidance, diagnosis, treatment, or guaranteed outcomes.</p><nav><Link to="/aactivated/privacy">Privacy</Link><Link to="/aactivated/terms">Terms</Link><Link to="/aactivated/certificates">Quality documents</Link></nav></div></div></footer>

      {count > 0 && <aside className="vt-cart"><div><strong>{count} item{count === 1 ? '' : 's'}</strong><span>{money(subtotal)}</span></div><button onClick={checkout}>Secure checkout</button></aside>}
    </main><style>{styles}</style>
  </PublicLayout>;
}

function ProductCard({ product, qty, setQty }: { product: DistributorCatalogProduct; qty: number; setQty: (id: string, qty: number) => void }) {
  const meta = getProductMetadata(product);
  const price = product.displayPrice ?? product.suggested_retail_price;
  return <article className="vt-card"><div className="vt-card-image"><img src={`${ASSET}/vita-theory-single-vial.png`} alt={`${meta.commonName} Vita Theory presentation`} loading="lazy" /><span>{collections[collectionFor(product)].label}</span></div><div className="vt-card-body"><p className="vt-strength">{meta.doseLabel}</p><h3>{meta.commonName}</h3><p>{product.description || 'A thoughtfully curated wellness product available through secure review and checkout.'}</p><div className="vt-card-price"><strong>{price == null ? 'Review' : money(price)}</strong><Link to={`/aactivated/mixing/${product.id}`}>View details</Link></div>{qty ? <div className="vt-qty"><button aria-label={`Remove ${meta.commonName}`} onClick={() => setQty(product.id, qty - 1)}>−</button><span>{qty}</span><button aria-label={`Add another ${meta.commonName}`} onClick={() => setQty(product.id, qty + 1)}>+</button></div> : <button className="vt-add" onClick={() => setQty(product.id, 1)}>Add to cart</button>}</div></article>;
}

function collectionFor(product: DistributorCatalogProduct): Collection {
  const value = `${product.id} ${product.product_name} ${product.category}`.toLowerCase();
  if (/tirzep|semag|retatr|cagri|aod|glp/.test(value)) return 'weight';
  if (/selank|semax|dsip|cognitive/.test(value)) return 'cognitive';
  if (/nad|mots|ss-31|glutath|cell/.test(value)) return 'cellular';
  if (/epital|thymosin|longevity/.test(value)) return 'longevity';
  if (/hgh|tesa|cjc|ipamor|igf|performance/.test(value)) return 'performance';
  return 'recovery';
}
function rank(product: DistributorCatalogProduct) { const i = featured.indexOf(product.id); return i < 0 ? 100 : i; }
function money(value: number) { return `$${Number(value).toFixed(2)}`; }

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Montserrat:wght@400;500;600&display=swap');
.vt{--olive:#303521;--sage:#8c9274;--ivory:#f6f1e7;--cream:#fffaf1;--blush:#bc7868;--gold:#b79a5c;--ink:#24251d;background:var(--ivory);color:var(--ink);font-family:Montserrat,system-ui,sans-serif;overflow-x:clip}.vt *{box-sizing:border-box}.vt h1,.vt h2,.vt h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500}.vt-wrap{width:min(1180px,calc(100% - 40px));margin:auto}.vt-narrow{max-width:760px;text-align:center}.vt-eyebrow{color:var(--blush)!important;text-transform:uppercase;letter-spacing:.2em;font-size:11px!important;font-weight:600}.vt-hero{min-height:84vh;padding:70px 0;background:linear-gradient(110deg,rgba(40,43,28,.96),rgba(48,53,33,.88) 48%,rgba(48,53,33,.2)),url('${ASSET}/vita-theory-basket.png') center/cover}.vt-hero-grid{min-height:68vh;display:grid;grid-template-columns:1fr .82fr;gap:8vw;align-items:center}.vt-hero-copy{color:#fff}.vt-logo{width:min(330px,72vw);mix-blend-mode:screen;filter:sepia(1) saturate(.45) brightness(1.45);margin-bottom:25px}.vt-hero h1{font-size:clamp(50px,7vw,88px);line-height:.91;margin:12px 0 24px;letter-spacing:-.03em}.vt-hero-copy>p:not(.vt-eyebrow){max-width:620px;color:#e7e1d5;line-height:1.8}.vt-hero figure{margin:0;overflow:hidden;border:1px solid rgba(202,176,113,.65);box-shadow:0 30px 90px #1118}.vt-hero figure img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover}.vt-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.vt-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:600;text-decoration:none;border:1px solid var(--gold)}.vt-button.primary{background:var(--olive);color:#fff}.vt-hero .primary{background:var(--gold);color:var(--olive)}.vt-button.ghost{color:#fff;background:transparent}.vt-intro{padding:100px 0}.vt-intro h2,.vt-heading h2,.vt-editorial h2,.vt-about h2{font-size:clamp(42px,5vw,66px);line-height:1;margin:10px 0 20px}.vt-intro .vt-narrow>p:last-child{font-size:17px;line-height:1.9;color:#5d5c50}.vt-categories{padding:80px 0;background:#e9e5d8}.vt-heading{text-align:center;margin-bottom:38px}.vt-category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.vt-category-grid button{text-align:left;padding:28px;border:1px solid #cbc5b3;background:rgba(255,250,241,.64);color:var(--ink);cursor:pointer;transition:.2s}.vt-category-grid button:hover{transform:translateY(-3px);border-color:var(--gold);background:var(--cream)}.vt-category-grid span{color:var(--blush);font-size:11px;letter-spacing:.16em}.vt-category-grid h3{font-size:28px;margin:16px 0 8px}.vt-category-grid p{color:#68685c;line-height:1.6;font-size:13px}.vt-editorial{padding:100px 0;background:var(--cream)}.vt-editorial-grid,.vt-about-grid{display:grid;grid-template-columns:1.12fr .88fr;gap:7vw;align-items:center}.vt-editorial img,.vt-about img{width:100%;display:block;box-shadow:0 24px 70px #3a33261c}.vt-editorial p:not(.vt-eyebrow),.vt-about p:not(.vt-eyebrow){line-height:1.85;color:#666557;margin-bottom:28px}.vt-catalog{padding:100px 0}.vt-toolbar{display:grid;gap:18px;margin-bottom:32px}.vt-toolbar input{width:min(460px,100%);margin:auto;min-height:48px;padding:0 18px;border:1px solid #c8c1ae;background:var(--cream);font:inherit}.vt-toolbar>div{display:flex;justify-content:center;flex-wrap:wrap;gap:8px}.vt-toolbar button{border:1px solid #c8c1ae;background:transparent;padding:9px 13px;color:var(--olive);cursor:pointer}.vt-toolbar button.active{background:var(--olive);color:#fff}.vt-products{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.vt-card{background:var(--cream);border:1px solid #d9d1bf;display:grid}.vt-card-image{height:330px;position:relative;overflow:hidden;background:#ddd7c8}.vt-card-image img{width:100%;height:100%;object-fit:cover;transition:.4s}.vt-card:hover .vt-card-image img{transform:scale(1.025)}.vt-card-image span{position:absolute;left:14px;top:14px;background:rgba(48,53,33,.9);color:#fff;padding:7px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.vt-card-body{padding:24px;display:grid;gap:10px;align-content:start}.vt-card h3{font-size:31px;line-height:1;margin:0}.vt-card-body>p:not(.vt-strength){font-size:13px;line-height:1.65;color:#69685d;min-height:64px}.vt-strength{margin:0;color:var(--blush);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.vt-card-price{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #ddd5c3;padding-top:14px}.vt-card-price strong{font-family:'Cormorant Garamond',serif;font-size:25px}.vt-card-price a{font-size:11px;text-transform:uppercase;color:var(--olive)}.vt-add,.vt-cart button{min-height:45px;border:0;background:var(--olive);color:#fff;text-transform:uppercase;letter-spacing:.12em;font-weight:600;cursor:pointer}.vt-qty{display:grid;grid-template-columns:45px 1fr 45px;border:1px solid var(--sage);align-items:center;text-align:center}.vt-qty button{height:43px;border:0;background:#e3e4d6;font-size:20px}.vt-empty{text-align:center}.vt-about{padding:100px 0;background:#dedfce}.vt-about-grid{grid-template-columns:.88fr 1.12fr}.vt-about img{order:2}.vt footer{background:#252a1d;color:#eee8da;padding:50px 0 110px}.vt footer .vt-wrap{display:grid;grid-template-columns:180px 1fr;gap:35px;align-items:center}.vt footer img{width:180px;background:#fff}.vt footer p{color:#c9c7b9}.vt-legal{font-size:11px;line-height:1.6;max-width:780px}.vt footer nav{display:flex;gap:18px;flex-wrap:wrap}.vt footer a{color:#d6bb82;font-size:12px}.vt-cart{position:fixed;z-index:50;left:50%;bottom:18px;transform:translateX(-50%);width:min(580px,calc(100% - 28px));background:rgba(37,42,29,.97);color:#fff;border:1px solid var(--gold);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 20px 60px #1116}.vt-cart div{display:grid}.vt-cart span{color:#d6bb82}.vt-cart button{padding:0 22px;background:var(--gold);color:var(--olive)}
.vt-logo,.vt footer img,.pub-nav-brand img[src*="/brands/vita-theory/"],.pub-footer img[src*="/brands/vita-theory/"]{aspect-ratio:1;border-radius:50%;object-fit:cover;background:#fff}
@media(max-width:850px){.vt-hero-grid,.vt-editorial-grid,.vt-about-grid{grid-template-columns:1fr}.vt-hero{padding-top:48px}.vt-hero figure{max-width:560px}.vt-category-grid,.vt-products{grid-template-columns:repeat(2,1fr)}.vt-about img{order:0}}
@media(max-width:580px){.vt-wrap{width:min(100% - 24px,1180px)}.vt-hero{min-height:auto}.vt-hero-grid{gap:38px}.vt-hero h1{font-size:48px}.vt-actions .vt-button{width:100%}.vt-category-grid,.vt-products{grid-template-columns:1fr}.vt-card-image{height:290px}.vt-intro,.vt-categories,.vt-editorial,.vt-catalog,.vt-about{padding:68px 0}.vt footer .vt-wrap{grid-template-columns:1fr}.vt-cart{align-items:stretch;flex-direction:column;gap:10px}.vt-cart button{width:100%}}
`;
