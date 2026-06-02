import { useState } from 'react';

const BADGE_SRC = '/marketing/aactivated-verified-quality-badge.png?v=20260602';

type AACTIVATEDRXVerificationBadgeProps = {
  placement?: 'hero' | 'card' | 'detail' | 'checkout';
  productName?: string;
  className?: string;
};

type AACTIVATEDRXVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  productName?: string;
};

const verificationSections = [
  {
    title: 'Verified Purity',
    body: 'Every batch is sourced through vetted manufacturing partners and undergoes rigorous quality verification procedures designed to meet or exceed AACTIVATEDRX standards.',
  },
  {
    title: 'Manufacturing Standards',
    body: 'Products are represented at 99.2% purity or better when supported by applicable third-party testing documentation. Manufacturing review may include process controls, purity information, quality control procedures, batch testing information, laboratory documentation, and identity verification language maintained by the platform.',
  },
  {
    title: 'Color Verification Guide',
    body: 'Peptide appearance may include white powder, slight off-white appearance, or a lyophilized cake appearance. Normal color variation may occur by product, batch, and storage history, and should be reviewed against product-specific documentation where available.',
  },
  {
    title: 'Storage Guidelines',
    body: 'Storage expectations are based on current product guidance maintained by the platform and applicable fulfillment documentation. Customers should follow the storage and handling instructions provided with their order and avoid using products that appear compromised.',
  },
  {
    title: 'Verification Statement',
    body: 'AACTIVATEDRX maintains strict sourcing and quality verification procedures designed to provide consistency, reliability, and confidence in every order.',
  },
];

export function AACTIVATEDRXVerificationModal({
  open,
  onClose,
  productName,
}: AACTIVATEDRXVerificationModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="aactivated-verify-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AACTIVATEDRX verified quality program"
        className="aactivated-verify-modal"
      >
        <button type="button" className="aactivated-verify-close" onClick={onClose} aria-label="Close verification details">
          x
        </button>
        <div className="aactivated-verify-hero">
          <img src={BADGE_SRC} alt="AACTIVATEDRX verified 99.2% plus quality guarantee" />
          <div>
            <div className="aactivated-verify-kicker">AACTIVATEDRX VERIFIED</div>
            <h2>AACTIVATEDRX VERIFIED QUALITY PROGRAM™</h2>
            <p>99.2%+ Purity &amp; Identity Verification Standard</p>
            {productName && <span>Applies to: {productName}</span>}
          </div>
        </div>

        <div className="aactivated-verify-actions" aria-label="Verification resources">
          <a href="/aactivated/certificates">Quality Documents</a>
          <a href="/aactivated/product-confidence">Verification Policy</a>
          <a href="/aactivated/library">Product Library</a>
        </div>

        <div className="aactivated-verify-sections">
          {verificationSections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export default function AACTIVATEDRXVerificationBadge({
  placement = 'card',
  productName,
  className = '',
}: AACTIVATEDRXVerificationBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`aactivated-verify-badge aactivated-verify-badge-${placement} ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-label="Open AACTIVATEDRX verified quality guarantee"
      >
        <img src={BADGE_SRC} alt="" aria-hidden="true" />
        <span>
          <strong>AACTIVATEDRX VERIFIED</strong>
          <small>99.2%+ QUALITY GUARANTEE</small>
        </span>
      </button>
      <AACTIVATEDRXVerificationModal open={open} onClose={() => setOpen(false)} productName={productName} />
    </>
  );
}
