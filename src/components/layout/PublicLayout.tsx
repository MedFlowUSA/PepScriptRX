import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHONE_DISPLAY, PHONE_HREF, ADDRESS_LINE1, ADDRESS_LINE2 } from '../../config';
import FloatingContact from '../FloatingContact';

const DISCLAIMER =
  'PepScriptRX is not a pharmacy, medical provider, or emergency medical service. PepScriptRX does not provide medical advice, diagnosis, treatment, prescribing, dispensing, or pharmacy services. Any product eligibility, fulfillment, or refill option is subject to prescription verification, licensed partner review, state availability, and applicable law. Product listings are for informational, availability-review, or refill-savings purposes only. Displayed pricing does not guarantee eligibility, approval, availability, fulfillment, or suitability for any individual. PepScriptRX does not guarantee that it can beat a customer\'s current receipt, provide any specific discount, obtain fulfillment, or approve any product request. Savings depend on eligibility, verification, partner availability, product availability, state restrictions, and review status.';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const loginMenuRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <>
      <nav className="pub-nav">
        <Link to="/" className="pub-nav-brand">
          PepScript<span>RX</span>
        </Link>
        <div className="pub-nav-links">
          <div className="pub-nav-secondary">
            <Link to="/peptide-calculator" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              PrecisionMix
            </Link>
            <Link to="/certificates" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              Quality Docs
            </Link>
          </div>
          <div className="login-menu" ref={loginMenuRef}>
            <button
              type="button"
              className="btn btn-ghost btn-sm login-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={loginOpen}
              onClick={() => setLoginOpen((open) => !open)}
            >
              Login <span aria-hidden="true">⌄</span>
            </button>
            {loginOpen && (
              <div className="login-menu-panel" role="menu">
                <Link to="/login?portal=patient" className="login-menu-item" role="menuitem" onClick={() => setLoginOpen(false)}>
                  <span className="login-menu-icon">PT</span>
                  <span>
                    <strong>Patient Portal</strong>
                    <small>Track orders, goals, and refills</small>
                  </span>
                </Link>
                <Link to="/login?portal=rep" className="login-menu-item" role="menuitem" onClick={() => setLoginOpen(false)}>
                  <span className="login-menu-icon">RP</span>
                  <span>
                    <strong>Rep Portal</strong>
                    <small>View leads, QR links, and commissions</small>
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
          {pathname !== '/start' && (
            <Link to="/start" className="btn btn-primary btn-sm">
              Check My Savings
            </Link>
          )}
        </div>
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
                Already prescribed? Refill for less. Upload your receipt and confirm your prescription for refill savings review.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
                Quick Links
              </div>
              <div className="pub-footer-links">
                <Link to="/" className="pub-footer-link">Home</Link>
                <Link to="/start" className="pub-footer-link">Refill Now</Link>
                <Link to="/peptide-calculator" className="pub-footer-link">PrecisionMix Calculator</Link>
                <Link to="/login" className="pub-footer-link">Patient Login</Link>
                <Link to="/certificates" className="pub-footer-link">Quality Documents</Link>
              </div>
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
                  {ADDRESS_LINE1}<br />
                  {ADDRESS_LINE2}
                </div>
                <a href={PHONE_HREF} style={{ fontSize: 14, color: 'var(--teal-light)', textDecoration: 'none' }}>
                  {PHONE_DISPLAY} - AI Line
                </a>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>Available 24 hours</div>
              </div>
            </div>
          </div>
          <div className="pub-footer-bottom">
            <p style={{ marginBottom: 12 }}>{DISCLAIMER}</p>
            <p>© {new Date().getFullYear()} PepScriptRX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
