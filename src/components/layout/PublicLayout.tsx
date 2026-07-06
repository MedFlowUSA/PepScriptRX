import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHONE_DISPLAY, PHONE_HREF, ADDRESS_LINE1, ADDRESS_LINE2 } from '../../config';
import { applyReferralFromUrl, restoreReferral, updateManifestForReferral } from '../../config/referrals';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { useAuth } from '../../context/AuthContext';
import { roleMatchesPortal } from '../../lib/authRoles';
import { recordReferralAttribution } from '../../lib/supabase';
import { buildScopedPath, contextFromPortal, resolveStoreContextFromLocation, storeActiveStoreContext } from '../../lib/storeContext';
import { t } from '../../lib/i18n';
import FloatingContact from '../FloatingContact';
import PortalAgeLeadGate from '../PortalAgeLeadGate';
import PepRxBotFloatingButton from '../ai/PepRxBotFloatingButton';

const DISCLAIMER =
  'PepScriptRX is not a pharmacy, medical provider, or emergency medical service. PepScriptRX does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Any product eligibility, fulfillment, or refill option is subject to prescription verification, licensed partner review, state availability, and applicable law. Product listings are for informational, availability-review, or refill-savings purposes only. Displayed pricing does not guarantee eligibility, approval, availability, fulfillment, or suitability for any individual. PepScriptRX does not guarantee that it can beat a customer\'s current receipt, provide any specific discount, obtain fulfillment, or approve any product request. Savings depend on eligibility, verification, partner availability, product availability, state restrictions, and review status.';
const ANATOLIA_DISCLAIMER =
  'Anatolia Wellness Labs bir eczane, sağlık hizmeti sağlayıcısı veya acil sağlık hizmeti değildir. Tıbbi tavsiye, teşhis, tedavi, reçete, dozlama, enjeksiyon veya karışım talimatı sunmaz. Ürün uygunluğu, ödeme, teslimat ve bulunurluk; lisanslı iş ortağı incelemesi, eyalet uygunluğu ve geçerli yasalara tabidir.';
const ACTIVE_PORTAL_PATH_KEY = 'pepscriptrx_active_portal_path';

type PublicLayoutProps = {
  children: ReactNode;
  isolatedPortal?: boolean;
  portalHomePath?: string;
  portalName?: string;
  portalLogoSrc?: string;
  portalKey?: string;
};

export default function PublicLayout({
  children,
  isolatedPortal = false,
  portalHomePath = '/',
  portalName = 'Partner Portal',
  portalLogoSrc,
  portalKey,
}: PublicLayoutProps) {
  const { pathname, search } = useLocation();
  const { user, profile } = useAuth();
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const portalConfig = isolatedPortal ? getWhiteLabelPortal(portalKey ?? portalHomePath ?? portalName) : null;
  const isOptimaxPortal = portalConfig?.id === 'optimax';
  const isVyigenixPortal = portalConfig?.id === 'vyigenix';
  const isAuroraPortal = portalConfig?.id === 'aurora';
  const isAnatoliaPortal = portalConfig?.id === 'anatolia';
  const locale = isAnatoliaPortal ? 'tr' : 'en';
  const hidesPlatformBranding = portalConfig?.id === 'aactivated';
  const hidesPublicOperationsLinks = isAuroraPortal || isAnatoliaPortal;
  const hidesBackOfficeLogin = isolatedPortal || isAnatoliaPortal;
  const footerBrand = hidesPlatformBranding ? portalName : 'PepScriptRX';
  const footerCopy = isAnatoliaPortal
    ? 'Uygun müşteriler için ürün kataloğu, karışım hesaplayıcıları ve güvenli hesap erişimi.'
    : hidesPlatformBranding
    ? 'A private partner ecosystem for optimized wellness requests, education, and account access.'
    : 'A cleaner refill request experience for eligible customers with existing prescriptions.';
  const footerDisclaimer = isAnatoliaPortal
    ? ANATOLIA_DISCLAIMER
    : hidesPlatformBranding
    ? 'This portal is not a pharmacy, medical provider, or emergency medical service. It does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Product eligibility, fulfillment, and availability are subject to licensed partner review, state availability, and applicable law.'
    : DISCLAIMER;
  const currentPortalPath = `${pathname}${search}`;
  const customerLoginPath = portalConfig
    ? appendReturnTo(buildPortalLoginPath(portalConfig, 'patient'), currentPortalPath)
    : '/login?portal=patient';
  const isCustomerSession = Boolean(user && profile && roleMatchesPortal(profile.role, 'patient'));
  const customerAccountPath = isolatedPortal ? customerLoginPath : isCustomerSession ? '/patient' : customerLoginPath;
  const customerAccountLabel = isolatedPortal ? t(locale, 'Login') : isCustomerSession ? t(locale, 'My Account') : 'Customer Portal';
  const repLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'rep') : '/login?portal=rep';
  const adminLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'admin') : '/login?portal=admin';
  const backOfficePortal = portalConfig?.backOfficePortal ?? 'rep';
  const backOfficeLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, backOfficePortal) : '/login?portal=rep';
  const backOfficeLabel = backOfficePortal === 'admin' ? 'Admin Portal' : 'Rep Portal';
  const signupPath = portalConfig ? appendReturnTo(buildPortalSignupPath(portalConfig), currentPortalPath) : '/patient/signup';
  const activeStoreContext = portalConfig ? contextFromPortal(portalConfig) : null;
  const privacyPath = buildScopedPath('/privacy', activeStoreContext);
  const termsPath = buildScopedPath('/terms', activeStoreContext);
  const certificatesPath = buildScopedPath('/certificates', activeStoreContext);
  const libraryPath = buildScopedPath('/library', activeStoreContext);
  const mixingPath = buildScopedPath('/mixing', activeStoreContext);
  const homePath = isolatedPortal ? portalHomePath : '/';

  function handleHomeClick() {
    if (activeStoreContext) storeActiveStoreContext(activeStoreContext);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const scrollHome = () => {
      const scrollRoot = document.scrollingElement ?? document.documentElement;
      scrollRoot.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };
    scrollHome();
    window.requestAnimationFrame(scrollHome);
    window.setTimeout(scrollHome, 80);
    window.setTimeout(scrollHome, 240);
    window.setTimeout(scrollHome, 500);
  }

  useEffect(() => {
    const context = portalConfig
      ? contextFromPortal(portalConfig)
      : resolveStoreContextFromLocation(window.location);
    if (context) storeActiveStoreContext(context);
  }, [pathname, portalConfig]);

  useEffect(() => {
    const referral = applyReferralFromUrl(window.location.search, pathname) ?? restoreReferral();
    updateManifestForReferral(referral);
    if (referral) {
      void recordReferralAttribution(referral, 'app_launch', null, { pathname }).catch((error) => {
        console.warn('Referral attribution tracking failed', error);
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (!hidesPlatformBranding || !portalConfig?.path) return;
    window.sessionStorage.setItem(ACTIVE_PORTAL_PATH_KEY, portalConfig.path);
  }, [hidesPlatformBranding, portalConfig?.path, pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!portalMenuRef.current?.contains(event.target as Node)) setPortalMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPortalMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const appDropdown = (
    <div className="login-menu portal-app-menu" ref={portalMenuRef}>
      <button
        type="button"
        className="portal-app-trigger"
        aria-label={isAnatoliaPortal ? 'Portal menüsünü aç' : 'Open portal menu'}
        aria-haspopup="menu"
        aria-expanded={portalMenuOpen}
        onClick={() => setPortalMenuOpen((open) => !open)}
      >
        <span className="portal-app-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="portal-app-label">{isAnatoliaPortal ? 'Menü' : 'Menu'}</span>
      </button>
      {portalMenuOpen && (
        <div className="login-menu-panel portal-app-panel" role="menu">
          <Link to={homePath} className="login-menu-item" role="menuitem" onClick={() => { setPortalMenuOpen(false); handleHomeClick(); }}>
            <span className="login-menu-icon">ST</span>
            <span>
              <strong>{isolatedPortal ? t(locale, 'Catalog') : t(locale, 'Home')}</strong>
              <small>{isolatedPortal ? (isAnatoliaPortal ? `${portalName} mağazasına dön` : `Return to the ${portalName} storefront`) : 'Return to the main platform'}</small>
            </span>
          </Link>
          {!isolatedPortal && (
            <Link to="/start" className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
              <span className="login-menu-icon">RX</span>
              <span>
                <strong>Start Refill Request</strong>
                <small>Open checkout and refill intake</small>
              </span>
            </Link>
          )}
          <Link to={customerAccountPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">CU</span>
            <span>
              <strong>{customerAccountLabel}</strong>
              <small>{isAnatoliaPortal ? 'Siparişler ve hesap bilgileri' : 'Orders, refills, and profile info'}</small>
            </span>
          </Link>
          {!isolatedPortal && !isAnatoliaPortal && (
            <>
              <Link to={repLoginPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
                <span className="login-menu-icon">RP</span>
                <span>
                  <strong>Rep Login</strong>
                  <small>Open rep tools and storefront links</small>
                </span>
              </Link>
              <Link to={adminLoginPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
                <span className="login-menu-icon">AD</span>
                <span>
                  <strong>Admin Login</strong>
                  <small>Manage stores, reps, orders, and payouts</small>
                </span>
              </Link>
            </>
          )}
          <Link to={libraryPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">LB</span>
            <span>
              <strong>{t(locale, 'Product Library')}</strong>
              <small>{isAnatoliaPortal ? 'Eğitici ürün referansları' : 'See educational product references'}</small>
            </span>
          </Link>
          <Link to={mixingPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">MX</span>
            <span>
              <strong>{t(locale, 'Mixing Center')}</strong>
              <small>{isAnatoliaPortal ? 'Hesaplayıcı ve karışım aracı' : 'Open calculator and mixing guidance'}</small>
            </span>
          </Link>
          {isAnatoliaPortal ? null : isolatedPortal ? (
            <Link to={`${portalHomePath.replace(/\/+$/, '')}/rep-intake`} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
              <span className="login-menu-icon">AP</span>
              <span>
                <strong>{hidesPlatformBranding ? 'Approval Intake' : 'Rep Intake'}</strong>
                <small>{hidesPlatformBranding ? 'Apply for AACTIVATEDRX portal review' : 'Apply for partner review'}</small>
              </span>
            </Link>
          ) : (
            <Link to="/rep-intake" className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
              <span className="login-menu-icon">AP</span>
              <span>
                <strong>Rep Store Setup</strong>
                <small>Submit a new partner request</small>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <nav className="pub-nav">
        {appDropdown}
        <Link to={homePath} className="pub-nav-brand" onClick={handleHomeClick}>
          {isolatedPortal && portalLogoSrc ? (
            <img
              src={portalLogoSrc}
              alt={portalName}
              style={{
                height: hidesPlatformBranding ? 54 : isOptimaxPortal ? 46 : isVyigenixPortal ? 34 : 38,
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
                background: hidesPlatformBranding ? 'rgba(255,255,255,.08)' : isOptimaxPortal ? 'rgba(255,255,255,.94)' : undefined,
                border: hidesPlatformBranding ? '1px solid rgba(103,232,249,.16)' : isOptimaxPortal ? '1px solid rgba(123,220,42,.2)' : undefined,
                borderRadius: hidesPlatformBranding ? 12 : isOptimaxPortal ? 12 : undefined,
                padding: hidesPlatformBranding ? '6px 10px' : isOptimaxPortal ? '5px 11px' : undefined,
                boxShadow: hidesPlatformBranding ? '0 10px 24px rgba(0,0,0,.18)' : isOptimaxPortal ? '0 10px 28px rgba(0,0,0,.18)' : undefined,
                mixBlendMode: isVyigenixPortal ? 'screen' : undefined,
                filter: isVyigenixPortal ? 'drop-shadow(0 0 12px rgba(37,199,217,.22))' : undefined,
              }}
            />
          ) : (
            <>
              {isolatedPortal ? portalName : 'PepScript'}<span>{isolatedPortal ? '' : 'RX'}</span>
            </>
          )}
        </Link>
        {!isolatedPortal ? (
          <div className="pub-nav-links">
          <div className="pub-nav-secondary">
            <Link to="/library" className="btn btn-sm lib-nav-btn">
              ⚗ Compound Library
            </Link>
            <Link to={mixingPath} className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              {t(locale, 'Mixing Center')}
            </Link>
            <Link to="/certificates" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              Quality
            </Link>
          </div>
          <Link to={mixingPath} className="btn btn-ghost btn-sm mixing-mobile-nav-link">
            {t(locale, 'Mixing Center')}
          </Link>
          {pathname !== '/start' && (
            <Link to="/start" className="btn btn-primary btn-sm">
              Start Refill Request
            </Link>
          )}
        </div>
        ) : (
          hidesPlatformBranding ? (
            <div className="pub-nav-links portal-nav-actions">
              <Link to={homePath} className="btn btn-ghost btn-sm" onClick={handleHomeClick}>
                Catalog
              </Link>
              <Link to={libraryPath} className="btn btn-ghost btn-sm portal-nav-secondary-action">
                Education
              </Link>
              <Link to={mixingPath} className="btn btn-ghost btn-sm portal-nav-secondary-action">
                {t(locale, 'Mixing Center')}
              </Link>
              <Link to={customerAccountPath} className="btn btn-primary btn-sm">
                {customerAccountLabel}
              </Link>
            </div>
          ) : (
            <div className="pub-nav-links portal-nav-actions">
              {isAnatoliaPortal && (
                <Link to={libraryPath} className="btn btn-ghost btn-sm">
                  Ürün Kütüphanesi
                </Link>
              )}
              {!hidesPublicOperationsLinks && (
                <Link to={mixingPath} className="btn btn-ghost btn-sm">
                  {t(locale, 'Mixing Center')}
                </Link>
              )}
              <Link to={customerAccountPath} className="btn btn-ghost btn-sm">
                {customerAccountLabel}
              </Link>
              {!hidesBackOfficeLogin && (
                <Link to={backOfficeLoginPath} className="btn btn-primary btn-sm">
                  {backOfficeLabel}
                </Link>
              )}
            </div>
          )
        )}
      </nav>

      <main>{children}</main>

      <PepRxBotFloatingButton />
      {!hidesPlatformBranding && <FloatingContact />}
      <PortalAgeLeadGate portal={portalConfig} />

      <footer className="pub-footer">
        <div className="container">
          <div className="pub-footer-grid">
            <div>
              {hidesPlatformBranding && portalLogoSrc ? (
                <img src={portalLogoSrc} alt={portalName} style={{ width: 180, height: 'auto', display: 'block', marginBottom: 12 }} />
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, color: '#F8FAFC', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 12 }}>
                  {footerBrand === 'PepScriptRX' ? <>PepScript<span style={{ color: 'var(--teal)' }}>RX</span></> : footerBrand}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', maxWidth: 320, lineHeight: 1.7 }}>
                {footerCopy}
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                {isAnatoliaPortal ? 'Hızlı Bağlantılar' : 'Quick Links'}
              </div>
              {isolatedPortal ? (
                <div className="pub-footer-links">
                  <Link to={portalHomePath} className="pub-footer-link">{isAnatoliaPortal ? t(locale, 'Catalog') : hidesPlatformBranding ? 'Shop Catalog' : 'Storefront'}</Link>
                  {!hidesPublicOperationsLinks && <Link to={mixingPath} className="pub-footer-link">{t(locale, 'Mixing Center')}</Link>}
                  <Link to={customerAccountPath} className="pub-footer-link">{customerAccountLabel}</Link>
                  {!isCustomerSession && <Link to={signupPath} className="pub-footer-link">{t(locale, 'Create Account')}</Link>}
                  {hidesPlatformBranding ? (
                    <>
                      <Link to={libraryPath} className="pub-footer-link">{t(locale, 'Product Library')}</Link>
                      <Link to={`${portalHomePath.replace(/\/+$/, '')}/rep-intake`} className="pub-footer-link">Rep Approval Intake</Link>
                    </>
                  ) : (
                    !hidesBackOfficeLogin && <Link to={backOfficeLoginPath} className="pub-footer-link">{backOfficeLabel}</Link>
                  )}
                  <Link to={privacyPath} className="pub-footer-link">{isAnatoliaPortal ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link>
                  <Link to={termsPath} className="pub-footer-link">{isAnatoliaPortal ? 'Kullanım Şartları' : 'Terms of Service'}</Link>
                  <Link to={certificatesPath} className="pub-footer-link">{isAnatoliaPortal ? t(locale, 'Certificates') : 'Quality Documents'}</Link>
                </div>
              ) : (
                <div className="pub-footer-links">
                  <Link to="/" className="pub-footer-link">Home</Link>
                  <Link to="/start" className="pub-footer-link">Start Refill Request</Link>
                  <Link to="/rep-intake" className="pub-footer-link">Rep Store Setup</Link>
                  <Link to="/product-confidence" className="pub-footer-link">Product Confidence</Link>
                  <Link to="/library" className="pub-footer-link">Compound Library</Link>
                  <Link to={mixingPath} className="pub-footer-link">Mixing Center</Link>
                  <Link to="/peptide-calculator" className="pub-footer-link">PrecisionMix Calculator</Link>
                  <Link to={customerAccountPath} className="pub-footer-link">{customerAccountLabel}</Link>
                  <Link to="/certificates" className="pub-footer-link">Quality Documents</Link>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                {isAnatoliaPortal ? 'Yasal' : 'Legal'}
              </div>
              <div className="pub-footer-links">
                <Link to={privacyPath} className="pub-footer-link">{isAnatoliaPortal ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link>
                <Link to={termsPath} className="pub-footer-link">{isAnatoliaPortal ? 'Kullanım Şartları' : 'Terms of Service'}</Link>
                <Link to={certificatesPath} className="pub-footer-link">{isAnatoliaPortal ? 'Kalite Belgeleri / COA' : 'Quality Documents / COAs'}</Link>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                {isAnatoliaPortal ? 'İletişim' : 'Contact'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                  {ADDRESS_LINE1}
                  {ADDRESS_LINE2 && (
                    <>
                      <br />
                      {ADDRESS_LINE2}
                    </>
                  )}
                </div>
                <a href={PHONE_HREF} style={{ fontSize: 14, color: 'var(--teal-light)', textDecoration: 'none' }}>
                  {PHONE_DISPLAY} - {isAnatoliaPortal ? 'Destek hattı' : 'Support line'}
                </a>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{isAnatoliaPortal ? '24 saat açık' : 'Available 24 hours'}</div>
              </div>
            </div>
          </div>
          <div className="pub-footer-bottom">
            <p style={{ marginBottom: 12 }}>{footerDisclaimer}</p>
            <p>(c) {new Date().getFullYear()} {footerBrand}. {isAnatoliaPortal ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</p>
          </div>
        </div>
      </footer>
    </>
  );
}

function appendReturnTo(path: string, returnTo: string): string {
  if (!returnTo || returnTo === '/' || path.includes('returnTo=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
