import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHONE_DISPLAY, PHONE_HREF, ADDRESS_LINE1, ADDRESS_LINE2 } from '../../config';
import { applyReferralFromUrl, restoreReferral, updateManifestForReferral } from '../../config/referrals';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { recordReferralAttribution } from '../../lib/supabase';
import FloatingContact from '../FloatingContact';

const DISCLAIMER =
  'PepScriptRX is not a pharmacy, medical provider, or emergency medical service. PepScriptRX does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Any product eligibility, fulfillment, or refill option is subject to prescription verification, licensed partner review, state availability, and applicable law. Product listings are for informational, availability-review, or refill-savings purposes only. Displayed pricing does not guarantee eligibility, approval, availability, fulfillment, or suitability for any individual. PepScriptRX does not guarantee that it can beat a customer\'s current receipt, provide any specific discount, obtain fulfillment, or approve any product request. Savings depend on eligibility, verification, partner availability, product availability, state restrictions, and review status.';

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
  const [loginOpen, setLoginOpen] = useState(false);
  const loginMenuRef = useRef<HTMLDivElement | null>(null);
  const portalConfig = isolatedPortal ? getWhiteLabelPortal(portalKey ?? portalHomePath ?? portalName) : null;
  const customerLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, 'patient') : '/login?portal=patient';
  const backOfficePortal = portalConfig?.backOfficePortal ?? 'rep';
  const backOfficeLoginPath = portalConfig ? buildPortalLoginPath(portalConfig, backOfficePortal) : '/login?portal=rep';
  const backOfficeLabel = backOfficePortal === 'admin' ? 'Admin Portal' : 'Rep Portal';
  const signupPath = portalConfig ? buildPortalSignupPath(portalConfig) : '/patient/signup';

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
    function handlePointerDown(event: MouseEvent) {
      if (!loginMenuRef.current?.contains(event.target as Node)) setLoginOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLoginOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loginDropdown = (
    <div className="login-menu" ref={loginMenuRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm login-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={loginOpen}
        onClick={() => setLoginOpen((open) => !open)}
      >
        Login <span aria-hidden="true">v</span>
      </button>
      {loginOpen && (
        <div className="login-menu-panel" role="menu">
          <Link to="/login?portal=patient" className="login-menu-item" role="menuitem" onClick={() => setLoginOpen(false)}>
            <span className="login-menu-icon">CU</span>
            <span>
              <strong>Customer Portal</strong>
              <small>Track orders, goals, and refills</small>
            </span>
          </Link>
          <Link to="/login?portal=rep" className="login-menu-item" role="menuitem" onClick={() => setLoginOpen(false)}>
            <span className="login-menu-icon">RP</span>
            <span>
              <strong>Rep Portal</strong>
              <small>View leads, QR links, and storefront tools</small>
            </span>
          </Link>
          <Link to="/login?portal=admin" className="login-menu-item" role="menuitem" onClick={() => setLoginOpen(false)}>
            <span className="login-menu-icon">AD</span>
            <span>
              <strong>Admin Portal</strong>
              <small>Review submissions and fulfillment</small>
            </span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      <nav className="pub-nav">
        <Link to={isolatedPortal ? portalHomePath : '/'} className="pub-nav-brand">
          {isolatedPortal && portalLogoSrc ? (
            <img
              src={portalLogoSrc}
              alt={portalName}
              style={{ height: 38, width: 'auto', display: 'block', objectFit: 'contain' }}
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
            <Link to="/certificates" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              Quality
            </Link>
          </div>
          {loginDropdown}
          {pathname !== '/start' && (
            <Link to="/start" className="btn btn-primary btn-sm">
              Start Refill Request
            </Link>
          )}
        </div>
        ) : (
          <div className="pub-nav-links portal-nav-actions">
            <Link to={customerLoginPath} className="btn btn-ghost btn-sm">
              Customer Portal
            </Link>
            <Link to={backOfficeLoginPath} className="btn btn-primary btn-sm">
              {backOfficeLabel}
            </Link>
          </div>
        )}
      </nav>

      <main>{children}</main>

      <FloatingContact />

      <footer className="pub-footer">
        <div className="container">
          <div className="pub-footer-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, color: '#F8FAFC', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 12 }}>
                PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', maxWidth: 320, lineHeight: 1.7 }}>
                A cleaner refill request experience for eligible customers with existing prescriptions.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                Quick Links
              </div>
              {isolatedPortal ? (
                <div className="pub-footer-links">
                  <Link to={portalHomePath} className="pub-footer-link">Storefront</Link>
                  <Link to={customerLoginPath} className="pub-footer-link">Customer Portal</Link>
                  <Link to={signupPath} className="pub-footer-link">Create Customer Account</Link>
                  <Link to={backOfficeLoginPath} className="pub-footer-link">{backOfficeLabel}</Link>
                  <Link to="/privacy" className="pub-footer-link">Privacy Policy</Link>
                  <Link to="/terms" className="pub-footer-link">Terms & Conditions</Link>
                  <Link to="/certificates" className="pub-footer-link">Quality Documents</Link>
                </div>
              ) : (
                <div className="pub-footer-links">
                  <Link to="/" className="pub-footer-link">Home</Link>
                  <Link to="/start" className="pub-footer-link">Start Refill Request</Link>
                  <Link to="/library" className="pub-footer-link">Compound Library</Link>
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
                <Link to="/privacy" className="pub-footer-link">Privacy Policy</Link>
                <Link to="/terms" className="pub-footer-link">Terms of Service</Link>
                <Link to="/certificates" className="pub-footer-link">Quality Documents / COAs</Link>
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
            <p style={{ marginBottom: 12 }}>{DISCLAIMER}</p>
            <p>(c) {new Date().getFullYear()} PepScriptRX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
