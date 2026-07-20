import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { REP_INTAKE_PRODUCTS } from '../../data/repIntakeCatalog';
import { usePageMeta } from '../../hooks/usePageMeta';
import { calculateLabelArithmetic, type MixingUnit } from '../../lib/mixingCalculator';
import { mixingProductSlug } from '../../lib/mixingCenter';

type PeptideCalculatorProps = { portalKey?: string };

export default function PeptideCalculator({ portalKey }: PeptideCalculatorProps = {}) {
  const { productSlug } = useParams<{ productSlug?: string }>();
  const portal = portalKey ? getWhiteLabelPortal(portalKey) : null;
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const linkedProduct = useMemo(() => findLinkedProduct(productSlug), [productSlug]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [vialStrengthMg, setVialStrengthMg] = useState('');
  const [diluentVolumeMl, setDiluentVolumeMl] = useState('');
  const [prescribedAmount, setPrescribedAmount] = useState('');
  const [prescribedUnit, setPrescribedUnit] = useState<MixingUnit>('mg');

  const result = useMemo(() => calculateLabelArithmetic({
    vialStrengthMg,
    diluentVolumeMl,
    prescribedAmount,
    prescribedUnit,
  }), [diluentVolumeMl, prescribedAmount, prescribedUnit, vialStrengthMg]);
  const inputStatus = getInputStatus(vialStrengthMg, diluentVolumeMl, prescribedAmount, result);

  const resetCalculator = () => {
    setVialStrengthMg('');
    setDiluentVolumeMl('');
    setPrescribedAmount('');
    setPrescribedUnit('mg');
  };

  usePageMeta(
    `${brandName} Mixing Calculator`,
    'Arithmetic-only unit conversion using values supplied on a provider instruction sheet or pharmacy label.',
  );

  return (
    <PublicLayout
      isolatedPortal={Boolean(portal)}
      portalHomePath={portal?.path}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
      portalKey={portal?.id}
    >
      <main className="precisionmix-page mixing-center-page">
        <div className="container container-md">
          <header className="precisionmix-hero mixing-center-hero">
            <div>
              <div className="precisionmix-kicker">Mixing calculator</div>
              <h1>Mixing Calculator</h1>
              <p>
                This tool only converts values you enter from written provider instructions or a dispensing-pharmacy label.
                It does not provide mixing directions, choose a dose, or recommend how any product should be used.
              </p>
            </div>
          </header>

          {!acknowledged ? (
            <section className="precisionmix-panel mixing-card" aria-labelledby="calculator-ack-title">
              <h2 id="calculator-ack-title">Before using the calculator</h2>
              <p>
                Obtain the vial strength, diluent volume, and prescribed amount from your provider or dispensing pharmacy.
                If any value or instruction is unclear, stop and contact them before continuing.
              </p>
              <label className="precisionmix-ack" htmlFor="calculator-acknowledgment">
                <input
                  id="calculator-acknowledgment"
                  type="checkbox"
                  checked={ackChecked}
                  onChange={(event) => setAckChecked(event.target.checked)}
                />
                <span>I will enter only values from my written provider instructions or pharmacy label and independently verify the result.</span>
              </label>
              <button className="btn btn-primary" type="button" disabled={!ackChecked} onClick={() => setAcknowledged(true)}>
                Accept and open Mixing Calculator
              </button>
            </section>
          ) : (
            <section className="precisionmix-panel mixing-card" aria-labelledby="calculator-title">
              <div className="precisionmix-panel-head">
                <span id="calculator-title">Enter written label values</span>
                <small>No field is prefilled. The platform does not select or infer these values.</small>
              </div>

              <div className="label-math-source-grid" aria-label="Where to find each value">
                <InfoCard title="1. Vial strength" body="Copy the total amount printed on the vial, expressed in mg. Do not use a concentration value here." />
                <InfoCard title="2. Diluent volume" body="Copy the final diluent volume stated in the written preparation directions. Do not choose a volume yourself." />
                <InfoCard title="3. Written amount" body="Copy the prescribed amount and select the exact unit—mg or mcg. The unit choice changes the arithmetic." />
              </div>

              {linkedProduct ? (
                <p className="disclaimer">
                  Opened from the educational entry for <strong>{linkedProduct.productName}</strong>. Confirm the exact product and strength on your own label.
                </p>
              ) : null}

              <div className="mixing-mobile-stack">
                <NumberField
                  id="vial-strength"
                  label="Total vial strength from label (mg)"
                  value={vialStrengthMg}
                  onChange={setVialStrengthMg}
                  max={10000}
                  hint="Example label format: total amount in one vial — not a suggested value."
                />
                <NumberField
                  id="diluent-volume"
                  label="Diluent volume stated in instructions (mL)"
                  value={diluentVolumeMl}
                  onChange={setDiluentVolumeMl}
                  max={100}
                  hint="Use only the volume explicitly written by the pharmacy or provider."
                />
                <label className="precisionmix-field" htmlFor="prescribed-amount">
                  <span>Amount stated in written instructions</span>
                  <div className="precisionmix-input-row">
                    <input
                      id="prescribed-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="10000000"
                      step="any"
                      value={prescribedAmount}
                      onChange={(event) => setPrescribedAmount(event.target.value)}
                    />
                    <select aria-label="Written amount unit" value={prescribedUnit} onChange={(event) => setPrescribedUnit(event.target.value as MixingUnit)}>
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                    </select>
                  </div>
                  <small>Confirm whether the written amount says mg or mcg; 1 mg equals 1,000 mcg.</small>
                </label>
              </div>

              <div className="label-math-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetCalculator}>Clear all values</button>
                <span>{inputStatus}</span>
              </div>

              <div className="precisionmix-output-disclaimer" role="note">
                Arithmetic only. This output is not a dose, frequency, route, injection, preparation, storage, or treatment recommendation.
              </div>

              {result ? (
                <div className="label-math-results" aria-live="polite">
                  <div className="precisionmix-metrics">
                    <Metric label="Concentration" value={`${format(result.concentrationMgPerMl, 4)} mg/mL`} subvalue={`${format(result.concentrationMcgPerMl, 2)} mcg/mL`} />
                    <Metric label="Calculated volume" value={`${format(result.drawVolumeMl, 4)} mL`} subvalue="Volume produced by the entered values" />
                    <Metric label="U-100 scale equivalent" value={`${format(result.u100Units, 2)} units`} subvalue="Mathematical scale conversion only" />
                    <Metric label="Amount per U-100 unit" value={`${format(result.amountMcgPerU100Unit, 4)} mcg`} subvalue={`${format(result.amountMgPerU100Unit, 6)} mg per scale unit`} />
                  </div>

                  <section className="label-math-breakdown" aria-labelledby="math-breakdown-title">
                    <h2 id="math-breakdown-title">How the result was calculated</h2>
                    <MathStep number="1" title="Normalize the written amount" formula={prescribedUnit === 'mcg'
                      ? `${format(Number(prescribedAmount), 6)} mcg ÷ 1,000 = ${format(result.prescribedAmountMg, 6)} mg`
                      : `${format(result.prescribedAmountMg, 6)} mg = ${format(result.prescribedAmountMcg, 4)} mcg`} />
                    <MathStep number="2" title="Calculate concentration" formula={`${format(Number(vialStrengthMg), 6)} mg ÷ ${format(Number(diluentVolumeMl), 6)} mL = ${format(result.concentrationMgPerMl, 6)} mg/mL`} />
                    <MathStep number="3" title="Calculate volume" formula={`${format(result.prescribedAmountMg, 6)} mg ÷ ${format(result.concentrationMgPerMl, 6)} mg/mL = ${format(result.drawVolumeMl, 6)} mL`} />
                    <MathStep number="4" title="Convert mL to a U-100 scale" formula={`${format(result.drawVolumeMl, 6)} mL × 100 = ${format(result.u100Units, 4)} scale units`} />
                  </section>

                  <section className="label-math-checklist" aria-labelledby="verification-checklist-title">
                    <h2 id="verification-checklist-title">Verify before relying on this arithmetic</h2>
                    <ul>
                      <li>The vial name and total strength match the written instructions.</li>
                      <li>The diluent volume is copied from explicit preparation directions.</li>
                      <li>The prescribed amount and mg/mcg unit match exactly.</li>
                      <li>Your pharmacist or provider confirms any ambiguous, rounded, or unexpected result.</li>
                    </ul>
                    <p>Do not use this screen as a substitute for the original label. Save or reference the written instructions when asking a pharmacist to verify the calculation.</p>
                  </section>
                </div>
              ) : (
                <p className="precisionmix-warning" aria-live="polite">
                  Enter three positive values within the displayed limits to calculate. Zero, negative, non-numeric, and excessive values are rejected.
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

function NumberField({ id, label, value, onChange, max, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; max: number; hint: string }) {
  return (
    <label className="precisionmix-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" inputMode="decimal" min="0" max={max} step="any" value={value} onChange={(event) => onChange(event.target.value)} />
      <small>{hint}</small>
    </label>
  );
}

function Metric({ label, value, subvalue }: { label: string; value: string; subvalue: string }) {
  return <div className="precisionmix-metric"><span>{label}</span><strong>{value}</strong><small>{subvalue}</small></div>;
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return <div className="label-math-info-card"><strong>{title}</strong><p>{body}</p></div>;
}

function MathStep({ number, title, formula }: { number: string; title: string; formula: string }) {
  return <div className="label-math-step"><span>{number}</span><div><strong>{title}</strong><code>{formula}</code></div></div>;
}

function getInputStatus(vial: string, volume: string, amount: string, result: unknown) {
  const completed = [vial, volume, amount].filter((value) => value.trim()).length;
  if (result) return 'Calculation complete — independently verify all three source values.';
  if (completed === 0) return 'Waiting for three written values.';
  if (completed < 3) return `${completed} of 3 written values entered.`;
  return 'One or more values are outside the accepted positive range.';
}

function findLinkedProduct(productSlug?: string) {
  if (!productSlug) return null;
  const normalized = normalize(productSlug);
  return REP_INTAKE_PRODUCTS.find((product) => (
    normalize(product.id) === normalized
    || normalize(product.productName) === normalized
    || normalize(mixingProductSlug({ id: product.id, name: product.productName })) === normalized
  )) ?? null;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function format(value: number, decimals: number) {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}
