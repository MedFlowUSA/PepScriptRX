import { useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { RX_PLUS_DISTRIBUTORS, getDistributorProducts } from '../../data/rxPlus';
import type { RxPlusCategory, DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';

type CartMap = Record<string, number>; // productId → qty

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const MARK_PORTAL_PATH = '/EmpireHealth&Wellness';
const GUY_PORTAL_PATH = '/aactivated';
const ROBERT_PORTAL_PATH = '/warxlabz';
const MARK_LOGO_SRC = '/marketing/empire-health-wellness-logo.png';
const MARK_PRODUCT_IMAGE_SRC = '/marketing/empire-product-vial.png';
const GUY_LOGO_SRC = '/marketing/aactivated-rx-logo-v2.png';
const GUY_PRODUCT_IMAGE_SRC = '/marketing/aactivated-product-vial.png';
const ROBERT_LOGO_SRC = '/marketing/warxlabz-logo.png';
const ROBERT_PRODUCT_IMAGE_SRC = '/marketing/warxlabz-vial.png';

type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'alpha';

const CAT_ICONS: Record<string, string> = {
  'GLP / Weight Management': '⚡',
  'Growth / Performance': '🧬',
  'Longevity / Wellness': '✨',
  'Weight Loss / GLP-1':       '⚡',
  'Recovery / Repair':         '🔬',
  'Growth Hormone / Longevity':'🧬',
  'Wellness / Anti-Aging':     '✨',
  'Neuro / Cognitive / Mood':  '🧠',
  'Functional / Supplies':     '📦',
};

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  'best seller': { bg: 'rgba(34,197,94,.15)', color: '#16a34a' },
  'popular':     { bg: 'rgba(37,199,217,.15)', color: '#0e9ab0' },
  'AACTIVATED-RX Exclusive': { bg: 'rgba(37,199,217,.18)', color: '#0891b2' },
  'Partner Catalog': { bg: 'rgba(15,23,42,.08)', color: '#0f172a' },
  'WarXlabz Pricing': { bg: 'rgba(202,138,4,.18)', color: '#92400e' },
};

const CATEGORY_DETAILS: Record<string, { focus: string; faq: string }> = {
  'GLP / Weight Management': {
    focus: 'Expanded GLP and metabolic-support options for weight-management review through AACTIVATED-RX.',
    faq: 'Eligibility depends on health history, current medications, state availability, and clinical review.',
  },
  'Growth / Performance': {
    focus: 'Growth and performance support options for vitality, body-composition, and training goals.',
    faq: 'Some products require additional provider review, lab context, or documentation before fulfillment.',
  },
  'Longevity / Wellness': {
    focus: 'Longevity and wellness compounds requested for energy, oxidative stress, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and clinical review.',
  },
  'Weight Loss / GLP-1': {
    focus: 'Metabolic support options commonly reviewed for appetite, weight-management, and glucose-related goals.',
    faq: 'Eligibility depends on health history, current medications, state availability, and clinical review.',
  },
  'Recovery / Repair': {
    focus: 'Recovery-focused compounds often requested for tissue support, joint comfort, and training recovery goals.',
    faq: 'Use should be supervised by a qualified licensed provider and reviewed against your medical history.',
  },
  'Growth Hormone / Longevity': {
    focus: 'Hormone-support and longevity products commonly reviewed for sleep, body-composition, and vitality goals.',
    faq: 'Some therapies require extra review, lab context, or provider documentation before fulfillment.',
  },
  'Wellness / Anti-Aging': {
    focus: 'Wellness compounds requested for oxidative stress, energy, skin, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and clinical review.',
  },
  'Neuro / Cognitive / Mood': {
    focus: 'Cognitive and mood-support options for customers exploring focus, calm, sleep, or resilience support.',
    faq: 'These products are not emergency care and are not substitutes for mental-health treatment.',
  },
  'Functional / Supplies': {
    focus: 'Supplies and functional add-ons that may support eligible orders and fulfillment workflows.',
    faq: 'Supplies may ship with eligible reviewed orders or require confirmation from the care team.',
  },
};

function cartTotal(cart: CartMap, products: DistributorCatalogProduct[]): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === id);
    return sum + (p?.displayPrice ? p.displayPrice * qty : 0);
  }, 0);
}

function cartCount(cart: CartMap): number {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function cartEntries(cart: CartMap, products: DistributorCatalogProduct[]) {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((e) => e.product);
}

function formatRetailPrice(price: number | null): string {
  return typeof price === 'number' ? `$${price.toFixed(2)}` : 'Retail price not configured';
}

function portalSpecialPriceLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal = false): string | null {
  if (isMarkPortal) return 'Special Empire member pricing is attached through checkout.';
  if (isRobertPortal) return 'Special WarXlabz pricing is attached through checkout under Empire Health & Wellness.';
  if (isGuyPortal) return 'Special AACTIVATED-RX member pricing is attached through checkout.';
  return null;
}

function portalPoweredByLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal: boolean): string {
  if (isRobertPortal) return 'Powered by Empire Health & Wellness and PepScriptRX.';
  if (isMarkPortal) return 'Powered by PepScriptRX.';
  if (isGuyPortal) return 'Powered by PepScriptRX.';
  return 'Powered by PepScriptRX.';
}

function ProductThumbnail({ product, imageSrc }: { product: DistributorCatalogProduct; imageSrc?: string }) {
  const initials = product.product_name
    .split(/\s|\+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const accent = product.category.includes('Weight')
    ? '#25C7D9'
    : product.category.includes('Recovery')
      ? '#22c55e'
      : product.category.includes('Growth')
        ? '#8b5cf6'
        : '#f59e0b';

  return (
    <div style={{
      height: imageSrc ? 132 : 96,
      borderRadius: 12,
      background: imageSrc ? 'radial-gradient(circle at 50% 42%, rgba(37,199,217,.28), #07111f 72%)' : `linear-gradient(145deg, ${accent}22, #ffffff 60%)`,
      border: imageSrc ? '1px solid rgba(37,199,217,.24)' : '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 14,
    }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${product.product_name} ${product.strength}`}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: 8 }}
        />
      ) : (
        <>
          <div style={{ width: 28, height: 74, borderRadius: '10px 10px 6px 6px', border: `2px solid ${accent}`, background: '#fff', boxShadow: '0 10px 20px rgba(7,20,34,.10)' }} />
          <div style={{ position: 'absolute', width: 54, height: 54, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, boxShadow: `0 10px 24px ${accent}44` }}>
            {initials || 'RX'}
          </div>
        </>
      )}
    </div>
  );
}

// ── Quantity Stepper ─────────────────────────────────────────────────────────
function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: 36 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{ width: 36, height: 36, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 18, color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >−</button>
      <div style={{ minWidth: 36, textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--navy)', background: '#fff' }}>{value}</div>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        style={{ width: 36, height: 36, border: 'none', background: 'var(--teal)', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >+</button>
    </div>
  );
}

// ── Cart Drawer (mobile overlay / sidebar) ───────────────────────────────────
function CartDrawer({
  open,
  onClose,
  cart,
  products,
  onQtyChange,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartMap;
  products: DistributorCatalogProduct[];
  onQtyChange: (id: string, qty: number) => void;
  onCheckout: () => void;
}) {
  const entries = cartEntries(cart, products);
  const total = cartTotal(cart, products);
  const count = cartCount(cart);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100dvh', width: Math.min(420, window.innerWidth - 48),
        background: '#fff', zIndex: 1001, boxShadow: '-8px 0 40px rgba(0,0,0,.18)',
        transform: open ? 'translateX(0)' : 'translateX(110%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--navy)' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>Your Order</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 2 }}>{count} {count === 1 ? 'item' : 'items'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Your cart is empty</div>
              <div style={{ fontSize: 13 }}>Browse products and tap + to add items.</div>
            </div>
          ) : entries.map(({ product, qty }) => (
            <div key={product.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14, lineHeight: 1.3 }}>{product.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{product.strength} · {product.category}</div>
                <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700, marginTop: 4 }}>{formatRetailPrice(product.displayPrice ? product.displayPrice * qty : null)}</div>
              </div>
              <Stepper value={qty} onChange={(v) => onQtyChange(product.id, v)} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--card-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Subtotal ({count} items)</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${total.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Clinical review included. Shipping confirmed at checkout.</div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '14px 0', borderRadius: 10 }}
            disabled={entries.length === 0}
            onClick={onCheckout}
          >
            Proceed to Checkout →
          </button>
          <button
            onClick={onClose}
            style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}
          >
            Continue browsing
          </button>
        </div>
      </div>
    </>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({
  product,
  qty,
  onQtyChange,
  onAdd,
  onLearnMore,
  showDiscount,
  isMarkPortal,
  isGuyPortal,
  isRobertPortal,
}: {
  product: DistributorCatalogProduct;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
  onAdd: (id: string) => void;
  onLearnMore: (product: DistributorCatalogProduct) => void;
  showDiscount: boolean;
  isMarkPortal: boolean;
  isGuyPortal: boolean;
  isRobertPortal: boolean;
}) {
  const catIcon = CAT_ICONS[product.category] ?? '💊';
  const inCart = qty > 0;
  const canAddToCart = typeof product.displayPrice === 'number';
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal);

  return (
    <article style={{
      background: '#fff', borderRadius: 14,
      border: inCart ? '2px solid var(--teal)' : '1.5px solid var(--border)',
      boxShadow: inCart ? '0 4px 24px rgba(37,199,217,.14)' : '0 1px 4px rgba(0,0,0,.06)',
      display: 'flex', flexDirection: 'column', transition: 'border-color .2s, box-shadow .2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {inCart && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--teal)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 10px' }}>
          ×{qty} in cart
        </div>
      )}
      {showDiscount && !inCart && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#ecfdf5', color: '#15803d', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '4px 10px', border: '1px solid rgba(34,197,94,.25)' }}>
          Member Pricing
        </div>
      )}
      <div style={{ padding: '20px 20px 0' }}>
        <ProductThumbnail
          product={product}
          imageSrc={isMarkPortal ? MARK_PRODUCT_IMAGE_SRC : isRobertPortal ? ROBERT_PRODUCT_IMAGE_SRC : isGuyPortal ? GUY_PRODUCT_IMAGE_SRC : undefined}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{catIcon}</span>
          <span style={{ fontSize: 11, color: '#0f766e', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{product.category}</span>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy)', margin: '0 0 4px', lineHeight: 1.2 }}>{product.product_name}</h3>
        <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 10 }}>{product.strength}</div>
        <p style={{ fontSize: 12, color: '#334155', fontWeight: 500, lineHeight: 1.55, margin: '0 0 12px' }}>
          {product.description}
        </p>

        {product.badges && product.badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {product.badges.map((badge) => {
              const style = BADGE_COLORS[badge] ?? { bg: 'var(--surface-2)', color: 'var(--navy)' };
              return (
                <span key={badge} style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', padding: '3px 10px', borderRadius: 20, background: style.bg, color: style.color }}>
                  {badge}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ marginBottom: specialPriceLabel ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#102033' }}>{formatRetailPrice(product.displayPrice)}</span>
            {canAddToCart && <span style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>retail price / vial</span>}
          </div>
        </div>
        {specialPriceLabel && (
          <div style={{ fontSize: 12, color: '#0f5132', fontWeight: 800, background: '#ecfdf5', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            {specialPriceLabel}
          </div>
        )}
        {(isGuyPortal || isRobertPortal) && (
          <div style={{ fontSize: 12, color: isRobertPortal ? '#92400e' : '#0e7490', fontWeight: 800, background: isRobertPortal ? '#fef3c7' : '#ecfeff', border: `1px solid ${isRobertPortal ? 'rgba(202,138,4,.32)' : 'rgba(37,199,217,.25)'}`, borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            {isRobertPortal ? 'WarXlabz Custom Catalog' : 'AACTIVATED-RX Partner Catalog'}
          </div>
        )}
        {showDiscount && (
          <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 800, background: '#f0fdfa', border: '1px solid rgba(20,184,166,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            Retail price shown. Your portal code stays attached for checkout review.
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        {inCart ? (
          <Stepper value={qty} onChange={(v) => onQtyChange(product.id, v)} />
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!canAddToCart}
            onClick={() => onAdd(product.id)}
          >
            + Add to Cart
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ flex: inCart ? 1 : '0 0 100%', justifyContent: 'center' }}
          onClick={() => onLearnMore(product)}
        >
          Learn more
        </button>
      </div>
    </article>
  );
}

function ProductDetailModal({
  product,
  onClose,
  onAdd,
  isMarkPortal,
  isGuyPortal,
  isRobertPortal,
}: {
  product: DistributorCatalogProduct | null;
  onClose: () => void;
  onAdd: (id: string) => void;
  isMarkPortal: boolean;
  isGuyPortal: boolean;
  isRobertPortal: boolean;
}) {
  if (!product) return null;
  const details = CATEGORY_DETAILS[product.category] ?? {
    focus: product.description,
    faq: 'Availability, eligibility, and fulfillment are confirmed after clinical review.',
  };
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(7,20,34,.55)', zIndex: 1200 }} />
      <div role="dialog" aria-modal="true" aria-label={`${product.product_name} details`} style={{ position: 'fixed', inset: '7vh 16px auto', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', margin: '0 auto', background: '#fff', borderRadius: 14, zIndex: 1201, boxShadow: '0 24px 70px rgba(0,0,0,.28)', border: '1px solid var(--border)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 86, flexShrink: 0 }}>
            <ProductThumbnail
              product={product}
              imageSrc={isMarkPortal ? MARK_PRODUCT_IMAGE_SRC : isRobertPortal ? ROBERT_PRODUCT_IMAGE_SRC : isGuyPortal ? GUY_PRODUCT_IMAGE_SRC : undefined}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{product.category}</div>
            <h2 style={{ margin: '4px 0', color: 'var(--navy)', fontSize: 24, lineHeight: 1.15 }}>{product.product_name}</h2>
            <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>
              {product.strength} · Retail price {formatRetailPrice(product.displayPrice)}{typeof product.displayPrice === 'number' ? ' / vial' : ''}
            </div>
            {specialPriceLabel && (
              <div style={{ color: '#0f5132', fontSize: 12, fontWeight: 800, marginTop: 6 }}>
                {specialPriceLabel}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close details" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 18 }}>x</button>
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Overview</div>
            <p style={{ margin: 0, color: '#1f2937', fontWeight: 500, lineHeight: 1.7 }}>{details.focus}</p>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Review notes</div>
            <p style={{ margin: 0, color: '#1f2937', fontWeight: 500, lineHeight: 1.7 }}>{details.faq}</p>
          </div>
          <div style={{ background: '#f8fbfc', border: '1px solid var(--border)', borderRadius: 10, padding: 14, color: '#334155', fontSize: 13, fontWeight: 500, lineHeight: 1.7 }}>
            Side effects, suitability, dosing, and instructions vary by individual and must be reviewed with a licensed healthcare professional. This portal does not provide medical advice.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => { onAdd(product.id); onClose(); }}>Add to Cart</button>
            <button className="btn btn-outline" onClick={onClose}>Continue browsing</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RxPlusDistributorPortal() {
  const { distributorSlug = 'guy' } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const resolvedSlug = pathname.toLowerCase() === '/empirehealth&wellness'
    ? 'mark'
    : pathname.toLowerCase() === '/warxlabz'
      ? 'robert'
      : ['/aactivated', '/guy'].includes(pathname.toLowerCase())
        ? 'guy'
        : distributorSlug;

  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === resolvedSlug);
  const products = getDistributorProducts(resolvedSlug);
  const isMarkPortal = resolvedSlug === 'mark';
  const isGuyPortal = resolvedSlug === 'guy';
  const isRobertPortal = resolvedSlug === 'robert';

  usePageMeta(
    isMarkPortal ? 'Empire Health & Wellness — Peptide Therapy' : isGuyPortal ? 'AACTIVATED-RX — Optimize. Recover. Perform.' : (distributor ? distributor.portal_name : 'Advanced Wellness'),
    isMarkPortal
      ? 'Pharmaceutical-grade peptide treatments for weight loss, recovery, hormone support, and longevity. Compounded to order and shipped directly to you after clinical review.'
      : isGuyPortal
        ? 'Shop curated wellness options for weight management, performance, recovery, longevity, and cognitive support.'
        : 'Advanced wellness catalog.',
  );

  const [category, setCategory] = useState<'All' | RxPlusCategory>('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('featured');
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [cart, setCart] = useState<CartMap>({});
  const [cartOpen, setCartOpen] = useState(false);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchCat = category === 'All' || p.category === category;
      const matchQ = !q || [p.product_name, p.strength, p.category, ...(p.badges ?? [])].some((v) => v.toLowerCase().includes(q));
      return matchCat && matchQ;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc') return (a.displayPrice ?? Number.MAX_SAFE_INTEGER) - (b.displayPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price-desc') return (b.displayPrice ?? 0) - (a.displayPrice ?? 0);
      if (sort === 'alpha') return a.product_name.localeCompare(b.product_name);
      if (a.distributorProduct.featured !== b.distributorProduct.featured) return a.distributorProduct.featured ? -1 : 1;
      return a.product_name.localeCompare(b.product_name);
    });
  }, [category, products, search, sort]);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);

  const addToCart = useCallback((id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const handleCheckout = useCallback(() => {
    const entries = cartEntries(cart, products);
    if (entries.length === 0) return;
    const portalRepCode = isMarkPortal ? 'MARK65' : isGuyPortal ? 'GUY60' : isRobertPortal ? 'ROBERT' : resolvedSlug.toUpperCase();
    const cartPayload = {
      rep: portalRepCode,
      distributor: resolvedSlug,
      items: entries.map(({ product, qty }) => ({
        id: product.id,
        name: product.product_name,
        strength: product.strength,
        category: product.category,
        price: product.displayPrice ?? 0,
        qty,
      })),
      total: cartTotal(cart, products),
      capturedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartPayload));
    const params = new URLSearchParams({
      rep:      portalRepCode,
      discount: portalRepCode,
      source:  `${resolvedSlug}-portal`,
    });
    navigate(`/start?${params}`);
  }, [cart, products, isMarkPortal, isGuyPortal, isRobertPortal, resolvedSlug, navigate]);

  const count = cartCount(cart);
  const total = cartTotal(cart, products);

  if (!distributor) {
    return (
      <PublicLayout>
        <section className="section">
          <div className="container-sm">
            <div className="empty-state card">
              <div className="empty-state-icon">+</div>
              <div className="empty-state-title">Portal not found</div>
              <div className="empty-state-desc">This distributor portal is not active or has not been configured.</div>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout
      isolatedPortal={isMarkPortal || isGuyPortal || isRobertPortal}
      portalHomePath={isMarkPortal ? MARK_PORTAL_PATH : isGuyPortal ? GUY_PORTAL_PATH : isRobertPortal ? ROBERT_PORTAL_PATH : '/'}
      portalName={isMarkPortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : isRobertPortal ? 'WarXlabz' : distributor.portal_name}
      portalLogoSrc={isMarkPortal ? MARK_LOGO_SRC : isGuyPortal ? GUY_LOGO_SRC : isRobertPortal ? ROBERT_LOGO_SRC : undefined}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ background: isRobertPortal ? 'linear-gradient(135deg, #050505 0%, #181714 48%, #3a311f 100%)' : 'linear-gradient(135deg, #0a1628 0%, #0d2040 60%, #0e2d4a 100%)', padding: '56px 0 44px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,199,217,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 580 }}>
              {isMarkPortal && (
                <img
                  src={MARK_LOGO_SRC}
                  alt="Empire Health & Wellness"
                  style={{
                    width: 'min(420px, 86vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 14,
                    boxShadow: '0 24px 60px rgba(0,0,0,.28)',
                  }}
                />
              )}
              {isGuyPortal && (
                <img
                  src={GUY_LOGO_SRC}
                  alt="AACTIVATED-RX"
                  style={{
                    width: 'min(360px, 82vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    filter: 'drop-shadow(0 18px 36px rgba(37,199,217,.28))',
                  }}
                />
              )}
              {isRobertPortal && (
                <img
                  src={ROBERT_LOGO_SRC}
                  alt="WarXlabz"
                  style={{
                    width: 'min(520px, 88vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 12,
                    boxShadow: '0 24px 70px rgba(250,204,21,.16)',
                  }}
                />
              )}
              {/* Brand line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#25C7D9,#0e9ab0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧬</div>
                <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {isMarkPortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : distributor.portal_name}
                </span>
              </div>

              <h1 style={{ color: '#fff', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, margin: '0 0 14px', lineHeight: 1.1, letterSpacing: '-.02em' }}>
                {isMarkPortal ? 'Advanced Peptide Therapy' : isGuyPortal ? 'Optimize. Recover. Perform.' : isRobertPortal ? 'Train Hard. Recover Tactical.' : 'Advanced Wellness Products'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 15, margin: '0 0 24px', lineHeight: 1.7 }}>
                {isMarkPortal
                  ? 'Pharmaceutical-grade peptides for weight loss, recovery, hormone support, and longevity. Select your products, set your quantity, and our clinical team will review and ship your order directly to you.'
                  : isGuyPortal
                    ? 'Explore targeted wellness support for weight management, performance, recovery, longevity, and cognitive health. Choose your options and submit your request for care-team review.'
                    : isRobertPortal
                      ? 'WarXlabz custom pricing for performance, recovery, and wellness support. Orders remain under Empire Health & Wellness hierarchy and PepScriptRX clinical review.'
                      : 'Curated advanced wellness products for performance, recovery, and longevity.'}
              </p>

              {/* Trust badges */}
              {(isMarkPortal || isGuyPortal || isRobertPortal) && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { icon: '✓', label: isGuyPortal ? 'Curated Wellness Options' : 'Pharmaceutical Grade' },
                    { icon: '✓', label: isGuyPortal ? 'Care Team Review' : 'Clinical Review Included' },
                    { icon: '✓', label: 'Discreet Shipping' },
                    { icon: '✓', label: isGuyPortal ? 'AACTIVATED-RX Member Pricing' : 'Compounded to Order' },
                  ].map(({ icon, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(37,199,217,.12)', color: '#25C7D9', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(37,199,217,.22)' }}>
                      <span style={{ fontSize: 11 }}>{icon}</span>{label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cart chip */}
            <button
              onClick={() => setCartOpen(true)}
              style={{
                background: count > 0 ? 'rgba(37,199,217,1)' : 'rgba(255,255,255,.08)',
                border: count > 0 ? '2px solid rgba(37,199,217,.4)' : '1.5px solid rgba(255,255,255,.15)',
                borderRadius: 16, padding: '16px 22px', cursor: 'pointer', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                minWidth: 150, transition: 'all .2s', boxShadow: count > 0 ? '0 8px 24px rgba(37,199,217,.3)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🛒</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{count > 0 ? `${count} item${count === 1 ? '' : 's'}` : 'My Cart'}</span>
              </div>
              {count > 0
                ? <div style={{ fontSize: 20, fontWeight: 900 }}>${total.toFixed(2)}</div>
                : <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>0 items</div>
              }
            </button>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      {(isMarkPortal || isGuyPortal || isRobertPortal) && (
        <div style={{ background: isRobertPortal ? '#0b0b0a' : '#fff', borderBottom: isRobertPortal ? '1px solid rgba(250,204,21,.22)' : '1px solid var(--border)', padding: '14px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: '🔬', text: isGuyPortal ? 'Curated wellness menu' : 'Sterile compounding lab' },
                { icon: '🚚', text: 'Ships nationwide' },
                { icon: '👨‍⚕️', text: 'Clinical team review' },
                { icon: '🔒', text: 'HIPAA-compliant ordering' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isMarkPortal && (
        <section style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: '#f8fbfc' }}>
                <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome from Mark Ayala
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  This Empire Health &amp; Wellness portal was created so you can review our approved wellness catalog and submit your order for clinical review — with member pricing automatically applied.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,199,217,.35)', borderRadius: 12, padding: 20, background: '#ecfeff' }}>
                <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Questions?
                </div>
                <div style={{ color: 'var(--navy)', fontWeight: 800, marginBottom: 8 }}>Mark's wellness team can help.</div>
                <a className="btn btn-primary btn-sm" href="mailto:info@pepscriptrx.com?subject=Empire Health %26 Wellness portal question">Contact the team</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section style={{ background: '#06111f', borderBottom: '1px solid rgba(37,199,217,.2)', padding: '24px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(37,199,217,.25)', borderRadius: 12, padding: 20, background: 'rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 12, color: '#25C7D9', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Shop AACTIVATED-RX
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,.84)', fontWeight: 700, lineHeight: 1.7 }}>
                  Find support for weight management, recovery, performance, longevity, and focus in one streamlined experience.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,199,217,.35)', borderRadius: 12, padding: 20, background: 'rgba(37,199,217,.08)' }}>
                <div style={{ fontSize: 12, color: '#67e8f9', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Find Your Fit
                </div>
                <div style={{ color: '#fff', fontWeight: 800, marginBottom: 8 }}>Browse by goal.</div>
                <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, lineHeight: 1.6 }}>Filter by weight management, performance, recovery, longevity, or cognitive support.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ background: '#f4f6f9', padding: '32px 0 64px' }}>
        <div className="container">

          {/* Search + category filters */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexDirection: 'column', boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
            <input
              type="search"
              className="form-input"
              placeholder="Search by peptide name, strength, or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ borderRadius: 10 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                {isMarkPortal ? 'MARK65 pricing stays attached through checkout.' : isGuyPortal ? 'AACTIVATED-RX member pricing is applied automatically at checkout.' : isRobertPortal ? 'ROBERT pricing stays attached through checkout under Empire Health & Wellness.' : 'Partner catalog pricing stays attached through checkout.'}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                Sort
                <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={{ width: 180, borderRadius: 10 }}>
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${category === 'All' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCategory('All')}
                style={{ borderRadius: 20 }}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCategory(cat)}
                  style={{ borderRadius: 20 }}
                >
                  {CAT_ICONS[cat] ?? ''} {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Main layout: product grid + cart sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: count > 0 ? 'minmax(0,1fr) 340px' : '1fr', gap: 20, alignItems: 'start' }}>

            {/* Product grid */}
            <div>
              {visibleProducts.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 16 }}>No products found</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Try a different search or category filter.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>
                    Showing {visibleProducts.length} treatment{visibleProducts.length !== 1 ? 's' : ''}{category !== 'All' ? ` · ${category}` : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {visibleProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        qty={cart[product.id] ?? 0}
                        onQtyChange={setQty}
                        onAdd={addToCart}
                        onLearnMore={setDetailProduct}
                        showDiscount={isMarkPortal || isGuyPortal || isRobertPortal}
                        isMarkPortal={isMarkPortal}
                        isGuyPortal={isGuyPortal}
                        isRobertPortal={isRobertPortal}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sticky cart sidebar — desktop, only shown when cart has items */}
            {count > 0 && (
              <div style={{ position: 'sticky', top: 24 }}>
                <div style={{ background: '#fff', borderRadius: 16, border: '2px solid var(--teal)', boxShadow: '0 8px 32px rgba(37,199,217,.12)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--navy)', padding: '18px 20px' }}>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Your Order</div>
                    <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>{count} item{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ padding: '14px 20px', maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cartEntries(cart, products).map(({ product, qty }) => (
                      <div key={product.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13, lineHeight: 1.3 }}>{product.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{product.strength}</div>
                          <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700, marginTop: 3 }}>{formatRetailPrice(product.displayPrice ? product.displayPrice * qty : null)}</div>
                        </div>
                        <Stepper value={qty} onChange={(v) => setQty(product.id, v)} />
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--card-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Subtotal</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${total.toFixed(2)}</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '13px 0', borderRadius: 10 }}
                      onClick={handleCheckout}
                    >
                      Proceed to Checkout →
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                      Clinical review included. Ships directly to your door.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating cart bar — mobile, shown when cart has items */}
          {count > 0 && (
            <div style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 100, display: 'none',
            }} className="cart-float-bar">
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 14,
                  padding: '14px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🛒 {count} item{count !== 1 ? 's' : ''}</span>
                <span style={{ borderLeft: '1px solid rgba(255,255,255,.25)', paddingLeft: 14, color: '#25C7D9', fontSize: 17 }}>${total.toFixed(2)}</span>
                <span style={{ color: '#25C7D9' }}>Checkout →</span>
              </button>
            </div>
          )}

          <div style={{ marginTop: 48, padding: '20px 24px', background: '#fff', borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 6 }}>Important Notice</strong>
            All products are compounded peptides intended for use under the supervision of a licensed healthcare provider.
            Empire Health &amp; Wellness and PepScriptRX do not provide medical advice, diagnosis, or treatment.
            Product availability, pricing, and fulfillment are subject to clinical review and applicable state regulations.
            Orders are reviewed by our clinical team before shipment. Not all products are available in every state.
            <div style={{ color: isRobertPortal ? '#92400e' : 'var(--text-muted)', fontWeight: 800, marginTop: 8 }}>
              {portalPoweredByLabel(isMarkPortal, isGuyPortal, isRobertPortal)}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
              <a href="/privacy" style={{ color: 'var(--teal)', fontWeight: 700 }}>Privacy Policy</a>
              <a href="/terms" style={{ color: 'var(--teal)', fontWeight: 700 }}>Terms &amp; Conditions</a>
              <a href="/certificates" style={{ color: 'var(--teal)', fontWeight: 700 }}>Quality Documents</a>
            </div>
          </div>
        </div>
      </section>

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={addToCart}
        isMarkPortal={isMarkPortal}
        isGuyPortal={isGuyPortal}
        isRobertPortal={isRobertPortal}
      />

      {/* Cart drawer (mobile) */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        products={products}
        onQtyChange={setQty}
        onCheckout={() => { setCartOpen(false); handleCheckout(); }}
      />

      <style>{`
        @media (max-width: 768px) {
          .cart-float-bar { display: block !important; }
          .portal-welcome-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) {
          [style*="gridTemplateColumns"] { transition: grid-template-columns .3s ease; }
        }
      `}</style>
    </PublicLayout>
  );
}
