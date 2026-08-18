import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProductMetadata, productMetaSearchText } from '../../lib/productMetadata';
import {
  ROCKPHORM_PRODUCT_SELECT,
  dedupeRockPhormManagedProducts,
  mapRockPhormProductRow,
  type RockPhormManagedProduct,
  type RockPhormProductRow,
} from '../../lib/rockPhormProducts';
import {
  KLOW_STORE_NAME,
  KLOW_STORE_SLUG,
  ROCKPHORM_COMMISSION_RATE,
  ROCKPHORM_SCOPE_CODE,
  ROCKPHORM_STORE_SLUG,
} from '../../lib/rockPhormScope';
import { supabase } from '../../lib/supabase';

type CartMap = Record<string, number>;
type ProductGroup = 'recovery' | 'radiance' | 'restoration' | 'performance';
type KlowLocale = 'en' | 'es';
type KlowCatalogProduct = DistributorCatalogProduct & {
  originalDisplayPrice?: number;
  priceNote?: string;
};
type KlowRepAttribution = {
  scopeCode: string;
  repSlug: string;
  label: string;
  commissionRate: number;
  priceMultiplier?: number;
  priceNote?: string;
};

const CART_STORAGE_KEY = 'pepscriptrx_portal_cart';
const HERO_IMAGE = '/brands/klow/klow-luxury-bundle.png';
const AMBIENT_IMAGE = '/brands/klow/klow-radiance-hero.png';
const PRODUCT_CARD_IMAGE = '/brands/klow/klow-vial-placeholder.png';

const KLOW_COPY = {
  en: {
    seoTitle: 'KLOW Recovery + Radiance | Rock Phorm x PepScriptRX',
    seoDescription: 'Premium recovery and radiance peptide marketplace powered by PepScriptRX.',
    languageLabel: 'Language selector',
    kicker: 'Rock Phorm x PepScriptRX',
    headline: 'KLOW Recovery + Radiance',
    subheadline: 'Luxury peptide wellness focused on recovery, skin support, restoration, and full-body radiance.',
    tagline: 'Calm the system. Restore the body. Reveal the glow.',
    shopCta: 'Shop KLOW',
    recoveryCta: 'Explore Recovery Blends',
    heroAlt: 'KLOW luxury recovery and radiance peptide bundle',
    ambientAlt: 'KLOW dark champagne radiance visual',
    introKicker: 'Recovery / Skin / Restoration',
    introTitle: 'Luxury wellness with a recovery-led edge.',
    introBody: 'KLOW is a darker, calmer, recovery-led storefront for customers reviewing restoration, skin support, and full-body radiance options.',
    repPriceNote: 'Rebecca preferred pricing',
    repPriceActive: '30% preferred store pricing is active.',
    searchPlaceholder: 'Search KLOW products',
    jumpLinksLabel: 'Product section links',
    recoveryLink: 'Recovery',
    radianceLink: 'Radiance',
    restorationLink: 'Restoration',
    performanceLink: 'Performance',
    recoveryEyebrow: 'Elite Recovery',
    recoveryTitle: 'Recovery blends, repair support, and inflammation-conscious wellness.',
    radianceEyebrow: 'Skin Support & Radiance',
    radianceTitle: 'Skin-forward peptides and antioxidant support for full-body glow.',
    restorationEyebrow: 'Restoration & Longevity',
    restorationTitle: 'Cellular vitality and restoration support for a calmer system.',
    performanceEyebrow: 'Performance Wellness',
    performanceTitle: 'Advanced optimization options for experienced wellness customers.',
    processKicker: 'Boutique process',
    processTitle: 'Processed through PepScriptRX.',
    processBody: 'Orders move through secure PepScriptRX checkout with standard review, payment, and fulfillment handling.',
    supportKicker: 'Guided support',
    supportTitle: 'Mixing Center and product education.',
    supportBody: 'Customers can use the KLOW education tools for mixing, product review, and preparation support.',
    openMixing: 'Open Mixing Center',
    cartLabel: 'KLOW cart summary',
    item: 'item',
    items: 'items',
    checkoutAvailable: 'Checkout Available',
    bestFor: 'Best For',
    whyChoose: 'Why Customers Choose It',
    bacWater: '3 mL BAC Water Included',
    physicianReview: 'Physician Review',
    rockPayout: 'Rock Phorm Payout',
    mixingCenter: 'Mixing Center',
    reviewPrice: 'Review',
    addToCart: 'Add to Cart',
    remove: 'Remove',
    addAnother: 'Add another',
    productAltSuffix: 'KLOW vial placeholder',
  },
  es: {
    seoTitle: 'KLOW Recuperación + Vitalidad | PepScriptRX',
    seoDescription: 'Descubre KLOW, una experiencia premium enfocada en bienestar, recuperación y vitalidad.',
    languageLabel: 'Selector de idioma',
    kicker: 'Rock Phorm x PepScriptRX',
    headline: 'KLOW Recuperación + Vitalidad',
    subheadline: 'Bienestar peptídico de lujo enfocado en recuperación, soporte para la piel, restauración y vitalidad de cuerpo completo.',
    tagline: 'Calma el sistema. Restaura el cuerpo. Revela el brillo.',
    shopCta: 'Comprar KLOW',
    recoveryCta: 'Explorar fórmulas de recuperación',
    heroAlt: 'Paquete de lujo KLOW para recuperación y vitalidad',
    ambientAlt: 'Visual KLOW de vitalidad en tonos champán oscuro',
    introKicker: 'Recuperación / Piel / Restauración',
    introTitle: 'Bienestar de lujo con enfoque en recuperación.',
    introBody: 'KLOW es una tienda más sobria, calmada y enfocada en recuperación para clientes que revisan opciones de restauración, soporte para la piel y vitalidad integral.',
    repPriceNote: 'Precio preferente de Rebecca',
    repPriceActive: 'El precio preferente del 30% está activo.',
    searchPlaceholder: 'Buscar productos KLOW',
    jumpLinksLabel: 'Enlaces de secciones de productos',
    recoveryLink: 'Recuperación',
    radianceLink: 'Vitalidad',
    restorationLink: 'Restauración',
    performanceLink: 'Rendimiento',
    recoveryEyebrow: 'Recuperación élite',
    recoveryTitle: 'Fórmulas de recuperación, soporte de reparación y bienestar consciente de la inflamación.',
    radianceEyebrow: 'Soporte para la piel + vitalidad',
    radianceTitle: 'Péptidos orientados a la piel y soporte antioxidante para un brillo integral.',
    restorationEyebrow: 'Restauración + longevidad',
    restorationTitle: 'Vitalidad celular y soporte de restauración para un sistema más calmado.',
    performanceEyebrow: 'Bienestar de rendimiento',
    performanceTitle: 'Opciones avanzadas de optimización para clientes con experiencia en bienestar.',
    processKicker: 'Proceso boutique',
    processTitle: 'Procesado a través de PepScriptRX.',
    processBody: 'Los pedidos pasan por el checkout seguro de PepScriptRX con revisión, pago y gestión de cumplimiento estándar.',
    supportKicker: 'Soporte guiado',
    supportTitle: 'Centro de mezcla y educación de productos.',
    supportBody: 'Los clientes pueden usar las herramientas educativas de KLOW para cálculos de mezcla, revisión de producto y soporte de preparación.',
    openMixing: 'Abrir centro de mezcla',
    cartLabel: 'Resumen del carrito KLOW',
    item: 'producto',
    items: 'productos',
    checkoutAvailable: 'Finalizar compra',
    bestFor: 'Ideal para',
    whyChoose: 'Por qué lo eligen los clientes',
    bacWater: 'Incluye 3 mL de agua BAC',
    physicianReview: 'Revisión médica',
    rockPayout: 'Pago Rock Phorm',
    mixingCenter: 'Centro de mezcla',
    reviewPrice: 'Revisión',
    addToCart: 'Agregar al carrito',
    remove: 'Quitar',
    addAnother: 'Agregar otro',
    productAltSuffix: 'imagen de vial KLOW',
  },
} as const;

type KlowCopy = (typeof KLOW_COPY)[KlowLocale];

const KLOW_REP_ATTRIBUTIONS: Record<string, KlowRepAttribution> = {
  REBECCAKLOW: {
    scopeCode: 'REBECCAKLOW',
    repSlug: 'REBECCA-ALMANZA',
    label: 'Rebecca Almanza',
    commissionRate: 0.40,
    priceMultiplier: 0.70,
    priceNote: 'Rebecca preferred pricing',
  },
  NIKKIKLOW: {
    scopeCode: 'NIKKIKLOW',
    repSlug: 'SERENA-BRISSON',
    label: 'Serena Brisson',
    commissionRate: 0.40,
  },
};

const PRODUCT_PRIORITY = [
  'rockphorm-klow-peptide-blend',
  'rockphorm-bpc-157-tb-500-blend',
  'rockphorm-bpc-157-10mg',
  'rockphorm-tb-500-10mg',
  'rockphorm-ghk-cu-100mg',
  'rockphorm-glutathione-1500mg',
  'rockphorm-nad-plus',
  'rockphorm-tesamorelin-10mg',
  'rockphorm-cjc-1295-ipamorelin',
  'rockphorm-hgh-somatropin',
  'rockphorm-semaglutide-10mg',
  'rockphorm-tirzepatide-15mg',
  'rockphorm-tirzepatide-30mg',
  'rockphorm-retatrutide-15mg',
  'rockphorm-retatrutide-30mg',
  'rockphorm-cagrisema',
  'rockphorm-cagrilintide-5mg',
  'rockphorm-glow-peptide-blend',
];

const PRODUCT_COPY: Record<string, { short: string; bestFor: string; why: string; group: ProductGroup }> = {
  'rockphorm-klow-peptide-blend': {
    short: 'A luxury recovery and radiance blend positioned for calm, repair, skin support, and full-body restoration.',
    bestFor: 'Recovery routines, skin support, inflammation-conscious wellness, and elevated radiance protocols.',
    why: 'KLOW is the signature boutique blend for customers who want recovery and skin-forward wellness in one premium ritual.',
    group: 'recovery',
  },
  'rockphorm-bpc-157-tb-500-blend': {
    short: 'A recovery stack commonly selected by active customers focused on repair and resilient movement.',
    bestFor: 'Repair-focused routines, training recovery, mobility support, and advanced wellness plans.',
    why: 'The combined BPC-157 and TB-500 pathway fits customers building a more complete restoration routine.',
    group: 'recovery',
  },
  'rockphorm-bpc-157-10mg': {
    short: 'A focused repair-support peptide for customers building a recovery-centered wellness routine.',
    bestFor: 'Recovery support, repair routines, active wellness, and restoration-focused protocols.',
    why: 'BPC-157 is a frequent foundation product for customers prioritizing recovery and tissue-support conversations.',
    group: 'recovery',
  },
  'rockphorm-tb-500-10mg': {
    short: 'A repair and mobility-oriented option often paired with active lifestyle recovery goals.',
    bestFor: 'Mobility-conscious routines, performance recovery, and repair-focused wellness.',
    why: 'TB-500 fits customers who want recovery support with a premium, performance-aware approach.',
    group: 'recovery',
  },
  'rockphorm-ghk-cu-100mg': {
    short: 'A skin and cosmetic wellness peptide associated with repair, tone, and radiance-focused routines.',
    bestFor: 'Skin quality support, cosmetic wellness, hair, skin, nail routines, and repair support.',
    why: 'GHK-Cu anchors the radiance side of KLOW with a refined skin-support profile.',
    group: 'radiance',
  },
  'rockphorm-glutathione-1500mg': {
    short: 'A premium antioxidant option commonly chosen for cellular support and glow-oriented wellness.',
    bestFor: 'Antioxidant support, beauty wellness, cellular wellness, and radiance routines.',
    why: 'Glutathione complements peptide routines for customers focused on wellness from within.',
    group: 'radiance',
  },
  'rockphorm-nad-plus': {
    short: 'A cellular vitality option for customers focused on energy, clarity, restoration, and longevity.',
    bestFor: 'Cellular energy, longevity routines, vitality support, and fatigue-conscious wellness.',
    why: 'NAD+ supports the restoration side of KLOW with a clean longevity and energy position.',
    group: 'restoration',
  },
  'rockphorm-tesamorelin-10mg': {
    short: 'An advanced body-composition and wellness optimization option for experienced customers.',
    bestFor: 'Longevity-focused wellness, body-composition routines, and advanced vitality plans.',
    why: 'Tesamorelin fits customers who want a more elevated metabolic and restoration-oriented option.',
    group: 'performance',
  },
  'rockphorm-cjc-1295-ipamorelin': {
    short: 'A performance and recovery-support blend selected by customers pursuing advanced optimization.',
    bestFor: 'Recovery routines, performance wellness, body composition, and experienced peptide users.',
    why: 'CJC / Ipamorelin keeps the KLOW catalog rounded for performance-minded customers.',
    group: 'performance',
  },
};

const PRODUCT_COPY_ES: Record<string, { short: string; bestFor: string; why: string; group: ProductGroup }> = {
  'rockphorm-klow-peptide-blend': {
    short: 'Una fórmula de lujo para recuperación y vitalidad, posicionada para calma, reparación, soporte para la piel y restauración integral.',
    bestFor: 'Rutinas de recuperación, soporte para la piel, bienestar consciente de la inflamación y protocolos elevados de vitalidad.',
    why: 'KLOW es la fórmula boutique insignia para clientes que desean bienestar enfocado en recuperación y piel dentro de un ritual premium.',
    group: 'recovery',
  },
  'rockphorm-bpc-157-tb-500-blend': {
    short: 'Un stack de recuperación seleccionado por clientes activos enfocados en reparación y movimiento resiliente.',
    bestFor: 'Rutinas enfocadas en reparación, recuperación del entrenamiento, soporte de movilidad y planes avanzados de bienestar.',
    why: 'La combinación BPC-157 y TB-500 encaja con clientes que buscan una rutina de restauración más completa.',
    group: 'recovery',
  },
  'rockphorm-bpc-157-10mg': {
    short: 'Un péptido enfocado en soporte de reparación para clientes que construyen una rutina centrada en recuperación.',
    bestFor: 'Soporte de recuperación, rutinas de reparación, bienestar activo y protocolos de restauración.',
    why: 'BPC-157 suele ser una base para clientes que priorizan conversaciones de recuperación y soporte tisular.',
    group: 'recovery',
  },
  'rockphorm-tb-500-10mg': {
    short: 'Una opción orientada a reparación y movilidad, a menudo vinculada con metas de recuperación para estilos de vida activos.',
    bestFor: 'Rutinas conscientes de movilidad, recuperación de rendimiento y bienestar enfocado en reparación.',
    why: 'TB-500 encaja con clientes que desean soporte de recuperación con un enfoque premium y orientado al rendimiento.',
    group: 'recovery',
  },
  'rockphorm-ghk-cu-100mg': {
    short: 'Un péptido de bienestar cosmético y de piel asociado con rutinas enfocadas en reparación, tono y vitalidad.',
    bestFor: 'Soporte de calidad de piel, bienestar cosmético, rutinas para cabello, piel y uñas, y soporte de reparación.',
    why: 'GHK-Cu sostiene el lado de vitalidad de KLOW con un perfil refinado de soporte para la piel.',
    group: 'radiance',
  },
  'rockphorm-glutathione-1500mg': {
    short: 'Una opción antioxidante premium elegida con frecuencia para soporte celular y bienestar orientado al brillo.',
    bestFor: 'Soporte antioxidante, bienestar de belleza, bienestar celular y rutinas de vitalidad.',
    why: 'Glutatión complementa rutinas peptídicas para clientes enfocados en bienestar desde adentro.',
    group: 'radiance',
  },
  'rockphorm-nad-plus': {
    short: 'Una opción de vitalidad celular para clientes enfocados en energía, claridad, restauración y longevidad.',
    bestFor: 'Energía celular, rutinas de longevidad, soporte de vitalidad y bienestar consciente de la fatiga.',
    why: 'NAD+ apoya el lado restaurador de KLOW con una posición limpia de longevidad y energía.',
    group: 'restoration',
  },
  'rockphorm-tesamorelin-10mg': {
    short: 'Una opción avanzada de composición corporal y optimización de bienestar para clientes con experiencia.',
    bestFor: 'Bienestar enfocado en longevidad, rutinas de composición corporal y planes avanzados de vitalidad.',
    why: 'Tesamorelin encaja con clientes que desean una opción metabólica y restauradora más elevada.',
    group: 'performance',
  },
  'rockphorm-cjc-1295-ipamorelin': {
    short: 'Una fórmula de soporte para rendimiento y recuperación seleccionada por clientes que buscan optimización avanzada.',
    bestFor: 'Rutinas de recuperación, bienestar de rendimiento, composición corporal y usuarios con experiencia en péptidos.',
    why: 'CJC / Ipamorelin completa el catálogo KLOW para clientes con mentalidad de rendimiento.',
    group: 'performance',
  },
};

type KlowStorefrontProps = {
  locale?: KlowLocale;
};

export default function KlowStorefront({ locale = 'en' }: KlowStorefrontProps) {
  const text = KLOW_COPY[locale];
  const portalPath = locale === 'es' ? '/klow-es' : '/klow';
  usePageMeta(
    text.seoTitle,
    text.seoDescription,
    HERO_IMAGE,
  );
  useKlowLocaleMetadata(locale);
  const navigate = useNavigate();
  const activeAttribution = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return resolveKlowRepAttribution(new URLSearchParams(window.location.search).get('rep'));
  }, []);
  const [liveProducts, setLiveProducts] = useState<DistributorCatalogProduct[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from('distributor_products')
      .select(ROCKPHORM_PRODUCT_SELECT)
      .eq('distributor.slug', ROCKPHORM_STORE_SLUG)
      .order('featured', { ascending: false })
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const nextProducts = ((data as unknown as RockPhormProductRow[]) ?? [])
          .map(mapRockPhormProductRow)
          .filter((product): product is RockPhormManagedProduct => Boolean(product?.dbEnabled));
        const uniqueProducts = dedupeRockPhormManagedProducts(nextProducts);
        setLiveProducts(uniqueProducts.length > 0 ? uniqueProducts : null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(() => {
    const baseProducts = sortKlowProducts(
      keepKlow70MgProduct(liveProducts ?? getDistributorProducts(ROCKPHORM_STORE_SLUG)),
    );
    return applyKlowRepPricing(baseProducts, activeAttribution, text.repPriceNote);
  }, [activeAttribution, liveProducts, text.repPriceNote]);
  const [cart, setCart] = useState<CartMap>({});
  const [search, setSearch] = useState('');

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, products);
  const visibleProducts = products.filter((product) => {
    const copy = productCopy(product, locale);
    const q = search.trim().toLowerCase();
    return !q || [product.product_name, product.strength, product.category, product.description, productMetaSearchText(product), copy.short].join(' ').toLowerCase().includes(q);
  });

  const recoveryProducts = visibleProducts.filter((product) => productCopy(product, locale).group === 'recovery');
  const radianceProducts = visibleProducts.filter((product) => productCopy(product, locale).group === 'radiance');
  const restorationProducts = visibleProducts.filter((product) => productCopy(product, locale).group === 'restoration');
  const performanceProducts = visibleProducts.filter((product) => productCopy(product, locale).group === 'performance');

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
          original_price: getOriginalDisplayPrice(product),
          price_note: product.priceNote,
          qty,
          inventory_status_at_purchase: 'checkout_available',
          inventory_status_label_at_purchase: text.checkoutAvailable,
          was_special_order: false,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!items.length) return;

    const checkoutScopeCode = activeAttribution?.scopeCode ?? ROCKPHORM_SCOPE_CODE;
    const sourceRepCode = activeAttribution?.scopeCode ?? ROCKPHORM_SCOPE_CODE;

    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      rep: sourceRepCode,
      scope_code: checkoutScopeCode,
      discount_code: '',
      discount_amount: 0,
      distributor: ROCKPHORM_STORE_SLUG,
      source_portal: KLOW_STORE_NAME,
      source_route: `${window.location.pathname}${window.location.search}`,
      locale,
      source_language: locale,
      store_slug: KLOW_STORE_SLUG,
      store_name: KLOW_STORE_NAME,
      brand_id: ROCKPHORM_STORE_SLUG,
      admin_code: ROCKPHORM_SCOPE_CODE,
      account_type: activeAttribution ? 'rep' : 'admin',
      parent_type: activeAttribution ? 'klow_downline_rep' : 'rockphorm_secondary_brand',
      parent_rep: ROCKPHORM_SCOPE_CODE,
      commission_owner: activeAttribution?.scopeCode ?? ROCKPHORM_STORE_SLUG,
      commission_rate: activeAttribution?.commissionRate ?? ROCKPHORM_COMMISSION_RATE,
      partner_payout_eligible: true,
      items,
      total: subtotal,
      capturedAt: new Date().toISOString(),
    }));

    const params = new URLSearchParams({ scope: checkoutScopeCode, source: 'klow-portal', rep: sourceRepCode, brand: 'klow' });
    if (locale === 'es') params.set('locale', 'es');
    navigate(`/start?${params.toString()}`);
  }

  return (
    <PublicLayout isolatedPortal portalHomePath={portalPath} portalName="KLOW" portalKey="klow" portalLocale={locale}>
      <div className={`klow-store-wrap klow-locale-${locale}`}>
        <section className="klow-hero">
          <div className="klow-shell klow-hero-grid">
            <div className="klow-hero-copy">
              <nav className="klow-language-switch" aria-label={text.languageLabel}>
                <Link className={locale === 'en' ? 'active' : ''} to={buildKlowLocalePath('en')}>EN</Link>
                <span>|</span>
                <Link className={locale === 'es' ? 'active' : ''} to={buildKlowLocalePath('es')}>ES</Link>
              </nav>
              <p className="klow-kicker">{text.kicker}</p>
              <KlowHeroHeadline locale={locale} headline={text.headline} />
              <p className="klow-subheadline">{text.subheadline}</p>
              <p className="klow-tagline">{text.tagline}</p>
              <div className="klow-actions">
                <a className="klow-btn klow-btn-primary" href="#klow-recovery">{text.shopCta}</a>
                <a className="klow-btn klow-btn-secondary" href="#klow-recovery">{text.recoveryCta}</a>
              </div>
            </div>
            <div className="klow-hero-media">
              <img src={HERO_IMAGE} alt={text.heroAlt} />
            </div>
            <KlowPurityBadge locale={locale} />
          </div>
        </section>

        <section className="klow-section klow-intro-band">
          <div className="klow-shell klow-intro-grid">
            <img src={AMBIENT_IMAGE} alt={text.ambientAlt} loading="lazy" />
            <div>
              <p className="klow-kicker">{text.introKicker}</p>
              <h2>{text.introTitle}</h2>
              <p>{text.introBody}</p>
              {activeAttribution?.priceNote && <p className="klow-pricing-note">{text.repPriceNote}: {text.repPriceActive}</p>}
            </div>
          </div>
        </section>

        <section className="klow-section klow-catalog">
          <div className="klow-shell">
            <div className="klow-filter-row">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder} />
              <div className="klow-jump-links" aria-label={text.jumpLinksLabel}>
                <a href="#klow-recovery">{text.recoveryLink}</a>
                <a href="#klow-radiance">{text.radianceLink}</a>
                <a href="#klow-restoration">{text.restorationLink}</a>
                <a href="#klow-performance">{text.performanceLink}</a>
              </div>
            </div>

            <StoreSection id="klow-recovery" eyebrow={text.recoveryEyebrow} title={text.recoveryTitle} products={recoveryProducts} cart={cart} addToCart={addToCart} setQty={setQty} locale={locale} text={text} portalPath={portalPath} />
            <StoreSection id="klow-radiance" eyebrow={text.radianceEyebrow} title={text.radianceTitle} products={radianceProducts} cart={cart} addToCart={addToCart} setQty={setQty} locale={locale} text={text} portalPath={portalPath} />
            <StoreSection id="klow-restoration" eyebrow={text.restorationEyebrow} title={text.restorationTitle} products={restorationProducts} cart={cart} addToCart={addToCart} setQty={setQty} locale={locale} text={text} portalPath={portalPath} />
            <StoreSection id="klow-performance" eyebrow={text.performanceEyebrow} title={text.performanceTitle} products={performanceProducts} cart={cart} addToCart={addToCart} setQty={setQty} locale={locale} text={text} portalPath={portalPath} />
          </div>
        </section>

        <section className="klow-section klow-process">
          <div className="klow-shell klow-process-grid">
            <article>
              <p className="klow-kicker">{text.processKicker}</p>
              <h2>{text.processTitle}</h2>
              <p>{text.processBody}</p>
            </article>
            <article>
              <p className="klow-kicker">{text.supportKicker}</p>
              <h2>{text.supportTitle}</h2>
              <p>{text.supportBody}</p>
              <Link className="klow-btn klow-btn-primary" to={`${portalPath}/mixing`}>{text.openMixing}</Link>
            </article>
          </div>
        </section>

        {count > 0 && (
          <aside className="klow-cart" aria-label={text.cartLabel}>
            <div>
              <strong>{count} {count === 1 ? text.item : text.items}</strong>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <button type="button" onClick={checkout}>{text.checkoutAvailable}</button>
          </aside>
        )}
      </div>

      <style>{KLOW_STYLES}</style>
    </PublicLayout>
  );
}

function KlowPurityBadge({ locale }: { locale: KlowLocale }) {
  if (locale !== 'es') return <ProductPurityGuaranteeBadge compact locale="en" />;

  return (
    <aside className="purity-guarantee-badge compact brand-pepscriptrx">
      <div className="purity-guarantee-art" aria-hidden="true">
        <div className="purity-guarantee-seal">
          <div className="purity-guarantee-shield">RX</div>
          <div className="purity-guarantee-percent">99.2%</div>
          <div className="purity-guarantee-seal-text">Confianza de Pureza</div>
          <div className="purity-guarantee-ribbon">Pruebas de Terceros</div>
          <div className="purity-guarantee-brand">PepScript<span>RX</span></div>
        </div>
      </div>
      <div className="purity-guarantee-copy">
        <div className="purity-guarantee-kicker">Pruebas de terceros disponibles</div>
        <h3>Garantia de confianza de pureza 99.2%</h3>
        <p>
          Se admite verificacion con pruebas de terceros. Si una prueba independiente aprobada muestra que un producto
          PepScriptRX verificado esta por debajo de 99.2% de pureza, el cliente puede calificar para una revision de reembolso.
        </p>
        <Link to="/product-confidence" className="purity-guarantee-link">Conocer mas</Link>
      </div>
    </aside>
  );
}

function KlowHeroHeadline({ locale, headline }: { locale: KlowLocale; headline: string }) {
  if (locale !== 'es') return <h1>{headline}</h1>;

  return (
    <h1 className="klow-headline-stack" lang="es">
      <span>KLOW</span>
      <span>Recuperación</span>
      <span>+ Vitalidad</span>
    </h1>
  );
}

function useKlowLocaleMetadata(locale: KlowLocale) {
  useEffect(() => {
    const previousLang = document.documentElement.lang;
    document.documentElement.lang = locale === 'es' ? 'es' : 'en';
    setAlternateLink('alternate-klow-en', 'en', `${window.location.origin}/klow`);
    setAlternateLink('alternate-klow-es', 'es', `${window.location.origin}/klow-es`);
    return () => {
      document.documentElement.lang = previousLang || 'en';
    };
  }, [locale]);
}

function setAlternateLink(id: string, hrefLang: string, href: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'alternate';
    document.head.appendChild(link);
  }
  link.hreflang = hrefLang;
  link.href = href;
}

function buildKlowLocalePath(locale: KlowLocale) {
  if (typeof window === 'undefined') return locale === 'es' ? '/klow-es' : '/klow';
  const params = new URLSearchParams(window.location.search);
  const query = params.toString();
  return `${locale === 'es' ? '/klow-es' : '/klow'}${query ? `?${query}` : ''}`;
}

function resolveKlowRepAttribution(value: string | null): KlowRepAttribution | null {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return KLOW_REP_ATTRIBUTIONS[normalized] ?? null;
}

function sortKlowProducts(products: DistributorCatalogProduct[]) {
  return [...products].sort((a, b) => priority(a) - priority(b) || a.product_name.localeCompare(b.product_name));
}

function keepKlow70MgProduct(products: DistributorCatalogProduct[]) {
  return products.filter((product) => {
    const identity = [product.id, product.sku, product.product_name].join(' ').toLowerCase();
    if (!identity.includes('klow')) return true;

    const strength = String(product.strength ?? '').toLowerCase().replace(/\s+/g, '');
    return strength.includes('70mg');
  });
}

function applyKlowRepPricing(products: DistributorCatalogProduct[], attribution: KlowRepAttribution | null, priceNote: string): KlowCatalogProduct[] {
  const multiplier = attribution?.priceMultiplier;
  if (!multiplier || multiplier === 1) return products;

  return products.map((product) => {
    const originalPrice = Number(product.displayPrice ?? product.suggested_retail_price ?? 0);
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) return product;
    const displayPrice = roundMoney(originalPrice * multiplier);
    return {
      ...product,
      displayPrice,
      suggested_retail_price: displayPrice,
      priceNote: attribution.priceNote ? priceNote : undefined,
      originalDisplayPrice: originalPrice,
      distributorProduct: {
        ...product.distributorProduct,
        custom_price: displayPrice,
      },
    };
  });
}

function getOriginalDisplayPrice(product: KlowCatalogProduct) {
  const original = Number(product.originalDisplayPrice ?? 0);
  return Number.isFinite(original) && original > 0 ? original : undefined;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function priority(product: DistributorCatalogProduct) {
  const found = PRODUCT_PRIORITY.indexOf(product.id);
  if (found >= 0) return found;
  const search = productMetaSearchText(product).toLowerCase();
  if (search.includes('recovery') || search.includes('repair') || search.includes('ghk')) return 120;
  if (search.includes('longevity') || search.includes('nad') || search.includes('glutathione')) return 220;
  if (search.includes('growth') || search.includes('performance') || search.includes('hgh')) return 320;
  return 500;
}

function productCopy(product: DistributorCatalogProduct, locale: KlowLocale = 'en') {
  const meta = getProductMetadata(product);
  const search = productMetaSearchText(product).toLowerCase();
  const localizedCopy = locale === 'es' ? PRODUCT_COPY_ES[product.id] : PRODUCT_COPY[product.id];
  const fallbackGroup: ProductGroup = search.includes('ghk') || search.includes('glutathione') || search.includes('glow')
    ? 'radiance'
    : search.includes('nad') || search.includes('longevity')
      ? 'restoration'
      : search.includes('hgh') || search.includes('tesamorelin') || search.includes('cjc') || search.includes('performance')
        ? 'performance'
        : 'recovery';
  return localizedCopy ?? {
    short: locale === 'es'
      ? 'Una opción de soporte de bienestar con revisión médica disponible a través del checkout seguro de PepScriptRX.'
      : 'A physician-reviewed wellness support option available through secure PepScriptRX checkout.',
    bestFor: locale === 'es'
      ? `Soporte de ${meta.commonName}, rutinas avanzadas de bienestar y revisión adecuada del cliente.`
      : `${meta.commonName} support, advanced wellness routines, and appropriate customer review.`,
    why: locale === 'es'
      ? `${meta.commonName} está disponible para clientes que construyen una rutina de lujo enfocada en recuperación y vitalidad.`
      : `${meta.commonName} is available for customers building a luxury recovery and radiance routine.`,
    group: fallbackGroup,
  };
}

function groupLabel(group: ProductGroup, locale: KlowLocale = 'en') {
  if (locale === 'es') {
    if (group === 'recovery') return 'Recuperación élite';
    if (group === 'radiance') return 'Soporte para la piel + vitalidad';
    if (group === 'restoration') return 'Restauración + longevidad';
    return 'Bienestar de rendimiento';
  }
  if (group === 'recovery') return 'Elite Recovery';
  if (group === 'radiance') return 'Skin Support & Radiance';
  if (group === 'restoration') return 'Restoration & Longevity';
  return 'Performance Wellness';
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

function StoreSection({ id, eyebrow, title, products, cart, addToCart, setQty, locale, text, portalPath, intro, children }: {
  id: string;
  eyebrow: string;
  title: string;
  products: KlowCatalogProduct[];
  cart: CartMap;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  locale: KlowLocale;
  text: KlowCopy;
  portalPath: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  if (!products.length && !intro && !children) return null;
  return (
    <section id={id} className="klow-product-section">
      <div className="klow-section-head">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {intro}
      {products.length > 0 && (
        <div className="klow-product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} qty={cart[product.id] ?? 0} addToCart={addToCart} setQty={setQty} locale={locale} text={text} portalPath={portalPath} />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function ProductCard({ product, qty, addToCart, setQty, locale, text, portalPath }: {
  product: KlowCatalogProduct;
  qty: number;
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  locale: KlowLocale;
  text: KlowCopy;
  portalPath: string;
}) {
  const meta = getProductMetadata(product);
  const copy = productCopy(product, locale);
  const price = product.displayPrice ?? product.suggested_retail_price;
  const originalPrice = getOriginalDisplayPrice(product);
  const showOriginalPrice = Boolean(originalPrice && price && originalPrice > price);
  return (
    <article className="klow-product-card">
      <img src={PRODUCT_CARD_IMAGE} alt={`${meta.commonName} ${text.productAltSuffix}`} loading="lazy" />
      <div className="klow-product-copy">
        <span className="klow-product-category">{groupLabel(copy.group, locale)}</span>
        <h3>{meta.commonName}</h3>
        <p className="klow-strength">{meta.doseLabel}</p>
        <div className="product-bac-water-included">{text.bacWater}</div>
        <p>{copy.short}</p>
        <div className="klow-product-detail"><strong>{text.bestFor}</strong><span>{copy.bestFor}</span></div>
        <div className="klow-product-detail"><strong>{text.whyChoose}</strong><span>{copy.why}</span></div>
        <div className="klow-badges">
          <span>{text.physicianReview}</span>
          <span>{text.rockPayout}</span>
        </div>
        <div className="klow-card-footer">
          <div className="klow-price-stack">
            {showOriginalPrice && <span>${originalPrice?.toFixed(2)}</span>}
            <strong>{price ? `$${price.toFixed(2)}` : text.reviewPrice}</strong>
          </div>
          <Link to={`${portalPath}/mixing/${product.id}`}>{text.mixingCenter}</Link>
        </div>
        {product.priceNote && <p className="klow-product-price-note">{product.priceNote}</p>}
        {qty > 0 ? (
          <div className="klow-qty">
            <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label={`${text.remove} ${meta.commonName}`}>-</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label={`${text.addAnother} ${meta.commonName}`}>+</button>
          </div>
        ) : (
          <button className="klow-add" type="button" onClick={() => addToCart(product.id)}>{text.addToCart}</button>
        )}
      </div>
    </article>
  );
}

const KLOW_STYLES = `
  :root {
    --klow-bg: #080605;
    --klow-surface: #14100c;
    --klow-text: #f8f1e7;
    --klow-muted: #cdbb9e;
    --klow-tan: #b89b72;
    --klow-champagne: #d7c09a;
    --klow-gold: #c7a45d;
    --klow-black: #050403;
  }
  .klow-shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
  .klow-store-wrap { min-height: 100vh; color: var(--klow-text); background-image: linear-gradient(90deg, rgba(5,4,3,.82) 0%, rgba(5,4,3,.58) 46%, rgba(5,4,3,.18) 100%), url('/brands/klow/klow-radiance-hero.png'); background-position: center top; background-size: cover; background-repeat: no-repeat; background-attachment: fixed; }
  .klow-hero { color: var(--klow-text); background: linear-gradient(180deg, rgba(5,4,3,.58), rgba(5,4,3,.24)); padding: clamp(42px, 7vw, 82px) 0 36px; overflow: hidden; }
  .klow-hero-grid { display: grid; grid-template-columns: minmax(0, .86fr) minmax(320px, 1.14fr); gap: clamp(24px, 5vw, 54px); align-items: center; position: relative; }
  .klow-hero-copy { display: grid; gap: 18px; align-content: center; min-width: 0; }
  .klow-locale-es .klow-hero-grid { grid-template-columns: minmax(0, .78fr) minmax(420px, 1.22fr); gap: clamp(34px, 6vw, 88px); }
  .klow-locale-es .klow-hero h1 { max-width: 620px; font-size: clamp(42px, 5.25vw, 78px); line-height: 1.02; }
  .klow-headline-stack span { display: block; }
  .klow-locale-es .klow-subheadline { max-width: 520px; font-size: clamp(17px, 1.8vw, 22px); }
  .klow-locale-es .klow-tagline { max-width: 540px; font-size: clamp(18px, 2vw, 24px); }
  .klow-language-switch { display: inline-flex; align-items: center; gap: 8px; width: max-content; color: rgba(215,192,154,.72); font-size: 12px; font-weight: 900; letter-spacing: .08em; }
  .klow-language-switch a { color: rgba(248,241,231,.64); text-decoration: none; }
  .klow-language-switch a.active { color: var(--klow-champagne); }
  .klow-kicker { margin: 0; color: var(--klow-gold); font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .klow-hero h1 { margin: 0; color: var(--klow-champagne); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(46px, 7vw, 92px); line-height: .95; font-weight: 500; letter-spacing: 0; text-shadow: 0 18px 52px rgba(0,0,0,.52); }
  .klow-subheadline { margin: 0; max-width: 650px; color: var(--klow-text); font-size: clamp(18px, 2.4vw, 25px); line-height: 1.45; }
  .klow-tagline { margin: 0; color: var(--klow-muted); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(18px, 2.4vw, 28px); line-height: 1.25; }
  .klow-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
  .klow-btn, .klow-add, .klow-cart button, .klow-jump-links a { min-height: 44px; border-radius: 8px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
  .klow-btn:hover, .klow-add:hover, .klow-cart button:hover, .klow-jump-links a:hover { transform: translateY(-1px); }
  .klow-btn-primary, .klow-add, .klow-cart button { background: linear-gradient(135deg, var(--klow-gold), var(--klow-tan)); color: #120c08; box-shadow: 0 16px 34px rgba(199,164,93,.22); }
  .klow-btn-secondary { background: rgba(8,6,5,.72); color: var(--klow-text); border-color: rgba(215,192,154,.42); box-shadow: 0 12px 30px rgba(0,0,0,.26); }
  .klow-hero-media { border: 1px solid rgba(215,192,154,.38); border-radius: 8px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.48); background: var(--klow-black); }
  .klow-hero-media img { display: block; width: 100%; aspect-ratio: 16 / 11; object-fit: cover; object-position: center; }
  .klow-section { color: var(--klow-text); padding: clamp(44px, 7vw, 76px) 0; background: linear-gradient(180deg, rgba(8,6,5,.78), rgba(20,16,12,.7)); backdrop-filter: blur(1px); }
  .klow-intro-band { background: linear-gradient(180deg, rgba(8,6,5,.72), rgba(20,16,12,.62)); }
  .klow-intro-grid { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.1fr); gap: clamp(20px, 4vw, 38px); align-items: center; }
  .klow-intro-grid img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; border: 1px solid rgba(215,192,154,.28); box-shadow: 0 20px 52px rgba(0,0,0,.35); }
  .klow-intro-grid h2, .klow-process-grid h2 { margin: 0 0 10px; color: var(--klow-champagne); font-family: Georgia, 'Times New Roman', serif; font-weight: 500; line-height: 1.1; }
  .klow-intro-grid p, .klow-process-grid p { margin: 0; color: var(--klow-muted); font-size: 15px; line-height: 1.7; }
  .klow-pricing-note { margin-top: 14px; color: #f8f1e7; font-weight: 800; }
  .klow-catalog { background: linear-gradient(180deg, rgba(8,6,5,.86), rgba(20,16,12,.78) 48%, rgba(8,6,5,.88)); }
  .klow-filter-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 34px; align-items: center; }
  .klow-filter-row input { min-height: 46px; border: 1px solid rgba(215,192,154,.28); border-radius: 8px; padding: 0 14px; color: var(--klow-text); background: rgba(20,16,12,.92); outline: none; }
  .klow-filter-row input::placeholder { color: rgba(248,241,231,.58); }
  .klow-jump-links { display: flex; flex-wrap: wrap; gap: 8px; }
  .klow-jump-links a { background: rgba(20,16,12,.92); color: var(--klow-muted); border-color: rgba(215,192,154,.26); min-height: 40px; padding: 8px 12px; }
  .klow-section-head { max-width: 780px; margin: 0 0 24px; }
  .klow-section-head p { margin: 0 0 8px; color: var(--klow-gold); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .klow-section-head h2 { margin: 0; color: var(--klow-champagne); font-family: Georgia, 'Times New Roman', serif; font-size: clamp(28px, 4vw, 48px); line-height: 1.08; font-weight: 500; }
  .klow-product-section { padding-top: 10px; margin-top: 34px; }
  .klow-product-section + .klow-product-section { margin-top: 64px; }
  .klow-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
  .klow-product-card { overflow: hidden; display: grid; grid-template-rows: 230px 1fr; background: linear-gradient(180deg, #17120d, #0d0907); border: 1px solid rgba(215,192,154,.24); border-radius: 8px; box-shadow: 0 22px 50px rgba(0,0,0,.34); min-height: 670px; }
  .klow-product-card > img { width: 100%; height: 230px; object-fit: cover; object-position: center; border-bottom: 1px solid rgba(215,192,154,.18); display: block; }
  .klow-product-copy { padding: 18px; display: grid; gap: 10px; align-content: start; }
  .klow-product-category { color: var(--klow-gold); font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .klow-product-copy h3 { margin: 0; color: var(--klow-text); font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.1; font-weight: 500; }
  .klow-strength { margin: -6px 0 0; color: var(--klow-champagne); font-weight: 900; }
  .klow-product-copy p, .klow-product-detail span { margin: 0; color: var(--klow-muted); font-size: 14px; line-height: 1.6; }
  .klow-product-detail { display: grid; gap: 3px; padding-top: 2px; }
  .klow-product-detail strong { color: var(--klow-text); font-size: 12px; }
  .klow-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  .klow-badges span { border: 1px solid rgba(215,192,154,.22); border-radius: 999px; background: rgba(215,192,154,.10); color: var(--klow-champagne); padding: 6px 9px; font-size: 11px; font-weight: 900; }
  .klow-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px; }
  .klow-price-stack { display: grid; gap: 2px; }
  .klow-price-stack span { color: rgba(205,187,158,.72); font-size: 13px; font-weight: 800; text-decoration: line-through; }
  .klow-card-footer strong { color: var(--klow-text); font-size: 24px; }
  .klow-card-footer a { color: var(--klow-champagne); font-size: 13px; font-weight: 900; }
  .klow-product-price-note { margin: -2px 0 0; color: var(--klow-gold); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
  .klow-add { width: 100%; }
  .klow-qty { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; min-height: 44px; border: 1px solid rgba(215,192,154,.28); border-radius: 8px; overflow: hidden; }
  .klow-qty button { height: 44px; border: 0; background: rgba(215,192,154,.14); color: var(--klow-champagne); font-size: 20px; font-weight: 900; cursor: pointer; }
  .klow-qty span { text-align: center; color: var(--klow-text); font-weight: 900; }
  .klow-process { background: linear-gradient(180deg, rgba(18,13,9,.74), rgba(8,6,5,.9)); }
  .klow-process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .klow-process-grid article { background: rgba(20,16,12,.82); border: 1px solid rgba(215,192,154,.24); border-radius: 8px; padding: 22px; box-shadow: 0 18px 42px rgba(0,0,0,.24); }
  .klow-cart { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 28px)); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(8,6,5,.96); color: var(--klow-text); border: 1px solid rgba(215,192,154,.48); border-radius: 12px; padding: 12px; box-shadow: 0 18px 52px rgba(0,0,0,.4); }
  .klow-cart div { display: grid; gap: 2px; }
  .klow-cart strong { font-size: 15px; }
  .klow-cart span { color: var(--klow-champagne); font-weight: 900; }
  @media (max-width: 880px) {
    .klow-store-wrap { background-attachment: scroll; background-position: 58% top; }
    .klow-hero-grid, .klow-intro-grid, .klow-filter-row { grid-template-columns: 1fr; }
    .klow-hero-copy { text-align: center; justify-items: center; }
    .klow-locale-es .klow-hero-grid { grid-template-columns: 1fr; gap: 24px; }
    .klow-locale-es .klow-hero h1 { width: 100%; max-width: 360px; font-size: clamp(34px, 10.2vw, 48px); line-height: 1.08; }
    .klow-locale-es .klow-subheadline { max-width: 360px; font-size: 17px; line-height: 1.5; }
    .klow-locale-es .klow-tagline { max-width: 360px; font-size: 18px; line-height: 1.35; }
    .klow-actions, .klow-jump-links { width: 100%; }
    .klow-actions .klow-btn, .klow-jump-links a { flex: 1 1 180px; }
    .klow-hero-media img { aspect-ratio: 1 / 1; }
    .klow-cart { align-items: stretch; flex-direction: column; }
    .klow-cart button { width: 100%; }
  }
`;
