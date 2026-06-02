import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import AACTIVATEDRXVerificationBadge from '../../components/AACTIVATEDRXVerificationBadge';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ReactNode } from 'react';

const IMPORTANT_LIMITS = [
  'No medical outcome guarantee.',
  'No treatment guarantee.',
  'No patient-response guarantee.',
  'No FDA approval claim.',
  'Refund is not automatic and is subject to review.',
  'Guarantee applies only to purity verification.',
];

type ProductConfidenceProps = {
  portalKey?: string;
};

export default function ProductConfidence({ portalKey }: ProductConfidenceProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const isAactivated = portal?.id === 'aactivated';
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const policyTitle = isAactivated
    ? 'AACTIVATEDRX Verified Quality Policy'
    : '99.2% Product Purity Confidence Policy';
  const requiredConditions = [
    `Product must come from a verified ${brandName} order.`,
    'Product must be unopened or handled in a way acceptable for laboratory testing.',
    'Customer must provide the full lab report.',
    `Laboratory must be approved by or otherwise acceptable to ${brandName}.`,
    `Claim must be submitted within 14 days from delivery unless another written ${brandName} return or refund policy applies.`,
    `${brandName} must be able to verify chain of custody where applicable.`,
  ];

  usePageMeta(
    policyTitle,
    `${brandName} product quality verification policy for verified orders and approved independent third-party testing.`,
  );

  return (
    <PublicLayout
      isolatedPortal={Boolean(portal)}
      portalHomePath={portal?.path ?? '/'}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
      portalKey={portal?.id}
    >
      <section className="section" style={{ background: isAactivated ? 'linear-gradient(135deg, #050505 0%, #11100c 48%, #0f223d 100%)' : 'linear-gradient(135deg, #071422 0%, #102033 58%, #0f766e 100%)' }}>
        <div className="container-sm">
          <div className="hero-tag" style={{ marginBottom: 14 }}>
            {isAactivated ? 'AACTIVATEDRX verification' : 'Quality transparency'}
          </div>
          <h1 className="section-title" style={{ color: '#fff', marginBottom: 14 }}>
            {policyTitle}
          </h1>
          <p style={{ color: 'rgba(255,255,255,.76)', fontSize: 17, lineHeight: 1.7, margin: '0 0 24px' }}>
            {isAactivated
              ? 'AACTIVATEDRX supports customer confidence through verified sourcing, applicable third-party testing documentation, and a reviewed independent testing pathway for eligible verified orders.'
              : 'PepScriptRX supports product confidence through applicable third-party testing documentation and a reviewed independent testing pathway for verified orders.'}
          </p>
          {isAactivated ? (
            <AACTIVATEDRXVerificationBadge placement="detail" />
          ) : (
            <ProductPurityGuaranteeBadge expanded />
          )}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-sm policy-stack">
          <PolicySection title="1. Our Purity Standard">
            {isAactivated
              ? 'Eligible AACTIVATEDRX products are represented at 99.2% purity or better when supported by applicable third-party testing documentation. Product-specific documentation may vary by product, batch, and availability.'
              : 'Eligible products are represented at 99.2% purity or better when supported by the applicable third-party testing documentation. Product-specific documentation may vary by product, batch, and availability.'}
          </PolicySection>

          <PolicySection title="2. Customer Independent Testing">
            Customers may submit a verified {brandName} product for independent testing through an approved third-party laboratory. Testing must be handled in a way that allows {brandName} to review the laboratory, chain of custody, sample handling, and full report.
          </PolicySection>

          <PolicySection title="3. Refund Eligibility">
            If the approved independent lab report shows purity below 99.2%, the customer may qualify for a refund of the product purchase price and approved testing cost, subject to {brandName} review.
          </PolicySection>

          <PolicySection title="4. Required Conditions">
            <ul className="policy-list">
              {requiredConditions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </PolicySection>

          <PolicySection title="5. Important Limits">
            <ul className="policy-list">
              {IMPORTANT_LIMITS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </PolicySection>

          <PolicySection title="6. Review Window">
            The suggested review window is 14 days from delivery unless there is an existing written {brandName} return or refund policy that states a different period for the order or product at issue.
          </PolicySection>

          <div className="disclaimer">
            This policy is limited to product purity verification based on acceptable third-party laboratory testing. It does not provide medical advice and does not guarantee medical results, treatment outcomes, patient response, product availability, or automatic refund approval.
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="policy-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
