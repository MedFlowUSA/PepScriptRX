import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { EMAIL_SUPPORT } from '../../config';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { REP_INTAKE_PRODUCTS } from '../../data/repIntakeCatalog';
import { usePageMeta } from '../../hooks/usePageMeta';

type CertificatesProps = { portalKey?: string };

type DocumentStatus = 'verified_document' | 'verified_data_pending_publication' | 'documentation_pending' | 'not_available';

type QualityDocumentRecord = {
  sku: string;
  productName: string;
  status: DocumentStatus;
  documentUrl: string | null;
  batchNumber: string | null;
  testDate: string | null;
  retestDate: string | null;
  laboratory: string | null;
  purityResult: string | null;
};

// This is intentionally conservative. A record may only move to a verified state
// when a real document and its batch metadata are reviewed and published together.
const QUALITY_DOCUMENTS: QualityDocumentRecord[] = REP_INTAKE_PRODUCTS
  .filter((product) => product.category !== 'Supplies / Add-ons')
  .map((product) => ({
    sku: product.id,
    productName: product.productName,
    status: 'documentation_pending',
    documentUrl: null,
    batchNumber: null,
    testDate: null,
    retestDate: null,
    laboratory: null,
    purityResult: null,
  }));

const STATUS_COPY: Record<DocumentStatus, string> = {
  verified_document: 'Verified PDF available',
  verified_data_pending_publication: 'Verified data; document awaiting publication',
  documentation_pending: 'Documentation requested',
  not_available: 'No documentation currently available',
};

export default function Certificates({ portalKey }: CertificatesProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const homePath = portal?.path ?? '/';
  const requestHref = `mailto:${EMAIL_SUPPORT}?subject=${encodeURIComponent(`${brandName} quality-document request`)}`;

  usePageMeta(
    `${brandName} | Quality Documents`,
    `Current publication status for product quality documents available through ${brandName}.`,
  );

  return (
    <PublicLayout isolatedPortal={Boolean(portal)} portalKey={portal?.id} portalHomePath={portal?.path} portalName={brandName} portalLogoSrc={portal?.logoSrc}>
      <main>
        <section style={{ background: 'var(--ink)', padding: '56px 24px 48px' }}>
          <div className="container">
            <p style={{ color: 'var(--teal-light)', fontWeight: 700 }}>Transparency and document status</p>
            <h1 style={{ color: '#fff' }}>Quality documents</h1>
            <p style={{ color: 'rgba(255,255,255,.78)', maxWidth: 720, lineHeight: 1.7 }}>
              This page reports whether product-specific documentation is currently posted. A product listing is not evidence of testing,
              purity, sterility, regulatory approval, or suitability. No batch result is shown unless its supporting document has been verified and published.
            </p>
            <Link to={homePath} className="btn btn-primary btn-sm">Back to {brandName}</Link>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="card" role="status" style={{ marginBottom: 24 }}>
              <strong>Current publication status</strong>
              <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
                No verified PDF files are currently published in this application. Documentation has been requested for the catalog entries below.
              </p>
            </div>

            <div className="table-wrap">
              <table>
                <caption className="sr-only">Quality-document publication status by catalog SKU</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">Catalog SKU</th><th scope="col">Document status</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {QUALITY_DOCUMENTS.map((record) => (
                    <tr key={record.sku}>
                      <th scope="row">{record.productName}</th>
                      <td>{record.sku}</td>
                      <td><span className="badge badge-warning">{STATUS_COPY[record.status]}</span></td>
                      <td>
                        {isCurrentVerifiedDocument(record) ? (
                          <a className="btn btn-primary btn-sm" href={record.documentUrl} target="_blank" rel="noopener noreferrer">View COA</a>
                        ) : (
                          <a className="btn btn-outline btn-sm" href={requestHref}>Request documentation</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="disclaimer" style={{ marginTop: 24 }}>
              Quality documents are provided for transparency only. They are not prescriptions, dispensing records, proof of FDA approval,
              sterility assurance, medical guidance, or evidence that a product is appropriate for any person. Product and batch applicability must be verified separately.
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function isCurrentVerifiedDocument(record: QualityDocumentRecord): record is QualityDocumentRecord & { documentUrl: string } {
  if (record.status !== 'verified_document' || !record.documentUrl || !record.retestDate) return false;
  const retestDate = Date.parse(record.retestDate);
  return Number.isFinite(retestDate) && retestDate >= Date.now();
}
