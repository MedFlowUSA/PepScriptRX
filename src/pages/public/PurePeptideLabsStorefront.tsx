import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';
import { computeInventoryStatus } from '../../lib/inventoryStatus';
import { buildPureCart, mapPureCatalogRow, PURE_CATALOG_SELECT, PURE_STORE, pureProductImage, type PureCatalogProduct, type PureCatalogRow } from '../../lib/purePeptideLabsCatalog';
import './PurePeptideLabsStorefront.css';
import { applyPureQuote, collectionLines, quotePureCart, type PureCollection, type PureQuote } from '../../lib/pureCollections';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function PurePeptideLabsStorefront() {
  usePageMeta('Pure Peptide Labs | A considered collection for research', 'Explore individual products and thoughtfully grouped research collections.', `${PURE_STORE.assets}/hero-aqua.webp`);
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
  const [collections, setCollections] = useState<PureCollection[]>([]);
  const [quote, setQuote] = useState<PureQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [bundleQuantities,setBundleQuantities] = useState<Record<string,number>>(()=>{
    try {const saved=JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart')??'null');return saved?.store_slug===PURE_STORE.slug?Object.fromEntries((saved.pure_bundles??[]).map((b:{id:string;quantity:number})=>[b.id,b.quantity])):{};}catch{return {};}
  });
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart') ?? 'null');
      return saved?.store_slug === PURE_STORE.slug
        ? Object.fromEntries(saved.items.filter((p:{bundle_id?:string})=>!p.bundle_id).map((p: { id: string; qty: number }) => [p.id, p.qty])) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    if (status !== 'ready') return;
    const next = buildPureCart(products, quantities);
    if(Object.entries(bundleQuantities).some(([id,qty])=>qty>0&&!collections.some(c=>c.id===id))){setQuote(null);setQuoteBusy(false);setCartMessage('A collection in your bag is no longer published. Remove it before continuing.');return;}
    const lines = [...next.items, ...collections.flatMap(c=>bundleQuantities[c.id]>0?collectionLines(c,bundleQuantities[c.id]):[])];
    let cancelled=false;
    setQuote(null);setCartMessage('');
    if (lines.length) {
      setQuoteBusy(true);
      void quotePureCart(lines).then(q=>{if(cancelled)return;setQuote(q);sessionStorage.setItem('pepscriptrx_portal_cart',JSON.stringify(applyPureQuote(next,q)));})
        .catch(e=>{if(!cancelled)setCartMessage(e.message);}).finally(()=>{if(!cancelled)setQuoteBusy(false);});
    } else {
      setQuoteBusy(false);
      try {
        const saved = JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart') ?? 'null');
        if (saved?.store_slug === PURE_STORE.slug) sessionStorage.removeItem('pepscriptrx_portal_cart');
      } catch { /* Leave other stores' cart storage alone. */ }
    }
    return ()=>{cancelled=true;};
  }, [products, quantities, status, collections, bundleQuantities]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setStatus('error'); return; }
      try {
        const bundleResult = await supabase.from('store_collections').select('*').eq('store_slug',PURE_STORE.slug).eq('published',true).order('display_order');
        if(bundleResult.error)throw bundleResult.error;
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
          setCollections(bundleResult.data as PureCollection[]);
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
  const count = (quote?.items??cart.items).reduce((sum, p) => sum + p.qty, 0);
  const setQty = (id: string, qty: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, qty) }));
  function checkout() {
    if (!quote?.items.length || quoteBusy) return;
    sessionStorage.setItem('pepscriptrx_portal_cart', JSON.stringify(applyPureQuote(cart,quote)));
    navigate(`/start?scope=${PURE_STORE.scope}&source=${PURE_STORE.slug}&rep=${PURE_STORE.owner}&brand=${PURE_STORE.slug}`);
  }
  return <PublicLayout isolatedPortal portalHomePath="/purepeptidelabs" portalName={PURE_STORE.name}
    portalLogoSrc={`${PURE_STORE.assets}/logo-aqua.webp`} portalKey="purepeptidelabs">
    <div className="ppl" data-view={view}>
      <div className="ppl-edition-bar"><span>One brand. Your expression.</span><div className="ppl-edition-switch" role="group" aria-label="Storefront style">
        <button type="button" aria-pressed={isHis} onClick={() => selectView('his')}>His</button>
        <button type="button" aria-pressed={!isHis} onClick={() => selectView('hers')}>Hers</button>
      </div></div>
      <nav className="ppl-nav" aria-label="Pure Peptide Labs collection"><a href="#bundles">Shop Bundles</a><span aria-hidden="true">✧</span><a href="#collection">The Collection</a><span aria-hidden="true">✧</span><a href="#our-world">Our World</a><span aria-hidden="true">✧</span><a href="#ppl-help">Contact</a></nav>
      <section className="ppl-hero" aria-labelledby="ppl-title">
        <img className="ppl-hero-image" src={`${PURE_STORE.assets}/hero-aqua.webp`} alt="Pure Peptide Labs vials in a woven basket with aqua ribbon, eucalyptus and white flowers; illustrative packaging" fetchPriority="high" />
        <div className="ppl-shell"><div className="ppl-hero-copy"><p className="ppl-eyebrow">Pure Peptide Labs / {isHis ? 'His' : 'Hers'}</p>
          <h1 id="ppl-title">A considered<br />collection<br /><em>for research.</em></h1>
          <p>Explore individual products and thoughtfully grouped research collections.</p>
          <div className="ppl-hero-actions"><a className="ppl-button" href="#collection">Shop the Collection <span aria-hidden="true">↗</span></a><a className="ppl-button ppl-button-outline" href="#bundles">Explore Bundles</a></div>
          <small>25% off products with code <strong>PURE25</strong> at checkout.</small>
          <small>Powered by PepScriptRX</small>
        </div></div>
      </section>
      <div className="ppl-ribbon"><span>Thoughtful details</span><i aria-hidden="true">✧</i><span>Your account, connected</span><i aria-hidden="true">✧</i><span>A personal point of view</span></div>
      <section className="ppl-bundles ppl-shell" id="bundles"><header><p className="ppl-eyebrow">Thoughtfully grouped</p><h2>Shop Bundles</h2><p>Individual products. A considered collection. Save 15% together.</p></header>
        <div className="ppl-bundle-grid">{collections.map((b,index)=>{
          const parts=b.components.map(c=>({component:c,product:products.find(p=>p.id===c.product_id&&p.sku===c.sku&&p.strength===c.strength)}));
          const available=parts.every(({product:p})=>p?.inventoryStatus?.checkout_allowed);
          const regular=parts.reduce((s,{component:c,product:p})=>s+(p?.displayPrice??0)*c.quantity,0);
          const total=Math.round((regular*(1-b.discount_percent/100)+Number.EPSILON)*100)/100;
          return <article className="ppl-bundle-card" key={b.id}><span className="ppl-eyebrow">Collection / 0{index+1}</span><h3>{b.name}</h3><div className="ppl-bundle-art"><img className="ppl-collection-image" src={b.image_url} alt="Pure Peptide Labs collection imagery; packaging is illustrative, included variants are listed below" loading="lazy" /></div>
            <ul>{parts.map(({component:c,product:p})=><li key={c.product_id}><span>{c.quantity} × {p?.product_name??c.sku} <small>{c.strength}</small></span><span>{p?money(p.displayPrice!*c.quantity):'Unavailable'}</span></li>)}</ul>
            {parts.every(p=>p.product)&&<div className="ppl-bundle-price"><s>{money(regular)}</s><strong>{money(total)}</strong><span>Save {b.discount_percent}% · {money(regular-total)}</span></div>}
            <p className="ppl-bundle-notice">{available?parts.some(({product:p})=>p?.inventoryStatus?.was_special_order)?'Includes an out-of-stock item. Checkout is available; fulfillment timing requires review.':'Components available for checkout.':'A component is unavailable. This collection cannot be added.'}</p>
            <details><summary>Collection details</summary><p>{b.description}</p><p>Illustrative packaging does not identify a compound or strength. A qualifying promotion replaces collection savings when it gives a better single offer.</p></details>
            <button className="ppl-button" disabled={!available||quoteBusy} onClick={()=>setBundleQuantities(q=>({...q,[b.id]:(q[b.id]??0)+1}))}>Add Collection <span>+</span></button>
            {bundleQuantities[b.id]>0&&<button className="ppl-text-link" onClick={()=>setBundleQuantities(q=>({...q,[b.id]:Math.max(0,q[b.id]-1)}))}>Remove one · {bundleQuantities[b.id]} in bag</button>}
          </article>;
        })}</div><p className="ppl-section-note">Collections are research groupings, not claims of combined health outcomes. Eligibility and review requirements apply to every component.</p>
        {status==='ready'&&!collections.length&&<p>Research collections are being reviewed. Individual products remain available below.</p>}
      </section>
      {cartMessage&&<div className="ppl-cart-message ppl-shell" role="alert"><p>{cartMessage} Please adjust your bag or refresh the collection.</p><button className="ppl-button" onClick={()=>setBundleQuantities({})}>Remove collections from bag</button></div>}
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
      <section className="ppl-story" id="our-world"><div className="ppl-shell ppl-story-grid"><div className="ppl-story-image"><img src={`${PURE_STORE.assets}/vial-aqua.webp`} alt="Pure Peptide Labs sea-glass vial with botanical detailing; illustrative packaging" loading="lazy" /></div><div><p className="ppl-eyebrow">Welcome to our world</p><h2>Considered.<br />Down to the details.</h2><p>Soft textures. Clear details. A space to browse at your own pace.</p><p>Pure Peptide Labs brings a personal perspective to the PepScriptRX experience, with one connected path from your account to order review.</p><Link className="ppl-text-link" to="/login?portal=patient&brand=purepeptidelabs&returnTo=%2Fpurepeptidelabs">Your account, right here <span aria-hidden="true">↗</span></Link></div></div></section>
      <section className="ppl-help ppl-shell" id="ppl-help"><p className="ppl-eyebrow">Here to help</p><h2>A clear path, every step.</h2><div><article><span>01 / EXPLORE</span><h3>Take your time.</h3><p>Read the available product information and pricing before making a selection.</p></article><article><span>02 / CONNECT</span><h3>One familiar account.</h3><p>Use your PepScriptRX account for requests, order updates, and messages with the care team.</p></article><article><span>03 / REVIEW</span><h3>Support along the way.</h3><p>Continue through the platform’s existing eligibility and review process.</p><Link to="/login?portal=patient&brand=purepeptidelabs">Account & support ↗</Link></article></div></section>
      <section className="ppl-contact ppl-shell" aria-label="Pure Peptide Labs contact"><div><p className="ppl-eyebrow">Text or call / Pure Peptide Labs</p><h2>A personal point of contact.</h2><p>For store questions. Your platform account and support remain available.</p></div><div><a href="tel:+19097352151">909-735-2151</a><a href="sms:+19097352151">Send a text ↗</a></div></section>
      <div className="ppl-signoff"><img src={`${PURE_STORE.assets}/logo-aqua.webp`} alt="Pure Peptide Labs" loading="lazy" /><nav aria-label="Store policies"><Link to="/purepeptidelabs/privacy">Privacy</Link><Link to="/purepeptidelabs/terms">Terms</Link></nav></div>
      {(count > 0 || quoteBusy) && <aside className="ppl-bag" aria-label="Shopping bag"><div><strong>{count} item{count === 1 ? '' : 's'} in your bag</strong><span>{quoteBusy ? 'Updating current prices…' : quote ? `${money(quote.total)} · ${money(quote.discount)} collection savings` : money(cart.total)}</span></div><button className="ppl-button" disabled={quoteBusy || !quote || !!cartMessage} onClick={checkout}>Continue to checkout ↗</button></aside>}
    </div>
  </PublicLayout>;
}
