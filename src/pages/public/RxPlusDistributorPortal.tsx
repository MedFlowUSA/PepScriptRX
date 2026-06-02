import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import AACTIVATEDRXVerificationBadge from '../../components/AACTIVATEDRXVerificationBadge';
import { RX_PLUS_DISTRIBUTORS, getDistributorProducts } from '../../data/rxPlus';
import type { RxPlusCategory, DistributorCatalogProduct } from '../../data/rxPlus';
import { AACTIVATED_TOP_SELLER_IDS } from '../../data/rxPlusAdmin';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { supabase } from '../../lib/supabase';

type CartMap = Record<string, number>; // productId → qty

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const MARK_PORTAL_PATH = '/EmpireHealth&Wellness';
const ELLIE_PORTAL_PATH = '/EHWSUB';
const GUY_PORTAL_PATH = '/aactivated';
const ROBERT_PORTAL_PATH = '/warxlabz';
const SCOTT_PORTAL_PATH = '/peakform';
const ALPHA_PORTAL_PATH = '/alphapride';
const OPTIMAX_PORTAL_PATH = '/optimax-peptide-therapy';
const RONIN_PORTAL_PATH = '/ronin';
const MARK_LOGO_SRC = '/marketing/empire-health-wellness-logo.png';
const MARK_PRODUCT_IMAGE_SRC = '/marketing/empire-product-vial.png';
const GUY_LOGO_SRC = '/marketing/aactivated-rx-logo-v2.png';
const GUY_PRODUCT_IMAGE_SRC = '/marketing/aactivated-product-vial.png';
const ROBERT_LOGO_SRC = '/marketing/warxlabz-logo.png';
const ROBERT_PRODUCT_IMAGE_SRC = '/marketing/warxlabz-vial.png';
const SCOTT_LOGO_SRC = '/marketing/peakform-logo.png';
const SCOTT_PRODUCT_IMAGE_SRC = '/marketing/peakform-vial.png';
const SCOTT_NEEDLES_IMAGE_SRC = '/marketing/peakform-needles.png';
const ALPHA_LOGO_SRC = '/marketing/alphapride-logo-readable.png';
const ALPHA_PRODUCT_IMAGE_SRC = '/marketing/alphapride-vial.png';
const OPTIMAX_LOGO_SRC = '/marketing/optimax-logo-clean.png';
const OPTIMAX_PRODUCT_IMAGE_SRC = '/marketing/optimax-vial.png';
const RONIN_LOGO_SRC = '/marketing/ronin-logo.png';
const RONIN_PRODUCT_IMAGE_SRC = '/marketing/ronin-vial.png';

const AACTIVATED_EDUCATION = [
  {
    title: 'GLP / Weight Management',
    body: 'Metabolic support options for customers exploring appetite, body-composition, and weight-management goals.',
    library: 'Use the library to compare GLP pathways, appetite support, metabolic cofactors, and support compounds before selecting products.',
    pairings: ['Tirzepatide or Retatrutide', 'AOD-9604', 'NAD+', 'MOTS-c', 'Glutathione'],
  },
  {
    title: 'Recovery / Repair',
    body: 'Performance recovery options commonly requested around training load, soft-tissue repair, joint comfort, and resilience goals.',
    library: 'Review tissue-support peptides, recovery blends, copper peptide support, and inflammation-oriented options in the branded library.',
    pairings: ['BPC-157', 'TB-500', 'BPC-157 / TB-500 Blend', 'GHK-Cu', 'Glow Peptide Blend'],
  },
  {
    title: 'Longevity / Wellness',
    body: 'Wellness-oriented compounds for energy, oxidative stress, mitochondrial support, skin health, and general optimization.',
    library: 'The library helps compare energy-support, antioxidant, mitochondrial, and skin-focused compounds by wellness interest.',
    pairings: ['NAD+', 'Glutathione', 'MOTS-c', 'GHK-Cu', 'Epitalon'],
  },
  {
    title: 'Growth / Performance',
    body: 'Performance-focused options with additional eligibility, documentation, and availability checks where required.',
    library: 'Use the library to understand growth-hormone secretagogue families, recovery pairings, sleep-support context, and fulfillment requirements.',
    pairings: ['Tesamorelin', 'Sermorelin', 'Ipamorelin', 'CJC-1295 / Ipamorelin', 'HGH / Somatropin'],
  },
];

type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'alpha';
type AactivatedPromoLink = {
  promo_title: string;
  discount_code: string;
  discount_amount: number;
  product_id: string | null;
  store_scope_code: string;
  link_slug: string;
};

const CAT_ICONS: Record<string, string> = {
  'Recovery / Performance / Wellness': '+',
  'Additional Catalog / Optional': '*',
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
  'Recovery / Performance / Wellness': {
    focus: 'Performance, recovery, and wellness options available through Optimax Peptide Therapy.',
    faq: 'Products and availability may vary. Orders remain subject to standard verification and state availability.',
  },
  'Additional Catalog / Optional': {
    focus: 'Additional peptide options available for qualifying wellness and optimization requests.',
    faq: 'Availability, suitability, and final fulfillment are confirmed through standard verification.',
  },
  'GLP / Weight Management': {
    focus: 'Expanded GLP and metabolic-support options for weight-management goals through this portal.',
    faq: 'Eligibility depends on health history, current medications, state availability, and standard verification.',
  },
  'Growth / Performance': {
    focus: 'Growth and performance support options for vitality, body-composition, and training goals.',
    faq: 'Some products require additional provider context, lab context, or documentation before fulfillment.',
  },
  'Longevity / Wellness': {
    focus: 'Longevity and wellness compounds requested for energy, oxidative stress, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and verification requirements.',
  },
  'Weight Loss / GLP-1': {
    focus: 'Metabolic support options commonly requested for appetite, weight-management, and glucose-related goals.',
    faq: 'Eligibility depends on health history, current medications, state availability, and standard verification.',
  },
  'Recovery / Repair': {
    focus: 'Recovery-focused compounds often requested for tissue support, joint comfort, and training recovery goals.',
    faq: 'Use should be supervised by a qualified licensed provider and considered against your medical history.',
  },
  'Growth Hormone / Longevity': {
    focus: 'Hormone-support and longevity products commonly requested for sleep, body-composition, and vitality goals.',
    faq: 'Some therapies require extra verification, lab context, or provider documentation before fulfillment.',
  },
  'Wellness / Anti-Aging': {
    focus: 'Wellness compounds requested for oxidative stress, energy, skin, and general optimization support.',
    faq: 'Product availability and recommended use may vary by state, formulation, and verification requirements.',
  },
  'Neuro / Cognitive / Mood': {
    focus: 'Cognitive and mood-support options for customers exploring focus, calm, sleep, or resilience support.',
    faq: 'These products are not emergency care and are not substitutes for mental-health treatment.',
  },
  'Functional / Supplies': {
    focus: 'Supplies and functional add-ons that may support eligible orders and fulfillment workflows.',
    faq: 'Supplies may ship with eligible orders or require confirmation from the care team.',
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

function retailUnitLabel(product: DistributorCatalogProduct): string {
  const label = `${product.product_name} ${product.strength}`.toLowerCase();
  if (label.includes('10 vials') || label.includes('10-vial')) return '10-vial pack';
  return 'vial';
}

function isAactivatedTopSeller(product: DistributorCatalogProduct): boolean {
  return AACTIVATED_TOP_SELLER_IDS.includes(product.id)
    || Boolean(product.badges?.some((badge) => ['best seller', 'popular'].includes(badge.toLowerCase())));
}

function portalSpecialPriceLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal = false, isAlphaPortal = false): string | null {
  if (isMarkPortal) return 'Special Empire member pricing is attached through checkout.';
  if (isAlphaPortal) return 'Alpha Pride member pricing is attached through checkout.';
  if (isRobertPortal) return null;
  if (isGuyPortal) return 'AACTIVATEDRX account pricing stays attached through checkout.';
  return null;
}

function portalPoweredByLabel(isMarkPortal: boolean, isGuyPortal: boolean, isRobertPortal: boolean, isOptimaxPortal: boolean, isAlphaPortal: boolean, isRoninPortal = false): string {
  if (isRoninPortal) return 'Ronin is powered by PepScriptRX.';
  if (isRobertPortal) return 'Powered by Empire Health & Wellness and PepScriptRX.';
  if (isAlphaPortal) return 'Alpha Pride Wellness is powered under Empire Health & Wellness and PepScriptRX.';
  if (isOptimaxPortal) return 'Powered by Optimax Peptide Therapy and PepScriptRX.';
  if (isMarkPortal) return 'Powered by PepScriptRX.';
  if (isGuyPortal) return 'AACTIVATEDRX private partner ecosystem.';
  return 'Powered by PepScriptRX.';
}

function portalProductImageSrc(
  product: DistributorCatalogProduct,
  isMarkPortal: boolean,
  isGuyPortal: boolean,
  isRobertPortal: boolean,
  isScottPortal: boolean,
  isAlphaPortal: boolean,
  isOptimaxPortal: boolean,
  isRoninPortal = false,
): string | undefined {
  if (isRoninPortal) return RONIN_PRODUCT_IMAGE_SRC;
  if (isScottPortal && product.id === 'scott-insulin-needles') return SCOTT_NEEDLES_IMAGE_SRC;
  if (isMarkPortal) return MARK_PRODUCT_IMAGE_SRC;
  if (isRobertPortal) return ROBERT_PRODUCT_IMAGE_SRC;
  if (isScottPortal) return SCOTT_PRODUCT_IMAGE_SRC;
  if (isAlphaPortal) return ALPHA_PRODUCT_IMAGE_SRC;
  if (isOptimaxPortal) return OPTIMAX_PRODUCT_IMAGE_SRC;
  if (isGuyPortal) return GUY_PRODUCT_IMAGE_SRC;
  return undefined;
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
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Secure checkout opens next. Shipping is confirmed at checkout.</div>
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
function AactivatedShowcaseCard({
  product,
  qty,
  onQtyChange,
  onAdd,
  onLearnMore,
}: {
  product: DistributorCatalogProduct;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
  onAdd: (id: string) => void;
  onLearnMore: (product: DistributorCatalogProduct) => void;
}) {
  const inCart = qty > 0;
  const canAddToCart = typeof product.displayPrice === 'number';
  const category = product.category.replace(/\s*\/\s*/g, ' / ');
  const strengthLabel = product.strength && product.strength !== 'Standard'
    ? product.strength
    : retailUnitLabel(product);
  const showStrengthInline = product.strength && product.strength !== 'Standard' && !product.product_name.toLowerCase().includes(product.strength.toLowerCase());
  const title = showStrengthInline ? `${product.product_name} ${strengthLabel}` : product.product_name;
  const isTopSeller = isAactivatedTopSeller(product);

  return (
    <article style={{
      position: 'relative',
      overflow: 'hidden',
      minHeight: 430,
      borderRadius: 20,
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fdff 46%, #e8f8fb 100%)',
      border: inCart ? '3px solid #25C7D9' : '2px solid rgba(103,232,249,.75)',
      boxShadow: inCart ? '0 20px 48px rgba(37,199,217,.28)' : '0 18px 46px rgba(2,8,23,.32)',
      display: 'flex',
      flexDirection: 'column',
      isolation: 'isolate',
    }}>
      <div style={{ position: 'absolute', inset: 8, borderRadius: 16, border: '1px solid rgba(8,145,178,.24)', pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 22%, rgba(103,232,249,.38), transparent 32%), radial-gradient(circle at 70% 68%, rgba(125,211,252,.22), transparent 34%)', zIndex: 0 }} />
      <div style={{ position: 'absolute', right: -34, top: 20, width: 230, height: 230, borderRadius: '50%', border: '2px solid rgba(8,145,178,.12)', zIndex: 0 }} />
      <div style={{ position: 'absolute', right: -64, top: 50, width: 260, height: 260, borderRadius: '50%', border: '1px solid rgba(8,145,178,.1)', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 3, padding: '24px 22px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
          <img
            src={GUY_LOGO_SRC}
            alt="AACTIVATED-RX"
            loading="lazy"
            style={{ width: 148, height: 44, objectFit: 'contain', objectPosition: 'left center', filter: 'drop-shadow(0 5px 12px rgba(8,145,178,.12))' }}
          />
          {isTopSeller && (
            <span style={{ fontSize: 10, color: '#064e3b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', background: '#d1fae5', border: '1px solid rgba(16,185,129,.22)', borderRadius: 999, padding: '5px 8px', whiteSpace: 'nowrap' }}>
              Top seller
            </span>
          )}
        </div>
        <div style={{ margin: '-12px 0 14px' }}>
          <AACTIVATEDRXVerificationBadge placement="card" productName={title} />
        </div>

        <div style={{ width: '58%', minWidth: 168, position: 'relative', zIndex: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(8,145,178,.36)', color: '#0891b2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>Rx</span>
            <span style={{ fontSize: 10, color: '#0f3654', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2 }}>
              {category}
            </span>
          </div>

          <h3 style={{ margin: '0 0 12px', color: '#07172d', fontSize: 'clamp(25px, 3vw, 34px)', lineHeight: 1.02, fontWeight: 950 }}>
            {title}
          </h3>
          {!showStrengthInline && (
            <div style={{ color: '#0891b2', fontSize: 22, lineHeight: 1.05, fontWeight: 900, marginTop: -6, marginBottom: 12 }}>
              {strengthLabel}
            </div>
          )}
          <div style={{ width: '88%', height: 2, background: 'linear-gradient(90deg,#0891b2,#67e8f9,transparent)', marginBottom: 12 }} />

          <div style={{ color: '#061425', fontSize: 'clamp(36px, 4vw, 48px)', lineHeight: .95, fontWeight: 950, letterSpacing: 0 }}>
            {formatRetailPrice(product.displayPrice)}
          </div>

          <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
            <div style={{ color: '#075985', fontSize: 11, fontWeight: 900, lineHeight: 1.25 }}>
              Account-code checkout
            </div>
            <div style={{ color: '#0f3654', fontSize: 11, fontWeight: 800, lineHeight: 1.35 }}>
              Secure checkout available
            </div>
          </div>
        </div>

        <img
          src={GUY_PRODUCT_IMAGE_SRC}
          alt={`${product.product_name} vial`}
          loading="lazy"
          style={{
            position: 'absolute',
            right: -4,
            bottom: 70,
            width: '48%',
            maxWidth: 188,
            minWidth: 132,
            height: 250,
            objectFit: 'contain',
            filter: 'drop-shadow(0 24px 28px rgba(2,8,23,.22))',
            zIndex: 2,
          }}
        />

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, color: '#0f3654', fontSize: 10, fontWeight: 900, padding: '10px 0 12px' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', color: '#0891b2', border: '1px solid rgba(8,145,178,.35)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>OK</span>
          <span>In Stock</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0891b2' }} />
          <span>Ready to Ship</span>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 4, padding: '0 20px 20px' }}>
        {inCart ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 10, alignItems: 'center' }}>
            <Stepper value={qty} onChange={(v) => onQtyChange(product.id, v)} />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onLearnMore(product)}
              style={{ minHeight: 52, borderRadius: 14, justifyContent: 'center', fontWeight: 900, color: '#075985', borderColor: 'rgba(8,145,178,.35)', background: 'rgba(255,255,255,.78)' }}
            >
              View Details
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canAddToCart}
            onClick={() => onAdd(product.id)}
            style={{
              width: '100%',
              minHeight: 56,
              border: '1px solid rgba(103,232,249,.72)',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
              color: '#fff',
              fontSize: 18,
              fontWeight: 950,
              cursor: canAddToCart ? 'pointer' : 'not-allowed',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 12px 22px rgba(8,145,178,.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,.58)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>-&gt;</span>
            Add to Cart
          </button>
        )}
      </div>
    </article>
  );
}

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
  isScottPortal,
  isAlphaPortal,
  isOptimaxPortal,
  isRoninPortal,
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
  isScottPortal: boolean;
  isAlphaPortal: boolean;
  isOptimaxPortal: boolean;
  isRoninPortal: boolean;
}) {
  const catIcon = CAT_ICONS[product.category] ?? '💊';
  const inCart = qty > 0;
  const canAddToCart = typeof product.displayPrice === 'number';
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal, isAlphaPortal);
  const retailUnit = retailUnitLabel(product);
  const isTopSeller = isGuyPortal && isAactivatedTopSeller(product);

  if (isGuyPortal) {
    return (
      <AactivatedShowcaseCard
        product={product}
        qty={qty}
        onQtyChange={onQtyChange}
        onAdd={onAdd}
        onLearnMore={onLearnMore}
      />
    );
  }

  return (
    <article style={{
      background: isRoninPortal ? 'linear-gradient(180deg, #15171c, #08090c)' : '#fff', borderRadius: 14,
      border: inCart ? (isRoninPortal ? '2px solid #b91c1c' : '2px solid var(--teal)') : isRoninPortal ? '1.5px solid rgba(226,232,240,.16)' : '1.5px solid var(--border)',
      boxShadow: inCart ? (isRoninPortal ? '0 8px 30px rgba(185,28,28,.24)' : '0 4px 24px rgba(37,199,217,.14)') : isRoninPortal ? '0 18px 42px rgba(0,0,0,.28)' : '0 1px 4px rgba(0,0,0,.06)',
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
          {isGuyPortal ? 'Guarantee Review' : 'Member Pricing'}
        </div>
      )}
      <div style={{ padding: '20px 20px 0' }}>
        <ProductThumbnail
          product={product}
          imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{catIcon}</span>
          <span style={{ fontSize: 11, color: isRoninPortal ? '#f87171' : '#0f766e', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{product.category}</span>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: isRoninPortal ? '#f8fafc' : 'var(--navy)', margin: '0 0 4px', lineHeight: 1.2 }}>{product.product_name}</h3>
        <div style={{ fontSize: 13, color: isRoninPortal ? '#cbd5e1' : '#475569', fontWeight: 700, marginBottom: 10 }}>{product.strength}</div>
        <p style={{ fontSize: 12, color: isRoninPortal ? '#b6c0ce' : '#334155', fontWeight: 500, lineHeight: 1.55, margin: '0 0 12px' }}>
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
        {isTopSeller && (
          <div style={{ fontSize: 11, color: '#155e75', fontWeight: 900, background: '#cffafe', border: '1px solid rgba(8,145,178,.24)', borderRadius: 8, padding: '7px 9px', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            AACTIVATEDRX top seller
          </div>
        )}

        <div style={{ marginBottom: specialPriceLabel ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: isRoninPortal ? '#f8fafc' : '#102033' }}>{formatRetailPrice(product.displayPrice)}</span>
            {canAddToCart && <span style={{ fontSize: 13, fontWeight: 800, color: isRoninPortal ? '#94a3b8' : '#475569' }}>retail price / {retailUnit}</span>}
          </div>
        </div>
        {specialPriceLabel && (
          <div style={{ fontSize: 12, color: '#0f5132', fontWeight: 800, background: '#ecfdf5', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            {specialPriceLabel}
          </div>
        )}
        {isGuyPortal && (
          <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, background: '#ecfeff', border: '1px solid rgba(37,199,217,.25)', borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            Partner catalog item. Account credit: VITALITYINS.
          </div>
        )}
        {showDiscount && (
          <div style={{ fontSize: 12, color: isRoninPortal ? '#fecaca' : '#0f766e', fontWeight: 800, background: isRoninPortal ? 'rgba(127,29,29,.22)' : '#f0fdfa', border: `1px solid ${isRoninPortal ? 'rgba(248,113,113,.24)' : 'rgba(20,184,166,.25)'}`, borderRadius: 8, padding: '7px 9px', marginBottom: 10 }}>
            Retail price shown. Your portal code stays attached at checkout.
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
  isScottPortal,
  isAlphaPortal,
  isOptimaxPortal,
  isRoninPortal,
}: {
  product: DistributorCatalogProduct | null;
  onClose: () => void;
  onAdd: (id: string) => void;
  isMarkPortal: boolean;
  isGuyPortal: boolean;
  isRobertPortal: boolean;
  isScottPortal: boolean;
  isAlphaPortal: boolean;
  isOptimaxPortal: boolean;
  isRoninPortal: boolean;
}) {
  if (!product) return null;
  const details = CATEGORY_DETAILS[product.category] ?? {
    focus: product.description,
    faq: 'Availability, eligibility, and fulfillment are confirmed after clinical review.',
  };
  const specialPriceLabel = portalSpecialPriceLabel(isMarkPortal, isGuyPortal, isRobertPortal, isAlphaPortal);
  const retailUnit = retailUnitLabel(product);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(7,20,34,.55)', zIndex: 1200 }} />
      <div role="dialog" aria-modal="true" aria-label={`${product.product_name} details`} style={{ position: 'fixed', inset: '7vh 16px auto', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', margin: '0 auto', background: '#fff', borderRadius: 14, zIndex: 1201, boxShadow: '0 24px 70px rgba(0,0,0,.28)', border: '1px solid var(--border)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 86, flexShrink: 0 }}>
            <ProductThumbnail
              product={product}
              imageSrc={portalProductImageSrc(product, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{product.category}</div>
            <h2 style={{ margin: '4px 0', color: 'var(--navy)', fontSize: 24, lineHeight: 1.15 }}>{product.product_name}</h2>
            <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>
              {product.strength} · Retail price {formatRetailPrice(product.displayPrice)}{typeof product.displayPrice === 'number' ? ` / ${retailUnit}` : ''}
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
          {isGuyPortal ? (
            <AACTIVATEDRXVerificationBadge placement="detail" productName={`${product.product_name} ${product.strength}`} />
          ) : (
            <ProductPurityGuaranteeBadge compact variant="pepscriptrx" />
          )}
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
    : pathname.toLowerCase() === '/ehwsub'
      ? 'ehwsub'
      : pathname.toLowerCase() === '/warxlabz'
        ? 'robert'
        : ['/aactivated', '/guy'].includes(pathname.toLowerCase())
          ? 'guy'
          : pathname.toLowerCase() === '/peakform'
            ? 'scott'
            : pathname.toLowerCase() === '/alphapride'
              ? 'alpha'
              : pathname.toLowerCase() === '/optimax-peptide-therapy'
                ? 'optimax'
                : pathname.toLowerCase() === '/ronin'
                  ? 'ronin'
                : distributorSlug;

  const distributor = RX_PLUS_DISTRIBUTORS.find((d) => d.slug === resolvedSlug);
  const products = getDistributorProducts(resolvedSlug);
  const isMarkPortal   = resolvedSlug === 'mark';
  const isElliePortal  = resolvedSlug === 'ehwsub';
  const isEmpirePortal = isMarkPortal;
  const isGuyPortal    = resolvedSlug === 'guy';
  const isRobertPortal = resolvedSlug === 'robert';
  const isScottPortal  = resolvedSlug === 'scott';
  const isAlphaPortal  = resolvedSlug === 'alpha';
  const isOptimaxPortal = resolvedSlug === 'optimax';
  const isRoninPortal = resolvedSlug === 'ronin';
  const portalConfig = getWhiteLabelPortal(resolvedSlug);

  usePageMeta(
    isEmpirePortal  ? 'Empire Health & Wellness — Peptide Therapy'
    : isElliePortal ? 'PepScriptRX'
    : isGuyPortal   ? 'AACTIVATED-RX — Optimize. Recover. Perform.'
    : isScottPortal ? 'Peak Form Peptides | Premium Research Peptides'
    : isAlphaPortal ? 'Alpha Pride Wellness | Elite Peptide Wellness'
    : isOptimaxPortal ? 'Optimax Peptide Therapy | Premium Peptide Therapy'
    : isRoninPortal ? 'Ronin | Premium Wellness Catalog'
    : (distributor ? distributor.portal_name : 'Advanced Wellness'),
    isEmpirePortal
      ? 'Pharmaceutical-grade peptide treatments for weight loss, recovery, hormone support, and longevity. Compounded to order and shipped directly to you after clinical review.'
      : isGuyPortal
        ? 'Shop curated wellness options for weight management, performance, recovery, longevity, and cognitive support.'
        : isScottPortal
          ? 'Premium peptide research compounds and wellness solutions from Peak Form Peptides.'
          : isAlphaPortal
            ? 'Premium black-and-gold wellness catalog for Alpha Pride Wellness.'
            : isOptimaxPortal
              ? 'Premium peptide therapy solutions powered by Optimax Peptide Therapy and PepScriptRX.'
              : isRoninPortal
                ? 'Ronin premium wellness catalog with secure checkout and PepScriptRX-powered verification.'
              : 'Advanced wellness catalog.',
  );

  const [category, setCategory] = useState<'All' | RxPlusCategory>(() => {
    const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('category') : null;
    return requested || 'All';
  });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('featured');
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null);
  const [cart, setCart] = useState<CartMap>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activePromo, setActivePromo] = useState<AactivatedPromoLink | null>(null);
  const [promoError, setPromoError] = useState('');
  const [calcDose, setCalcDose] = useState(0.25);
  const [calcDoseUnit, setCalcDoseUnit] = useState<'mg' | 'mcg'>('mg');
  const [calcMg, setCalcMg] = useState(10);
  const [calcMl, setCalcMl] = useState(2);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const promoSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('promo') : null;

  useEffect(() => {
    if (!isGuyPortal || !promoSlug || !supabase) return;
    let cancelled = false;
    supabase
      .from('aactivated_promo_links')
      .select('promo_title,discount_code,discount_amount,product_id,store_scope_code,link_slug')
      .eq('link_slug', promoSlug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPromoError('This promo link is not active or could not be verified.');
          setActivePromo(null);
          return;
        }
        const promo = data as AactivatedPromoLink;
        setActivePromo(promo);
        if (promo.product_id) {
          const product = products.find((item) => item.id === promo.product_id);
          if (product) {
            setCategory(product.category);
            setSearch(product.product_name);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isGuyPortal, products, promoSlug]);

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
    const portalRepCode = isElliePortal ? 'ELLIEBEYER' : isMarkPortal ? 'MARK65' : isGuyPortal ? 'GUY60' : isRobertPortal ? 'ROBERT' : isScottPortal ? 'SCOTTB' : isAlphaPortal ? 'ALPHAPRIDE' : isOptimaxPortal ? 'GABE50' : isRoninPortal ? 'MGT1111' : resolvedSlug.toUpperCase();
    const portalScopeCode = activePromo?.store_scope_code || (isOptimaxPortal
      ? 'OPTIMAX'
        : isGuyPortal
          ? 'VITALITYINS'
          : isRoninPortal
            ? 'MGT1111'
        : portalRepCode);
    const sourcePortal = isOptimaxPortal
      ? 'Optimax'
      : isGuyPortal
        ? 'VITALITYINS'
        : isScottPortal
          ? 'Peak Form'
          : isAlphaPortal
            ? 'Alpha Pride Wellness'
            : isRobertPortal
              ? 'WarXlabz'
              : isRoninPortal
                ? 'Ronin'
              : isEmpirePortal
                ? 'Empire Health & Wellness'
                : resolvedSlug;
    const cartPayload = {
      rep: portalRepCode,
      scope_code: portalScopeCode,
      discount_code: activePromo?.discount_code ?? '',
      discount_amount: activePromo?.discount_amount ?? 0,
      promo_title: activePromo?.promo_title ?? '',
      promo_slug: activePromo?.link_slug ?? '',
      promo_product_id: activePromo?.product_id ?? '',
      distributor: resolvedSlug,
      source_portal: sourcePortal,
      source_route: window.location.pathname,
      store_slug: isOptimaxPortal ? 'optimax-peptide-therapy' : isAlphaPortal ? 'alphapride' : isRoninPortal ? 'ronin' : isElliePortal ? 'EHWSUB' : resolvedSlug,
      store_name: isOptimaxPortal ? 'Optimax Peptide Therapy' : isAlphaPortal ? 'Alpha Pride Wellness' : isRoninPortal ? 'Ronin' : isElliePortal ? 'PepScriptRX' : isEmpirePortal ? 'Empire Health & Wellness' : distributor?.portal_name ?? resolvedSlug,
      admin_code: isOptimaxPortal ? 'GABE50' : isRoninPortal ? 'MGT1111' : undefined,
      account_type: isOptimaxPortal ? 'admin' : 'rep',
      parent_type: isOptimaxPortal || isRoninPortal ? 'platform' : undefined,
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
      scope:    portalScopeCode,
      source:  `${resolvedSlug}-portal`,
      rep:     portalRepCode,
    });
    navigate(`/start?${params}`);
  }, [activePromo, cart, products, distributor?.portal_name, isElliePortal, isEmpirePortal, isMarkPortal, isGuyPortal, isRobertPortal, isScottPortal, isAlphaPortal, isOptimaxPortal, isRoninPortal, resolvedSlug, navigate]);

  const count = cartCount(cart);
  const total = cartTotal(cart, products);
  const topSellers = useMemo(() => products.filter((product) => isAactivatedTopSeller(product)).slice(0, 6), [products]);
  const hasActiveAactivatedCatalogFilters = search.trim().length > 0 || category !== 'All' || sort !== 'featured';
  const aactivatedCatalogProducts = hasActiveAactivatedCatalogFilters ? visibleProducts : topSellers;
  const calcMgPerMl = calcMg > 0 && calcMl > 0 ? calcMg / calcMl : 0;
  const calcDoseMg = calcDoseUnit === 'mg' ? calcDose : calcDose / 1000;
  const calcDrawMl = calcMgPerMl > 0 ? calcDoseMg / calcMgPerMl : 0;
  const calcUnits = calcDrawMl * 100;
  const legalBasePath = isGuyPortal ? GUY_PORTAL_PATH : isAlphaPortal ? ALPHA_PORTAL_PATH : isRoninPortal ? RONIN_PORTAL_PATH : '';
  const privacyPath = legalBasePath ? `${legalBasePath}/privacy` : '/privacy';
  const termsPath = legalBasePath ? `${legalBasePath}/terms` : '/terms';
  const certificatesPath = legalBasePath ? `${legalBasePath}/certificates` : '/certificates';

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
      isolatedPortal={isEmpirePortal || isGuyPortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal}
      portalHomePath={isElliePortal ? ELLIE_PORTAL_PATH : isMarkPortal ? MARK_PORTAL_PATH : isGuyPortal ? GUY_PORTAL_PATH : isRobertPortal ? ROBERT_PORTAL_PATH : isScottPortal ? SCOTT_PORTAL_PATH : isAlphaPortal ? ALPHA_PORTAL_PATH : isOptimaxPortal ? OPTIMAX_PORTAL_PATH : isRoninPortal ? RONIN_PORTAL_PATH : '/'}
      portalName={isElliePortal ? 'PepScriptRX' : isEmpirePortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : isRobertPortal ? 'WarXlabz' : isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : distributor.portal_name}
      portalLogoSrc={isEmpirePortal ? MARK_LOGO_SRC : isGuyPortal ? GUY_LOGO_SRC : isRobertPortal ? ROBERT_LOGO_SRC : isScottPortal ? SCOTT_LOGO_SRC : isAlphaPortal ? ALPHA_LOGO_SRC : isOptimaxPortal ? OPTIMAX_LOGO_SRC : isRoninPortal ? RONIN_LOGO_SRC : undefined}
      portalKey={portalConfig?.id}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ background: isRoninPortal ? 'radial-gradient(circle at 78% 8%, rgba(185,28,28,.24), transparent 30%), linear-gradient(135deg, #030305 0%, #101116 54%, #250707 100%)' : isAlphaPortal ? 'linear-gradient(135deg, #050505 0%, #16130b 52%, #3a2a0a 100%)' : isRobertPortal ? 'linear-gradient(135deg, #050505 0%, #181714 48%, #3a311f 100%)' : isScottPortal ? 'linear-gradient(135deg, #0d1b3e 0%, #0f2555 50%, #1a3a7a 100%)' : isOptimaxPortal ? 'linear-gradient(135deg, #f8fffb 0%, #effbf7 46%, #e7f8ff 100%)' : 'linear-gradient(135deg, #0a1628 0%, #0d2040 60%, #0e2d4a 100%)', padding: '56px 0 44px', position: 'relative', overflow: 'hidden', borderBottom: isRoninPortal ? '1px solid rgba(239,68,68,.24)' : isAlphaPortal ? '1px solid rgba(245,158,11,.28)' : isOptimaxPortal ? '1px solid rgba(8,127,140,.14)' : undefined }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,199,217,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div className="container">
          <div className={isGuyPortal ? 'aactivated-hero-layout' : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap', position: 'relative' }}>
            <div className={isGuyPortal ? 'aactivated-hero-copy' : undefined} style={{ maxWidth: 580 }}>
              {isEmpirePortal && (
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
              {isScottPortal && (
                <img
                  src={SCOTT_LOGO_SRC}
                  alt="Peak Form Peptides"
                  style={{
                    width: 'min(420px, 84vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    filter: 'drop-shadow(0 20px 48px rgba(37,99,235,.45))',
                  }}
                />
              )}
              {isAlphaPortal && (
                <img
                  src={ALPHA_LOGO_SRC}
                  alt="Alpha Pride Wellness"
                  style={{
                    width: 'min(430px, 84vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 22px',
                    borderRadius: 14,
                    boxShadow: '0 28px 72px rgba(245,158,11,.28)',
                  }}
                />
              )}
              {isOptimaxPortal && (
                <img
                  src={OPTIMAX_LOGO_SRC}
                  alt="Optimax Peptide Therapy"
                  style={{
                    width: 'min(500px, 86vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 24px',
                    filter: 'drop-shadow(0 22px 44px rgba(25,199,217,.28)) drop-shadow(0 10px 28px rgba(123,220,42,.16))',
                  }}
                />
              )}
              {isRoninPortal && (
                <img
                  src={RONIN_LOGO_SRC}
                  alt="Ronin"
                  style={{
                    width: 'min(360px, 78vw)',
                    height: 'auto',
                    display: 'block',
                    margin: '0 0 24px',
                    filter: 'drop-shadow(0 22px 48px rgba(185,28,28,.34))',
                  }}
                />
              )}
              {/* Brand line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: isRoninPortal ? 'linear-gradient(135deg,#f8fafc,#991b1b)' : isAlphaPortal ? 'linear-gradient(135deg,#111827,#D4AF37)' : isScottPortal ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : isOptimaxPortal ? 'linear-gradient(135deg,#7BDC2A,#25C7D9)' : 'linear-gradient(135deg,#25C7D9,#0e9ab0)', color: isOptimaxPortal ? '#061425' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900 }}>{isRoninPortal ? 'R' : isAlphaPortal ? 'A' : isScottPortal ? '⛰' : isOptimaxPortal ? 'O' : '🧬'}</div>
                <span style={{ color: isRoninPortal ? 'rgba(226,232,240,.72)' : isAlphaPortal ? 'rgba(250,204,21,.74)' : isOptimaxPortal ? 'rgba(6,20,37,.58)' : 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {isEmpirePortal ? 'Empire Health & Wellness' : isGuyPortal ? 'AACTIVATED-RX' : isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : distributor.portal_name}
                </span>
              </div>

              <h1 style={{ color: isOptimaxPortal ? '#061425' : '#fff', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, margin: '0 0 14px', lineHeight: 1.1, letterSpacing: '-.02em' }}>
                {isEmpirePortal ? 'Advanced Peptide Therapy' : isGuyPortal ? 'Optimize. Recover. Perform.' : isRobertPortal ? 'Train Hard. Recover Tactical.' : isScottPortal ? 'Perform. Recover. Peak.' : isAlphaPortal ? 'Strength. Recovery. Pride.' : isOptimaxPortal ? 'Optimize. Recover. Perform.' : isRoninPortal ? 'Discipline. Recovery. Precision.' : 'Advanced Wellness Products'}
              </h1>
              <p style={{ color: isOptimaxPortal ? 'rgba(6,20,37,.72)' : 'rgba(255,255,255,.65)', fontSize: 15, margin: '0 0 24px', lineHeight: 1.7 }}>
                {isEmpirePortal
                  ? 'Pharmaceutical-grade peptides for weight loss, recovery, hormone support, and longevity. Select your products, set your quantity, and continue directly to secure checkout.'
                  : isGuyPortal
                    ? 'A private partner portal for targeted wellness support, top-seller product paths, education, and secure account-code checkout.'
                    : isRobertPortal
                      ? 'WarXlabz custom pricing for performance, recovery, and wellness support. Orders stay attributed under Empire Health & Wellness and continue to secure checkout.'
                      : isScottPortal
                        ? 'Premium peptides for athletes, high performers, and wellness-focused individuals. Select your products and continue directly to secure checkout.'
                        : isAlphaPortal
                          ? 'A black-and-gold wellness storefront built for elite performance, recovery, and strength-focused optimization.'
                          : isOptimaxPortal
                            ? 'Premium peptide therapy solutions powered by Optimax Peptide Therapy and PepScriptRX.'
                            : isRoninPortal
                              ? 'A premium minimalist catalog built for disciplined performance, recovery, and focused wellness support.'
                            : 'Curated advanced wellness products for performance, recovery, and longevity.'}
              </p>

              {isOptimaxPortal && (
                <a className="btn btn-primary" href="#optimax-products" style={{ marginBottom: 18, background: '#7BDC2A', borderColor: '#7BDC2A', color: '#061425', fontWeight: 900, boxShadow: '0 14px 28px rgba(123,220,42,.24)' }}>
                  Start Your Wellness Request
                </a>
              )}

              {/* Trust badges */}
              {(isEmpirePortal || isGuyPortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal) && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { icon: '✓', label: isGuyPortal ? 'Curated Wellness Options' : isScottPortal ? 'Premium Grade' : isAlphaPortal ? 'Elite Wellness Catalog' : isOptimaxPortal ? 'Premium Therapy Options' : isRoninPortal ? 'Disciplined Catalog' : 'Pharmaceutical Grade' },
                    { icon: '✓', label: isGuyPortal ? 'Secure Checkout' : 'Immediate Checkout' },
                    { icon: '✓', label: 'Discreet Shipping' },
                    { icon: '✓', label: isGuyPortal ? 'AACTIVATED-RX Member Pricing' : isScottPortal ? 'Peak Form Member Pricing' : isAlphaPortal ? 'Alpha Pride Pricing' : isOptimaxPortal ? 'Optimax Retail Pricing' : isRoninPortal ? 'Ronin Pricing' : 'Compounded to Order' },
                  ].map(({ icon, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isRoninPortal ? 'rgba(127,29,29,.24)' : isAlphaPortal ? 'rgba(245,158,11,.14)' : isScottPortal ? 'rgba(37,99,235,.18)' : isOptimaxPortal ? 'rgba(255,255,255,.72)' : 'rgba(37,199,217,.12)', color: isRoninPortal ? '#fecaca' : isAlphaPortal ? '#FACC15' : isScottPortal ? '#93C5FD' : isOptimaxPortal ? '#075b6b' : '#25C7D9', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1px solid ${isRoninPortal ? 'rgba(248,113,113,.28)' : isAlphaPortal ? 'rgba(245,158,11,.32)' : isScottPortal ? 'rgba(37,99,235,.35)' : isOptimaxPortal ? 'rgba(8,127,140,.2)' : 'rgba(37,199,217,.22)'}` }}>
                      <span style={{ fontSize: 11 }}>{icon}</span>{label}
                    </span>
                  ))}
                </div>
              )}
              {(isEmpirePortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal) && (
                <div style={{ marginTop: 20, maxWidth: 760 }}>
                  <ProductPurityGuaranteeBadge compact variant={isGuyPortal ? 'aactivated' : 'pepscriptrx'} />
                </div>
              )}
            </div>

            <div className="aactivated-hero-side" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', marginLeft: 'auto' }}>
              {isGuyPortal && <AACTIVATEDRXVerificationBadge placement="hero" />}

              {/* Cart chip */}
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  background: count > 0 ? (isOptimaxPortal ? '#061425' : 'rgba(37,199,217,1)') : (isOptimaxPortal ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.08)'),
                  border: count > 0 ? `2px solid ${isOptimaxPortal ? 'rgba(123,220,42,.45)' : 'rgba(37,199,217,.4)'}` : `1.5px solid ${isOptimaxPortal ? 'rgba(8,127,140,.18)' : 'rgba(255,255,255,.15)'}`,
                  borderRadius: 16, padding: '16px 22px', cursor: 'pointer', color: isOptimaxPortal && count === 0 ? '#061425' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                  marginTop: 0,
                  minWidth: 150, transition: 'all .2s', boxShadow: count > 0 ? (isOptimaxPortal ? '0 14px 30px rgba(6,20,37,.18)' : '0 8px 24px rgba(37,199,217,.3)') : (isOptimaxPortal ? '0 12px 28px rgba(8,127,140,.1)' : 'none'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🛒</span>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{count > 0 ? `${count} item${count === 1 ? '' : 's'}` : 'My Cart'}</span>
                </div>
                {count > 0
                  ? <div style={{ fontSize: 20, fontWeight: 900 }}>${total.toFixed(2)}</div>
                  : <div style={{ fontSize: 12, color: isOptimaxPortal ? 'rgba(6,20,37,.58)' : 'rgba(255,255,255,.5)', fontWeight: 600 }}>0 items</div>
                }
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      {isGuyPortal && (activePromo || promoError) && (
        <section style={{ background: '#06101f', borderBottom: '1px solid rgba(250,204,21,.28)', padding: '14px 0' }}>
          <div className="container">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap',
              border: activePromo ? '1px solid rgba(250,204,21,.36)' : '1px solid rgba(248,113,113,.34)',
              background: activePromo ? 'linear-gradient(135deg, rgba(20,16,8,.96), rgba(9,17,32,.96))' : 'rgba(127,29,29,.16)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div>
                <div style={{ color: activePromo ? '#FACC15' : '#FCA5A5', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {activePromo ? 'Promo Link Active' : 'Promo Link Notice'}
                </div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>
                  {activePromo ? activePromo.promo_title : promoError}
                </div>
                {activePromo && (
                  <div style={{ color: 'rgba(255,255,255,.66)', fontSize: 12, marginTop: 2 }}>
                    Code {activePromo.discount_code} saves ${Number(activePromo.discount_amount ?? 0).toFixed(2)} at checkout.
                  </div>
                )}
              </div>
              {activePromo?.product_id && (
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => {
                    const product = products.find((item) => item.id === activePromo.product_id);
                    if (product) addToCart(product.id);
                  }}
                  style={{ background: '#FACC15', borderColor: '#FACC15', color: '#050505', fontWeight: 900 }}
                >
                  Add Promo Product
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {(isEmpirePortal || isRobertPortal || isScottPortal || isAlphaPortal || isOptimaxPortal || isRoninPortal) && (
        <div style={{ background: isRoninPortal ? '#07080b' : isAlphaPortal ? '#0b0b0a' : isRobertPortal ? '#0b0b0a' : isScottPortal ? '#f0f5ff' : isOptimaxPortal ? '#f4fbf8' : '#fff', borderBottom: isRoninPortal ? '1px solid rgba(248,113,113,.18)' : isAlphaPortal ? '1px solid rgba(245,158,11,.25)' : isRobertPortal ? '1px solid rgba(250,204,21,.22)' : isScottPortal ? '1px solid rgba(37,99,235,.18)' : isOptimaxPortal ? '1px solid rgba(123,220,42,.22)' : '1px solid var(--border)', padding: '14px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: '🔬', text: isGuyPortal ? 'Curated wellness menu' : 'Sterile compounding lab' },
                { icon: '🚚', text: 'Ships nationwide' },
                { icon: '✓', text: 'Immediate checkout path' },
                { icon: '🔒', text: 'HIPAA-compliant ordering' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isRoninPortal ? '#e2e8f0' : isAlphaPortal ? '#FACC15' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isEmpirePortal && (
        <section style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: '#f8fbfc' }}>
                <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome from Mark Ayala
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  This Empire Health &amp; Wellness portal was created so you can browse our wellness catalog and continue directly to secure checkout — with member pricing automatically applied.
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
        <section style={{ background: '#f8fbfc', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '22px 0 8px' }}>
          <div className="container">
            <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid rgba(8,145,178,.18)', padding: '16px 20px', display: 'flex', gap: 12, flexDirection: 'column', boxShadow: '0 14px 34px rgba(15,23,42,.06)' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Search by peptide name, strength, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ borderRadius: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#075985', fontWeight: 800 }}>
                  AACTIVATED-RX member pricing is applied automatically at checkout.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 800 }}>
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
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section id="aactivated-top-sellers" style={{ background: '#f8fbfc', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '30px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {hasActiveAactivatedCatalogFilters ? 'Catalog results' : 'Top sellers'}
                </div>
                <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>
                  {hasActiveAactivatedCatalogFilters ? 'Browse available product paths' : 'Fast-start product paths'}
                </h2>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCatalogOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={catalogOpen}
                  style={{
                    background: catalogOpen ? '#ecfeff' : '#ffffff',
                    border: '1px solid rgba(8,145,178,.22)',
                    borderRadius: 12,
                    color: '#0891b2',
                    cursor: 'pointer',
                    fontWeight: 900,
                    padding: '10px 14px',
                    boxShadow: catalogOpen ? '0 12px 30px rgba(8,145,178,.12)' : '0 8px 20px rgba(15,23,42,.04)',
                  }}
                >
                  Full Catalog <span style={{ fontSize: 12 }}>{catalogOpen ? '^' : 'v'}</span>
                </button>
                {catalogOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      zIndex: 12,
                      width: 'min(280px, calc(100vw - 32px))',
                      background: '#ffffff',
                      border: '1px solid rgba(8,145,178,.18)',
                      borderRadius: 14,
                      padding: 8,
                      boxShadow: '0 24px 60px rgba(15,23,42,.18)',
                    }}
                  >
                    <a
                      href="#aactivated-top-sellers"
                      role="menuitem"
                      onClick={() => setCatalogOpen(false)}
                      style={{ display: 'block', padding: '12px 14px', borderRadius: 10, color: '#075985', fontWeight: 900, textDecoration: 'none' }}
                    >
                      Shop Top Sellers
                    </a>
                    <a
                      href="/aactivated/library"
                      role="menuitem"
                      onClick={() => setCatalogOpen(false)}
                      style={{ display: 'block', padding: '12px 14px', borderRadius: 10, color: '#075985', fontWeight: 900, textDecoration: 'none' }}
                    >
                      See Our Product Library
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 22 }}>
              {aactivatedCatalogProducts.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid rgba(8,145,178,.14)', borderRadius: 12, padding: 22, color: '#475569', fontWeight: 800 }}>
                  No products found. Try a different search or category filter.
                </div>
              ) : aactivatedCatalogProducts.map((product) => (
                <AactivatedShowcaseCard
                  key={product.id}
                  product={product}
                  qty={cart[product.id] ?? 0}
                  onQtyChange={setQty}
                  onAdd={(id) => { addToCart(id); setCategory(product.category); }}
                  onLearnMore={setDetailProduct}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {isGuyPortal && (
        <section id="aactivated-calculator" style={{ background: '#f4f8fb', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '22px 0' }}>
          <div className="container">
            <details className="aactivated-resource-dropdown">
              <summary>
                <span>
                  <small>AACTIVATEDRX resources</small>
                  <strong>Education, library paths, and mixing calculator</strong>
                </span>
                <b aria-hidden="true">v</b>
              </summary>
              <div className="aactivated-resource-dropdown-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(300px,1.1fr)', gap: 18 }} className="portal-welcome-grid">
                  <div>
                    <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Compound Library</div>
                    <h2 style={{ margin: '0 0 10px', color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>Education by goal</h2>
                    <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px', fontWeight: 650 }}>
                      Start with the goal, then use the AACTIVATED library to compare commonly requested peptide pairings before checkout. Pairing paths are educational only and final use should be discussed with a licensed provider.
                    </p>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {AACTIVATED_EDUCATION.map((item) => (
                        <div key={item.title} style={{ background: '#fff', border: '1px solid rgba(8,145,178,.14)', borderRadius: 12, padding: 16, boxShadow: '0 8px 22px rgba(15,23,42,.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ color: 'var(--navy)', fontWeight: 950, fontSize: 16 }}>{item.title}</div>
                            <Link to="/aactivated/library" style={{ color: '#0891b2', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>Open library</Link>
                          </div>
                          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, marginTop: 6, fontWeight: 600 }}>{item.body}</div>
                          <div style={{ color: '#075985', fontSize: 11, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 12 }}>
                            Pairing path
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                            {item.pairings.map((pairing) => (
                              <span key={pairing} style={{ background: '#ecfeff', border: '1px solid rgba(8,145,178,.18)', borderRadius: 999, color: '#155e75', fontSize: 11, fontWeight: 850, padding: '5px 9px' }}>
                                {pairing}
                              </span>
                            ))}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
                            {item.library}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid rgba(37,99,235,.14)', borderRadius: 12, padding: 14, marginTop: 14, color: '#334155', fontSize: 12, lineHeight: 1.65, fontWeight: 650 }}>
                      Pairing ideas are not protocols, prescriptions, dosing guidance, or medical advice. Availability, suitability, and final product selection remain subject to standard verification and state availability.
                    </div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18, boxShadow: '0 12px 28px rgba(15,23,42,.06)' }}>
                    <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Mixing calculator</div>
                    <h3 style={{ margin: '0 0 14px', color: 'var(--navy)', fontSize: 22 }}>Mixing strength and draw volume</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Vial mg<input className="form-input" type="number" min="1" value={calcMg} onChange={(e) => setCalcMg(Number(e.target.value))} /></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Water mL<input className="form-input" type="number" min="0.1" step="0.1" value={calcMl} onChange={(e) => setCalcMl(Number(e.target.value))} /></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Dose unit<select className="form-input" value={calcDoseUnit} onChange={(e) => setCalcDoseUnit(e.target.value as 'mg' | 'mcg')}><option value="mg">mg</option><option value="mcg">mcg</option></select></label>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Desired dose ({calcDoseUnit})<input className="form-input" type="number" min="0" step={calcDoseUnit === 'mg' ? '0.01' : '1'} value={calcDose} onChange={(e) => setCalcDose(Number(e.target.value))} /></label>
                    </div>
                    <div style={{ background: '#ecfeff', border: '1px solid rgba(8,145,178,.18)', borderRadius: 10, padding: 14, marginTop: 14 }}>
                      <div style={{ color: '#155e75', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Mixed concentration</div>
                      <div style={{ color: 'var(--navy)', fontSize: 30, fontWeight: 900 }}>{Number.isFinite(calcMgPerMl) ? calcMgPerMl.toFixed(2) : '0.00'} mg/mL</div>
                      <div style={{ color: '#155e75', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', marginTop: 12 }}>Estimated draw</div>
                      <div style={{ color: 'var(--navy)', fontSize: 24, fontWeight: 900 }}>{Number.isFinite(calcDrawMl) ? calcDrawMl.toFixed(2) : '0.00'} mL / {Number.isFinite(calcUnits) ? calcUnits.toFixed(1) : '0.0'} units</div>
                      <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5 }}>Calculator is educational only. Follow licensed-provider and pharmacy instructions.</div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </section>
      )}

      {isScottPortal && (
        <section style={{ background: '#f0f5ff', borderBottom: '1px solid rgba(37,99,235,.18)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(37,99,235,.22)', borderRadius: 12, padding: 20, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to Peak Form Peptides
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  This portal gives you direct access to our curated peptide catalog — built for performance, recovery, and peak wellness. Select your products and continue directly to secure checkout.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(37,99,235,.3)', borderRadius: 12, padding: 20, background: 'rgba(37,99,235,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 118 }}>
                <div style={{ color: 'var(--navy)', fontSize: 22, fontWeight: 900, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Peak Form Peptides
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isAlphaPortal && (
        <section style={{ background: '#11100d', borderBottom: '1px solid rgba(245,158,11,.22)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(245,158,11,.24)', borderRadius: 12, padding: 20, background: '#fffaf0' }}>
                <div style={{ fontSize: 12, color: '#a16207', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Welcome to Alpha Pride Wellness
                </div>
                <p style={{ margin: 0, color: '#171717', fontWeight: 750, lineHeight: 1.7 }}>
                  A premium black-and-gold catalog built for strength, recovery, performance, and elite wellness. Select your products and continue directly to secure checkout.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(245,158,11,.32)', borderRadius: 12, padding: 20, background: 'linear-gradient(135deg,#050505,#2b210f)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 118 }}>
                <div style={{ color: '#FACC15', fontSize: 22, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Alpha Pride Wellness
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isOptimaxPortal && (
        <section style={{ background: '#f4fbf8', borderBottom: '1px solid rgba(123,220,42,.22)', padding: '22px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)', gap: 18, alignItems: 'stretch' }} className="portal-welcome-grid">
              <div style={{ border: '1px solid rgba(25,199,217,.24)', borderRadius: 12, padding: 20, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#087f8c', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Optimax Peptide Therapy
                </div>
                <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 700, lineHeight: 1.7 }}>
                  Premium peptide therapy solutions built for athletic optimization, recovery, longevity, and modern wellness.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(123,220,42,.32)', borderRadius: 12, padding: 20, background: 'rgba(123,220,42,.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <img
                  src={OPTIMAX_LOGO_SRC}
                  alt="Optimax Peptide Therapy"
                  style={{ width: 'min(230px, 100%)', height: 'auto', margin: '0 0 14px', filter: 'drop-shadow(0 8px 18px rgba(8,127,140,.14))' }}
                />
                <div style={{ fontSize: 12, color: '#3b7f08', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Compliance Note
                </div>
                <div style={{ color: 'var(--navy)', fontWeight: 800, lineHeight: 1.6 }}>
                  Products and availability may vary. Orders continue to secure checkout and remain subject to standard verification.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!isGuyPortal && (
      <section id={isAlphaPortal ? 'alphapride-products' : isOptimaxPortal ? 'optimax-products' : isRoninPortal ? 'ronin-products' : undefined} style={{ background: isRoninPortal ? 'linear-gradient(180deg,#090a0e,#111217)' : isAlphaPortal ? '#0b0b0a' : '#f4f6f9', padding: '32px 0 64px' }}>
        <div className="container">
          {isOptimaxPortal && (
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: '0 0 6px', color: 'var(--navy)', fontSize: 26, fontWeight: 900 }}>
                Available Peptide Options
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 700 }}>
                Retail pricing shown. Checkout stays connected to Optimax Peptide Therapy.
              </p>
            </div>
          )}

          {/* Search + category filters */}
          <div style={{ background: isGuyPortal ? 'rgba(255,255,255,.96)' : isRoninPortal ? '#15171c' : isAlphaPortal ? '#fffaf0' : '#fff', borderRadius: 14, border: isGuyPortal ? '1px solid rgba(103,232,249,.28)' : isRoninPortal ? '1px solid rgba(248,113,113,.18)' : isAlphaPortal ? '1px solid rgba(245,158,11,.28)' : '1px solid var(--border)', padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexDirection: 'column', boxShadow: isGuyPortal ? '0 18px 42px rgba(2,8,23,.22)' : isRoninPortal ? '0 18px 42px rgba(0,0,0,.24)' : isAlphaPortal ? '0 18px 42px rgba(0,0,0,.28)' : '0 1px 6px rgba(0,0,0,.05)' }}>
            <input
              type="search"
              className="form-input"
              placeholder="Search by peptide name, strength, or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ borderRadius: 10 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {!isRobertPortal && (
                <div style={{ fontSize: 12, color: isGuyPortal ? '#075985' : 'var(--text-muted)', fontWeight: 700 }}>
                  {isEmpirePortal ? 'Member pricing stays attached through checkout.' : isGuyPortal ? 'AACTIVATED-RX member pricing is applied automatically at checkout.' : isScottPortal ? 'Peak Form member pricing is applied automatically at checkout.' : isAlphaPortal ? 'Alpha Pride pricing is applied automatically at checkout.' : isOptimaxPortal ? 'Optimax retail pricing is applied automatically at checkout.' : isRoninPortal ? 'Ronin pricing is applied automatically at checkout.' : 'Partner catalog pricing stays attached through checkout.'}
                </div>
              )}
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
                  <div style={{ fontSize: 13, color: isGuyPortal ? 'rgba(255,255,255,.68)' : isRoninPortal ? 'rgba(226,232,240,.68)' : isAlphaPortal ? 'rgba(250,204,21,.72)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>
                    Showing {visibleProducts.length} treatment{visibleProducts.length !== 1 ? 's' : ''}{category !== 'All' ? ` · ${category}` : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isGuyPortal ? 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isGuyPortal ? 28 : 14 }}>
                    {visibleProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        qty={cart[product.id] ?? 0}
                        onQtyChange={setQty}
                        onAdd={addToCart}
                        onLearnMore={setDetailProduct}
                        showDiscount={isEmpirePortal || isGuyPortal || isAlphaPortal || isRoninPortal}
                        isMarkPortal={isEmpirePortal}
                        isGuyPortal={isGuyPortal}
                        isRobertPortal={isRobertPortal}
                        isScottPortal={isScottPortal}
                        isAlphaPortal={isAlphaPortal}
                        isOptimaxPortal={isOptimaxPortal}
                        isRoninPortal={isRoninPortal}
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
                      Secure checkout available. Ships directly to your door.
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
            {isGuyPortal
              ? 'AACTIVATEDRX does not provide medical advice, diagnosis, or treatment.'
              : `${isScottPortal ? 'Peak Form Peptides' : isAlphaPortal ? 'Alpha Pride Wellness' : isOptimaxPortal ? 'Optimax Peptide Therapy' : isRoninPortal ? 'Ronin' : 'Empire Health & Wellness'} and PepScriptRX do not provide medical advice, diagnosis, or treatment.`}
            Product availability, pricing, and fulfillment are subject to standard verification and applicable state regulations.
            Orders may require eligibility or state-availability checks before shipment. Not all products are available in every state.
            <div style={{ color: isRoninPortal ? '#fecaca' : isAlphaPortal ? '#a16207' : isRobertPortal ? '#92400e' : 'var(--text-muted)', fontWeight: 800, marginTop: 8 }}>
              {portalPoweredByLabel(isEmpirePortal, isGuyPortal, isRobertPortal, isOptimaxPortal, isAlphaPortal, isRoninPortal)}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
              <a href={privacyPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>Privacy Policy</a>
              <a href={termsPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>Terms &amp; Conditions</a>
              <a href={certificatesPath} style={{ color: 'var(--teal)', fontWeight: 700 }}>Quality Documents</a>
            </div>
          </div>
        </div>
      </section>
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={addToCart}
        isMarkPortal={isEmpirePortal}
        isGuyPortal={isGuyPortal}
        isRobertPortal={isRobertPortal}
        isScottPortal={isScottPortal}
        isAlphaPortal={isAlphaPortal}
        isOptimaxPortal={isOptimaxPortal}
        isRoninPortal={isRoninPortal}
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
