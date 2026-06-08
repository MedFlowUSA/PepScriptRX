import { useState } from 'react';
import type { WhiteLabelPortal } from '../config/whiteLabelPortals';
import { recordPortalAgeLeadCapture } from '../lib/supabase';
import {
  PORTAL_LEAD_DISCOUNT_CODE,
  PORTAL_LEAD_DISCOUNT_PERCENT,
  buildPortalLeadCapture,
  hasPortalAgeConfirmation,
  storePortalLeadCapture,
} from '../lib/portalLeadCapture';

type PortalAgeLeadGateProps = {
  portal: WhiteLabelPortal | null;
};

export default function PortalAgeLeadGate({ portal }: PortalAgeLeadGateProps) {
  const [dismissed, setDismissed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const open = Boolean(portal && !dismissed && !hasPortalAgeConfirmation(portal.id));

  if (!portal || !open) return null;

  function scrollToStorefrontCatalog() {
    if (typeof window === 'undefined' || portal?.id !== 'aactivated') return;

    const path = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    const isStorefrontEntry = path === '/aactivated' || path === '/guy';
    if (!isStorefrontEntry) return;

    const scroll = () => {
      const target = document.getElementById('aactivated-top-sellers');
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        return;
      }
      window.location.hash = 'aactivated-top-sellers';
    };

    window.requestAnimationFrame(scroll);
    window.setTimeout(scroll, 150);
  }

  async function handleContinue(applyDiscount: boolean) {
    if (!portal || !ageConfirmed) return;
    setSubmitting(true);
    const capture = buildPortalLeadCapture(
      portal,
      applyDiscount ? { firstName, lastName, email, phone } : { firstName: '', lastName: '', email: '', phone: '' },
    );
    const hasSignupInput = Boolean(capture.firstName || capture.lastName || capture.email || capture.phone);
    storePortalLeadCapture(capture);

    if (hasSignupInput) {
      try {
        await recordPortalAgeLeadCapture({
          age_confirmed: true,
          first_name: capture.firstName || null,
          last_name: capture.lastName || null,
          email: capture.email || null,
          phone: capture.phone || null,
          portal_id: capture.portalId,
          portal_name: capture.portalName,
          portal_path: capture.portalPath,
          domain: window.location.hostname,
          path: window.location.pathname,
          discount_code: capture.discountTriggered ? PORTAL_LEAD_DISCOUNT_CODE : null,
          discount_percent: capture.discountTriggered ? PORTAL_LEAD_DISCOUNT_PERCENT : 0,
          discount_triggered: capture.discountTriggered,
          user_agent: window.navigator.userAgent,
        });
      } catch (error) {
        console.warn('Portal age lead capture was saved locally but not synced.', error);
      }
    }

    setSubmitting(false);
    setDismissed(true);
    scrollToStorefrontCatalog();
  }

  return (
    <div className="portal-age-gate" role="dialog" aria-modal="true" aria-labelledby="portal-age-gate-title">
      <div className="portal-age-gate-card">
        <div className="portal-age-gate-brand">
          <img src={portal.logoSrc} alt={portal.brandName} />
          <div>
            <div className="portal-age-gate-eyebrow">Age Confirmation</div>
            <h2 id="portal-age-gate-title">{portal.brandName}</h2>
          </div>
        </div>

        <section className="portal-age-gate-section" aria-label="Age confirmation">
          <label className="portal-age-gate-check">
            <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
            <span>I confirm that I am 21 years of age or older.</span>
          </label>
        </section>

        {!showSignup ? (
          <section className="portal-age-gate-offer-row" aria-label="Optional discount">
            <div className="portal-age-gate-offer">
              <strong>Want 10% off your first order?</strong>
              <span>Optional. Enroll with your name and email, or continue without sharing contact details.</span>
            </div>
            <button type="button" className="portal-age-gate-offer-button" onClick={() => setShowSignup(true)}>
              Get 10% Off
            </button>
          </section>
        ) : (
          <section className="portal-age-gate-signup" aria-label="Optional discount signup">
            <div className="portal-age-gate-offer">
              <strong>Optional first-order discount</strong>
              <span>First name, last name, and email are required only to enroll in this offer.</span>
            </div>
            <div className="portal-age-gate-grid">
              <label>
                <span>First name</span>
                <input required value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
              </label>
              <label>
                <span>Last name</span>
                <input required value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
              </label>
              <label>
                <span>Email address</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </label>
              <label>
                <span>Phone number (optional)</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
              </label>
            </div>
            <button type="button" className="portal-age-gate-cancel-offer" onClick={() => setShowSignup(false)}>
              Skip discount signup
            </button>
          </section>
        )}

        <div className="portal-age-gate-actions">
          {showSignup && (
            <button
              type="button"
              className="portal-age-gate-button"
              disabled={!ageConfirmed || !firstName.trim() || !lastName.trim() || !email.trim() || submitting}
              onClick={() => void handleContinue(true)}
            >
              {submitting ? 'Saving...' : 'Confirm Age and Apply 10%'}
            </button>
          )}
          <button
            type="button"
            className={showSignup ? 'portal-age-gate-secondary' : 'portal-age-gate-button'}
            disabled={!ageConfirmed || submitting}
            onClick={() => void handleContinue(false)}
          >
            {submitting ? 'Saving...' : 'Confirm Age and Continue'}
          </button>
        </div>
        <p className="portal-age-gate-note">Discount enrollment is optional and is not required to browse the catalog.</p>
      </div>
    </div>
  );
}
