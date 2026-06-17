import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import AiAssistedBadge from '../../components/ai/AiAssistedBadge';
import PepRxBotBadge from '../../components/ai/PepRxBotBadge';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { REP_INTAKE_PRODUCTS } from '../../data/repIntakeCatalog';
import { usePageMeta } from '../../hooks/usePageMeta';
import { mixingProductSlug } from '../../lib/mixingCenter';

const ACK_TEXT =
  'I understand this tool is for educational math support only. I will follow the instructions from my healthcare professional and verify all calculations before using any product.';

const ACK_TEXT_TR =
  'Bu aracın yalnızca eğitim amaçlı matematik desteği sunduğunu anlıyorum. Herhangi bir ürünü kullanmadan önce sağlık uzmanımın talimatlarını takip edeceğim ve tüm hesaplamaları doğrulayacağım.';

const DISCLAIMER =
  'Educational purposes only. Follow the instructions provided by your healthcare professional. PepScriptRX does not provide medical advice.';

const DISCLAIMER_TR =
  'Yalnızca eğitim amaçlıdır. Sağlık uzmanınız tarafından verilen talimatları izleyin. PepScriptRX tıbbi tavsiye vermez.';

const BAC_WATER_OPTIONS = ['1', '2', '3', '5'];
const DOSE_PRESETS = [
  { label: '250 mcg', value: '250', unit: 'mcg' as DesiredUnit },
  { label: '500 mcg', value: '500', unit: 'mcg' as DesiredUnit },
  { label: '1 mg', value: '1', unit: 'mg' as DesiredUnit },
  { label: '2.5 mg', value: '2.5', unit: 'mg' as DesiredUnit },
  { label: '5 mg', value: '5', unit: 'mg' as DesiredUnit },
];

const MIXING_PRODUCTS = REP_INTAKE_PRODUCTS
  .filter((product) => product.category !== 'Supplies / Add-ons')
  .map((product) => ({
    ...product,
    vialMg: inferVialMg(product.productName, product.id),
    slug: mixingProductSlug({ id: product.id, name: product.productName }),
  }));

type DesiredUnit = 'mcg' | 'mg';

type PeptideCalculatorProps = {
  portalKey?: string;
};

export default function PeptideCalculator({ portalKey }: PeptideCalculatorProps = {}) {
  const { productSlug } = useParams<{ productSlug?: string }>();
  const initialProduct = useMemo(() => findProductBySlug(productSlug) ?? MIXING_PRODUCTS[0], [productSlug]);
  const portalConfig = portalKey ? getWhiteLabelPortal(portalKey) : null;
  const isAactivated = portalConfig?.id === 'aactivated';
  const isAnatolia = portalConfig?.id === 'anatolia';
  const brandName = portalConfig?.brandName ?? 'PepScriptRX';
  const mixingTitle = isAnatolia ? 'Anatolia Wellness Labs Karışım Merkezi' : isAactivated ? 'AACTIVATED-RX Mixing Center' : 'PepScriptRX Mixing Center';
  const ackStorageKey = isAnatolia ? 'anatolia_precisionmix_ack' : isAactivated ? 'aactivated_precisionmix_ack' : 'pepscriptrx_precisionmix_ack';

  usePageMeta(
    initialProduct ? `${mixingTitle} - ${initialProduct.productName}` : mixingTitle,
    isAnatolia
      ? 'Ürün rehberleri, şırınga birimleri, saklama notları ve güvenlik hatırlatmaları içeren Türkçe karışım hesaplayıcı.'
      : 'Beginner-friendly peptide mixing calculator with product guides, syringe units, storage notes, and safety reminders.',
  );

  const [acknowledged, setAcknowledged] = useState(() => window.localStorage.getItem(ackStorageKey) === 'true');
  const [ackChecked, setAckChecked] = useState(false);
  const [productId, setProductId] = useState(initialProduct.id);
  const [waterMl, setWaterMl] = useState('2');
  const [desiredAmount, setDesiredAmount] = useState('500');
  const [desiredUnit, setDesiredUnit] = useState<DesiredUnit>('mcg');
  const [emergencyDose, setEmergencyDose] = useState('500');
  const [emergencyUnit, setEmergencyUnit] = useState<DesiredUnit>('mcg');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setProductId(initialProduct.id);
  }, [initialProduct.id]);

  const selectedProduct = MIXING_PRODUCTS.find((product) => product.id === productId) ?? initialProduct;
  const guide = getProductGuide(selectedProduct.productName, selectedProduct.category, isAnatolia);
  const result = useMemo(() => calculate(selectedProduct.vialMg, waterMl, desiredAmount, desiredUnit), [
    selectedProduct.vialMg,
    waterMl,
    desiredAmount,
    desiredUnit,
  ]);
  const emergencyResult = useMemo(() => calculate(selectedProduct.vialMg, waterMl, emergencyDose, emergencyUnit), [
    selectedProduct.vialMg,
    waterMl,
    emergencyDose,
    emergencyUnit,
  ]);

  function acceptDisclaimer() {
    if (!ackChecked) return;
    window.localStorage.setItem(ackStorageKey, 'true');
    setAcknowledged(true);
  }

  function chooseDose(value: string, unit: DesiredUnit) {
    setDesiredAmount(value);
    setDesiredUnit(unit);
  }

  async function copySummary() {
    const text = [
      mixingTitle,
      `${isAnatolia ? 'Ürün' : 'Product'}: ${selectedProduct.productName}`,
      `${isAnatolia ? 'BAC su' : 'BAC water'}: ${waterMl} mL`,
      `${isAnatolia ? 'İstenen miktar' : 'Desired amount'}: ${desiredAmount} ${desiredUnit}`,
      `${isAnatolia ? 'Çekilecek birim' : 'Units to draw'}: ${formatNumber(result.unitsToDraw)} ${isAnatolia ? 'birim' : 'units'}`,
      `${isAnatolia ? 'Verilen miligram' : 'Milligrams delivered'}: ${formatNumber(result.mgDelivered, 3)} mg`,
      `${isAnatolia ? 'Saklama' : 'Storage'}: ${guide.storage}`,
      `${isAnatolia ? 'Güvenlik' : 'Safety'}: ${isAnatolia ? DISCLAIMER_TR : DISCLAIMER}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <PublicLayout
      isolatedPortal={Boolean(portalConfig)}
      portalHomePath={portalConfig?.path}
      portalName={brandName}
      portalLogoSrc={portalConfig?.logoSrc}
      portalKey={portalConfig?.id}
    >
      <section className="precisionmix-page mixing-center-page">
        <div className="container">
          <div className={`precisionmix-hero mixing-center-hero ${isAactivated ? 'aactivated-mixing-hero' : ''}`}>
            <div>
              {(isAactivated || isAnatolia) && portalConfig?.logoSrc ? (
                <img src={portalConfig.logoSrc} alt={brandName} className="aactivated-mixing-logo" />
              ) : null}
              <div className="precisionmix-kicker">{mixingTitle}</div>
              <h1>{isAnatolia ? 'Anatolia siparişleri için basit karışım desteği' : isAactivated ? 'Simple mixing help for AACTIVATED-RX orders' : 'Simple vial mixing help'}</h1>
              <p>
                {isAnatolia
                  ? 'Ürününüzü seçin, kullandığınız BAC su miktarını girin, yazılı talimatınızdaki miktarı ekleyin ve çekilecek şırınga birimini görün.'
                  : 'Pick your product, choose how much BAC water you used, enter the amount written on your instructions, and see the syringe units to draw.'}
              </p>
            </div>
            <div className="precisionmix-hero-card">
              <span>{isAnatolia ? 'İlk kullanım için sade' : 'First-time friendly'}</span>
              <strong>{isAnatolia ? 'Formül göstermez' : 'No formulas shown'}</strong>
              <small>{isAnatolia ? 'Bunu yalnızca görsel matematik yardımcısı olarak kullanın. Sağlık uzmanınızın talimatları önceliklidir.' : "Use this as a visual math helper only. Your healthcare professional's instructions come first."}</small>
            </div>
          </div>

          <div className="precisionmix-banner">
            <strong>{isAnatolia ? 'Önemli:' : 'Important:'}</strong> {isAnatolia ? DISCLAIMER_TR : DISCLAIMER}
          </div>

          <PepRxBotBadge
            variant="section"
            context="mixing"
            title={isAnatolia ? 'PEPRXbot Karışım Yardımcısı' : 'PEPRXbot Mixing Helper'}
            body={isAnatolia ? 'Flakon gücünü, BAC su miktarını ve sağlayıcı tarafından verilen miktarı girin. PEPRXbot matematiği açıklayabilir; doz önermez veya reçete yazmaz.' : 'Enter your vial strength, BAC water amount, and provider-directed dose. PEPRXbot can help explain the math, but it does not prescribe or recommend dosing.'}
          />

          <div className="mixing-mobile-stack">
            <section className="precisionmix-panel mixing-card">
              <div className="precisionmix-panel-head">
                <span>{isAnatolia ? '1. Flakonunuzu seçin' : '1. Choose your vial'}</span>
                <small>{isAnatolia ? 'Ürün sayfaları doğrudan buraya bağlanabilir.' : 'Product pages can link here directly.'}</small>
              </div>
              <AiAssistedBadge compact />

              <label className="precisionmix-field">
                <span>{isAnatolia ? 'Ürün' : 'Product'}</span>
                <select className="mixing-select" value={productId} onChange={(event) => setProductId(event.target.value)}>
                  {MIXING_PRODUCTS.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mixing-product-summary">
                <strong>{selectedProduct.productName}</strong>
                <span>{selectedProduct.category}</span>
                <small>{selectedProduct.vialMg ? `${selectedProduct.vialMg} mg ${isAnatolia ? 'flakon algılandı' : 'vial detected'}` : isAnatolia ? 'Etiketiniz farklıysa flakon miktarını manuel girin.' : 'Enter vial amount manually if your label differs.'}</small>
              </div>
            </section>

            <section className="precisionmix-panel mixing-card">
              <div className="precisionmix-panel-head">
                <span>{isAnatolia ? '2. Eklenen BAC su' : '2. BAC water added'}</span>
                <small>{isAnatolia ? 'Flakona karıştırdığınız miktarı seçin.' : 'Tap the amount you mixed into the vial.'}</small>
              </div>
              <div className="mixing-button-grid">
                {BAC_WATER_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`mixing-choice ${waterMl === value ? 'active' : ''}`}
                    onClick={() => setWaterMl(value)}
                  >
                    {value} mL
                  </button>
                ))}
              </div>
            </section>

            <section className="precisionmix-panel mixing-card">
              <div className="precisionmix-panel-head">
                <span>{isAnatolia ? '3. İstenen miktar' : '3. Desired amount'}</span>
                <small>{isAnatolia ? 'Yazılı talimatınızdaki miktarı kullanın.' : 'Use the amount from your written instructions.'}</small>
              </div>
              <div className="mixing-button-grid dose-grid">
                {DOSE_PRESETS.map((dose) => (
                  <button
                    key={dose.label}
                    type="button"
                    className={`mixing-choice ${desiredAmount === dose.value && desiredUnit === dose.unit ? 'active' : ''}`}
                    onClick={() => chooseDose(dose.value, dose.unit)}
                  >
                    {dose.label}
                  </button>
                ))}
              </div>
              <label className="precisionmix-field mixing-custom-dose">
                <span>{isAnatolia ? 'Özel miktar' : 'Custom amount'}</span>
                <div className="precisionmix-input-row">
                  <input value={desiredAmount} onChange={(event) => setDesiredAmount(event.target.value)} inputMode="decimal" />
                  <select value={desiredUnit} onChange={(event) => setDesiredUnit(event.target.value as DesiredUnit)}>
                    <option value="mcg">mcg</option>
                    <option value="mg">mg</option>
                  </select>
                </div>
              </label>
            </section>
          </div>

          <div className="precisionmix-shell mixing-results-shell">
            <div className="precisionmix-results mixing-results-panel">
              <div className="precisionmix-result-card primary">
                <span>{isAnatolia ? 'Çekilecek birim' : 'Units to draw'}</span>
                <strong>{formatNumber(result.unitsToDraw)}</strong>
                <small>{isAnatolia ? 'U-100 insülin şırıngası birimleri' : 'U-100 insulin syringe units'}</small>
              </div>

              <SyringeVisual units={result.unitsToDraw} isTurkish={isAnatolia} />

              <div className="precisionmix-metrics">
                <Metric label={isAnatolia ? 'Verilen miligram' : 'Milligrams delivered'} value={`${formatNumber(result.mgDelivered, 3)} mg`} />
                <Metric label={isAnatolia ? 'Çekim hacmi' : 'Draw volume'} value={`${formatNumber(result.drawVolumeMl, 3)} mL`} />
                <Metric label={isAnatolia ? 'Sıklık' : 'Frequency'} value={guide.frequency} />
                <Metric label={isAnatolia ? 'Saklama' : 'Storage'} value={guide.storageShort} />
              </div>

              {result.warnings.length > 0 && (
                <div className="precisionmix-warning">
                  <strong>{isAnatolia ? 'Kullanmadan önce tekrar kontrol edin.' : 'Double-check before using.'}</strong>
                  {result.warnings.map((warning) => <span key={warning}>{translateWarning(warning, isAnatolia)}</span>)}
                </div>
              )}

              <div className="precisionmix-output-disclaimer">
                {isAnatolia ? DISCLAIMER_TR : DISCLAIMER}
              </div>

              <button className="btn btn-primary w-full" type="button" onClick={copySummary}>
                {copied ? isAnatolia ? 'Karışım Özeti Kopyalandı' : 'Copied Mixing Summary' : isAnatolia ? 'Karışım Özetini Kopyala' : 'Copy Mixing Summary'}
              </button>
            </div>

            <div className="precisionmix-panel mixing-card mixing-guide">
              <div className="precisionmix-panel-head">
                <span>{selectedProduct.productName} {isAnatolia ? 'rehberi' : 'guide'}</span>
                <small>{isAnatolia ? 'Sade dilde genel bakış' : 'Plain-language overview'}</small>
              </div>
              <GuideBlock title={isAnatolia ? 'Karışım talimatları' : 'Mixing instructions'} text={guide.mixing} />
              <GuideBlock title={isAnatolia ? 'Saklama talimatları' : 'Storage instructions'} text={guide.storage} />
              <GuideBlock title={isAnatolia ? 'Enjeksiyon talimatları' : 'Injection instructions'} text={guide.injection} />
              <GuideBlock title={isAnatolia ? 'Doz örnekleri' : 'Dosing examples'} text={guide.example} />
            </div>
          </div>

          <section className="precisionmix-panel mixing-card emergency-card">
            <div className="precisionmix-panel-head">
              <span>{isAnatolia ? 'Hızlı hesaplayıcı' : 'Emergency calculator'}</span>
              <small>{isAnatolia ? 'Flakonu zaten karıştırdınız mı? Etiketinizdeki miktarı girin.' : 'Already mixed your vial? Enter the amount from your label.'}</small>
            </div>
            <div className="mixing-emergency-grid">
              <label className="precisionmix-field">
                <span>{isAnatolia ? 'Çekmeniz gereken miktar' : 'Amount you need to draw'}</span>
                <div className="precisionmix-input-row">
                  <input value={emergencyDose} onChange={(event) => setEmergencyDose(event.target.value)} inputMode="decimal" />
                  <select value={emergencyUnit} onChange={(event) => setEmergencyUnit(event.target.value as DesiredUnit)}>
                    <option value="mcg">mcg</option>
                    <option value="mg">mg</option>
                  </select>
                </div>
              </label>
              <div className="precisionmix-result-card emergency-result">
                <span>{isAnatolia ? 'Bu kadar birim çekin' : 'Draw this many units'}</span>
                <strong>{formatNumber(emergencyResult.unitsToDraw)}</strong>
                <small>{isAnatolia ? 'Kullanmadan önce sağlık uzmanınızla doğrulayın.' : 'Verify with your healthcare professional before using.'}</small>
              </div>
            </div>
          </section>

          <div className="precisionmix-footer-disclaimer">
            {isAnatolia ? DISCLAIMER_TR : DISCLAIMER}
          </div>
        </div>
      </section>

      {!acknowledged && (
        <div className="precisionmix-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="precisionmix-modal-title">
          <div className="precisionmix-modal">
            <div className="precisionmix-kicker">{isAnatolia ? 'Gerekli Onay' : 'Required Acknowledgment'}</div>
            <h2 id="precisionmix-modal-title">{isAnatolia ? 'Karışım Merkezini kullanmadan önce' : 'Before using Mixing Center'}</h2>
            <p>{isAnatolia ? DISCLAIMER_TR : DISCLAIMER} {isAnatolia ? 'Bu araç yalnızca hesaplayıcıdır; doz veya kullanım programı önermez.' : 'This tool is a calculator only and does not recommend a dose or schedule.'}</p>
            <label className="precisionmix-ack">
              <input type="checkbox" checked={ackChecked} onChange={(event) => setAckChecked(event.target.checked)} />
              <span>{isAnatolia ? ACK_TEXT_TR : ACK_TEXT}</span>
            </label>
            <button className="btn btn-primary w-full" type="button" disabled={!ackChecked} onClick={acceptDisclaimer}>
              {isAnatolia ? 'Onayla ve Karışım Merkezini Aç' : 'Accept and Open Mixing Center'}
            </button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function SyringeVisual({ units, isTurkish }: { units: number | null; isTurkish: boolean }) {
  const safeUnits = units == null || !Number.isFinite(units) ? 0 : Math.max(0, Math.min(100, units));
  return (
    <div className="mixing-syringe-card" aria-label="Insulin syringe visual">
      <div className="mixing-syringe-label">
        <span>{isTurkish ? 'Şırınga görseli' : 'Syringe visual'}</span>
        <strong>{isTurkish ? 'Vurgu' : 'Highlight'}: {formatNumber(safeUnits)} {isTurkish ? 'birim' : 'units'}</strong>
      </div>
      <div className="mixing-syringe">
        <div className="mixing-syringe-plunger" />
        <div className="mixing-syringe-body">
          <div className="mixing-syringe-fill" style={{ width: `${safeUnits}%` }} />
          <div className="mixing-syringe-highlight" style={{ left: `${safeUnits}%` }} />
          {Array.from({ length: 11 }).map((_, index) => (
            <span key={index} style={{ left: `${index * 10}%` }}>{index * 10}</span>
          ))}
        </div>
        <div className="mixing-syringe-needle" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="precisionmix-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GuideBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mixing-guide-block">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function calculate(vialMg: number | null, waterMlRaw: string, desiredRaw: string, desiredUnit: DesiredUnit) {
  const waterMl = parsePositive(waterMlRaw);
  const desiredInput = parsePositive(desiredRaw);
  const desiredMg = desiredInput == null ? null : desiredUnit === 'mg' ? desiredInput : desiredInput / 1000;
  const concentrationMgPerMl = vialMg != null && waterMl ? vialMg / waterMl : null;
  const drawVolumeMl = desiredMg != null && concentrationMgPerMl ? desiredMg / concentrationMgPerMl : null;
  const unitsToDraw = drawVolumeMl != null ? drawVolumeMl * 100 : null;
  const warnings: string[] = [];

  if (vialMg == null) warnings.push('Vial strength was not detected. Confirm the vial amount on your label.');
  if (unitsToDraw != null && unitsToDraw > 100) warnings.push('The result is over 100 units and may not fit in a 1 mL insulin syringe.');
  if (unitsToDraw != null && unitsToDraw > 0 && unitsToDraw < 1) warnings.push('The result is under 1 unit and may be hard to measure accurately.');
  if (unitsToDraw != null && unitsToDraw >= 1 && Math.abs(unitsToDraw - Math.round(unitsToDraw)) > 0.2) {
    warnings.push('The result lands between unit lines. Ask your healthcare professional how to handle rounding.');
  }

  return {
    unitsToDraw,
    drawVolumeMl,
    mgDelivered: desiredMg,
    warnings,
  };
}

function getProductGuide(productName: string, category: string, isTurkish = false) {
  const lower = productName.toLowerCase();
  const isGlp = category.includes('GLP') || ['tirzepatide', 'semaglutide', 'retatrutide', 'cagrilintide', 'cagrisema'].some((name) => lower.includes(name));
  const productLabel = productName.replace(/\s+/g, ' ').trim();

  if (isTurkish) {
    return {
      mixing: `${productLabel} flakon miktarınızı doğrulayın, seçtiğiniz BAC su miktarını yavaşça ekleyin ve flakon eşit şekilde karışmış görünene kadar nazikçe çevirin. Sert çalkalamayın. Etiketiniz farklı karışım talimatı veriyorsa etiketi izleyin.`,
      storage: 'Karışımdan sonra flakonu buzdolabında, ışıktan koruyarak saklayın ve dondurmayın. Sıvı bulanık, renk değiştirmiş veya parçacıklı görünüyorsa kullanmayın. Etiketinizdeki son kullanım/atma tarihini izleyin.',
      storageShort: 'Karışımdan sonra buzdolabında saklayın',
      injection: 'Yalnızca sağlık uzmanınızın açıkladığı uygulama yolu, bölge, iğne ve tekniği kullanın. Her seferinde yeni steril şırınga kullanın ve kesici-delici atıkları güvenli şekilde atın.',
      frequency: 'Yazılı programınızı izleyin',
      example: isGlp
        ? 'Yalnızca örnek: yazılı talimatınız 0.25 mg diyorsa mg seçin ve 0.25 girin. Hesaplayıcı, karıştırdığınız su miktarına göre şırınga birimini gösterir.'
        : 'Yalnızca örnek: yazılı talimatınız 500 mcg diyorsa mcg seçin ve 500 girin. Hesaplayıcı, karıştırdığınız su miktarına göre şırınga birimini gösterir.',
    };
  }

  return {
    mixing: `Confirm your ${productLabel} vial amount, slowly add the BAC water amount you selected, and gently swirl until the vial looks evenly mixed. Do not shake hard. If your label gives different mixing instructions, follow the label.`,
    storage: 'After mixing, keep the vial refrigerated, protected from light, and do not freeze. Do not use if the liquid looks cloudy, discolored, or contains particles. Follow the discard date on your label.',
    storageShort: 'Refrigerate after mixing',
    injection: 'Use only the route, site, needle, and technique explained by your healthcare professional. Use a new sterile syringe each time and dispose of sharps safely.',
    frequency: 'Follow your written schedule',
    example: isGlp
      ? 'Example only: if your written instructions say 0.25 mg, select mg and enter 0.25. The calculator will show the syringe units for the water amount you mixed.'
      : 'Example only: if your written instructions say 500 mcg, select mcg and enter 500. The calculator will show the syringe units for the water amount you mixed.',
  };
}

function translateWarning(warning: string, isTurkish: boolean) {
  if (!isTurkish) return warning;
  if (warning.includes('Vial strength was not detected')) return 'Flakon gücü algılanmadı. Etiketinizdeki flakon miktarını doğrulayın.';
  if (warning.includes('over 100 units')) return 'Sonuç 100 birimin üzerinde ve 1 mL insülin şırıngasına sığmayabilir.';
  if (warning.includes('under 1 unit')) return 'Sonuç 1 birimin altında ve doğru ölçülmesi zor olabilir.';
  if (warning.includes('between unit lines')) return 'Sonuç birim çizgileri arasına denk geliyor. Yuvarlama konusunda sağlık uzmanınıza danışın.';
  return warning;
}

function findProductBySlug(productSlug?: string) {
  if (!productSlug) return null;
  const normalized = normalizeComparable(productSlug);
  return MIXING_PRODUCTS.find((product) => (
    normalizeComparable(product.slug) === normalized
    || normalizeComparable(product.id) === normalized
    || normalizeComparable(product.productName) === normalized
    || normalizeComparable(product.productName.replace(/\d+\s*mg/i, '')) === normalized
  )) ?? null;
}

function inferVialMg(productName: string, id: string) {
  const match = `${productName} ${id}`.match(/(\d+(?:\.\d+)?)\s*mg/i);
  return match ? Number(match[1]) : null;
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/mg$/g, '');
}

function parsePositive(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number | null, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (decimals != null) return trim(value.toFixed(decimals));
  if (value === 0) return '0';
  if (Math.abs(value) < 0.01) return trim(value.toFixed(4));
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return trim(value.toFixed(1));
  return trim(value.toFixed(2));
}

function trim(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
