import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ReactNode } from 'react';

const REQUIRED_CONDITIONS = [
  'Product must come from a verified PepScriptRX order.',
  'Product must be unopened or handled in a way acceptable for laboratory testing.',
  'Customer must provide the full lab report.',
  'Laboratory must be approved by or otherwise acceptable to PepScriptRX.',
  'Claim must be submitted within 14 days from delivery unless another written PepScriptRX return or refund policy applies.',
  'PepScriptRX must be able to verify chain of custody where applicable.',
];

const IMPORTANT_LIMITS = [
  'No medical outcome guarantee.',
  'No treatment guarantee.',
  'No patient-response guarantee.',
  'No FDA approval claim.',
  'Refund is not automatic and is subject to review.',
  'Guarantee applies only to purity verification.',
];

export default function ProductConfidence() {
  usePageMeta(
    '99.2% Product Purity Confidence Policy',
    'PepScriptRX product purity confidence policy for verified orders and approved independent third-party testing.',
  );

  return (
    <PublicLayout>
      <section className="section" style={{ background: 'linear-gradient(135deg, #071422 0%, #102033 58%, #0f766e 100%)' }}>
        <div className="container-sm">
          <div className="hero-tag" style={{ marginBottom: 14 }}>Quality transparency</div>
          <h1 className="section-title" style={{ color: '#fff', marginBottom: 14 }}>
            99.2% Product Purity Confidence Policy
          </h1>
          <p style={{ color: 'rgba(255,255,255,.76)', fontSize: 17, lineHeight: 1.7, margin: '0 0 24px' }}>
            PepScriptRX supports product confidence through applicable third-party testing documentation and a reviewed independent testing pathway for verified orders.
          </p>
          <ProductPurityGuaranteeBadge expanded />
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-sm policy-stack">
          <PolicySection title="1. Our Purity Standard">
            Eligible products are represented at 99.2% purity or better when supported by the applicable third-party testing documentation. Product-specific documentation may vary by product, batch, and availability.
          </PolicySection>

          <PolicySection title="2. Customer Independent Testing">
            Customers may submit a verified PepScriptRX product for independent testing through an approved third-party laboratory. Testing must be handled in a way that allows PepScriptRX to review the laboratory, chain of custody, sample handling, and full report.
          </PolicySection>

          <PolicySection title="3. Refund Eligibility">
            If the approved independent lab report shows purity below 99.2%, the customer may qualify for a refund of the product purchase price and approved testing cost, subject to PepScriptRX review.
          </PolicySection>

          <PolicySection title="4. Required Conditions">
            <ul className="policy-list">
              {REQUIRED_CONDITIONS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </PolicySection>

          <PolicySection title="5. Important Limits">
            <ul className="policy-list">
              {IMPORTANT_LIMITS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </PolicySection>

          <PolicySection title="6. Review Window">
            The suggested review window is 14 days from delivery unless there is an existing written PepScriptRX return or refund policy that states a different period for the order or product at issue.
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
