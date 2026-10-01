import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';
import { computeInventoryStatus } from '../../lib/inventoryStatus';
import { buildPureCart, mapPureCatalogRow, PURE_CATALOG_SELECT, PURE_STORE, pureProductImage, type PureCatalogProduct, type PureCatalogRow } from '../../lib/purePeptideLabsCatalog';
import './PurePeptideLabsStorefront.css';
import './PurePeptideLabsEditions.css';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function PurePeptideLabsStorefront() {
  usePageMeta('Pure Peptide Labs | A considered approach to wellness', 'Discover Pure Peptide Labs, an independent storefront powered by PepScriptRX.', `${PURE_STORE.assets}/hero.png`);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [preferredView] = useState(() => {
    try { return localStorage.getItem('purepeptidelabs_view') === 'his' ? 'his' : 'hers'; }
    catch { return 'hers'; }
  });
  const viewParam = searchParams.get('view');
  const view = viewParam === 'his' || viewParam === 'hers' ? viewParam : preferredView;
  const isHis = view === 'his';
  useEffect(() => {
    try { localStorage.setItem('purepeptidelabs_view', view); } catch { /* Browsing works without storage. */ }
  }, [view]);
  function selectView(next: 'his' | 'hers') {
    setSearchParams((current) => { const params = new URLSearchParams(current); params.set('view', next); return params; });
  }
  const [products, setProducts] = useState<PureCatalogProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart') ?? 'null');
      return saved?.store_slug === PURE_STORE.slug
        ? Object.fromEntries(saved.items.map((p: { id: string; qty: number }) => [p.id, p.qty])) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    if (status !== 'ready') return;
    const next = buildPureCart(products, quantities);
    if (next.items.length) {
      sessionStorage.setItem('pepscriptrx_portal_cart', JSON.stringify(next));
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart') ?? 'null');
        if (saved?.store_slug === PURE_STORE.slug) sessionStorage.removeItem('pepscriptrx_portal_cart');
      } catch { /* Leave other stores' cart storage alone. */ }
    }
  }, [products, quantities, status]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setStatus('error'); return; }
      try {
        const { data, error } = await supabase.from('distributor_products').select(PURE_CATALOG_SELECT)
          .eq('distributor.slug', PURE_STORE.slug).eq('distributor.is_active', true).eq('is_enabled', true)
          .order('featured', { ascending: false });
        if (error) throw error;
        const mapped = ((data ?? []) as unknown as PureCatalogRow[]).map(mapPureCatalogRow)
          .filter((p): p is PureCatalogProduct => p !== null);
        if (mapped.length) {
          const inventory = await supabase.from('public_inventory_status').select('*')
            .eq('catalog_source', 'rx_plus_products').in('product_id', mapped.map((p) => p.id));
          if (inventory.error) throw inventory.error;
          for (const p of mapped) {
            const row = inventory.data?.find((r) => r.product_id === p.id);
            p.inventoryStatus = row ? { ...computeInventoryStatus(row), checkout_allowed: row.checkout_allowed === true } : undefined;
          }
        }
        if (!cancelled) {
          setProducts(mapped.filter((p) => p.inventoryStatus?.inventory_status !== 'hidden'));
          setStatus('ready');
        }
      } catch { if (!cancelled) { setProducts([]); setStatus('error'); } }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const visible = products.filter((p) => (!category || p.category === category)
    && `${p.product_name} ${p.strength} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const cart = buildPureCart(products, quantities);
  const count = cart.items.reduce((sum, p) => sum + p.qty, 0);
  const setQty = (id: string, qty: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, qty) }));
  function checkout() {
    if (!cart.items.length) return;
    sessionStorage.setItem('pepscriptrx_portal_cart', JSON.stringify(cart));
    navigate(`/start?scope=${PURE_STORE.scope}&source=${PURE_STORE.slug}&rep=${PURE_STORE.owner}&brand=${PURE_STORE.slug}`);
  }
  return <PublicLayout isolatedPortal portalHomePath="/purepeptidelabs" portalName={PURE_STORE.name}
    portalLogoSrc={`${PURE_STORE.assets}/logo.png`} portalKey="purepeptidelabs">
    <div className="ppl" data-view={view}>
      <div className="ppl-edition-bar"><span>One brand. Your expression.</span><div className="ppl-edition-switch" role="group" aria-label="Storefront style">
        <button type="button" aria-pressed={isHis} onClick={() => selectView('his')}>His</button>
        <button type="button" aria-pressed={!isHis} onClick={() => selectView('hers')}>Hers</button>
      </div></div>
      <nav className="ppl-nav" aria-label="Pure Peptide Labs collection"><a href="#collection">The collection</a><span aria-hidden="true">✧</span><a href="#our-world">Our world</a><span aria-hidden="true">✧</span><a href="#ppl-help">Here to help</a></nav>
      <section className="ppl-hero" aria-labelledby="ppl-title">
        {isHis ? <div className="ppl-his-hero-art"><span aria-hidden="true">PURE</span><img src={`${PURE_STORE.assets}/vial.png`} alt="Pure Peptide Labs signature vial" fetchPriority="high" /></div>
          : <img className="ppl-hero-image" src={`${PURE_STORE.assets}/hero.png`} alt="A woven basket of unlabelled vials on blush marble" fetchPriority="high" />}
        <div className="ppl-shell"><div className="ppl-hero-copy"><p className="ppl-eyebrow">Pure Peptide Labs / {isHis ? 'His' : 'Hers'}</p>
          <h1 id="ppl-title">{isHis ? <>Your pace.<br />Your focus.<br /><em>Your routine.</em></> : <>A considered<br />approach to<br /><em>wellness.</em></>}</h1>
          <p>{isHis ? <>A clear perspective.<br />An experience built around you.</> : <>A little more intention.<br />An experience, thoughtfully composed.</>}</p>
          <a className="ppl-button" href="#collection">Explore the collection <span aria-hidden="true">↗</span></a>
          <small>25% off products with code <strong>PURE25</strong> at checkout.</small>
          <small>Powered by PepScriptRX</small>
        </div></div>
      </section>
      <div className="ppl-ribbon"><span>Thoughtful details</span><i aria-hidden="true">✧</i><span>Your account, connected</span><i aria-hidden="true">✧</i><span>A personal point of view</span></div>
      <section className="ppl-collection ppl-shell" id="collection">
        <header><p className="ppl-eyebrow">The collection</p><h2>Discover your next chapter.</h2><p>Explore availability and product details, all in one place.</p></header>
        {products.length > 0 && <div className="ppl-filters"><label><span className="ppl-sr">Search products</span><input type="search" placeholder="Search the collection" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <label><span className="ppl-sr">Product category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label></div>}
        {status === 'loading' ? <p className="ppl-empty" role="status">Opening the collection…</p>
          : status === 'error' ? <div className="ppl-empty" role="status"><h3>The collection is temporarily unavailable.</h3><p>Please try again later. Your account and support remain available.</p></div>
          : products.length === 0 ? <div className="ppl-empty"><span className="ppl-ornament" aria-hidden="true">✧</span><h3>Something thoughtful is taking shape.</h3><p>Our collection is being prepared.<br />Please check back for available products and pricing.</p><a href="#our-world">Step inside Pure Peptide Labs <span aria-hidden="true">↗</span></a></div>
          : <><p className="ppl-results" role="status">{visible.length} product{visible.length === 1 ? '' : 's'}</p><div className="ppl-grid">{visible.map((p) => <article className="ppl-card" key={p.id}>
            <div className="ppl-product-image"><img src={pureProductImage(p)} alt="Pure Peptide Labs branded vial; illustrative packaging" loading="lazy" /><span>{p.category}</span></div>
            <div className="ppl-card-content"><p className="ppl-eyebrow">{p.strength}</p><h3>{p.product_name}</h3><strong>{money(p.displayPrice!)}</strong>
              <details><summary>Product details</summary>{p.description && <p>{p.description}</p>}<p>Eligibility and physician review, where applicable, are handled through PepScriptRX.</p><small>Image shows illustrative packaging.</small></details>
              <p className="ppl-availability">{p.inventoryStatus?.inventory_status_label ?? 'Availability under review'}</p>
              {quantities[p.id] > 0 ? <div className="ppl-quantity"><button aria-label={`Remove one ${p.product_name}`} onClick={() => setQty(p.id, quantities[p.id] - 1)}>−</button><output aria-label={`${p.product_name} quantity`}>{quantities[p.id]}</output><button disabled={!p.inventoryStatus?.checkout_allowed} aria-label={`Add one ${p.product_name}`} onClick={() => setQty(p.id, quantities[p.id] + 1)}>+</button></div>
                : <button className="ppl-button" disabled={!p.inventoryStatus?.checkout_allowed} onClick={() => setQty(p.id, 1)}>Add to bag <span aria-hidden="true">+</span></button>}
            </div></article>)}</div>{!visible.length && <p className="ppl-empty">No products match your search. Try another name or category.</p>}</>}
      </section>
      <section className="ppl-story" id="our-world"><div className="ppl-shell ppl-story-grid"><div className="ppl-story-image"><img src={`${PURE_STORE.assets}/vial.png`} alt="Pure Peptide Labs signature vial with ivory and rose-gold branding" loading="lazy" /></div><div><p className="ppl-eyebrow">Welcome to our world</p><h2>Considered.<br />Down to the details.</h2><p>{isHis ? 'Deep blues. Clean lines. A space to browse at your own pace.' : 'Soft textures. Warm tones. A space to browse at your own pace.'}</p><p>Pure Peptide Labs brings a personal perspective to the PepScriptRX experience, with one connected path from your account to order review.</p><Link className="ppl-text-link" to="/login?portal=patient&brand=purepeptidelabs&returnTo=%2Fpurepeptidelabs">Your account, right here <span aria-hidden="true">↗</span></Link></div></div></section>
      <section className="ppl-help ppl-shell" id="ppl-help"><p className="ppl-eyebrow">Here to help</p><h2>A clear path, every step.</h2><div><article><span>01 / EXPLORE</span><h3>Take your time.</h3><p>Read the available product information and pricing before making a selection.</p></article><article><span>02 / CONNECT</span><h3>One familiar account.</h3><p>Use your PepScriptRX account for requests, order updates, and messages with the care team.</p></article><article><span>03 / REVIEW</span><h3>Support along the way.</h3><p>Continue through the platform’s existing eligibility and review process.</p><Link to="/login?portal=patient&brand=purepeptidelabs">Account & support ↗</Link></article></div></section>
      <div className="ppl-signoff"><p>PURE <span>PEPTIDE LABS</span></p><nav aria-label="Store policies"><Link to="/purepeptidelabs/privacy">Privacy</Link><Link to="/purepeptidelabs/terms">Terms</Link></nav></div>
      {count > 0 && <aside className="ppl-bag" aria-label="Shopping bag"><div><strong>{count} item{count === 1 ? '' : 's'} in your bag</strong><span>{money(cart.total)} subtotal</span></div><button className="ppl-button" onClick={checkout}>Continue to checkout ↗</button></aside>}
    </div>
  </PublicLayout>;
}
