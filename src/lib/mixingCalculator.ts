export type MixingUnit = 'mcg' | 'mg';

export type MixingInputs = {
  vialStrengthMg: string;
  diluentVolumeMl: string;
  prescribedAmount: string;
  prescribedUnit: MixingUnit;
};

export type MixingResult = {
  concentrationMgPerMl: number;
  drawVolumeMl: number;
  u100Units: number;
};

const LIMITS = {
  vialStrengthMg: 10_000,
  diluentVolumeMl: 100,
  prescribedAmountMg: 10_000,
  u100Units: 1_000,
};

export function calculateLabelArithmetic(inputs: MixingInputs): MixingResult | null {
  const vialStrengthMg = parseBoundedPositive(inputs.vialStrengthMg, LIMITS.vialStrengthMg);
  const diluentVolumeMl = parseBoundedPositive(inputs.diluentVolumeMl, LIMITS.diluentVolumeMl);
  const prescribedInput = parseBoundedPositive(inputs.prescribedAmount, LIMITS.prescribedAmountMg * 1_000);
  if (vialStrengthMg == null || diluentVolumeMl == null || prescribedInput == null) return null;

  const prescribedAmountMg = inputs.prescribedUnit === 'mcg' ? prescribedInput / 1_000 : prescribedInput;
  if (prescribedAmountMg > LIMITS.prescribedAmountMg) return null;

  const concentrationMgPerMl = vialStrengthMg / diluentVolumeMl;
  const drawVolumeMl = prescribedAmountMg / concentrationMgPerMl;
  const u100Units = drawVolumeMl * 100;
  if (![concentrationMgPerMl, drawVolumeMl, u100Units].every(Number.isFinite) || u100Units > LIMITS.u100Units) return null;

  return { concentrationMgPerMl, drawVolumeMl, u100Units };
}

function parseBoundedPositive(value: string, maximum: number): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

