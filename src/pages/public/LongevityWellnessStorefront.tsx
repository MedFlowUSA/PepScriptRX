import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';

type Category = 'weight' | 'wellness';
type Product = { id: string; sku: string; name: string; strength: string; price: number; category: Category };
type Cart = Record<string, number>;

const STORE = 'Longevity Wellness';
const SLUG = 'longevity-wellness';
const SCOPE = 'LONGEVITY';
const OWNER = 'CYNTHIA50';
const ASSET = '/brands/longevity-wellness';
const CART_KEY = 'pepscriptrx_portal_cart';

const LONGEVITY_PRODUCTS: Product[] = [
  ['retatrutide-5mg','RETA-5','Retatrutide','5 mg',179,'weight'],
  ['retatrutide-10mg','RETA-10','Retatrutide','10 mg',229,'weight'],
  ['retatrutide-15mg','RETA-15','Retatrutide','15 mg',269,'weight'],
  ['retatrutide-20mg','RETA-20','Retatrutide','20 mg',299,'weight'],
  ['retatrutide-30mg','RETA-30','Retatrutide','30 mg',349,'weight'],
  ['tirzepatide-10mg','TIRZ-10','Tirzepatide','10 mg',129,'weight'],
  ['tirzepatide-15mg','TIRZ-15','Tirzepatide','15 mg',149,'weight'],
  ['tirzepatide-20mg','TIRZ-20','Tirzepatide','20 mg',169,'weight'],
  ['tirzepatide-30mg','TIRZ-30','Tirzepatide','30 mg',199,'weight'],
  ['tirzepatide-60mg','TIRZ-60','Tirzepatide','60 mg',249,'weight'],
  ['semaglutide-10mg','SEMA-10','Semaglutide','10 mg',99,'weight'],
  ['cagrisema','CAGRISEMA','CagriSema','2.4 mg + 2.4 mg, 4.8 mg total',249,'weight'],
  ['cagrilintide-5mg','CAGRI-5','Cagrilintide','5 mg',179,'weight'],
  ['bpc-157-5mg','BPC-5','BPC-157','5 mg',99,'wellness'],
  ['bpc-157-10mg','BPC-10','BPC-157','10 mg',139,'wellness'],
  ['tb-500-5mg','TB500-5','TB-500','5 mg',99,'wellness'],
  ['tb-500-10mg','TB500-10','TB-500','10 mg',149,'wellness'],
  ['wolverine-bpc-tb','WOLVERINE-20','Wolverine Stack','BPC-157 10 mg + TB-500 10 mg, 20 mg total',159,'wellness'],
  ['nad-1000iu','NAD-1000','NAD+','1000 mg',149,'wellness'],
  ['glutathione-1500mg','GLUTA-1500','Glutathione','1500 mg',149,'wellness'],
  ['ghk-cu-100mg','GHKCU-100','GHK-Cu','100 mg',129,'wellness'],
  ['glow-peptide-blend','GLOW-70','Glow Stack','70 mg total',169,'wellness'],
  ['tesamorelin-2mg','TESA-2','Tesamorelin','2 mg',99,'wellness'],
  ['tesamorelin-5mg','TESA-5','Tesamorelin','5 mg',149,'wellness'],
  ['tesamorelin-10mg','TESA-10','Tesamorelin','10 mg',199,'wellness'],
  ['sermorelin','SERMORELIN','Sermorelin','Standard',129,'wellness'],
  ['ipamorelin-5mg','IPAM-5','Ipamorelin','5 mg',129,'wellness'],
  ['cjc-ipamorelin-10mg','CJC-IPAM-10','CJC-1295 / Ipamorelin','5 mg + 5 mg, 10 mg total',169,'wellness'],
  ['hgh-somatropin-100iu','HGH-100','HGH / Somatropin','10 IU x 10, 100 IU total',285,'wellness'],
].map(([id,sku,name,strength,price,category]) => ({ id, sku, name, strength, price, category } as Product));

export default function LongevityWellnessStorefront() {
  usePageMeta(`${STORE} | Invest in Your Longevity`, 'Premium wellness products selected to support your goals, recovery, vitality, and long-term well-being.', `${ASSET}/longevity-hero.png`);
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart>({});
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const products = useMemo(() => LONGEVITY_PRODUCTS.filter((p) => (category === 'all' || p.category === category) && `${p.name} ${p.strength}`.toLowerCase().includes(query.toLowerCase().trim())), [category, query]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((sum, [id, qty]) => sum + (LONGEVITY_PRODUCTS.find((p) => p.id === id)?.price ?? 0) * qty, 0);
  const setQty = (id: string, qty: number) => setCart((current) => { const next = { ...current }; if (qty <= 0) delete next[id]; else next[id] = qty; return next; });
  const checkout = () => {
    const items = Object.entries(cart).flatMap(([id, qty]) => { const p = LONGEVITY_PRODUCTS.find((row) => row.id === id); return p ? [{ id:p.id, sku:p.sku, name:p.name, strength:p.strength, technical_name:p.name, category:p.category === 'weight' ? 'GLP / Weight Management' : 'Recovery / Performance / Wellness', price:p.price, qty, inventory_status_at_purchase:'checkout_available', inventory_status_label_at_purchase:'Checkout Available', was_special_order:false }] : []; });
    if (!items.length) return;
    sessionStorage.setItem(CART_KEY, JSON.stringify({ rep:OWNER, scope_code:SCOPE, distributor:SLUG, source_portal:STORE, source_route:`${location.pathname}${location.search}`, store_slug:SLUG, store_name:STORE, brand_id:SLUG, admin_code:SCOPE, account_type:'direct_store', parent_type:null, parent_brand_id:null, commission_owner:OWNER, commission_rate:.5, partner_payout_eligible:true, platform_allocation:.5, store_owner_allocation:.5, partner_commission:.5, rep_commission:.5, downline_commission:0, override_commission:0, items, total, capturedAt:new Date().toISOString() }));
    navigate(`/start?scope=${SCOPE}&source=${SLUG}&rep=${OWNER}&brand=${SLUG}`);
  };
  return <PublicLayout isolatedPortal portalHomePath={`/${SLUG}`} portalName={STORE} portalLogoSrc={`${ASSET}/longevity-logo.png`}>
    <main className="lw">
      <section className="lw-hero"><div className="lw-shell"><div className="lw-copy"><p className="lw-kicker">Curated wellness · Powered by PepScriptRX</p><h1>Invest in Your Longevity</h1><p>Premium wellness products selected to support your goals, recovery, vitality, and long-term well-being.</p><div className="lw-actions"><a href="#shop" className="lw-btn primary">Shop Products</a><a href="#wellness" className="lw-btn secondary">Explore Wellness</a></div></div></div></section>
      <section className="lw-intro" id="wellness"><div className="lw-shell lw-intro-grid"><div><p className="lw-kicker">A more considered path</p><h2>Wellness, elevated.</h2><p>Thoughtfully selected products, transparent presentation, and a secure PepScriptRX experience—brought together for people who take a long view of feeling their best.</p></div><img src={`${ASSET}/longevity-vial.png`} alt="Longevity Wellness luxury vial" /></div></section>
      <section className="lw-shop" id="shop"><div className="lw-shell"><header><p className="lw-kicker">The collection</p><h2>Explore Longevity Wellness</h2></header><div className="lw-toolbar"><input aria-label="Search Longevity Wellness products" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} /><div>{[['all','All'],['weight','Weight Management'],['wellness','Recovery & Wellness']].map(([key,label]) => <button key={key} className={category === key ? 'active' : ''} onClick={() => setCategory(key as Category | 'all')}>{label}</button>)}</div></div><div className="lw-grid">{products.map((p) => <article key={p.id} className="lw-card"><div className="lw-media"><img src={`${ASSET}/longevity-vial.png`} alt={`${p.name} ${p.strength}`} loading="lazy" /><span>{p.category === 'weight' ? 'Weight Management' : 'Recovery & Wellness'}</span></div><div className="lw-card-body"><small>{p.strength}</small><h3>{p.name}</h3><p>Available through secure eligibility review and checkout.</p><div className="lw-price"><strong>${p.price}</strong><Link to={`/mixing/${p.id}`}>Details</Link></div>{cart[p.id] ? <div className="lw-qty"><button aria-label={`Remove ${p.name}`} onClick={() => setQty(p.id, cart[p.id]-1)}>−</button><span>{cart[p.id]}</span><button aria-label={`Add another ${p.name}`} onClick={() => setQty(p.id, cart[p.id]+1)}>+</button></div> : <button className="lw-add" onClick={() => setQty(p.id,1)}>Add to cart</button>}</div></article>)}</div></div></section>
      <section className="lw-promise"><div className="lw-shell"><p className="lw-kicker">Confidence at every step</p><h2>Refined care. Secure experience.</h2><div><span>Curated selection</span><span>Secure checkout</span><span>Quality documentation</span><span>Responsive support</span></div></div></section>
      <footer><div className="lw-shell"><img src={`${ASSET}/longevity-logo.png`} alt={STORE} /><div><strong>{STORE}</strong><p>Direct with PepScriptRX.</p><p className="lw-legal">Products are subject to eligibility review, availability, and applicable requirements. Content is educational and does not provide medical advice, diagnosis, treatment, dosing guidance, or guaranteed outcomes.</p><nav><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/certificates">Quality documents</Link><Link to="/mixing">Mixing Center</Link></nav></div></div></footer>
      {count > 0 && <aside className="lw-cart"><div><strong>{count} item{count === 1 ? '' : 's'}</strong><span>${total.toFixed(2)}</span></div><button onClick={checkout}>Secure checkout</button></aside>}
    </main><style>{styles}</style>
  </PublicLayout>;
}

const styles = `
.lw{--navy:#071b3e;--blue:#075f9d;--teal:#08a9b9;--purple:#6541a4;--pearl:#f7f9fd;--gold:#c5a96d;color:var(--navy);background:var(--pearl);font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow-x:clip}.lw *{box-sizing:border-box}.lw h1,.lw h2,.lw h3{font-family:Georgia,'Times New Roman',serif;font-weight:500}.lw-shell{width:min(1180px,calc(100% - 40px));margin:auto}.lw-kicker{text-transform:uppercase;letter-spacing:.2em;font-size:11px;font-weight:800;color:var(--teal)}.lw-hero{min-height:720px;background-image:linear-gradient(90deg,rgba(247,249,253,.93) 0%,rgba(247,249,253,.76) 37%,rgba(247,249,253,0) 61%),url('${ASSET}/longevity-hero.png');background-size:cover;background-position:center}.lw-hero .lw-shell{min-height:720px;display:flex;align-items:center}.lw-copy{width:min(540px,48%)}.lw h1{font-size:clamp(52px,6vw,82px);line-height:.96;margin:16px 0 22px;color:var(--navy)}.lw-copy>p:not(.lw-kicker){font-size:18px;line-height:1.75;color:#40516b}.lw-actions{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}.lw-btn,.lw-add,.lw-cart button{min-height:48px;padding:0 24px;border:1px solid var(--blue);display:inline-flex;align-items:center;justify-content:center;text-decoration:none;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800;cursor:pointer}.lw-btn.primary,.lw-add,.lw-cart button{background:linear-gradient(135deg,var(--blue),var(--purple));color:#fff}.lw-btn.secondary{color:var(--navy);background:#fff9}.lw-intro{padding:90px 0;background:linear-gradient(135deg,#fff,#eef9fb)}.lw-intro-grid{display:grid;grid-template-columns:1fr 420px;gap:8vw;align-items:center}.lw-intro h2,.lw-shop h2,.lw-promise h2{font-size:clamp(40px,5vw,64px);margin:10px 0 18px}.lw-intro p:not(.lw-kicker){font-size:17px;line-height:1.8;color:#53647b}.lw-intro img{width:100%;border-radius:50% 50% 10px 10px;box-shadow:0 25px 70px #17386a22}.lw-shop{padding:92px 0}.lw-shop header{text-align:center}.lw-toolbar{display:grid;gap:16px;margin:32px 0}.lw-toolbar input{width:min(460px,100%);margin:auto;min-height:50px;padding:0 18px;border:1px solid #b9cadb;background:#fff}.lw-toolbar>div{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.lw-toolbar button{padding:10px 15px;border:1px solid #b9cadb;background:#fff;color:var(--navy);cursor:pointer}.lw-toolbar button.active{background:var(--navy);color:#fff}.lw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.lw-card{background:#fff;border:1px solid #dce4ed;box-shadow:0 12px 34px #17386a0c}.lw-media{height:300px;position:relative;overflow:hidden;background:linear-gradient(145deg,#f7fbff,#eceafa)}.lw-media img{width:100%;height:100%;object-fit:cover;transition:.4s}.lw-card:hover img{transform:scale(1.025)}.lw-media span{position:absolute;top:13px;left:13px;background:#071b3ee8;color:#fff;padding:7px 9px;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.lw-card-body{padding:22px;display:grid;gap:10px}.lw-card small{color:var(--purple);text-transform:uppercase;letter-spacing:.12em}.lw-card h3{font-size:29px;margin:0}.lw-card p{color:#64748b;font-size:13px}.lw-price{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e1e8ef;padding-top:14px}.lw-price strong{font-size:24px}.lw-price a{color:var(--blue);font-size:12px}.lw-add{width:100%;border:0}.lw-qty{display:grid;grid-template-columns:46px 1fr 46px;text-align:center;align-items:center;border:1px solid #b9cadb}.lw-qty button{height:44px;border:0;background:#edf5fa;font-size:20px}.lw-promise{padding:80px 0;text-align:center;background:linear-gradient(135deg,var(--navy),#102e63 55%,var(--purple));color:#fff}.lw-promise h2{color:#fff}.lw-promise>div>div{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}.lw-promise span{padding:14px 18px;border:1px solid #fff4;color:#e9f9ff}.lw footer{padding:48px 0 110px;background:#04132d;color:#fff}.lw footer .lw-shell{display:grid;grid-template-columns:160px 1fr;gap:30px;align-items:center}.lw footer img{width:160px;border-radius:50%;background:#fff}.lw footer p{color:#b8c8dd}.lw-legal{max-width:780px;font-size:11px;line-height:1.6}.lw footer nav{display:flex;gap:16px;flex-wrap:wrap}.lw footer a{color:#74dce6;font-size:12px}.lw-cart{position:fixed;z-index:60;left:50%;bottom:18px;transform:translateX(-50%);width:min(580px,calc(100% - 28px));display:flex;justify-content:space-between;align-items:center;background:#071b3ef5;color:#fff;border:1px solid var(--gold);padding:12px 14px;box-shadow:0 20px 55px #0005}.lw-cart div{display:grid}.lw-cart span{color:#77e2e8}.lw-cart button{border:0}
@media(max-width:850px){.lw-hero{min-height:780px;background-image:linear-gradient(180deg,rgba(247,249,253,.98) 0%,rgba(247,249,253,.88) 48%,rgba(247,249,253,.12) 72%),url('${ASSET}/longevity-hero.png');background-position:68% center}.lw-hero .lw-shell{min-height:780px;align-items:flex-start;padding-top:80px}.lw-copy{width:min(620px,100%)}.lw-intro-grid{grid-template-columns:1fr 320px}.lw-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:580px){.lw-shell{width:min(100% - 24px,1180px)}.lw-hero{min-height:700px;background-size:auto 700px;background-position:64% bottom}.lw-hero .lw-shell{min-height:700px;padding-top:48px}.lw h1{font-size:48px}.lw-copy>p:not(.lw-kicker){font-size:15px;max-width:95%}.lw-actions .lw-btn{width:100%}.lw-intro-grid,.lw-grid{grid-template-columns:1fr}.lw-intro img{max-width:330px;margin:auto}.lw-intro,.lw-shop,.lw-promise{padding:64px 0}.lw-media{height:280px}.lw footer .lw-shell{grid-template-columns:1fr}.lw-cart{align-items:stretch;flex-direction:column;gap:10px}.lw-cart button{width:100%}}
`;
