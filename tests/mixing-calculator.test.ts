import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLabelArithmetic } from '../src/lib/mixingCalculator.ts';

test('converts mg label values to concentration, volume, and U-100 scale units', () => {
  const result = calculateLabelArithmetic({ vialStrengthMg: '10', diluentVolumeMl: '2', prescribedAmount: '0.5', prescribedUnit: 'mg' });
  assert.deepEqual(result, {
    prescribedAmountMg: 0.5,
    prescribedAmountMcg: 500,
    concentrationMgPerMl: 5,
    concentrationMcgPerMl: 5000,
    amountMgPerU100Unit: 0.05,
    amountMcgPerU100Unit: 50,
    drawVolumeMl: 0.1,
    u100Units: 10,
  });
});

test('converts micrograms without changing the prescribed amount', () => {
  const result = calculateLabelArithmetic({ vialStrengthMg: '10', diluentVolumeMl: '2', prescribedAmount: '500', prescribedUnit: 'mcg' });
  assert.equal(result?.u100Units, 10);
  assert.equal(result?.prescribedAmountMg, 0.5);
  assert.equal(result?.prescribedAmountMcg, 500);
});

for (const value of ['', '0', '-1', 'NaN', 'Infinity']) {
  test(`rejects invalid vial strength: ${value || 'blank'}`, () => {
    assert.equal(calculateLabelArithmetic({ vialStrengthMg: value, diluentVolumeMl: '2', prescribedAmount: '1', prescribedUnit: 'mg' }), null);
  });
}

test('rejects excessive values and protects maximum output', () => {
  assert.equal(calculateLabelArithmetic({ vialStrengthMg: '10001', diluentVolumeMl: '2', prescribedAmount: '1', prescribedUnit: 'mg' }), null);
  assert.equal(calculateLabelArithmetic({ vialStrengthMg: '1', diluentVolumeMl: '100', prescribedAmount: '11', prescribedUnit: 'mg' }), null);
});

test('preserves fractional arithmetic for presentation-layer rounding', () => {
  const result = calculateLabelArithmetic({ vialStrengthMg: '7', diluentVolumeMl: '2', prescribedAmount: '0.1', prescribedUnit: 'mg' });
  assert.ok(result);
  assert.equal(result.u100Units, 2.857142857142857);
});
