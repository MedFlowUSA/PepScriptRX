import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';

type ProductConfidenceProps = { portalKey?: string };

export default function ProductConfidence({ portalKey }: ProductConfidenceProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const documentsPath = portal ? `${portal.path}/certificates` : '/certificates';

  usePageMeta(`${brandName} | Quality Transparency`, `How ${brandName} presents product-specific quality-document status.`);

  return (
    <PublicLayout isolatedPortal={Boolean(portal)} portalHomePath={portal?.path} portalName={brandName} portalLogoSrc={portal?.logoSrc} portalKey={portal?.id}>
      <main>
        <section className="section" style={{ background: 'linear-gradient(135deg, #071422 0%, #102033 58%, #0f766e 100%)' }}>
          <div className="container-sm">
            <div className="hero-tag">Quality transparency</div>
            <h1 className="section-title" style={{ color: '#fff' }}>Product-specific document status</h1>
            <p style={{ color: 'rgba(255,255,255,.8)', lineHeight: 1.7 }}>
              {brandName} does not display a purity result, third-party-tested claim, or batch verification unless a current supporting document is posted for that product and batch.
            </p>
            <Link className="btn btn-primary" to={documentsPath}>Review quality documents</Link>
          </div>
        </section>
        <section className="section section-alt">
          <div className="container-sm policy-stack">
            <section className="policy-section"><h2>What a posted document means</h2><p>A posted document reports the fields contained in that document for its identified product and batch. It does not establish medical suitability, sterility, regulatory approval, or expected outcomes.</p></section>
            <section className="policy-section"><h2>When documentation is missing</h2><p>The product is shown as “Documentation requested” or “Not currently posted.” Missing documentation is never represented as a verified result.</p></section>
            <section className="policy-section"><h2>Policy review required</h2><p>Any refund, testing-cost reimbursement, purity threshold, chain-of-custody requirement, or claim window requires a separately approved written policy. No automatic guarantee is offered by this page.</p></section>
            <div className="disclaimer">Legal and business-owner review is required before publishing any guarantee, refund eligibility rule, testing protocol, or fixed purity threshold.</div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
