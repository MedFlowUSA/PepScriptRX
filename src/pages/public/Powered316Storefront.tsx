import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';
import { computeInventoryStatus } from '../../lib/inventoryStatus';
import { POWERED316 as store, buildPowered316Cart, standardRetailPrice, type Powered316Product } from '../../lib/powered316Catalog';
import './Powered316Storefront.css';

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const key = 'pepscriptrx_portal_cart';
export default function Powered316Storefront() {
  usePageMeta('POWERED BY 316 | The collection', 'Explore the POWERED BY 316 partner collection on PepScriptRX.', `${store.assets}/wheelbarrow-hero.jpg`);
  const navigate = useNavigate();
  const [products, setProducts] = useState<Powered316Product[]>([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [inStock, setInStock] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null'); return saved?.store_slug === '316' ? Object.fromEntries(saved.items.map((p: {id: string; qty: number}) => [p.id, p.qty])) : {}; } catch { return {}; }
  });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!supabase) throw new Error('Unavailable');
        const data: Powered316Product[] = [];
        for (let offset = 0; ; offset += 500) {
          const page = await supabase.from('powered316_catalog').select('id,sku,product_name,strength,category,description,retail_price,suggested_retail_price').order('id').range(offset, offset + 499);
          if (page.error) throw page.error;
          data.push(...(page.data ?? []));
          if ((page.data?.length ?? 0) < 500) break;
        }
        const mapped: Powered316Product[] = [];
        for (let offset = 0; offset < data.length; offset += 200) {
          const batch = data.slice(offset, offset + 200);
          const inventory = await supabase.from('public_inventory_status').select('*').eq('catalog_source', 'rx_plus_products').in('product_id', batch.map(p => p.id));
          if (inventory.error) throw inventory.error;
          mapped.push(...batch.map(p => {
            const row = inventory.data?.find(r => r.product_id === p.id);
            const computed = computeInventoryStatus(row);
            return { ...p, inventoryStatus: row ? { ...computed,
              inventory_status: ['in_stock', 'low_stock', 'special_order', 'out_of_stock', 'hidden'].includes(row.display_stock_status)
                ? row.display_stock_status as typeof computed.inventory_status : computed.inventory_status,
              inventory_status_label: row.display_stock_label ?? computed.inventory_status_label,
              was_special_order: row.was_special_order ?? computed.was_special_order,
              supporting_copy: row.status_message ?? computed.supporting_copy,
              checkout_allowed: row.checkout_allowed === true } : undefined };
          }));
        }
        if (!cancelled) { setProducts(mapped.filter(p => p.inventoryStatus?.inventory_status !== 'hidden')); setStatus('ready'); }
      } catch { if (!cancelled) setStatus('error'); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  const cart = useMemo(() => buildPowered316Cart(products, quantities), [products, quantities]);
  useEffect(() => {
    if (status !== 'ready') return;
    if (cart.items.length) sessionStorage.setItem(key, JSON.stringify(cart));
    else { try { if (JSON.parse(sessionStorage.getItem(key) ?? 'null')?.store_slug === '316') sessionStorage.removeItem(key); } catch { /* Invalid old cart. */ } }
  }, [cart, status]);
  const categories = [...new Set(products.map(p => p.category))].sort();
  const visible = products.filter(p => (!category || p.category === category) && (!inStock || ['in_stock', 'low_stock'].includes(p.inventoryStatus?.inventory_status ?? '')) && `${p.product_name} ${p.strength} ${p.sku}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.product_name.localeCompare(b.product_name) : (sort === 'low' ? 1 : -1) * ((standardRetailPrice(a) ?? 0) - (standardRetailPrice(b) ?? 0)));
  const count = cart.items.reduce((n, p) => n + p.qty, 0);
  const setQty = (id: string, qty: number) => setQuantities(current => ({ ...current, [id]: Math.min(20, Math.max(0, qty)) }));
  function checkout() { if (cart.items.length) { sessionStorage.setItem(key, JSON.stringify(cart)); navigate(`/start?scope=${store.scope}&source=316&brand=316`); } }
  return <PublicLayout isolatedPortal portalKey="316" portalHomePath="/316" portalName={store.name} portalLogoSrc={`${store.assets}/logo.png`}>
    <main className="pb316">
      <nav className="pb316-subnav" aria-label="Collection navigation"><a href="#collection">The collection</a><span>PepScriptRX partner storefront</span><a href="#bag">Bag ({count})</a></nav>
      <section className="pb316-hero">
        <img src={`${store.assets}/wheelbarrow-hero.jpg`} alt="POWERED BY 316 wheelbarrow and branded vials; illustrative brand imagery" fetchPriority="high" width="1672" height="941" />
        <div className="pb316-hero-copy"><p className="pb316-eyebrow">Purpose in every detail</p><h1>Explore the<br /><span>POWERED BY 316</span><br />Collection.</h1><p>Your collection.<br />One connected PepScriptRX experience.</p><a className="pb316-button" href="#collection">Shop All Products <span aria-hidden="true">↗</span></a></div>
      </section>
      <div className="pb316-ribbon"><span>POWERED BY 316</span><span>For research purposes</span><span>Powered by PepScriptRX</span></div>
      <section className="pb316-shell pb316-collection" id="collection"><header><div><p className="pb316-eyebrow">Discover the collection</p><h2>Distinctive by design.</h2></div><p>Browse products, strengths, and current availability.</p></header>
        <div className="pb316-filters"><input aria-label="Search products" type="search" placeholder="Search by product or strength" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name: A–Z</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select><label><input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> In stock</label></div>
        {status === 'loading' ? <p className="pb316-empty" role="status">Loading the collection…</p> : status === 'error' ? <div className="pb316-empty" role="status"><h3>The collection is temporarily unavailable.</h3><p>Please try again later.</p></div> : <><p className="pb316-results" role="status">{visible.length} product{visible.length === 1 ? '' : 's'}</p><div className="pb316-grid">{visible.map(p => <article className="pb316-card" key={p.id}><div className="pb316-media"><img src={`${store.assets}/branded-vial.jpg`} alt="POWERED BY 316 vial; illustrative packaging" loading="lazy" width="600" height="900" /></div><div className="pb316-card-body"><p className="pb316-eyebrow">{p.category}</p><h3>{p.product_name}</h3><p className="pb316-strength">{p.strength}</p><div className="pb316-price">{standardRetailPrice(p) === null ? 'Price unavailable' : money(standardRetailPrice(p)!)}</div><details><summary>Product details</summary><p>{p.description}</p><small>Illustrative packaging. Product and strength are listed above.</small></details><p className="pb316-stock">{p.inventoryStatus?.inventory_status_label ?? 'Availability under review'}</p>{p.inventoryStatus?.supporting_copy && <small>{p.inventoryStatus.supporting_copy}</small>}{quantities[p.id] > 0 ? <div className="pb316-quantity"><button aria-label={`Remove one ${p.product_name} ${p.strength}`} onClick={() => setQty(p.id, quantities[p.id] - 1)}>−</button><output>{quantities[p.id]}</output><button disabled={!p.inventoryStatus?.checkout_allowed} aria-label={`Add one ${p.product_name} ${p.strength}`} onClick={() => setQty(p.id, quantities[p.id] + 1)}>+</button></div> : <button className="pb316-button" disabled={!p.inventoryStatus?.checkout_allowed || standardRetailPrice(p) === null} onClick={() => setQty(p.id, 1)}>Add to bag <span aria-hidden="true">+</span></button>}</div></article>)}</div>{!visible.length && <p className="pb316-empty">No products are available for this selection.</p>}</>}
      </section>
      <section className="pb316-bag pb316-shell" id="bag" aria-label="Shopping bag"><div><p className="pb316-eyebrow">Your selection</p><h2>Shopping bag</h2></div>{cart.items.map(p => <div className="pb316-bag-row" key={p.id}><span>{p.name} · {p.strength} × {p.qty}</span><strong>{money(p.price * p.qty)}</strong><button onClick={() => setQty(p.id, 0)} aria-label={`Remove ${p.name} from bag`}>Remove</button></div>)}<div className="pb316-bag-total"><span>{count} items · {money(cart.total)} subtotal</span><button className="pb316-button" disabled={!count} onClick={checkout}>Continue to checkout ↗</button></div></section>
      <footer className="pb316-footer pb316-shell"><img src={`${store.assets}/logo.png`} alt={store.name} loading="lazy" /><div><p className="pb316-eyebrow">A PepScriptRX partner storefront</p><p>FOR RESEARCH PURPOSES</p><p>Product eligibility, fulfillment, and availability are subject to licensed partner review, state availability, and applicable law.</p><nav><Link to="/316/privacy">Privacy policy</Link><Link to="/316/terms">Terms & conditions</Link><a href="#collection">Back to collection ↑</a></nav></div></footer>
    </main>
  </PublicLayout>;
}
