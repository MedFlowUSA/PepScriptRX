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

  usePageMeta(
    `${brandName} Label Math Calculator`,
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
              <div className="precisionmix-kicker">Arithmetic tool</div>
              <h1>Provider-label math calculator</h1>
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
                Accept and open arithmetic tool
              </button>
            </section>
          ) : (
            <section className="precisionmix-panel mixing-card" aria-labelledby="calculator-title">
              <div className="precisionmix-panel-head">
                <span id="calculator-title">Enter written label values</span>
                <small>No field is prefilled. The platform does not select or infer these values.</small>
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
                />
                <NumberField
                  id="diluent-volume"
                  label="Diluent volume stated in instructions (mL)"
                  value={diluentVolumeMl}
                  onChange={setDiluentVolumeMl}
                  max={100}
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
                </label>
              </div>

              <div className="precisionmix-output-disclaimer" role="note">
                Arithmetic only. This output is not a dose, frequency, route, injection, preparation, storage, or treatment recommendation.
              </div>

              {result ? (
                <div className="precisionmix-metrics" aria-live="polite">
                  <Metric label="Calculated concentration" value={`${format(result.concentrationMgPerMl, 4)} mg/mL`} />
                  <Metric label="Calculated volume" value={`${format(result.drawVolumeMl, 4)} mL`} />
                  <Metric label="U-100 scale conversion" value={`${format(result.u100Units, 2)} units`} />
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

function NumberField({ id, label, value, onChange, max }: { id: string; label: string; value: string; onChange: (value: string) => void; max: number }) {
  return (
    <label className="precisionmix-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" inputMode="decimal" min="0" max={max} step="any" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="precisionmix-metric"><span>{label}</span><strong>{value}</strong></div>;
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
