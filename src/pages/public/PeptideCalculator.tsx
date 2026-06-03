import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { REP_INTAKE_PRODUCTS } from '../../data/repIntakeCatalog';
import { usePageMeta } from '../../hooks/usePageMeta';
import { mixingProductSlug } from '../../lib/mixingCenter';

const ACK_TEXT =
  'I understand this tool is for educational math support only. I will follow the instructions from my healthcare professional and verify all calculations before using any product.';

const DISCLAIMER =
  'Educational purposes only. Follow the instructions provided by your healthcare professional. PepScriptRX does not provide medical advice.';

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

export default function PeptideCalculator() {
  const { productSlug } = useParams<{ productSlug?: string }>();
  const initialProduct = useMemo(() => findProductBySlug(productSlug) ?? MIXING_PRODUCTS[0], [productSlug]);

  usePageMeta(
    initialProduct ? `Mixing Center - ${initialProduct.productName}` : 'Mixing Center',
    'Beginner-friendly peptide mixing calculator with product guides, syringe units, storage notes, and safety reminders.',
  );

  const [acknowledged, setAcknowledged] = useState(() => window.localStorage.getItem('pepscriptrx_precisionmix_ack') === 'true');
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
  const guide = getProductGuide(selectedProduct.productName, selectedProduct.category);
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
    window.localStorage.setItem('pepscriptrx_precisionmix_ack', 'true');
    setAcknowledged(true);
  }

  function chooseDose(value: string, unit: DesiredUnit) {
    setDesiredAmount(value);
    setDesiredUnit(unit);
  }

  async function copySummary() {
    const text = [
      'PepScriptRX Mixing Center',
      `Product: ${selectedProduct.productName}`,
      `BAC water: ${waterMl} mL`,
      `Desired amount: ${desiredAmount} ${desiredUnit}`,
      `Units to draw: ${formatNumber(result.unitsToDraw)} units`,
      `Milligrams delivered: ${formatNumber(result.mgDelivered, 3)} mg`,
      `Storage: ${guide.storage}`,
      `Safety: ${DISCLAIMER}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <PublicLayout>
      <section className="precisionmix-page mixing-center-page">
        <div className="container">
          <div className="precisionmix-hero mixing-center-hero">
            <div>
              <div className="precisionmix-kicker">PepScriptRX Mixing Center</div>
              <h1>Simple vial mixing help</h1>
              <p>
                Pick your product, choose how much BAC water you used, enter the amount written on your instructions, and see the syringe units to draw.
              </p>
            </div>
            <div className="precisionmix-hero-card">
              <span>First-time friendly</span>
              <strong>No formulas shown</strong>
              <small>Use this as a visual math helper only. Your healthcare professional's instructions come first.</small>
            </div>
          </div>

          <div className="precisionmix-banner">
            <strong>Important:</strong> {DISCLAIMER}
          </div>

          <div className="mixing-mobile-stack">
            <section className="precisionmix-panel mixing-card">
              <div className="precisionmix-panel-head">
                <span>1. Choose your vial</span>
                <small>Product pages can link here directly.</small>
              </div>

              <label className="precisionmix-field">
                <span>Product</span>
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
                <small>{selectedProduct.vialMg ? `${selectedProduct.vialMg} mg vial detected` : 'Enter vial amount manually if your label differs.'}</small>
              </div>
            </section>

            <section className="precisionmix-panel mixing-card">
              <div className="precisionmix-panel-head">
                <span>2. BAC water added</span>
                <small>Tap the amount you mixed into the vial.</small>
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
                <span>3. Desired amount</span>
                <small>Use the amount from your written instructions.</small>
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
                <span>Custom amount</span>
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
                <span>Units to draw</span>
                <strong>{formatNumber(result.unitsToDraw)}</strong>
                <small>U-100 insulin syringe units</small>
              </div>

              <SyringeVisual units={result.unitsToDraw} />

              <div className="precisionmix-metrics">
                <Metric label="Milligrams delivered" value={`${formatNumber(result.mgDelivered, 3)} mg`} />
                <Metric label="Draw volume" value={`${formatNumber(result.drawVolumeMl, 3)} mL`} />
                <Metric label="Frequency" value={guide.frequency} />
                <Metric label="Storage" value={guide.storageShort} />
              </div>

              {result.warnings.length > 0 && (
                <div className="precisionmix-warning">
                  <strong>Double-check before using.</strong>
                  {result.warnings.map((warning) => <span key={warning}>{warning}</span>)}
                </div>
              )}

              <div className="precisionmix-output-disclaimer">
                {DISCLAIMER}
              </div>

              <button className="btn btn-primary w-full" type="button" onClick={copySummary}>
                {copied ? 'Copied Mixing Summary' : 'Copy Mixing Summary'}
              </button>
            </div>

            <div className="precisionmix-panel mixing-card mixing-guide">
              <div className="precisionmix-panel-head">
                <span>{selectedProduct.productName} guide</span>
                <small>Plain-language overview</small>
              </div>
              <GuideBlock title="Mixing instructions" text={guide.mixing} />
              <GuideBlock title="Storage instructions" text={guide.storage} />
              <GuideBlock title="Injection instructions" text={guide.injection} />
              <GuideBlock title="Dosing examples" text={guide.example} />
            </div>
          </div>

          <section className="precisionmix-panel mixing-card emergency-card">
            <div className="precisionmix-panel-head">
              <span>Emergency calculator</span>
              <small>Already mixed your vial? Enter the amount from your label.</small>
            </div>
            <div className="mixing-emergency-grid">
              <label className="precisionmix-field">
                <span>Amount you need to draw</span>
                <div className="precisionmix-input-row">
                  <input value={emergencyDose} onChange={(event) => setEmergencyDose(event.target.value)} inputMode="decimal" />
                  <select value={emergencyUnit} onChange={(event) => setEmergencyUnit(event.target.value as DesiredUnit)}>
                    <option value="mcg">mcg</option>
                    <option value="mg">mg</option>
                  </select>
                </div>
              </label>
              <div className="precisionmix-result-card emergency-result">
                <span>Draw this many units</span>
                <strong>{formatNumber(emergencyResult.unitsToDraw)}</strong>
                <small>Verify with your healthcare professional before using.</small>
              </div>
            </div>
          </section>

          <div className="precisionmix-footer-disclaimer">
            {DISCLAIMER}
          </div>
        </div>
      </section>

      {!acknowledged && (
        <div className="precisionmix-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="precisionmix-modal-title">
          <div className="precisionmix-modal">
            <div className="precisionmix-kicker">Required Acknowledgment</div>
            <h2 id="precisionmix-modal-title">Before using Mixing Center</h2>
            <p>{DISCLAIMER} This tool is a calculator only and does not recommend a dose or schedule.</p>
            <label className="precisionmix-ack">
              <input type="checkbox" checked={ackChecked} onChange={(event) => setAckChecked(event.target.checked)} />
              <span>{ACK_TEXT}</span>
            </label>
            <button className="btn btn-primary w-full" type="button" disabled={!ackChecked} onClick={acceptDisclaimer}>
              Accept and Open Mixing Center
            </button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function SyringeVisual({ units }: { units: number | null }) {
  const safeUnits = units == null || !Number.isFinite(units) ? 0 : Math.max(0, Math.min(100, units));
  return (
    <div className="mixing-syringe-card" aria-label="Insulin syringe visual">
      <div className="mixing-syringe-label">
        <span>Syringe visual</span>
        <strong>Highlight: {formatNumber(safeUnits)} units</strong>
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

function getProductGuide(productName: string, category: string) {
  const lower = productName.toLowerCase();
  const isGlp = category.includes('GLP') || ['tirzepatide', 'semaglutide', 'retatrutide', 'cagrilintide', 'cagrisema'].some((name) => lower.includes(name));
  const productLabel = productName.replace(/\s+/g, ' ').trim();

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
