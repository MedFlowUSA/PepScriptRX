import PublicLayout from '../../components/layout/PublicLayout';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';

type TermsProps = {
  portalKey?: string;
};

export default function Terms({ portalKey }: TermsProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const isPortal = Boolean(portal);
  const portalLabel = isPortal ? `${brandName} partner portal` : 'PepScriptRX savings-check platform';

  usePageMeta(
    `${brandName} | Terms of Service`,
    `${brandName} terms of service covering eligibility, prescriptions, payments, and limitations of liability.`,
  );
  return (
    <PublicLayout
      isolatedPortal={isPortal}
      portalKey={portal?.id}
      portalHomePath={portal?.path}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
    >
      <div style={{ padding: '64px 24px' }}>
        <div className="container-sm">
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-.02em' }}>Terms of Service</h1>
          {portal && (
            <a href={portal.path} className="btn btn-outline btn-sm" style={{ marginBottom: 18 }}>
              Back to {brandName}
            </a>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          {[
            {
              title: '1. No Medical Advice',
              body: `${brandName} is not a pharmacy, medical provider, or healthcare organization. We do not provide medical advice, diagnoses, or prescriptions. All submissions are for availability-review purposes only.`,
            },
            {
              title: '2. Eligibility',
              body: 'Eligibility for savings-check review depends on prescription verification, state availability, fulfillment partner capacity, and partner approval. Submission of a request does not guarantee approval, savings, or fulfillment.',
            },
            {
              title: '3. Valid Prescriptions Required',
              body: 'By submitting a refill-savings request, you attest that you hold a valid, active prescription for the medication selected. False attestations or fraudulent information are prohibited and may result in denial or legal action.',
            },
            {
              title: '4. Payment and Refunds',
              body: 'Payment is only requested after your submission is reviewed and approved. All sales are final once your order enters fulfillment. Refunds may be issued at our sole discretion in cases of fulfillment failure or error.',
            },
            {
              title: '5. Communications',
              body: `By submitting your information, you consent to ${brandName} contacting you via phone or email regarding your submission status, review outcome, and available refill options.`,
            },
            {
              title: '6. Limitation of Liability',
              body: `${brandName} is not responsible for fulfillment delays, errors by fulfillment partners, changes in product availability, or any adverse outcomes from medications. Your relationship with your prescribing physician remains unchanged.`,
            },
            {
              title: '7. Changes to These Terms',
              body: 'We may update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.',
            },
          ].map((section) => (
            <div key={section.title} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}

          <div className="disclaimer">
            {brandName} is not a pharmacy or medical provider. These terms govern your use of the {portalLabel} only.
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
