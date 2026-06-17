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
const ANATOLIA_COA_DISCLAIMER =
  'Analiz Sertifikaları yalnızca şeffaflık amacıyla sağlanır. COA, bir ürünün FDA onaylı, steril, insan kullanımına yasal olarak pazarlanabilir, reçete edilmiş, dağıtılmış veya herhangi bir hasta için uygun olduğunu göstermez. Bu belgeler yalnızca kimyasal ürün parti verilerini referans alır.';

function trCoaValue(value: string): string {
  if (value === 'Pending') return 'Beklemede';
  return value
    .replace('tight container', 'sıkı kapalı kap')
    .replace('protect from light', 'ışıktan koruyun')
    .replace('short term', 'kısa süreli')
    .replace('long term', 'uzun süreli')
    .replace('Conforms', 'Uygun')
    .replace('NMT', 'En fazla');
}

function trCoaCategory(category: string): string {
  return category
    .replace('Receptor Agonist', 'Reseptör Agonisti')
    .replace('Metabolic Cofactor', 'Metabolik Kofaktör')
    .replace('Copper Peptide', 'Bakır Peptit')
    .replace('Analogue', 'Analoğu')
    .replace('Mitochondrial Peptide', 'Mitokondriyal Peptit')
    .replace('Thymosin Peptide', 'Timosin Peptit');
}

type CertificatesProps = {
  portalKey?: string;
};

export default function Certificates({ portalKey }: CertificatesProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const isPortal = Boolean(portal);
  const isAnatolia = portal?.id === 'anatolia';
  const homePath = portal?.path ?? '/start';
  const coaMailto = `mailto:${EMAIL_SUPPORT}?subject=${encodeURIComponent(isAnatolia ? `${brandName} COA belge talebi` : `${brandName} COA documentation request`)}`;

  usePageMeta(
    isAnatolia ? `${brandName} | Kalite Belgeleri` : `${brandName} | Quality Documents`,
    isAnatolia ? `${brandName} üzerinden sunulan kalite belgeleri.` : `Quality documentation available through ${brandName}.`,
  );

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
            {isAnatolia ? 'Şeffaflık ve Kalite' : 'Transparency & Quality'}
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 14, lineHeight: 1.15 }}>
            {isAnatolia ? 'Analiz Sertifikaları' : 'Certificates of Analysis'}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', maxWidth: 600, lineHeight: 1.75, marginBottom: 24 }}>
            {isAnatolia ? `${brandName} üzerinden sunulan ürünler için üçüncü taraf parti belgeleri. Saflık, kimlik ve kalite test sonuçları aşağıda listelenir.` : `Third-party batch documentation for products available through ${brandName}. Purity, identity, and quality testing results are shown below for each product.`}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to={homePath} className="btn btn-primary btn-sm">
              {isPortal ? (isAnatolia ? `${brandName} mağazasına dön` : `Back to ${brandName}`) : 'Refill Now'}
            </Link>
            <a href="#disclaimer" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.25)' }}>{isAnatolia ? 'Uyarıyı Oku' : 'Read Disclaimer'}</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 8 }}>{isAnatolia ? 'Ürüne Göre Kalite Belgeleri' : 'Quality Documents by Product'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              {isAnatolia ? 'Mevcut parti verileri aşağıdadır. PDF beklemede olarak işaretlenen satırlarda parti alanları yayınlanmıştır, ancak indirilebilir sertifika dosyası henüz eklenmemiştir.' : 'Available batch data is listed below. Rows marked PDF Pending contain posted batch fields, but the downloadable certificate file is not yet attached.'}
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <PepRxBotBadge
              title={isAnatolia ? 'Kalite belgeleri hakkında PEPRXbot’a sorun' : 'Ask PEPRXbot about quality docs'}
              body={isAnatolia ? 'COA bulma, bekleyen PDF’leri anlama veya parti alanlarının ne anlama geldiğini öğrenme konusunda yardıma mı ihtiyacınız var? PEPRXbot tıbbi tavsiye vermeden rehberlik edebilir.' : 'Need help finding COAs, understanding pending PDFs, or knowing what a batch field means? PEPRXbot can guide you without giving medical advice.'}
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
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{isAnatolia ? trCoaCategory(coa.category) : coa.category} / CAS {coa.cas}</div>
                    </div>
                  </div>
                  {coa.file ? (
                    <a
                      href={coa.file}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      {isAnatolia ? 'COA’yı Görüntüle' : 'View COA'}
                    </a>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className="badge badge-warning">{isAnatolia ? 'PDF Beklemede' : 'PDF Pending'}</span>
                      <a href={coaMailto} className="btn btn-outline btn-sm">
                        {isAnatolia ? 'COA İste' : 'Request COA'}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 0 }}>
                  {[
                    { label: isAnatolia ? 'Saflık (HPLC)' : 'Purity (HPLC)', value: isAnatolia ? trCoaValue(coa.purityHPLC) : coa.purityHPLC, highlight: coa.purityHPLC !== 'Pending' },
                    { label: isAnatolia ? 'Bakteriyel Endotoksinler' : 'Bacterial Endotoxins', value: isAnatolia ? trCoaValue(coa.endotoxins) : coa.endotoxins },
                    { label: isAnatolia ? 'Parti No.' : 'Batch No.', value: isAnatolia ? trCoaValue(coa.batchNo) : coa.batchNo },
                    { label: isAnatolia ? 'Üretim Tarihi' : 'Mfg. Date', value: isAnatolia ? trCoaValue(coa.mfgDate) : coa.mfgDate },
                    { label: isAnatolia ? 'Tekrar Test Tarihi' : 'Retest Date', value: isAnatolia ? trCoaValue(coa.retestDate) : coa.retestDate },
                    { label: isAnatolia ? 'Saklama' : 'Storage', value: isAnatolia ? trCoaValue(coa.storage) : coa.storage },
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
                    <p style={{ fontSize: 12, color: '#7C2D12', margin: 0 }}>{isAnatolia ? 'COA beklemede. Belge için bizimle iletişime geçin. En güncel belge için COA isteyin.' : `${coa.note} Use Request COA for the latest available documentation.`}</p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      {isAnatolia ? `Formül: ${coa.formula}. Yalnızca şeffaflık içindir; FDA onayı, sterilite güvencesi veya insan kullanımına yetkilendirme değildir.` : `Formula: ${coa.formula}. For transparency only; not FDA approval, sterility assurance, or authorization for human use.`}
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
              {isAnatolia ? 'Karışım ve Dozlama: Burada Sağlanmaz' : 'Reconstitution & Dosing: Not Provided Here'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
              {isAnatolia ? (
                <>{brandName} karışım, dozlama, enjektör birimi, enjeksiyon veya yeniden hazırlama talimatı <strong>yayınlamaz</strong>. Tüm talimatlar doğrudan lisanslı sağlayıcınızdan veya dağıtıcı eczanenizden yazılı olarak gelmelidir.</>
              ) : (
                <>{brandName} does <strong>not</strong> publish mixing, dosing, syringe-unit, injection, or reconstitution instructions. Any instructions must come directly from your licensed provider or dispensing pharmacy in writing.</>
              )}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              {isAnatolia ? 'Eczane etiketi veya yazılı talimatlar su hacmi, nihai konsantrasyon, çekilecek miktar, karışım sonrası saklama, son kullanım tarihi, uygulama yolu ve sıklığı belirtmelidir. Herhangi bir şey net değilse ürünü kullanmayın; önce sağlayıcınızla iletişime geçin.' : 'Your pharmacy label or written instructions should specify water volume, final concentration, amount to draw, storage after mixing, beyond-use date, route, and frequency. If anything is unclear, do not use the product. Contact your provider first.'}
            </p>
            <Link to={homePath} className="btn btn-primary">
              {isPortal ? (isAnatolia ? `${brandName} mağazasına dön` : `Back to ${brandName}`) : 'Request Pharmacy Instructions'}
            </Link>
          </div>
        </div>
      </section>

      <section id="disclaimer" style={{ padding: '40px 0', background: 'var(--surface)' }}>
        <div className="container">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {isAnatolia ? 'Tam COA Uyarısı' : 'Full COA Disclaimer'}
          </h3>
          <div className="disclaimer" style={{ marginBottom: 16 }}>
            <strong>{isAnatolia ? 'COA Şeffaflık Uyarısı' : 'COA Transparency Notice'}:</strong> {isAnatolia ? ANATOLIA_COA_DISCLAIMER : COA_DISCLAIMER}
          </div>
          <div className="disclaimer">
            <strong>{isAnatolia ? 'Ar-Ge Beyanı' : 'R&D Statement'}:</strong> {isAnatolia ? `Bu sayfadaki belgeler üçüncü taraf parti test laboratuvarlarından gelir. Her sertifika ürünün kimyasal ürün olarak ve yalnızca Ar-Ge kullanımı için sağlandığını belirtir. ${brandName} bu belgeleri yalnızca şeffaflık amacıyla sunar. Belgeler eczane dağıtım kaydı, reçete belgesi, sterilite güvencesi veya düzenleyici onay yerine geçmez.` : `Documents on this page originate from third-party batch testing laboratories. Each certificate states the product is supplied as a chemical product and for R&D use only. ${brandName} provides these documents solely for transparency. They do not constitute pharmacy dispensing records, prescribing documentation, sterility assurance, or any form of regulatory approval. Any use of these products by patients must be directed and supervised by a licensed healthcare provider or dispensing pharmacy.`}
          </div>
          <p style={{ marginTop: 18, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
            {isAnatolia ? `Aşağıda listelenen ürünler sertifikalarında belirtildiği gibi yalnızca Ar-Ge kullanımı için kimyasal ürün olarak sağlanır. ${brandName} bunları FDA onaylı, steril veya insan kullanımına onaylı olarak temsil etmez. Kullanım reçete doğrulaması ve lisanslı sağlayıcı gözetimine tabidir.` : `All products listed below are supplied as chemical products for R&D use only as stated on their certificates. ${brandName} does not represent these as FDA-approved, sterile, or approved for human use. Use is subject to prescription verification and licensed provider oversight.`}
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
