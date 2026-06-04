import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import PepRxBotBadge from '../../components/ai/PepRxBotBadge';
import { EMAIL_SUPPORT } from '../../config';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';

interface CoaEntry {
  name: string;
  cas: string;
  formula: string;
  batchNo: string;
  mfgDate: string;
  retestDate: string;
  purityHPLC: string;
  endotoxins: string;
  storage: string;
  category: string;
  file?: string;
  note?: string;
}

const COAS: CoaEntry[] = [
  {
    name: 'Tirzepatide',
    cas: '2023788-19-2',
    formula: 'C225H348N48O68',
    batchNo: 'TRD-26031301',
    mfgDate: 'Mar 13, 2026',
    retestDate: 'Mar 12, 2028',
    purityHPLC: '99.2%',
    endotoxins: '<3 EU/mg',
    storage: '-20 +/- 5C',
    category: 'GLP-1 / GIP Receptor Agonist',
  },
  {
    name: 'Semaglutide',
    cas: '910463-68-2',
    formula: 'C187H291N45O59',
    batchNo: 'Pending',
    mfgDate: 'Pending',
    retestDate: 'Pending',
    purityHPLC: 'Pending',
    endotoxins: 'Pending',
    storage: '-20C',
    category: 'GLP-1 Receptor Agonist',
    note: 'COA pending. Contact us for documentation.',
  },
  {
    name: 'NAD+',
    cas: '53-84-9',
    formula: 'Nicotinamide Adenine Dinucleotide',
    batchNo: '26032501',
    mfgDate: 'Mar 18, 2026',
    retestDate: 'Pending',
    purityHPLC: '99.2%',
    endotoxins: '<0.2 EU/mg',
    storage: '-20C, tight container, protect from light',
    category: 'Metabolic Cofactor',
  },
  {
    name: 'GHK-Cu',
    cas: '89030-95-5',
    formula: 'C14H22CuN6O4',
    batchNo: '100003-26010702',
    mfgDate: 'Apr 2, 2026',
    retestDate: 'Apr 1, 2028',
    purityHPLC: '99.9%',
    endotoxins: 'Pending',
    storage: '2-8C short term; below -10C long term',
    category: 'Copper Peptide',
  },
  {
    name: 'CJC-1295 Without DAC',
    cas: '863288-34-0',
    formula: 'C152H252N44O42',
    batchNo: '800028-26031301',
    mfgDate: 'Mar 13, 2026',
    retestDate: 'Mar 12, 2028',
    purityHPLC: '99.7%',
    endotoxins: 'Conforms, NMT 10 EU/mg',
    storage: '2-8C short term; below -10C long term',
    category: 'GHRH Analogue',
  },
  {
    name: 'MOTS-c',
    cas: '1627580-64-6',
    formula: 'C101H152N28O22S2',
    batchNo: '26030503-04',
    mfgDate: 'Mar 6, 2026',
    retestDate: 'Mar 5, 2028',
    purityHPLC: '99.4%',
    endotoxins: '<3 EU/mg',
    storage: '2-8C short term; below -10C long term',
    category: 'Mitochondrial Peptide',
  },
  {
    name: 'TB-500 (Thymosin beta-4 Fragment)',
    cas: '885340-08-9',
    formula: 'C38H68N10O14',
    batchNo: '26031901',
    mfgDate: 'Mar 19, 2026',
    retestDate: 'Mar 18, 2028',
    purityHPLC: '99.6%',
    endotoxins: '<10 EU/mg',
    storage: '2-8C short term; below -10C long term',
    category: 'Thymosin Peptide',
  },
];

const COA_DISCLAIMER =
  'Certificates of Analysis are provided for transparency only. A COA does not establish that a product is FDA-approved, sterile, legally marketable for human use, prescribed, dispensed, or appropriate for any patient. These documents reference chemical product batch data only. Patients should only use medications pursuant to a valid prescription and written instructions from a licensed provider or dispensing pharmacy.';

type CertificatesProps = {
  portalKey?: string;
};

export default function Certificates({ portalKey }: CertificatesProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const isPortal = Boolean(portal);
  const homePath = portal?.path ?? '/start';
  const coaMailto = `mailto:${EMAIL_SUPPORT}?subject=${encodeURIComponent(`${brandName} COA documentation request`)}`;

  usePageMeta(`${brandName} | Quality Documents`, `Quality documentation available through ${brandName}.`);

  return (
    <PublicLayout
      isolatedPortal={isPortal}
      portalKey={portal?.id}
      portalHomePath={portal?.path}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
    >
      <section style={{ background: 'var(--ink)', padding: '56px 24px 48px' }}>
        <div className="container">
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--teal-light)', marginBottom: 10 }}>
            Transparency & Quality
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 14, lineHeight: 1.15 }}>
            Certificates of Analysis
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', maxWidth: 600, lineHeight: 1.75, marginBottom: 24 }}>
            Third-party batch documentation for products available through {brandName}. Purity, identity, and quality testing results are shown below for each product.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to={homePath} className="btn btn-primary btn-sm">
              {isPortal ? `Back to ${brandName}` : 'Refill Now'}
            </Link>
            <a href="#disclaimer" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.25)' }}>Read Disclaimer</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 8 }}>Quality Documents by Product</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              Available batch data is listed below. Rows marked PDF Pending contain posted batch fields, but the downloadable certificate file is not yet attached.
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <PepRxBotBadge
              title="Ask PEPRXbot about quality docs"
              body="Need help finding COAs, understanding pending PDFs, or knowing what a batch field means? PEPRXbot can guide you without giving medical advice."
              context="quality"
              compact
              variant="inline"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {COAS.map((coa) => (
              <div
                key={coa.name}
                className="card"
                style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 24px', background: 'var(--card-soft)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--teal-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      COA
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 17 }}>{coa.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{coa.category} / CAS {coa.cas}</div>
                    </div>
                  </div>
                  {coa.file ? (
                    <a
                      href={coa.file}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      View COA
                    </a>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className="badge badge-warning">PDF Pending</span>
                      <a href={coaMailto} className="btn btn-outline btn-sm">
                        Request COA
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 0 }}>
                  {[
                    { label: 'Purity (HPLC)', value: coa.purityHPLC, highlight: coa.purityHPLC !== 'Pending' },
                    { label: 'Bacterial Endotoxins', value: coa.endotoxins },
                    { label: 'Batch No.', value: coa.batchNo },
                    { label: 'Mfg. Date', value: coa.mfgDate },
                    { label: 'Retest Date', value: coa.retestDate },
                    { label: 'Storage', value: coa.storage },
                  ].map((field, i) => (
                    <div
                      key={field.label}
                      style={{
                        padding: '14px 20px',
                        borderRight: i % 3 !== 2 ? '1px solid var(--border)' : undefined,
                        borderBottom: i < 3 ? '1px solid var(--border)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                        {field.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: field.highlight ? 700 : 500, color: field.highlight ? 'var(--teal)' : 'var(--navy)' }}>
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', background: 'var(--card-soft)' }}>
                  {coa.note ? (
                    <p style={{ fontSize: 12, color: '#7C2D12', margin: 0 }}>{coa.note} Use Request COA for the latest available documentation.</p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Formula: {coa.formula}. For transparency only; not FDA approval, sterility assurance, or authorization for human use.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-md">
          <div className="card" style={{ border: '2px solid var(--teal)', padding: '32px 36px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
              Reconstitution & Dosing: Not Provided Here
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
              {brandName} does <strong>not</strong> publish mixing, dosing, syringe-unit, injection, or reconstitution instructions. Any instructions must come directly from your licensed provider or dispensing pharmacy in writing.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Your pharmacy label or written instructions should specify water volume, final concentration, amount to draw, storage after mixing, beyond-use date, route, and frequency. If anything is unclear, do not use the product. Contact your provider first.
            </p>
            <Link to={homePath} className="btn btn-primary">
              {isPortal ? `Back to ${brandName}` : 'Request Pharmacy Instructions'}
            </Link>
          </div>
        </div>
      </section>

      <section id="disclaimer" style={{ padding: '40px 0', background: 'var(--surface)' }}>
        <div className="container">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Full COA Disclaimer
          </h3>
          <div className="disclaimer" style={{ marginBottom: 16 }}>
            <strong>COA Transparency Notice:</strong> {COA_DISCLAIMER}
          </div>
          <div className="disclaimer">
            <strong>R&D Statement:</strong> Documents on this page originate from third-party batch testing laboratories. Each certificate states the product is supplied as a chemical product and for R&D use only. {brandName} provides these documents solely for transparency. They do not constitute pharmacy dispensing records, prescribing documentation, sterility assurance, or any form of regulatory approval. Any use of these products by patients must be directed and supervised by a licensed healthcare provider or dispensing pharmacy.
          </div>
          <p style={{ marginTop: 18, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
            All products listed below are supplied as chemical products for R&D use only as stated on their certificates. {brandName} does not represent these as FDA-approved, sterile, or approved for human use. Use is subject to prescription verification and licensed provider oversight.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
