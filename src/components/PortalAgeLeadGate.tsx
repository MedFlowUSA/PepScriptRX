import { useEffect, useState } from 'react';
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

  const open = Boolean(portal && !dismissed && !hasPortalAgeConfirmation(portal.id));

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissed(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!portal || !open) return null;

  function handleDismiss() {
    setDismissed(true);
  }

  async function handleContinue() {
    if (!portal || !ageConfirmed) return;
    setSubmitting(true);
    const capture = buildPortalLeadCapture(portal, { firstName, lastName, email, phone });
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
  }

  return (
    <div className="portal-age-gate" role="dialog" aria-modal="true" aria-labelledby="portal-age-gate-title">
      <div className="portal-age-gate-card">
        <button type="button" className="portal-age-gate-close" aria-label="Close age confirmation" onClick={handleDismiss}>
          X
        </button>
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

        <section className="portal-age-gate-signup" aria-label="Optional discount signup">
          <div className="portal-age-gate-offer">
            <strong>Optional 10% first-order discount</strong>
            <span>Enter your name and email to receive the discount, or leave these fields blank and continue.</span>
          </div>

          <div className="portal-age-gate-grid">
            <label>
              <span>First name</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
            </label>
            <label>
              <span>Last name</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
            </label>
            <label>
              <span>Email address</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>Phone number optional</span>
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </label>
          </div>
        </section>

        <button type="button" className="portal-age-gate-button" disabled={!ageConfirmed || submitting} onClick={handleContinue}>
          {submitting ? 'Saving...' : email && firstName && lastName ? 'Confirm and Apply 10% Discount' : 'Confirm and Continue'}
        </button>
        <p className="portal-age-gate-note">
          Discount eligibility is tied to the captured email and may be applied automatically at checkout when available.
        </p>
      </div>
    </div>
  );
}
