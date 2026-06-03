import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';

const ACK_TEXT =
  'I understand this tool is for informational and mathematical convenience only. PepScriptRX does not provide dosing recommendations, medical advice, treatment guidance, or guarantee calculation accuracy. I am responsible for independently verifying all calculations with a qualified professional.';

const DISCLAIMER =
  'Educational purposes only. Follow instructions from your healthcare professional. PepScriptRX does not provide medical advice.';

const SYRINGES = [
  { id: 'u100-1ml', label: 'U-100 1mL', volumeMl: 1, maxUnits: 100 },
  { id: 'u100-05ml', label: 'U-100 0.5mL', volumeMl: 0.5, maxUnits: 50 },
  { id: 'u100-03ml', label: 'U-100 0.3mL', volumeMl: 0.3, maxUnits: 30 },
];

type DesiredUnit = 'mcg' | 'mg';

export default function PeptideCalculator() {
  const { productSlug } = useParams<{ productSlug?: string }>();
  usePageMeta(
    productSlug ? `Mixing Center - ${formatProductSlug(productSlug)}` : 'Mixing Center',
    'Free peptide mixing calculator. Enter your vial strength and BAC water volume to estimate draw math on a U-100 insulin syringe.',
  );
  const [acknowledged, setAcknowledged] = useState(() => window.localStorage.getItem('pepscriptrx_precisionmix_ack') === 'true');
  const [ackChecked, setAckChecked] = useState(false);
  const [vialMg, setVialMg] = useState('10');
  const [waterMl, setWaterMl] = useState('2');
  const [desiredAmount, setDesiredAmount] = useState('500');
  const [desiredUnit, setDesiredUnit] = useState<DesiredUnit>('mcg');
  const [syringeId, setSyringeId] = useState(SYRINGES[0].id);
  const [copied, setCopied] = useState(false);

  const selectedSyringe = SYRINGES.find((syringe) => syringe.id === syringeId) ?? SYRINGES[0];
  const result = useMemo(() => calculate(vialMg, waterMl, desiredAmount, desiredUnit, selectedSyringe.maxUnits), [
    vialMg,
    waterMl,
    desiredAmount,
    desiredUnit,
    selectedSyringe.maxUnits,
  ]);

  const fillPercent = result.unitsToDraw == null
    ? 0
    : Math.max(0, Math.min(100, (result.unitsToDraw / selectedSyringe.maxUnits) * 100));

  function acceptDisclaimer() {
    if (!ackChecked) return;
    window.localStorage.setItem('pepscriptrx_precisionmix_ack', 'true');
    setAcknowledged(true);
  }

  async function copySummary() {
    const text = [
      'PepScriptRX PrecisionMix Calculator',
      `Vial amount: ${valueOrDash(vialMg)} mg`,
      `BAC water added: ${valueOrDash(waterMl)} mL`,
      `Desired amount per draw: ${valueOrDash(desiredAmount)} ${desiredUnit}`,
      `Syringe: ${selectedSyringe.label}`,
      `Concentration: ${formatNumber(result.concentrationMgPerMl)} mg/mL`,
      `Micrograms per U-100 unit: ${formatNumber(result.mcgPerUnit)} mcg/unit`,
      `Units to draw: ${formatNumber(result.unitsToDraw)} units`,
      `Draw volume: ${formatNumber(result.drawVolumeMl, 3)} mL`,
      `Approximate draws per vial: ${formatNumber(result.drawsPerVial)}`,
      `Remaining after 1st draw: ${formatNumber(result.remainingMcg)} mcg`,
      'Disclaimer: Results are automated mathematical estimates only and may be incorrect if inputs are entered incorrectly. Verify all calculations independently with a qualified professional.',
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <PublicLayout>
      <section className="precisionmix-page">
        <div className="container">
          <div className="precisionmix-hero">
            <div>
              <div className="precisionmix-kicker">PepScriptRX LabTools</div>
              <h1>Mixing Center</h1>
              <p>
                Estimate peptide mixing math with a simple calculator built for beginners. This calculator is for informational math support only and is not medical advice.
              </p>
              {productSlug && (
                <p style={{ marginTop: 10, fontWeight: 800, color: 'var(--teal)' }}>
                  Product guide: {formatProductSlug(productSlug)}
                </p>
              )}
            </div>
            <div className="precisionmix-hero-card">
              <span>Deterministic Math</span>
              <strong>No dosing guidance</strong>
              <small>Verify every output independently before relying on any calculation.</small>
            </div>
          </div>

          <div className="precisionmix-banner">
            <strong>Important:</strong> {DISCLAIMER}
          </div>

          <div className="precisionmix-shell">
            <div className="precisionmix-panel">
              <div className="precisionmix-panel-head">
                <span>Inputs</span>
                <small>Enter only values you can independently verify.</small>
              </div>

              <div className="precisionmix-field-grid">
                <label className="precisionmix-field">
                  <span>Peptide amount in vial</span>
                  <div className="precisionmix-input-row">
                    <input value={vialMg} onChange={(event) => setVialMg(event.target.value)} inputMode="decimal" />
                    <b>mg</b>
                  </div>
                </label>

                <label className="precisionmix-field">
                  <span>BAC water added</span>
                  <div className="precisionmix-input-row">
                    <input value={waterMl} onChange={(event) => setWaterMl(event.target.value)} inputMode="decimal" />
                    <b>mL</b>
                  </div>
                </label>

                <label className="precisionmix-field">
                  <span>Desired amount per draw</span>
                  <div className="precisionmix-input-row">
                    <input value={desiredAmount} onChange={(event) => setDesiredAmount(event.target.value)} inputMode="decimal" />
                    <select value={desiredUnit} onChange={(event) => setDesiredUnit(event.target.value as DesiredUnit)}>
                      <option value="mcg">mcg</option>
                      <option value="mg">mg</option>
                    </select>
                  </div>
                </label>
              </div>

              <div className="precisionmix-syringes" aria-label="Syringe type">
                {SYRINGES.map((syringe) => (
                  <button
                    key={syringe.id}
                    type="button"
                    className={`precisionmix-syringe-option ${syringe.id === syringeId ? 'active' : ''}`}
                    onClick={() => setSyringeId(syringe.id)}
                  >
                    <span>{syringe.label}</span>
                    <small>{syringe.maxUnits} max units</small>
                  </button>
                ))}
              </div>

              {result.warnings.length > 0 && (
                <div className="precisionmix-warning">
                  <strong>This calculation appears unusual.</strong>
                  <span>Please independently verify all inputs and results.</span>
                  <ul>
                    {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="precisionmix-results">
              <div className="precisionmix-result-card primary">
                <span>Units to Draw</span>
                <strong>{formatNumber(result.unitsToDraw)}</strong>
                <small>U-100 syringe units</small>
              </div>

              <div className="precisionmix-syringe-visual" aria-label="Visual syringe fill estimate">
                <div className="precisionmix-syringe-bar">
                  <div className="precisionmix-syringe-fill" style={{ width: `${fillPercent}%` }} />
                  {Array.from({ length: 11 }).map((_, index) => (
                    <span key={index} style={{ left: `${index * 10}%` }} />
                  ))}
                </div>
                <div className="precisionmix-syringe-labels">
                  <span>0</span>
                  <span>{Math.round(selectedSyringe.maxUnits / 2)}</span>
                  <span>{selectedSyringe.maxUnits}</span>
                </div>
              </div>

              <div className="precisionmix-metrics">
                <Metric label="Concentration" value={`${formatNumber(result.concentrationMgPerMl)} mg/mL`} />
                <Metric label="mcg per unit" value={`${formatNumber(result.mcgPerUnit)} mcg/unit`} />
                <Metric label="Draw volume" value={`${formatNumber(result.drawVolumeMl, 3)} mL`} />
                <Metric label="Draws per vial" value={formatNumber(result.drawsPerVial)} />
                <Metric label="Remaining after 1st draw" value={`${formatNumber(result.remainingMcg)} mcg`} />
              </div>

              <div className="precisionmix-strength">
                <div>
                  <span>Concentration Strength Meter</span>
                  <strong>{result.strengthLabel}</strong>
                </div>
                <div className="precisionmix-strength-track">
                  <i style={{ width: `${result.strengthPercent}%` }} />
                </div>
              </div>

              <div className="precisionmix-output-disclaimer">
                {DISCLAIMER} Results are automated mathematical estimates only and may be incorrect if inputs are entered incorrectly.
              </div>

              <button className="btn btn-primary w-full" type="button" onClick={copySummary}>
                {copied ? 'Copied Calculation Summary' : 'Copy Calculation Summary'}
              </button>
            </div>
          </div>

          <div className="precisionmix-footer-disclaimer">
            {DISCLAIMER}
          </div>
        </div>
      </section>

      {!acknowledged && (
        <div className="precisionmix-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="precisionmix-modal-title">
          <div className="precisionmix-modal">
            <div className="precisionmix-kicker">Required Acknowledgment</div>
            <h2 id="precisionmix-modal-title">Before using PrecisionMix</h2>
            <p>
              This tool is provided for informational and mathematical convenience purposes only. PepScriptRX does not provide dosing recommendations, medical advice, or treatment guidance.
            </p>
            <label className="precisionmix-ack">
              <input type="checkbox" checked={ackChecked} onChange={(event) => setAckChecked(event.target.checked)} />
              <span>{ACK_TEXT}</span>
            </label>
            <button className="btn btn-primary w-full" type="button" disabled={!ackChecked} onClick={acceptDisclaimer}>
              Accept and Open Calculator
            </button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function formatProductSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bBpc\b/g, 'BPC')
    .replace(/\bTb\b/g, 'TB')
    .replace(/\bNad\b/g, 'NAD')
    .replace(/\bGhk\b/g, 'GHK');
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="precisionmix-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function calculate(vialMgRaw: string, waterMlRaw: string, desiredRaw: string, desiredUnit: DesiredUnit, maxUnits: number) {
  const vialMg = parsePositive(vialMgRaw);
  const waterMl = parsePositive(waterMlRaw);
  const desiredInput = parsePositive(desiredRaw);
  const desiredMcg = desiredInput == null ? null : desiredUnit === 'mg' ? desiredInput * 1000 : desiredInput;
  const totalVialMcg = vialMg == null ? null : vialMg * 1000;
  const concentrationMgPerMl = vialMg != null && waterMl ? vialMg / waterMl : null;
  // mcg per one U-100 unit = (mg/mL × 1000 mcg/mg) ÷ 100 units/mL
  const mcgPerUnit = concentrationMgPerMl == null ? null : (concentrationMgPerMl * 1000) / 100;
  const unitsToDraw = desiredMcg != null && mcgPerUnit ? desiredMcg / mcgPerUnit : null;
  // Draw volume in mL: U-100 = 100 units per mL, so units ÷ 100 = mL
  const drawVolumeMl = unitsToDraw != null ? unitsToDraw / 100 : null;
  const drawsPerVial = totalVialMcg != null && desiredMcg ? totalVialMcg / desiredMcg : null;
  // Remaining after first draw
  const remainingMcg = totalVialMcg != null && desiredMcg != null ? Math.max(0, totalVialMcg - desiredMcg) : null;
  const warnings: string[] = [];

  if (waterMl != null && waterMl < 0.5) warnings.push('BAC water volume is very low — pipetting accuracy may be affected below 0.5 mL.');
  if (concentrationMgPerMl != null && concentrationMgPerMl > 10) warnings.push('Concentration is unusually high (> 10 mg/mL) — double-check your vial amount and water volume.');
  if (unitsToDraw != null && unitsToDraw > maxUnits) warnings.push('Units to draw exceed the selected syringe capacity — choose a larger syringe or adjust your dose.');
  if (unitsToDraw != null && unitsToDraw < 1) warnings.push('Draw amount is less than 1 unit — sub-unit doses cannot be accurately measured on a standard U-100 syringe. Consider adding more BAC water to lower the concentration.');
  if (unitsToDraw != null && unitsToDraw >= 1) {
    const fraction = unitsToDraw - Math.round(unitsToDraw);
    if (Math.abs(fraction) > 0.2) warnings.push(`Units to draw (${formatNumber(unitsToDraw)}) fall between syringe graduations — rounding to the nearest whole unit introduces a measurement error. Consider adjusting BAC water volume.`);
  }
  if (totalVialMcg != null && desiredMcg != null && desiredMcg > totalVialMcg) warnings.push('Desired dose exceeds the total amount in the vial.');

  const strength = getStrength(concentrationMgPerMl);
  return {
    concentrationMgPerMl,
    mcgPerUnit,
    unitsToDraw,
    drawVolumeMl,
    drawsPerVial,
    remainingMcg,
    warnings,
    strengthLabel: strength.label,
    strengthPercent: strength.percent,
  };
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

function getStrength(concentration: number | null) {
  if (concentration == null) return { label: 'Awaiting inputs', percent: 0 };
  if (concentration < 2) return { label: 'Diluted', percent: 22 };
  if (concentration <= 5) return { label: 'Standard', percent: 48 };
  if (concentration <= 10) return { label: 'Concentrated', percent: 72 };
  return { label: 'Highly concentrated', percent: 100 };
}

function valueOrDash(value: string): string {
  return value.trim() || '--';
}
