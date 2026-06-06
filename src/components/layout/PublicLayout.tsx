import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHONE_DISPLAY, PHONE_HREF, ADDRESS_LINE1, ADDRESS_LINE2 } from '../../config';
import { applyReferralFromUrl, restoreReferral, updateManifestForReferral } from '../../config/referrals';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { recordReferralAttribution } from '../../lib/supabase';
import { buildScopedPath, contextFromPortal, resolveStoreContextFromLocation, storeActiveStoreContext } from '../../lib/storeContext';
import FloatingContact from '../FloatingContact';
import PortalAgeLeadGate from '../PortalAgeLeadGate';
import PepRxBotFloatingButton from '../ai/PepRxBotFloatingButton';

const DISCLAIMER =
  'PepScriptRX is not a pharmacy, medical provider, or emergency medical service. PepScriptRX does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Any product eligibility, fulfillment, or refill option is subject to prescription verification, licensed partner review, state availability, and applicable law. Product listings are for informational, availability-review, or refill-savings purposes only. Displayed pricing does not guarantee eligibility, approval, availability, fulfillment, or suitability for any individual. PepScriptRX does not guarantee that it can beat a customer\'s current receipt, provide any specific discount, obtain fulfillment, or approve any product request. Savings depend on eligibility, verification, partner availability, product availability, state restrictions, and review status.';
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
  const { pathname } = useLocation();
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const portalConfig = isolatedPortal ? getWhiteLabelPortal(portalKey ?? portalHomePath ?? portalName) : null;
  const isOptimaxPortal = portalConfig?.id === 'optimax';
  const isVyigenixPortal = portalConfig?.id === 'vyigenix';
  const hidesPlatformBranding = portalConfig?.id === 'aactivated';
  const footerBrand = hidesPlatformBranding ? portalName : 'PepScriptRX';
  const footerCopy = hidesPlatformBranding
    ? 'A private partner ecosystem for optimized wellness requests, education, and account access.'
    : 'A cleaner refill request experience for eligible customers with existing prescriptions.';
  const footerDisclaimer = hidesPlatformBranding
    ? 'This portal is not a pharmacy, medical provider, or emergency medical service. It does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Product eligibility, fulfillment, and availability are subject to licensed partner review, state availability, and applicable law.'
    : DISCLAIMER;
  const customerLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'patient') : '/login?portal=patient';
  const repLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'rep') : '/login?portal=rep';
  const adminLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'admin') : '/login?portal=admin';
  const backOfficePortal = portalConfig?.backOfficePortal ?? 'rep';
  const backOfficeLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, backOfficePortal) : '/login?portal=rep';
  const backOfficeLabel = backOfficePortal === 'admin' ? 'Admin Portal' : 'Rep Portal';
  const signupPath = portalConfig ? buildPortalSignupPath(portalConfig) : '/patient/signup';
  const activeStoreContext = portalConfig ? contextFromPortal(portalConfig) : null;
  const privacyPath = buildScopedPath('/privacy', activeStoreContext);
  const termsPath = buildScopedPath('/terms', activeStoreContext);
  const certificatesPath = buildScopedPath('/certificates', activeStoreContext);
  const libraryPath = buildScopedPath('/library', activeStoreContext);
  const mixingPath = buildScopedPath('/mixing', activeStoreContext);
  const homePath = isolatedPortal ? portalHomePath : '/';

  function handleHomeClick() {
    if (activeStoreContext) storeActiveStoreContext(activeStoreContext);
    const scrollHome = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.requestAnimationFrame(scrollHome);
    window.setTimeout(scrollHome, 80);
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
        aria-label="Open portal menu"
        aria-haspopup="menu"
        aria-expanded={portalMenuOpen}
        onClick={() => setPortalMenuOpen((open) => !open)}
      >
        <span className="portal-app-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="portal-app-label">Menu</span>
      </button>
      {portalMenuOpen && (
        <div className="login-menu-panel portal-app-panel" role="menu">
          <Link to={homePath} className="login-menu-item" role="menuitem" onClick={() => { setPortalMenuOpen(false); handleHomeClick(); }}>
            <span className="login-menu-icon">ST</span>
            <span>
              <strong>{isolatedPortal ? 'Shop Catalog' : 'Home'}</strong>
              <small>{isolatedPortal ? `Return to the ${portalName} storefront` : 'Return to the main platform'}</small>
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
          <Link to={customerLoginPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">CU</span>
            <span>
              <strong>{isolatedPortal ? 'Customer Login' : 'Customer Portal'}</strong>
              <small>Orders, refills, and profile info</small>
            </span>
          </Link>
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
          <Link to={libraryPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">LB</span>
            <span>
              <strong>Product Library</strong>
              <small>See educational product references</small>
            </span>
          </Link>
          <Link to={mixingPath} className="login-menu-item" role="menuitem" onClick={() => setPortalMenuOpen(false)}>
            <span className="login-menu-icon">MX</span>
            <span>
              <strong>Mixing Center</strong>
              <small>Open calculator and mixing guidance</small>
            </span>
          </Link>
          {isolatedPortal ? (
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
              Mixing Center
            </Link>
            <Link to="/certificates" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              Quality
            </Link>
          </div>
          <Link to={mixingPath} className="btn btn-ghost btn-sm mixing-mobile-nav-link">
            Mixing Center
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
                Mixing Center
              </Link>
              <Link to={customerLoginPath} className="btn btn-primary btn-sm">
                Customer Login
              </Link>
            </div>
          ) : (
            <div className="pub-nav-links portal-nav-actions">
              <Link to={mixingPath} className="btn btn-ghost btn-sm">
                Mixing Center
              </Link>
              <Link to={customerLoginPath} className="btn btn-ghost btn-sm">
                Customer Portal
              </Link>
              <Link to={backOfficeLoginPath} className="btn btn-primary btn-sm">
                {backOfficeLabel}
              </Link>
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
                Quick Links
              </div>
              {isolatedPortal ? (
                <div className="pub-footer-links">
                  <Link to={portalHomePath} className="pub-footer-link">{hidesPlatformBranding ? 'Shop Catalog' : 'Storefront'}</Link>
                  <Link to={mixingPath} className="pub-footer-link">Mixing Center</Link>
                  <Link to={customerLoginPath} className="pub-footer-link">{hidesPlatformBranding ? 'Customer Login' : 'Customer Portal'}</Link>
                  <Link to={signupPath} className="pub-footer-link">Create Customer Account</Link>
                  {hidesPlatformBranding ? (
                    <>
                      <Link to={repLoginPath} className="pub-footer-link">Rep Login</Link>
                      <Link to={adminLoginPath} className="pub-footer-link">Admin Login</Link>
                      <Link to={libraryPath} className="pub-footer-link">Product Library</Link>
                      <Link to={`${portalHomePath.replace(/\/+$/, '')}/rep-intake`} className="pub-footer-link">Rep Approval Intake</Link>
                    </>
                  ) : (
                    <Link to={backOfficeLoginPath} className="pub-footer-link">{backOfficeLabel}</Link>
                  )}
                  <Link to={privacyPath} className="pub-footer-link">Privacy Policy</Link>
                  <Link to={termsPath} className="pub-footer-link">Terms of Service</Link>
                  <Link to={certificatesPath} className="pub-footer-link">Quality Documents</Link>
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
                  <Link to="/login" className="pub-footer-link">Customer Login</Link>
                  <Link to="/certificates" className="pub-footer-link">Quality Documents</Link>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                Legal
              </div>
              <div className="pub-footer-links">
                <Link to={privacyPath} className="pub-footer-link">Privacy Policy</Link>
                <Link to={termsPath} className="pub-footer-link">Terms of Service</Link>
                <Link to={certificatesPath} className="pub-footer-link">Quality Documents / COAs</Link>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                Contact
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
                  {PHONE_DISPLAY} - Support line
                </a>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>Available 24 hours</div>
              </div>
            </div>
          </div>
          <div className="pub-footer-bottom">
            <p style={{ marginBottom: 12 }}>{footerDisclaimer}</p>
            <p>(c) {new Date().getFullYear()} {footerBrand}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
