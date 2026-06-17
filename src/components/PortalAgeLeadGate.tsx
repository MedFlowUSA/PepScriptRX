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
  const isAnatolia = portal?.id === 'anatolia';
  const copy = isAnatolia
    ? {
        eyebrow: 'Yaş Onayı',
        sectionLabel: 'Yaş onayı',
        checkbox: '21 yaşında veya daha büyük olduğumu onaylıyorum.',
        offerLabel: 'İsteğe bağlı indirim',
        offerTitle: 'İlk siparişinizde %10 indirim ister misiniz?',
        offerBody: 'İsteğe bağlıdır. Adınız ve e-postanızla kayıt olabilir veya iletişim bilgisi paylaşmadan devam edebilirsiniz.',
        offerButton: '%10 İndirim Al',
        signupLabel: 'İsteğe bağlı indirim kaydı',
        signupTitle: 'İlk sipariş indirimi',
        signupBody: 'Bu teklife kayıt olmak için yalnızca ad, soyad ve e-posta gereklidir.',
        firstName: 'Ad',
        lastName: 'Soyad',
        email: 'E-posta adresi',
        phone: 'Telefon numarası (isteğe bağlı)',
        skipOffer: 'İndirim kaydını atla',
        saving: 'Kaydediliyor...',
        apply: 'Yaşı Onayla ve %10 Uygula',
        continue: 'Yaşı Onayla ve Devam Et',
        note: 'İndirim kaydı isteğe bağlıdır ve kataloğu görüntülemek için gerekli değildir.',
      }
    : {
        eyebrow: 'Age Confirmation',
        sectionLabel: 'Age confirmation',
        checkbox: 'I confirm that I am 21 years of age or older.',
        offerLabel: 'Optional discount',
        offerTitle: 'Want 10% off your first order?',
        offerBody: 'Optional. Enroll with your name and email, or continue without sharing contact details.',
        offerButton: 'Get 10% Off',
        signupLabel: 'Optional discount signup',
        signupTitle: 'Optional first-order discount',
        signupBody: 'First name, last name, and email are required only to enroll in this offer.',
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email address',
        phone: 'Phone number (optional)',
        skipOffer: 'Skip discount signup',
        saving: 'Saving...',
        apply: 'Confirm Age and Apply 10%',
        continue: 'Confirm Age and Continue',
        note: 'Discount enrollment is optional and is not required to browse the catalog.',
      };

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
            <div className="portal-age-gate-eyebrow">{copy.eyebrow}</div>
            <h2 id="portal-age-gate-title">{portal.brandName}</h2>
          </div>
        </div>

        <section className="portal-age-gate-section" aria-label={copy.sectionLabel}>
          <label className="portal-age-gate-check">
            <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
            <span>{copy.checkbox}</span>
          </label>
        </section>

        {!showSignup ? (
          <section className="portal-age-gate-offer-row" aria-label={copy.offerLabel}>
            <div className="portal-age-gate-offer">
              <strong>{copy.offerTitle}</strong>
              <span>{copy.offerBody}</span>
            </div>
            <button type="button" className="portal-age-gate-offer-button" onClick={() => setShowSignup(true)}>
              {copy.offerButton}
            </button>
          </section>
        ) : (
          <section className="portal-age-gate-signup" aria-label={copy.signupLabel}>
            <div className="portal-age-gate-offer">
              <strong>{copy.signupTitle}</strong>
              <span>{copy.signupBody}</span>
            </div>
            <div className="portal-age-gate-grid">
              <label>
                <span>{copy.firstName}</span>
                <input required value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
              </label>
              <label>
                <span>{copy.lastName}</span>
                <input required value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
              </label>
              <label>
                <span>{copy.email}</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </label>
              <label>
                <span>{copy.phone}</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
              </label>
            </div>
            <button type="button" className="portal-age-gate-cancel-offer" onClick={() => setShowSignup(false)}>
              {copy.skipOffer}
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
              {submitting ? copy.saving : copy.apply}
            </button>
          )}
          <button
            type="button"
            className={showSignup ? 'portal-age-gate-secondary' : 'portal-age-gate-button'}
            disabled={!ageConfirmed || submitting}
            onClick={() => void handleContinue(false)}
          >
            {submitting ? copy.saving : copy.continue}
          </button>
        </div>
        <p className="portal-age-gate-note">{copy.note}</p>
      </div>
    </div>
  );
}
